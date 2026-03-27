import { Consumer, Producer, stringDeserializers, stringSerializers, ListOffsetTimestamps } from '@platformatic/kafka';
import { getClientConfigFromOpts, resolveConsumeMode, type CommandContext } from '../utils/kafka.ts';

type Compression = ConstructorParameters<typeof Producer>[0]['compression'];

interface CopyTopicOptions {
  group: string;
  batchSize: number;
  compression?: Compression;
  from?: string;
  count: number;
}

export default async function copyTopic(source: string, dest: string, opts: CopyTopicOptions, { parent }: CommandContext) {
  const config = getClientConfigFromOpts(parent.opts());

  const consumer = new Consumer({
    ...config,
    groupId: opts.group,
    deserializers: stringDeserializers,
    autocommit: true,
  });

  const producer = new Producer({
    ...config,
    serializers: stringSerializers,
    compression: opts.compression,
  });

  let stream: Awaited<ReturnType<typeof consumer.consume>> | undefined;
  let interrupted = false;
  const handleSignal = () => {
    interrupted = true;
    if (stream) void stream.close();
  };
  process.once('SIGINT', handleSignal);
  process.once('SIGTERM', handleSignal);

  try {
    const fromArg = opts.from ?? '0';
    const { mode, offsets } = await resolveConsumeMode(consumer, source, fromArg);

    const latestMap = await consumer.listOffsets({ topics: [source], timestamp: ListOffsetTimestamps.LATEST });
    const highWatermarks = latestMap.get(source) || [];
    const remaining = new Set<number>();
    for (let p = 0; p < highWatermarks.length; p++) {
      if (highWatermarks[p] > 0n) remaining.add(p);
    }

    if (remaining.size === 0) {
      console.error('0 messages copied');
      return;
    }

    stream = await consumer.consume({
      topics: [source],
      mode,
      offsets,
      sessionTimeout: 30000,
      heartbeatInterval: 1000,
    });

    type Message = Parameters<typeof producer.send>[0]['messages'][number];
    let batch: Message[] = [];
    let total = 0;

    for await (const message of stream) {
      if (interrupted) break;

      batch.push({
        topic: dest,
        key: message.key ?? undefined,
        value: message.value ?? undefined,
        headers: message.headers,
      });
      total++;

      if (message.offset >= highWatermarks[message.partition] - 1n) {
        remaining.delete(message.partition);
      }

      if (batch.length >= opts.batchSize || remaining.size === 0 || total >= opts.count) {
        await producer.send({ messages: batch });
        batch = [];
        if (remaining.size === 0 || total >= opts.count) break;
      }
    }

    if (batch.length > 0) {
      await producer.send({ messages: batch });
    }

    console.error(`${total} messages copied`);
  } finally {
    process.off('SIGINT', handleSignal);
    process.off('SIGTERM', handleSignal);
    if (stream) await stream.close().catch(() => {});
    await consumer.close().catch(() => {});
    await producer.close().catch(() => {});
  }
}
