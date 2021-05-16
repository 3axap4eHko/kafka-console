import commander from 'commander';
import { createClient, createCluster, getSASL, CLISASLOptions } from '../utils/kafka';

export default async function list({ all }: any) {
  const { brokers, logLevel, ssl, ...rest } = commander.opts();
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
