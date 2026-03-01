/* eslint-disable no-console */
const { Kafka, CompressionTypes, logLevel } = require('kafkajs');
const KafkaRDKafka = require('node-rdkafka');
const { Producer: PlatformaticProducer, Consumer: PlatformaticConsumer, CompressionAlgorithms, ProduceAcks, stringSerializers, stringDeserializers, MessagesStreamModes } = require('@platformatic/kafka');
const crypto = require('crypto');

function generatePayload(size) {
  // Simulate JSON-like data: ~50% compressible structure, ~50% random values
  const template = '{"id":"","ts":,"data":""}';
  const randomPart = crypto.randomBytes(Math.floor(size / 2)).toString('base64');
  const padding = 'x'.repeat(Math.max(0, size - template.length - randomPart.length));
  return JSON.stringify({ id: crypto.randomUUID(), ts: Date.now(), data: randomPart, pad: padding }).slice(0, size).padEnd(size, ' ');
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {
    brokers: process.env.KAFKA_BROKERS || 'localhost:9092',
    topic: `kcli-bench-${Date.now()}`,
    count: 1_000_000,
    size: 1024,
    batchSize: 1000,
    concurrency: 16,
    partitions: 12,
    acks: 1,
    rdkConsumeBatch: 1000,
    rdkFetchMinBytes: 1048576,
    rdkFetchWaitMs: 50,
    rdkMaxPartitionFetchBytes: 5242880,
    rdkQueuedMinMessages: 10000,
    rdkQueuedMaxKbytes: 102400,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--brokers') out.brokers = args[++i];
    else if (arg === '--topic') out.topic = args[++i];
    else if (arg === '--count') out.count = Number(args[++i]);
    else if (arg === '--size') out.size = Number(args[++i]);
    else if (arg === '--batch') out.batchSize = Number(args[++i]);
    else if (arg === '--concurrency') out.concurrency = Number(args[++i]);
    else if (arg === '--partitions') out.partitions = Number(args[++i]);
    else if (arg === '--acks') out.acks = Number(args[++i]);
    else if (arg === '--rdk-consume-batch') out.rdkConsumeBatch = Number(args[++i]);
    else if (arg === '--rdk-fetch-min-bytes') out.rdkFetchMinBytes = Number(args[++i]);
    else if (arg === '--rdk-fetch-wait-ms') out.rdkFetchWaitMs = Number(args[++i]);
    else if (arg === '--rdk-max-partition-fetch-bytes') out.rdkMaxPartitionFetchBytes = Number(args[++i]);
    else if (arg === '--rdk-queued-min-messages') out.rdkQueuedMinMessages = Number(args[++i]);
    else if (arg === '--rdk-queued-max-kbytes') out.rdkQueuedMaxKbytes = Number(args[++i]);
  }

  return out;
}

function elapsedMs(start) {
  const diff = process.hrtime.bigint() - start;
  return Number(diff) / 1_000_000;
}

async function ensureTopicKafkaJS(brokers, topic, partitions) {
  const kafka = new Kafka({
    clientId: 'kcli-bench-admin',
    brokers: brokers.split(','),
    logLevel: logLevel.NOTHING,
  });
  const admin = kafka.admin();
  await admin.connect();
  try {
    await admin.createTopics({
      topics: [{ topic, numPartitions: partitions }],
      waitForLeaders: true,
    });
  } catch (err) {
    // topic may already exist or auto-create is enabled
  } finally {
    await admin.disconnect();
  }
}

async function benchKafkaJSProduce({ brokers, topic, count, size, batchSize, concurrency, acks }) {
  const kafka = new Kafka({
    clientId: 'kcli-bench-producer',
    brokers: brokers.split(','),
    logLevel: logLevel.NOTHING,
  });
  const producer = kafka.producer({ allowAutoTopicCreation: true });
  await producer.connect();

  const payload = generatePayload(size);
  const start = process.hrtime.bigint();
  const inFlight = [];
  const windowSize = Math.max(1, concurrency);

  for (let i = 0; i < count; i += batchSize) {
    const messages = [];
    const end = Math.min(i + batchSize, count);
    for (let j = i; j < end; j += 1) {
      messages.push({ value: payload });
    }
    inFlight.push(producer.send({
      topic,
      messages,
      compression: CompressionTypes.GZIP,
      acks,
    }));
    if (inFlight.length >= windowSize) {
      await Promise.all(inFlight);
      inFlight.length = 0;
    }
  }

  if (inFlight.length > 0) {
    await Promise.all(inFlight);
  }

  const ms = elapsedMs(start);
  await producer.disconnect();
  return ms;
}

