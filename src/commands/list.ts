import { createClient, createCluster, getSASL } from '../utils/kafka';

export default async function list({ all, parent: { brokers, logLevel, ssl, ...rest } }: any) {
  const sasl = getSASL(rest);
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
