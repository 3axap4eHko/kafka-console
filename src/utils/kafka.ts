import {
  adminClient,
  ConfigResourceTypes,
  Consumer,
  Producer,
  stringSerializers,
  stringDeserializers,
  MessagesStreamModes,
  ListOffsetTimestamps,
} from '@platformatic/kafka';

const { Admin } = adminClient;
import type { ConnectionOptions } from 'node:tls';
import Pool, { PoolOptions } from './pool';

export interface EncoderOptions {
  headers: Map<string, string>;
  key: string;
  value: any;
}

export interface ProducerMessage {
  topic?: string;
  key?: string;
  value: string | Buffer;
  headers?: Map<string, string>;
}

export interface MessageEncoder {
  (message: EncoderOptions): Promise<ProducerMessage> | ProducerMessage;
}

export interface Encoder {
  (value: any): Promise<string | Buffer> | string | Buffer;
}

export interface ConsumerMessage {
  topic: string;
  partition: number;
  key: string | null;
  value: string | null;
  headers: Map<string, string>;
  timestamp: bigint;
  offset: bigint;
  high: bigint;
}

export interface Decoder {
  (payload: ConsumerMessage): Promise<any> | any;
}

type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'nothing';

export function logLevelParser(level: string): LogLevel {
  if (/error/.test(level)) {
    return 'error';
  }
  if (/warn/.test(level)) {
    return 'warn';
  }
  if (/info/.test(level)) {
    return 'info';
  }
  if (/debug/.test(level)) {
    return 'debug';
  }
  return 'nothing';
}

type ConfigResourceType = 'UNKNOWN' | 'TOPIC' | 'BROKER' | 'BROKER_LOGGER';

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

export function resourceTypeToNumber(type: ConfigResourceType): typeof ConfigResourceTypes[keyof typeof ConfigResourceTypes] {
  return ConfigResourceTypes[type] ?? ConfigResourceTypes.UNKNOWN;
}

interface BrokerMetadata {
  nodeId: number;
  host: string;
  port: number;
  rack: any;
}

interface PartitionMetadata {
  partitionErrorCode: number;
  partitionId: number;
  leader: number;
  replicas: number[];
  isr: number[];
}

interface TopicMetadata {
  topicErrorCode: number;
  topic: string;
  isInternal: boolean;
  partitionMetadata: PartitionMetadata[];
}

interface Metadata {
  throttleTime: number;
  brokers: BrokerMetadata[];
  clusterId: string;
  controllerId: number;
  topicMetadata: TopicMetadata[];
}

type SASLMechanism = 'plain' | 'scram-sha-256' | 'scram-sha-512' | 'oauthbearer' | 'aws';

export interface CLISASLOptions {
  mechanism: SASLMechanism;
  username?: string;
  password?: string;
  authorizationIdentity?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  oauthBearer?: string;
}

interface SASLConfig {
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
}: CLISASLOptions): SASLConfig | undefined {
  switch (mechanism) {
    case 'plain':
      return { mechanism: 'PLAIN', username, password };
    case 'scram-sha-256':
      return { mechanism: 'SCRAM-SHA-256', username, password };
    case 'scram-sha-512':
      return { mechanism: 'SCRAM-SHA-512', username, password };
    case 'oauthbearer':
      return { mechanism: 'OAUTHBEARER', token: oauthBearer };
    case 'aws':
      throw new Error('AWS SASL mechanism is not supported by @platformatic/kafka');
    default:
      return undefined;
  }
}

export interface ClientOptions {
  brokers: string;
  ssl: boolean;
  sasl?: SASLConfig;
  logLevel: string; // kept for CLI compatibility, not used by platformatic/kafka
}

function getClientConfig(bootstrapServer: string, ssl: boolean, sasl?: SASLConfig) {
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
    config.tls = { rejectUnauthorized: false };
  }

  if (sasl) {
    config.sasl = sasl;
  }

  return config;
}

export function createClient(bootstrapServer: string, ssl: boolean, sasl: SASLConfig | undefined, _level: string): ClientOptions {
  return { brokers: bootstrapServer, ssl, sasl, logLevel: _level };
}

export async function createAdmin(client: ClientOptions): Promise<InstanceType<typeof Admin>> {
  const config = getClientConfig(client.brokers, client.ssl, client.sasl);
  return new Admin(config);
}

export async function createCluster(client: ClientOptions): Promise<{ metadata: () => Promise<Metadata>; disconnect: () => Promise<void> }> {
  const admin = await createAdmin(client);
  return {
    async metadata(): Promise<Metadata> {
      const meta = await admin.metadata({ topics: [] });
      const brokers: BrokerMetadata[] = [];
      for (const [nodeId, broker] of meta.brokers) {
        brokers.push({ nodeId, host: broker.host, port: broker.port, rack: null });
      }
      const topicMetadata: TopicMetadata[] = [];
      for (const [topicName, topicMeta] of meta.topics) {
        const partitionMetadata: PartitionMetadata[] = [];
        for (let partitionId = 0; partitionId < topicMeta.partitions.length; partitionId++) {
          const partition = topicMeta.partitions[partitionId];
          partitionMetadata.push({
            partitionErrorCode: 0,
            partitionId,
            leader: partition.leader,
            replicas: partition.replicas,
            isr: [], // platformatic/kafka metadata doesn't include ISR
          });
        }
        topicMetadata.push({
          topicErrorCode: 0,
          topic: topicName,
          isInternal: topicName.startsWith('__'),
          partitionMetadata,
        });
      }
      return {
        throttleTime: 0,
        brokers,
        clusterId: meta.id,
        controllerId: brokers[0]?.nodeId ?? 0,
        topicMetadata,
      };
    },
    async disconnect() {
      await admin.close();
    },
  };
}