async function benchKafkaJSConsume({ brokers, topic, count }) {
  const kafka = new Kafka({
    clientId: 'kcli-bench-consumer',
    brokers: brokers.split(','),
    logLevel: logLevel.NOTHING,
  });
  const groupId = `kcli-bench-js-${Date.now()}`;
  const consumer = kafka.consumer({ groupId });
  await consumer.connect();
  await consumer.subscribe({ topic, fromBeginning: true });

  let firstMessageMs = null;
  let seen = 0;
  const start = process.hrtime.bigint();
  let resolveDone;
  let doneResolved = false;

  const done = new Promise((resolve, reject) => {
    resolveDone = resolve;
    consumer.run({
      autoCommit: false,
      eachBatch: async ({ batch, resolveOffset, heartbeat, isRunning, isStale }) => {
        for (const message of batch.messages) {
          if (!isRunning() || isStale()) return;
          if (firstMessageMs === null) {
            firstMessageMs = elapsedMs(start);
          }
          seen += 1;
          resolveOffset(message.offset);
          if (seen >= count && !doneResolved) {
            doneResolved = true;
            resolveDone();
            break;
          }
        }
        await heartbeat();
      },
    }).catch(reject);
  });

  await done;
  await consumer.stop();
  await consumer.disconnect();

  return { totalMs: elapsedMs(start), firstMessageMs };
}

function createRDKafkaProducer(brokers, acks) {
  return new KafkaRDKafka.Producer({
    'metadata.broker.list': brokers,
    'request.required.acks': acks,
    'dr_cb': true,
    'queue.buffering.max.messages': 1000000,
    'compression.codec': 'gzip',
  });
}

