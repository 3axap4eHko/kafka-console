import * as Fs from 'fs';
import { finished } from 'node:stream/promises';
import { Consumer, stringDeserializers, MessagesStreamModes, ListOffsetTimestamps } from '@platformatic/kafka';
import { getClientConfigFromOpts, type CommandContext } from '../utils/kafka.ts';
import { getFormatter } from '../utils/formatters.ts';

interface ConsumeOptions {
  group: string;
  dataFormat: string;
  from?: string;
  count: number;
  skip: number;
  output?: string;
  snapshot?: boolean;
}

function toError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error));
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
  const closeConsumer = async () => {
    await consumer.close();
  };
  let stream: Awaited<ReturnType<typeof consumer.consume>> | undefined;
  const closeStream = async () => {
    if (!stream) return;
    await stream.close();
  };
  let interrupted = false;
  const handleSignal = () => {
    interrupted = true;
    if (stream) {
      void closeStream();
      return;
    }
    void closeConsumer();
  };
  process.once('SIGINT', handleSignal);
  process.once('SIGTERM', handleSignal);

  let timedOut = false;
  let timerId: NodeJS.Timeout | undefined;
  let failure: Error | undefined;
  let cleanupError: Error | undefined;
  let aborted = false;

  try {
    let mode: (typeof MessagesStreamModes)[keyof typeof MessagesStreamModes] = MessagesStreamModes.LATEST;
    let offsets: { topic: string; partition: number; offset: bigint }[] | undefined;

    if (opts.snapshot && !opts.from) {
      mode = MessagesStreamModes.EARLIEST;
    } else if (opts.from === '0') {
      mode = MessagesStreamModes.EARLIEST;
    } else if (opts.from) {
      const ts = /^\d+$/.test(opts.from) ? parseInt(opts.from, 10) : Date.parse(opts.from);

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

    try {
      stream = await consumer.consume(consumeOptions);
    } catch (error) {
      if (interrupted) {
        aborted = true;
      } else {
        throw error;
      }
    }

    if (!aborted) {
      let highWatermarks: bigint[] = [];
      try {
        const latestMap = await consumer.listOffsets({ topics: [topic], timestamp: ListOffsetTimestamps.LATEST });
        highWatermarks = latestMap.get(topic) || [];
      } catch (error) {
        if (interrupted) {
          aborted = true;
        } else {
          throw error;
        }
      }

      if (!aborted && globalOpts.timeout) {
        timerId = setTimeout(() => {
          timedOut = true;
          void closeStream();
        }, globalOpts.timeout);
      }

      if (!aborted) {
        if (!stream) {
          throw new Error('Consumer stream was not initialized');
        }

        const activeStream = stream;
        let index = 0;
        const limit = opts.skip + opts.count;
        const snapshotRemaining = opts.snapshot ? new Set<number>() : undefined;
        if (snapshotRemaining) {
          for (let p = 0; p < highWatermarks.length; p++) {
            if (highWatermarks[p] > 0n) snapshotRemaining.add(p);
          }
          if (snapshotRemaining.size === 0) {
            await closeStream();
          }
        }
        for await (const message of activeStream) {
          if (interrupted) break;
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
          if (snapshotRemaining && message.offset >= highWatermarks[message.partition] - 1n) {
            snapshotRemaining.delete(message.partition);
            if (snapshotRemaining.size === 0) break;
          }
          if (++index >= limit) break;
        }
      }
    }
  } catch (error) {
    failure = toError(error);
  } finally {
    clearTimeout(timerId);
    process.off('SIGINT', handleSignal);
    process.off('SIGTERM', handleSignal);

    try {
      await closeStream();
    } catch (error) {
      cleanupError ??= toError(error);
    }

    try {
      await closeConsumer();
    } catch (error) {
      cleanupError ??= toError(error);
    }

    if (opts.output) {
      try {
        output.end();
        await finished(output);
      } catch (error) {
        cleanupError ??= toError(error);
      }
    }
  }

  if (failure) throw failure;
  if (cleanupError) throw cleanupError;

  if (timedOut) {
    console.error('TIMEOUT');
    process.exit(1);
  }
}
