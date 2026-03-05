import * as Fs from 'fs';
import { createInterface } from 'readline';
import { Producer, stringSerializers } from '@platformatic/kafka';
import { getClientConfigFromOpts, type CommandContext } from '../utils/kafka.js';
import { getFormatter } from '../utils/formatters.js';

interface InputMessage {
  key?: string;
  value: string;
  headers?: Record<string, string>;
}

async function* readStdin(): AsyncGenerator<InputMessage> {
  const rl = createInterface({ input: process.stdin });
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      yield JSON.parse(line) as InputMessage;
    } catch {
      console.error(`Invalid JSON: ${line}`);
    }
  }
}

async function* readFile(filename: string): AsyncGenerator<InputMessage> {
  const content = await Fs.promises.readFile(filename, 'utf8');
  const messages = JSON.parse(content) as InputMessage[];
  for (const msg of messages) yield msg;
}

interface ProduceOptions {
  dataFormat: string;
  header: string[];
  input?: string;
  wait: number;
}

export default async function produce(topic: string, opts: ProduceOptions, { parent }: CommandContext) {
  const config = getClientConfigFromOpts(parent.opts());
  const producer = new Producer({
    ...config,
    serializers: stringSerializers,
  });

  const staticHeaders: Record<string, string> = {};
  for (const h of opts.header) {
    const match = h.match(/^([^:]+):(.*)$/);
    if (!match) {
      console.error(`Invalid header: ${h}`);
      continue;
    }
    staticHeaders[match[1].trim()] = match[2].trim();
  }

  const formatter = getFormatter(opts.dataFormat);
  const input = opts.input ? readFile(opts.input) : readStdin();

  try {
    for await (const { key, value, headers } of input) {
      const encodedValue = await formatter.encode(value);
      const mergedHeaders = { ...staticHeaders, ...headers };
      const headerMap = new Map<string, string>(Object.entries(mergedHeaders));
      await producer.send({
        messages: [
          {
            topic,
            key,
            value: encodedValue.toString(),
            headers: headerMap,
          },
        ],
      });
      if (opts.wait) await new Promise((resolve) => setTimeout(resolve, opts.wait));
    }
  } finally {
    await producer.close();
  }
}
