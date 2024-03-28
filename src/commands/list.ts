import { createClient, createCluster, getSASL, CLISASLOptions } from '../utils/kafka';

export default async function list(opts: any, { parent }: any) {
  const { all, brokers, logLevel, ssl, pretty, ...rest } = { ...parent.opts(), ...opts } as any;
  const sasl = getSASL(rest as CLISASLOptions);
  const client = createClient(brokers, ssl, sasl, logLevel);
  const cluster = await createCluster(client);
  const topics = (await cluster.metadata()).topicMetadata
  .filter(topic => all || !topic.isInternal)
  .map(({ topic }) => topic);

  const space = pretty ? 2 : 0;
  console.log(JSON.stringify(topics, null, space));
  await cluster.disconnect();
}
