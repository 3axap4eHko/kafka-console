import * as Fs from 'fs';
import { PassThrough } from 'stream';
import { createInterface } from 'readline';
import { promisify } from 'util';
import Pool from '../utils/pool';
import { createClient, createProducer, getSASL, CLISASLOptions, ProducerMessage } from '../utils/kafka';
import { getFormatter } from '../utils/formatters';

const readFile = promisify(Fs.readFile);

interface InputMessage {
  key?: string;
  value: any;
  headers?: Record<string, string>;
}

async function getInput(filename: string): Promise<Pool<InputMessage>> {
  if (filename) {
    const content = await readFile(filename, 'utf8');
    const result = JSON.parse(content) as InputMessage[];
    return new Pool<InputMessage>(result).done();
  } else {
    const input = new PassThrough();
    const readLine = createInterface({ input });
    const dataPool = new Pool<InputMessage>();
    readLine.on('line', (line) => {
      if (!line.trim()) return;
      try {
        dataPool.push(JSON.parse(line));
      } catch (e) {
        console.error(`Invalid JSON: ${line}`);
      }
    });
    readLine.on('close', () => dataPool.done());
    process.stdin.pipe(input);
    return dataPool;
  }
}

export default async function produce(topic: string, opts: any, { parent }: any) {
  const { dataFormat, header, input: filename, wait, brokers, logLevel, ssl, ...rest } = { ...parent.opts(), ...opts } as any;
  const sasl = getSASL(rest as CLISASLOptions);
  const client = createClient(brokers, ssl, sasl, logLevel);
  const producer = await createProducer(client, topic);
  const staticHeaders: Record<string, string> = header.reduce((result: any, header: string) => {
    try {
      const [, key, value] = header.match(/^([^:]+):(.*)$/);
      return {
        ...result,
        [key.trim()]: value.trim(),
      };
    } catch (e) {
      console.error(e);
    }
    return result;
  }, {});

  const formatter = getFormatter(dataFormat);
  const input = await getInput(filename);
  for await (const { key, value, headers } of input) {
    const encodedValue = await formatter.encode(value);
    const mergedHeaders = { ...staticHeaders, ...headers };
    const headerMap = new Map<string, string>(Object.entries(mergedHeaders));
    const message: ProducerMessage = { key, value: encodedValue, headers: headerMap };
    producer.push(message);
    await new Promise(resolve => setTimeout(resolve, wait));
  }
  producer.done();
}
