import { createClient, createCluster, getSASL, CLISASLOptions } from '../utils/kafka';

export default async function list(opts: any, { parent }: any) {
  const { all, brokers, logLevel, ssl, ...rest } = { ...parent.opts(), ...opts } as any;
  const sasl = getSASL(rest as CLISASLOptions);
  const client = createClient(brokers, ssl, sasl, logLevel);
  const cluster = await createCluster(client);
  const topics = (await cluster.metadata()).topicMetadata
  .filter(topic => all || !topic.isInternal)
  .map(({ topic }) => topic);

  for(const topic of topics) {
    console.log(topic);
  }
  await cluster.disconnect();
}