export async function createConsumer(client: ClientOptions, group: string, topic: string, from?: string, poolOptions: PoolOptions = {}) {
  const config = getClientConfig(client.brokers, client.ssl, client.sasl);
  const consumer = new Consumer({
    ...config,
    groupId: group,
    deserializers: stringDeserializers,
    autocommit: true,
  });

  let mode: typeof MessagesStreamModes[keyof typeof MessagesStreamModes] = MessagesStreamModes.LATEST;
  let offsets: { topic: string; partition: number; offset: bigint }[] | undefined;

  if (from === '0') {
    mode = MessagesStreamModes.EARLIEST;
  } else if (from) {
    const timestamp = /^\d+$/.test(from)
      ? new Date(parseInt(from, 10)).getTime()
      : Date.parse(from);

    if (Number.isNaN(timestamp)) {
      throw new Error(`Invalid timestamp "${from}"`);
    }

    const offsetsMap = await consumer.listOffsets({ topics: [topic], timestamp: BigInt(timestamp) });
    const partitionOffsets = offsetsMap.get(topic);
    if (partitionOffsets) {
      offsets = [];
      for (let partition = 0; partition < partitionOffsets.length; partition++) {
        offsets.push({ topic, partition, offset: partitionOffsets[partition] });
      }
      mode = MessagesStreamModes.MANUAL;
    }
  }

  const consumeOptions: Parameters<typeof consumer.consume>[0] = {
    topics: [topic],
    mode,
    sessionTimeout: 30000,
    heartbeatInterval: 1000,
  };

  if (offsets) {
    consumeOptions.offsets = offsets;
  }

  const stream = await consumer.consume(consumeOptions);

  const latestMap = await consumer.listOffsets({ topics: [topic], timestamp: ListOffsetTimestamps.LATEST });
  const highWatermarks = latestMap.get(topic) || [];

  const pool = new Pool<ConsumerMessage>([], poolOptions);

  (async () => {
    for await (const message of stream) {
      pool.push({
        topic: message.topic,
        partition: message.partition,
        key: message.key,
        value: message.value,
        headers: message.headers,
        timestamp: message.timestamp,
        offset: message.offset,
        high: highWatermarks[message.partition] ?? message.offset,
      });
    }
  })().catch(e => console.error(e));

  pool.onDone(async () => {
    await stream.close();
    await consumer.close();
  });

  return pool;
}

export async function createProducer(client: ClientOptions, topic: string) {
  const config = getClientConfig(client.brokers, client.ssl, client.sasl);
  const producer = new Producer({
    ...config,
    serializers: stringSerializers,
  });

  const pool = new Pool<ProducerMessage>();
  pool.onDone(async () => {
    await producer.close();
  });

  (async () => {
    for await (const message of pool) {
      await producer.send({
        messages: [{
          topic,
          key: message.key,
          value: message.value.toString(),
          headers: message.headers,
        }],
      });
    }
  })().catch(e => console.error(e));

  return pool;
}

export async function fetchTopicOffsets(client: ClientOptions, topic: string): Promise<{ partition: number; offset: string; high: string; low: string }[]> {
  const config = getClientConfig(client.brokers, client.ssl, client.sasl);
  const consumer = new Consumer({
    ...config,
    groupId: `kafka-cli-offsets-${Date.now()}`,
    deserializers: stringDeserializers,
  });

  const [earliestMap, latestMap] = await Promise.all([
    consumer.listOffsets({ topics: [topic], timestamp: ListOffsetTimestamps.EARLIEST }),
    consumer.listOffsets({ topics: [topic], timestamp: ListOffsetTimestamps.LATEST }),
  ]);

  await consumer.close();

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
}

export async function fetchTopicOffsetsByTimestamp(client: ClientOptions, topic: string, timestamp: number): Promise<{ partition: number; offset: string }[]> {
  const config = getClientConfig(client.brokers, client.ssl, client.sasl);
  const consumer = new Consumer({
    ...config,
    groupId: `kafka-cli-offsets-${Date.now()}`,
    deserializers: stringDeserializers,
  });

  const offsetsMap = await consumer.listOffsets({ topics: [topic], timestamp: BigInt(timestamp) });
  await consumer.close();

  const offsets = offsetsMap.get(topic) || [];
  return offsets.map((offset, partition) => ({ partition, offset: offset.toString() }));
}

export async function fetchConsumerGroupOffsets(client: ClientOptions, groupId: string, topics: string[]): Promise<{ topic: string; partitions: { partition: number; offset: string }[] }[]> {
  const config = getClientConfig(client.brokers, client.ssl, client.sasl);

  const admin = new Admin(config);
  const meta = await admin.metadata({ topics });
  await admin.close();

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

  const offsetsMap = await consumer.listCommittedOffsets({ topics: topicAssignments });
  await consumer.close();

  const result: { topic: string; partitions: { partition: number; offset: string }[] }[] = [];
  for (const topic of topics) {
    const offsets = offsetsMap.get(topic) || [];
    result.push({
      topic,
      partitions: offsets.map((offset: bigint, partition: number) => ({ partition, offset: offset.toString() })),
    });
  }

  return result;
}
