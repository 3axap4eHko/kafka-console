import { createClient, createCluster, getSASL, CLISASLOptions } from '../utils/kafka';

export default async function metadata(opts: any, { parent }: any) {
  const { brokers, logLevel, ssl, ...rest } = { ...parent.opts(), ...opts } as any;
  const sasl = getSASL(rest as CLISASLOptions);
  const client = createClient(brokers, ssl, sasl, logLevel);
  const cluster = await createCluster(client);
  const metadata = await cluster.metadata();
  console.log(JSON.stringify(metadata, null, '  '));
  await cluster.disconnect();
}
