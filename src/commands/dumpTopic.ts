import * as Fs from 'fs';
import { finished } from 'node:stream/promises';
import { Consumer, stringDeserializers, ListOffsetTimestamps } from '@platformatic/kafka';
import { getClientConfigFromOpts, resolveConsumeMode, type CommandContext } from '../utils/kafka.ts';

interface DumpTopicOptions {
  group: string;
  output: string;
  from?: string;
  count: number;
}

export default async function dumpTopic(topic: string, opts: DumpTopicOptions, { parent }: CommandContext) {
  const config = getClientConfigFromOpts(parent.opts());
  const output = Fs.createWriteStream(opts.output);

  const consumer = new Consumer({
    ...config,
    groupId: opts.group,
    deserializers: stringDeserializers,
    autocommit: true,
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
    const { mode, offsets } = await resolveConsumeMode(consumer, topic, fromArg);

    const latestMap = await consumer.listOffsets({ topics: [topic], timestamp: ListOffsetTimestamps.LATEST });
    const highWatermarks = latestMap.get(topic) || [];
    const remaining = new Set<number>();
    for (let p = 0; p < highWatermarks.length; p++) {
      if (highWatermarks[p] > 0n) remaining.add(p);
    }

    if (remaining.size === 0) {
      console.error(`0 messages dumped to ${opts.output}`);
      return;
    }

    stream = await consumer.consume({
      topics: [topic],
      mode,
      offsets,
      sessionTimeout: 30000,
      heartbeatInterval: 1000,
    });

    let total = 0;

    for await (const message of stream) {
      if (interrupted) break;

      const msg = {
        partition: message.partition,
        offset: message.offset.toString(),
        timestamp: message.timestamp.toString(),
        headers: Object.fromEntries(message.headers),
        key: message.key,
        value: message.value,
      };
      output.write(JSON.stringify(msg) + '\n');
      total++;

      if (message.offset >= highWatermarks[message.partition] - 1n) {
        remaining.delete(message.partition);
      }

      if (remaining.size === 0 || total >= opts.count) break;
    }

    console.error(`${total} messages dumped to ${opts.output}`);
  } finally {
    process.off('SIGINT', handleSignal);
    process.off('SIGTERM', handleSignal);
    if (stream) await stream.close().catch(() => {});
    await consumer.close().catch(() => {});
    output.end();
    await finished(output).catch(() => {});
  }
}
