import * as Fs from 'fs';
import { PassThrough } from 'stream';
import { createInterface } from 'readline';
import { promisify } from 'util';
import { Message } from 'kafkajs';
import Pool from '../utils/pool';
import { createClient, createProducer, getSASL, CLISASLOptions } from '../utils/kafka';
import { getFormatter } from '../utils/formatters';

const readFile = promisify(Fs.readFile);

async function getInput<T>(filename: string): Promise<Pool<T>> {
  if (filename) {
    const content = await readFile(filename, 'utf8');
    const result = JSON.parse(content) as T[];
    return new Pool<T>(result).done();
  } else {
    const input = new PassThrough();
    const readLine = createInterface({ input });
    const dataPool = new Pool<T>();
    readLine.on('line', async (line) => {
      dataPool.push(await JSON.parse(line));
    });
    readLine.on('close', () => dataPool.done());
    process.stdin.pipe(input);
    return dataPool;
  }
}

export default async function produce(topic: string, opts: any, { parent }: any) {
  const { format, header, input: filename, delay, brokers, logLevel, ssl, ...rest } = { ...parent.opts(), ...opts } as any;
  const sasl = getSASL(rest as CLISASLOptions);
  const client = createClient(brokers, ssl, sasl, logLevel);
  const producer = await createProducer(client, topic);
  const staticHeaders = header.reduce((result: any, header: string) => {
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

  const formatter = getFormatter(format);
  const input = await getInput<Message>(filename);
  for await (let { key, value, headers } of input) {
    const encodedValue = await formatter.encode(value);
    const message = { key, value: encodedValue, headers: { ...staticHeaders, ...headers } };
    producer.push(message);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  producer.done();
}
