import commander from 'commander';
import { createAdmin, createClient, getSASL, CLISASLOptions } from '../utils/kafka';

export default async function deleteTopic(topic: string) {
  const { brokers, logLevel, ssl, ...rest } = commander.opts();
  const sasl = getSASL(rest as CLISASLOptions);
  const client = createClient(brokers, ssl, sasl, logLevel);
  const admin = await createAdmin(client);

  await admin.deleteTopics({
    topics: [topic],
  });
  await admin.disconnect();
}