async function benchRDKafkaProduce({ brokers, topic, count, size, acks }) {
  const producer = createRDKafkaProducer(brokers, acks);
  let delivered = 0;
  let deliveryErrors = 0;

  await new Promise((resolve, reject) => {
    producer.on('ready', resolve);
    producer.on('event.error', reject);
    producer.connect();
  });

  producer.on('delivery-report', (err) => {
    if (err) {
      deliveryErrors += 1;
      return;
    }
    delivered += 1;
  });

  producer.setPollInterval(100);
  const payload = Buffer.from(generatePayload(size));
  const start = process.hrtime.bigint();

  for (let i = 0; i < count; i += 1) {
    try {
      producer.produce(topic, null, payload, null, Date.now());
    } catch (err) {
      if (err && err.code === -184) {
        await new Promise((resolve) => producer.once('drain', resolve));
        producer.produce(topic, null, payload, null, Date.now());
      } else {
        throw err;
      }
    }
  }

  await new Promise((resolve, reject) => {
    producer.flush(30_000, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });

  await new Promise((resolve) => {
    const waitStart = Date.now();
    const check = () => {
      if (delivered + deliveryErrors >= count) return resolve();
      if (Date.now() - waitStart >= 60_000) return resolve();
      setTimeout(check, 50);
    };
    check();
  });

  const ms = elapsedMs(start);
  producer.disconnect();
  return { ms, delivered, deliveryErrors };
}

async function benchRDKafkaConsume({
  brokers,
  topic,
  count,
  rdkConsumeBatch,
  rdkFetchMinBytes,
  rdkFetchWaitMs,
  rdkMaxPartitionFetchBytes,
  rdkQueuedMinMessages,
  rdkQueuedMaxKbytes,
}) {
  const groupId = `kcli-bench-rdk-${Date.now()}`;

  const consumer = new KafkaRDKafka.KafkaConsumer({
    'metadata.broker.list': brokers,
    'group.id': groupId,
    'enable.auto.commit': false,
    'auto.offset.reset': 'earliest',
    'fetch.min.bytes': rdkFetchMinBytes,
    'fetch.wait.max.ms': rdkFetchWaitMs,
    'max.partition.fetch.bytes': rdkMaxPartitionFetchBytes,
    'queued.min.messages': rdkQueuedMinMessages,
    'queued.max.messages.kbytes': rdkQueuedMaxKbytes,
  }, {});

  await new Promise((resolve, reject) => {
    consumer.on('ready', resolve);
    consumer.on('event.error', reject);
    consumer.connect();
  });

  const metadata = await new Promise((resolve, reject) => {
    consumer.getMetadata({ topic, timeout: 10000 }, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });

  const topicMeta = metadata.topics.find((t) => t.name === topic);
  if (!topicMeta) throw new Error(`Topic ${topic} not found in metadata`);

  const RD_KAFKA_OFFSET_BEGINNING = -2;
  const assignments = topicMeta.partitions.map((p) => ({
    topic,
    partition: p.id,
    offset: RD_KAFKA_OFFSET_BEGINNING,
  }));
  consumer.assign(assignments);

  let firstMessageMs = null;
  let seen = 0;
  const start = process.hrtime.bigint();
  const progressInterval = Math.max(1, Math.floor(count / 10));
  const batchSize = 5000;

  await new Promise((resolve, reject) => {
    consumer.on('event.error', reject);

    const consumeNext = () => {
      if (seen >= count) {
        consumer.disconnect();
        resolve();
        return;
      }
      consumer.consume(batchSize, (err, messages) => {
        if (err) return reject(err);
        const len = messages ? messages.length : 0;
        if (len > 0) {
          if (firstMessageMs === null) firstMessageMs = elapsedMs(start);
          seen += len;
          if (seen % progressInterval < len) {
            console.log(`node-rdkafka consume progress: ${seen}/${count}`);
          }
        }
        setImmediate(consumeNext);
      });
    };
    consumeNext();
  });
  return { totalMs: elapsedMs(start), firstMessageMs };
}

async function benchPlatformaticProduce({ brokers, topic, count, size, batchSize, acks }) {
  const producer = new PlatformaticProducer({
    clientId: 'kcli-bench-platformatic-producer',
    bootstrapBrokers: brokers.split(','),
    compression: CompressionAlgorithms.GZIP,
    serializers: stringSerializers,
  });

  const payload = generatePayload(size);
  const start = process.hrtime.bigint();

  for (let i = 0; i < count; i += batchSize) {
    const messages = [];
    const end = Math.min(i + batchSize, count);
    for (let j = i; j < end; j += 1) {
      messages.push({ topic, value: payload });
    }
    await producer.send({
      messages,
      acks: acks === 1 ? ProduceAcks.LEADER : ProduceAcks.ALL,
    });
  }

  const ms = elapsedMs(start);
  await producer.close();
  return ms;
}

async function benchPlatformaticConsume({ brokers, topic, count }) {
  const groupId = `kcli-bench-platformatic-${Date.now()}`;

  const consumer = new PlatformaticConsumer({
    clientId: 'kcli-bench-platformatic-consumer',
    bootstrapBrokers: brokers.split(','),
    groupId,
    autocommit: true,
    deserializers: stringDeserializers,
  });

  // Get earliest offsets for all partitions
  const offsetsMap = await consumer.listOffsets({ topics: [topic], timestamp: -2n });
  const offsets = [];
  const partitionOffsets = offsetsMap.get(topic);
  if (partitionOffsets) {
    for (let partition = 0; partition < partitionOffsets.length; partition++) {
      offsets.push({ topic, partition, offset: partitionOffsets[partition] });
    }
  }
  console.log(`@plt: using MANUAL mode with ${offsets.length} partitions`);

  const stream = await consumer.consume({
    topics: [topic],
    mode: MessagesStreamModes.MANUAL,
    offsets,
    sessionTimeout: 10000,
    heartbeatInterval: 500,
  });

  let firstMessageMs = null;
  let seen = 0;
  const start = process.hrtime.bigint();
  const progressInterval = Math.max(1, Math.floor(count / 10));

  const result = await new Promise((resolve, reject) => {
    stream.on('error', (err) => {
      console.error('@platformatic/kafka stream error:', err);
      reject(err);
    });

    stream.on('data', (message) => {
      if (firstMessageMs === null) {
        firstMessageMs = elapsedMs(start);
      }
      seen += 1;
      if (seen % progressInterval === 0) {
        console.log(`platformatic consume progress: ${seen}/${count}`);
      }
      if (seen >= count) {
        stream.destroy();
        resolve({ totalMs: elapsedMs(start), firstMessageMs });
      }
    });

    stream.on('end', () => {
      console.log('@platformatic/kafka stream ended');
      resolve({ totalMs: elapsedMs(start), firstMessageMs });
    });

    stream.resume();
  });

  await consumer.close(true);
  return result;
}

(async () => {
  const config = parseArgs();
  const { brokers, topic } = config;
  const jsTopic = `${topic}-js`;
  const rdkTopic = `${topic}-rdk`;
  const pltTopic = `${topic}-plt`;

  console.log('Benchmark config:', { ...config, topics: { kafkaJs: jsTopic, rdkafka: rdkTopic, platformatic: pltTopic } });
  await ensureTopicKafkaJS(brokers, jsTopic, config.partitions);
  await ensureTopicKafkaJS(brokers, rdkTopic, config.partitions);
  await ensureTopicKafkaJS(brokers, pltTopic, config.partitions);

  console.log('\nKafkaJS produce...');
  const jsProduceMs = await benchKafkaJSProduce({ ...config, topic: jsTopic });
  console.log(`KafkaJS produce: ${jsProduceMs.toFixed(1)} ms (${(config.count / (jsProduceMs / 1000)).toFixed(1)} msg/s)`);

  console.log('KafkaJS consume...');
  const jsConsume = await benchKafkaJSConsume({ ...config, topic: jsTopic });
  console.log(`KafkaJS first message: ${jsConsume.firstMessageMs.toFixed(1)} ms`);
  console.log(`KafkaJS consume: ${jsConsume.totalMs.toFixed(1)} ms (${(config.count / (jsConsume.totalMs / 1000)).toFixed(1)} msg/s)`);

  console.log('\nnode-rdkafka produce...');
  const rdkProduce = await benchRDKafkaProduce({ ...config, topic: rdkTopic });
  const rdkDelivered = rdkProduce.delivered > 0 ? rdkProduce.delivered : config.count;
  console.log(`node-rdkafka produce: ${rdkProduce.ms.toFixed(1)} ms (${(config.count / (rdkProduce.ms / 1000)).toFixed(1)} msg/s)`);
  console.log(`node-rdkafka delivered: ${rdkDelivered} (errors: ${rdkProduce.deliveryErrors})`);

  console.log('node-rdkafka consume...');
  const rdkConsume = await benchRDKafkaConsume({ ...config, topic: rdkTopic, count: rdkDelivered });
  console.log(`node-rdkafka first message: ${rdkConsume.firstMessageMs.toFixed(1)} ms`);
  console.log(`node-rdkafka consume: ${rdkConsume.totalMs.toFixed(1)} ms (${(rdkDelivered / (rdkConsume.totalMs / 1000)).toFixed(1)} msg/s)`);

  console.log('\n@platformatic/kafka produce...');
  const pltProduceMs = await benchPlatformaticProduce({ ...config, topic: pltTopic });
  console.log(`@platformatic/kafka produce: ${pltProduceMs.toFixed(1)} ms (${(config.count / (pltProduceMs / 1000)).toFixed(1)} msg/s)`);

  console.log('@platformatic/kafka consume...');
  const pltConsume = await benchPlatformaticConsume({ ...config, topic: pltTopic });
  console.log(`@platformatic/kafka first message: ${pltConsume.firstMessageMs?.toFixed(1) ?? 'N/A'} ms`);
  console.log(`@platformatic/kafka consume: ${pltConsume.totalMs.toFixed(1)} ms (${(config.count / (pltConsume.totalMs / 1000)).toFixed(1)} msg/s)`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
