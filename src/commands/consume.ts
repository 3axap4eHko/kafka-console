import * as Fs from 'fs';
import { createClient, createConsumer, getSASL, CLISASLOptions } from '../utils/kafka';
import { getFormatter } from '../utils/formatters';

export default async function consume(topic: string, opts: any, { parent }: any) {
  const { group, format, fromBeginning, count, skip, filename, brokers, logLevel, timeout, ssl, pretty, ...saslOptions } = { ...parent.opts(), ...opts } as any;
  const sasl = getSASL(saslOptions as CLISASLOptions);
  const client = createClient(brokers, ssl, sasl, logLevel);
  const output = filename ? Fs.createWriteStream(filename) : process.stdout;

  const consumer = await createConsumer(client, group, topic, fromBeginning, { skip, count, timeout });
  consumer.onDone((timeouted) => {
    if (timeouted) {
      console.log("TIMEOUT")
      process.exit(1);
    }
  });

  const formatter = getFormatter(format);

  for await (let { message: { headers, key, value } } of consumer) {
    const parsedHeaders = Object.entries(headers).reduce((result: any, [key, value]) => {
      return {
        ...result,
        [key]: value.toString(),
      };
    }, {});
    const message = { headers: parsedHeaders, key: key?.toString(), value: await formatter.decode(value) };
    const space = pretty ? 2 : 0;
    output.write(JSON.stringify(message, null, space) + '\n');
  }
}
