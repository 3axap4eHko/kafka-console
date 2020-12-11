import { createClient, createCluster, getSASL, CLISASLOptions } from '../utils/kafka';

export default async function metadata({ parent: { brokers, logLevel, ssl, ...rest } }: any) {
  const sasl = getSASL(rest as CLISASLOptions);
  const client = createClient(brokers, ssl, sasl, logLevel);
  const cluster = await createCluster(client);
  const metadata = await cluster.metadata();
  console.log(JSON.stringify(metadata, null, '  '));
  await cluster.disconnect();
}
