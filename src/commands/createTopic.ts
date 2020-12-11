import { createAdmin, createClient, getSASL } from '../utils/kafka';

export default async function createTopic(topic: string, { parent: { brokers, logLevel, ssl, ...rest } }: any) {
  const sasl = getSASL(rest);
  const client = createClient(brokers, ssl, sasl, logLevel);
  const admin = await createAdmin(client);

  const topics = await admin.createTopics({
    topics: [{ topic }],
  });
  console.log(topics);
  await admin.disconnect();
}
