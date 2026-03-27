import { Admin, ConfigResourceTypes, Consumer, stringDeserializers, ListOffsetTimestamps, MessagesStreamModes } from '@platformatic/kafka';
import type { ConnectionOptions } from 'node:tls';

export type ConfigResourceType = 'UNKNOWN' | 'TOPIC' | 'BROKER' | 'BROKER_LOGGER';

export function resourceParser(resource: string): ConfigResourceType {
  if (/^any$/i.test(resource)) {
    return 'UNKNOWN';
  }
  if (/^topic$/i.test(resource)) {
    return 'TOPIC';
  }
  if (/^broker$/i.test(resource)) {
    return 'BROKER';
  }
  if (/^broker_logger$/i.test(resource)) {
    return 'BROKER_LOGGER';
  }
  if (/^logger$/i.test(resource)) {
    return 'BROKER_LOGGER';
  }
  return 'UNKNOWN';
}

export function resourceTypeToNumber(type: ConfigResourceType): (typeof ConfigResourceTypes)[keyof typeof ConfigResourceTypes] {
  return ConfigResourceTypes[type] ?? ConfigResourceTypes.UNKNOWN;
}

export interface GlobalOptions {
  brokers: string;
  timeout: number;
  ssl: boolean;
  insecure?: boolean;
  mechanism?: string;
  username?: string;
  password?: string;
  oauthBearer?: string;
}

export interface CommandContext {
  parent: { opts(): GlobalOptions };
}

export interface SASLConfig {
  mechanism: 'PLAIN' | 'SCRAM-SHA-256' | 'SCRAM-SHA-512' | 'OAUTHBEARER';
  username?: string;
  password?: string;
  token?: string;
}

export function getSASL({
  mechanism,
  username,
  password,
  oauthBearer,
}: Pick<GlobalOptions, 'mechanism' | 'username' | 'password' | 'oauthBearer'>): SASLConfig | undefined {
  switch (mechanism) {
    case 'plain':
      return { mechanism: 'PLAIN', username, password };
    case 'scram-sha-256':
      return { mechanism: 'SCRAM-SHA-256', username, password };
    case 'scram-sha-512':
      return { mechanism: 'SCRAM-SHA-512', username, password };
    case 'oauthbearer':
      return { mechanism: 'OAUTHBEARER', token: oauthBearer };
    default:
      return undefined;
  }
}

export function getClientConfig(bootstrapServer: string, ssl: boolean, sasl?: SASLConfig, insecure = false) {
  const config: {
    clientId: string;
    bootstrapBrokers: string[];
    tls?: ConnectionOptions;
    sasl?: SASLConfig;
  } = {
    clientId: 'Kafka CLI',
    bootstrapBrokers: bootstrapServer.split(','),
  };

  if (ssl) {
    config.tls = { rejectUnauthorized: !insecure };
  }

  if (sasl) {
    config.sasl = sasl;
  }

  return config;
}

export function getClientConfigFromOpts(opts: GlobalOptions) {
  const sasl = getSASL(opts);
  return getClientConfig(opts.brokers, opts.ssl, sasl, opts.insecure);
}

export async function fetchTopicOffsets(
  config: ReturnType<typeof getClientConfig>,
  topic: string,
): Promise<{ partition: number; offset: string; high: string; low: string }[]> {
  const consumer = new Consumer({
    ...config,
    groupId: `kafka-cli-offsets-${Date.now()}`,
    deserializers: stringDeserializers,
  });

  try {
    const [earliestMap, latestMap] = await Promise.all([
      consumer.listOffsets({ topics: [topic], timestamp: ListOffsetTimestamps.EARLIEST }),
      consumer.listOffsets({ topics: [topic], timestamp: ListOffsetTimestamps.LATEST }),
    ]);

    const earliest = earliestMap.get(topic) || [];
    const latest = latestMap.get(topic) || [];

    const result: { partition: number; offset: string; high: string; low: string }[] = [];
    for (let partition = 0; partition < latest.length; partition++) {
      result.push({
        partition,
        offset: latest[partition].toString(),
        high: latest[partition].toString(),
        low: (earliest[partition] || BigInt(0)).toString(),
      });
    }

    return result;
  } finally {
    await consumer.close();
  }
}

export async function fetchTopicOffsetsByTimestamp(
  config: ReturnType<typeof getClientConfig>,
  topic: string,
  timestamp: number,
): Promise<{ partition: number; offset: string }[]> {
  const consumer = new Consumer({
    ...config,
    groupId: `kafka-cli-offsets-${Date.now()}`,
    deserializers: stringDeserializers,
  });

  try {
    const offsetsMap = await consumer.listOffsets({ topics: [topic], timestamp: BigInt(timestamp) });

    const offsets = offsetsMap.get(topic) || [];
    return offsets.map((offset, partition) => ({ partition, offset: offset.toString() }));
  } finally {
    await consumer.close();
  }
}

export async function resolveConsumeMode(
  consumer: { listOffsets: InstanceType<typeof Consumer>['listOffsets'] },
  topic: string,
  from: string | undefined,
): Promise<{
  mode: (typeof MessagesStreamModes)[keyof typeof MessagesStreamModes];
  offsets?: { topic: string; partition: number; offset: bigint }[];
}> {
  if (!from || from === '0') {
    return { mode: from === '0' ? MessagesStreamModes.EARLIEST : MessagesStreamModes.LATEST };
  }

  const ts = /^\d+$/.test(from) ? parseInt(from, 10) : Date.parse(from);
  if (Number.isNaN(ts)) {
    throw new Error(`Invalid timestamp "${from}"`);
  }

  const offsetsMap = await consumer.listOffsets({ topics: [topic], timestamp: BigInt(ts) });
  const partitionOffsets = offsetsMap.get(topic);
  if (!partitionOffsets) {
    return { mode: MessagesStreamModes.LATEST };
  }

  const offsets: { topic: string; partition: number; offset: bigint }[] = [];
  for (let partition = 0; partition < partitionOffsets.length; partition++) {
    offsets.push({ topic, partition, offset: partitionOffsets[partition] });
  }
  return { mode: MessagesStreamModes.MANUAL, offsets };
}

export async function fetchConsumerGroupOffsets(
  config: ReturnType<typeof getClientConfig>,
  groupId: string,
  topics: string[],
): Promise<{ topic: string; partitions: { partition: number; offset: string }[] }[]> {
  const admin = new Admin(config);
  let meta;
  try {
    meta = await admin.metadata({ topics });
  } finally {
    await admin.close();
  }

  const topicAssignments: { topic: string; partitions: number[] }[] = [];
  for (const topic of topics) {
    const topicMeta = meta.topics.get(topic);
    const partitionCount = topicMeta?.partitions.length ?? 0;
    topicAssignments.push({
      topic,
      partitions: Array.from({ length: partitionCount }, (_, i) => i),
    });
  }

  const consumer = new Consumer({
    ...config,
    groupId,
    deserializers: stringDeserializers,
  });

  try {
    const offsetsMap = await consumer.listCommittedOffsets({ topics: topicAssignments });

    const result: { topic: string; partitions: { partition: number; offset: string }[] }[] = [];
    for (const topic of topics) {
      const offsets = offsetsMap.get(topic) || [];
      result.push({
        topic,
        partitions: offsets.map((offset: bigint, partition: number) => ({ partition, offset: offset.toString() })),
      });
    }

    return result;
  } finally {
    await consumer.close();
  }
}
