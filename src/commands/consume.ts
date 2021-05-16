import commander from 'commander';
import * as Fs from 'fs';
import { createClient, createConsumer, getSASL, CLISASLOptions } from '../utils/kafka';
import { getFormatter } from '../utils/formatters';

export default async function consume(topic: string, {
  group,
  format,
  fromBeginning,
  filename,
}: any) {
  const { brokers, logLevel, ssl, ...rest } = commander.opts();
  const sasl = getSASL(rest as CLISASLOptions);
  const client = createClient(brokers, ssl, sasl, logLevel);
  const output = filename ? Fs.createWriteStream(filename) : process.stdout;

  const consumer = await createConsumer(client, group, topic, fromBeginning);
  const formatter = getFormatter(format);
  for await (let { message: { headers, key, value } } of consumer) {
    const parsedHeaders = Object.entries(headers).reduce((result: any, [key, value]) => {
      return {
        ...result,
        [key]: value.toString(),
      };
    }, {});
    const message = { headers: parsedHeaders, key: key?.toString(), value: await formatter.decode(value) };
    output.write(JSON.stringify(message, null, '  ') + '\n');
  }
}
