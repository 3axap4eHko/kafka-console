import commander from 'commander';
import { createAdmin, createClient, getSASL, CLISASLOptions } from '../utils/kafka';

export default async function createTopic(topic: string) {
  const { brokers, logLevel, ssl, ...rest } = commander.opts();
  const sasl = getSASL(rest as CLISASLOptions);
  const client = createClient(brokers, ssl, sasl, logLevel);
  const admin = await createAdmin(client);

  const topics = await admin.createTopics({
    topics: [{ topic }],
  });
  console.log(topics);
  await admin.disconnect();
}
