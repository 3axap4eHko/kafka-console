import {
  ConsumerConfig,
  Kafka,
  KafkaConfig,
  EachMessagePayload,
  SASLMechanism,
  logLevel,
  ConsumerSubscribeTopic,
  Message, PartitionMetadata, Cluster, ResourceTypes, IHeaders, OauthbearerProviderResponse,
} from 'kafkajs';
import Pool from './pool';

export interface EncoderOptions {
  headers: IHeaders;
  key: string;
  value: any;
}

export interface MessageEncoder {
  (message: EncoderOptions): Promise<Message> | Message;
}

export interface Encoder {
  (value: any): Promise<string | Buffer> | string | Buffer;
}

export interface Decoder {
  (payload: EachMessagePayload): Promise<any> | any;
}

export function logLevelParser(level: string) {
  if (/error/.test(level)) {
    return logLevel.ERROR;
  }
  if (/warn/.test(level)) {
    return logLevel.WARN;
  }
  if (/info/.test(level)) {
    return logLevel.INFO;
  }
  if (/debug/.test(level)) {
    return logLevel.DEBUG;
  }
  return logLevel.NOTHING;
}

export function resourceParser(resource: string) {
  if (/^any$/i.test(resource)) {
    return ResourceTypes.ANY;
  }
  if (/^topic$/i.test(resource)) {
    return ResourceTypes.TOPIC;
  }
  if (/^group$/i.test(resource)) {
    return ResourceTypes.GROUP;
  }
  if (/^cluster$/i.test(resource)) {
    return ResourceTypes.CLUSTER;
  }
  if (/^transactional.?id$/i.test(resource)) {
    return ResourceTypes.TRANSACTIONAL_ID;
  }
  if (/^delegation.?token$/i.test(resource)) {
    return ResourceTypes.DELEGATION_TOKEN;
  }
  return ResourceTypes.UNKNOWN;
}

interface BrokerMetadata {
  nodeId: number;
  host: string;
  port: number;
  rack: any;
}

interface TopicMetadata {
  topicErrorCode: number;
  topic: string;
  isInternal: boolean;
  partitionMetadata: PartitionMetadata[];
}

interface Metadata {
  throttleTime: number;
  brokers: BrokerMetadata[],
  clusterId: string;
  controllerId: number;
  topicMetadata: [TopicMetadata]
}

interface KafkaCluster extends Cluster {
  metadata(): Metadata;
}

const SASLMap = {
  'plain': (username: string, password: string) => ({ username, password }),
  'scram-sha-256': (username: string, password: string) => ({ username, password }),
  'scram-sha-512': (username: string, password: string) => ({ username, password }),
};

function getSASL(mechanism: SASLMechanism, ...args: string[]) {
  if (!mechanism) {
    return null;
  }
  if (mechanism in SASLMap) {
    return (SASLMap as any)[mechanism](...args);
  }
  throw new Error(`SASL mechanism ${mechanism} is not supported`);
}

export function createClient(bootstrapServer: string, ssl: boolean, mechanism: SASLMechanism, username: string, password: string, level: string) {

  const options: KafkaConfig = {
    clientId: 'Kafka CLI',
    brokers: bootstrapServer.split(','),
    ssl,
    logLevel: logLevelParser(level),
    sasl: getSASL(mechanism, username, password),
  };
  return new Kafka(options);
}

export async function createCluster(client: Kafka): Promise<KafkaCluster> {
  const createClusterKey = Reflect.ownKeys(client).find(key => /createCluster/.test(key.toString()));
  const createCluster = Reflect.get(client, createClusterKey) as (options: any) => KafkaCluster;
  const cluster = createCluster({});
  await cluster.connect();
  return cluster;
}

export async function createAdmin(client: Kafka) {
  const admin = client.admin();
  await admin.connect();
  return admin;
}

export async function createConsumer(client: Kafka, group: string, topic: string, fromBeginning: boolean = false) {
  const consumerConfig: ConsumerConfig = {
    groupId: group,
  };

  const consumerOptions: ConsumerSubscribeTopic = {
    topic,
    fromBeginning,
  };

  const consumer = client.consumer(consumerConfig);
  await consumer.connect();
  await consumer.subscribe(consumerOptions);

  const pool = new Pool<EachMessagePayload>();
  pool.onDone(() => {
    consumer.disconnect();
  });

  consumer.run({
    eachMessage: async (payload) => {
      pool.push(payload);
    },
  }).catch(e => console.error(e));

  return pool;
}

export async function createProducer(client: Kafka, topic: string) {
  const producer = client.producer();
  await producer.connect();

  const pool = new Pool<Message>();
  pool.onDone(() => {
    producer.disconnect();
  });

  (async () => {
    for await (let message of pool) {
      await producer.send({
        topic,
        messages: [message],
      });
    }
  })().catch(e => console.error(e));


  return pool;
}
