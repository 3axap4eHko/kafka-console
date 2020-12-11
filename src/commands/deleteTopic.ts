import { createAdmin, createClient, getSASL } from '../utils/kafka';

export default async function deleteTopic(topic: string, { parent: { brokers, logLevel, ssl, ...rest } }: any) {
  const sasl = getSASL(rest);
  const client = createClient(brokers, ssl, sasl, logLevel);
  const admin = await createAdmin(client);

  await admin.deleteTopics({
    topics: [topic],
  });
  await admin.disconnect();
}
