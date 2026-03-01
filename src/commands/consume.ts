import * as Fs from 'fs';
import { createClient, createConsumer, getSASL, CLISASLOptions } from '../utils/kafka';
import { getFormatter } from '../utils/formatters';

export default async function consume(topic: string, opts: any, { parent }: any) {
  const { group, dataFormat, from, count, skip, output: filename, brokers, logLevel, timeout, ssl, pretty, ...saslOptions } = { ...parent.opts(), ...opts } as any;
  const sasl = getSASL(saslOptions as CLISASLOptions);
  const client = createClient(brokers, ssl, sasl, logLevel);
  const output = filename ? Fs.createWriteStream(filename) : process.stdout;
  let timeouted = false;

  const consumer = await createConsumer(client, group, topic, from, { skip, count, timeout });

  consumer.onDone((isTimeout) => {
    timeouted = isTimeout;
  });

  const formatter = getFormatter(dataFormat);

  try {
    for await (const { partition, offset, timestamp, headers, key, value, high } of consumer) {
      const parsedHeaders: Record<string, string> = Object.fromEntries(headers);
      const ahead = Number(high - offset);
      const message = { partition, offset: offset.toString(), timestamp: timestamp.toString(), headers: parsedHeaders, key, value: await formatter.decode(value), ahead };
      const space = pretty ? 2 : 0;
      output.write(JSON.stringify(message, null, space) + '\n');
    }
  } finally {
    if (filename) {
      output.end();
      await new Promise(resolve => output.on('finish', resolve));
    }
  }

  if (timeouted) {
    console.error("TIMEOUT");
    process.exit(1);
  }
}
