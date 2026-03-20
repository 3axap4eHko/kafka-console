import * as Fs from 'fs';
import { createInterface } from 'readline';
import { Producer, stringSerializers } from '@platformatic/kafka';
import { getClientConfigFromOpts, type CommandContext } from '../utils/kafka.ts';
import { getFormatter } from '../utils/formatters.ts';

interface InputMessage {
  key?: string;
  value: unknown;
  headers?: Record<string, string>;
}

function toInputMessage(value: unknown): InputMessage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !('value' in value)) {
    return null;
  }

  const message = value as InputMessage;
  if (message.value === undefined) {
    return null;
  }

  return {
    key: message.key,
    value: message.value,
    headers: message.headers,
  };
}

async function* readStdin(): AsyncGenerator<InputMessage> {
  const rl = createInterface({ input: process.stdin });
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const message = toInputMessage(JSON.parse(line) as unknown);
      if (!message) {
        console.error(`Invalid message payload: missing or undefined "value" field: ${line}`);
        continue;
      }
      yield message;
    } catch {
      console.error(`Invalid JSON: ${line}`);
    }
  }
}

async function* readFile(filename: string): AsyncGenerator<InputMessage> {
  const content = await Fs.promises.readFile(filename, 'utf8');
  const parsed = JSON.parse(content) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`Input file "${filename}" must contain a JSON array`);
  }

  for (let index = 0; index < parsed.length; index++) {
    const message = toInputMessage(parsed[index]);
    if (!message) {
      console.error(`Invalid message at index ${index}: missing or undefined "value" field`);
      continue;
    }
    yield message;
  }
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
