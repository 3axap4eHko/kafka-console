import * as Fs from 'fs';
import { Consumer, stringDeserializers, MessagesStreamModes, ListOffsetTimestamps } from '@platformatic/kafka';
import { getClientConfigFromOpts, type CommandContext } from '../utils/kafka.js';
import { getFormatter } from '../utils/formatters.js';

interface ConsumeOptions {
  group: string;
  dataFormat: string;
  from?: string;
  count: number;
  skip: number;
  output?: string;
}

export default async function consume(topic: string, opts: ConsumeOptions, { parent }: CommandContext) {
  const globalOpts = parent.opts();
  const config = getClientConfigFromOpts(globalOpts);
  const output = opts.output ? Fs.createWriteStream(opts.output) : process.stdout;
  const formatter = getFormatter(opts.dataFormat);

  const consumer = new Consumer({
    ...config,
    groupId: opts.group,
    deserializers: stringDeserializers,
    autocommit: true,
  });

  let mode: (typeof MessagesStreamModes)[keyof typeof MessagesStreamModes] = MessagesStreamModes.LATEST;
  let offsets: { topic: string; partition: number; offset: bigint }[] | undefined;

  if (opts.from === '0') {
    mode = MessagesStreamModes.EARLIEST;
  } else if (opts.from) {
    const ts = /^\d+$/.test(opts.from) ? new Date(parseInt(opts.from, 10)).getTime() : Date.parse(opts.from);

    if (Number.isNaN(ts)) {
      throw new Error(`Invalid timestamp "${opts.from}"`);
    }

    const offsetsMap = await consumer.listOffsets({ topics: [topic], timestamp: BigInt(ts) });
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

  let timedOut = false;
  let timerId: NodeJS.Timeout | undefined;
  if (globalOpts.timeout) {
    timerId = setTimeout(() => {
      timedOut = true;
      void stream.close();
    }, globalOpts.timeout);
  }

  try {
    let index = 0;
    const limit = opts.skip + opts.count;
    for await (const message of stream) {
      if (index >= opts.skip) {
        const parsedHeaders: Record<string, string> = Object.fromEntries(message.headers);
        const high = highWatermarks[message.partition] ?? message.offset;
        const ahead = Number(high - message.offset);
        const msg = {
          partition: message.partition,
          offset: message.offset.toString(),
          timestamp: message.timestamp.toString(),
          headers: parsedHeaders,
          key: message.key,
          value: await formatter.decode(message.value),
          ahead,
        };
        output.write(JSON.stringify(msg) + '\n');
      }
      if (++index >= limit) break;
    }
  } finally {
    clearTimeout(timerId);
    await stream.close();
    await consumer.close();
    if (opts.output) {
      output.end();
      await new Promise((resolve) => output.on('finish', resolve));
    }
  }

  if (timedOut) {
    console.error('TIMEOUT');
    process.exit(1);
  }
}
