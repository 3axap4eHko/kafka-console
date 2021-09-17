import { createAdmin, createClient, getSASL, CLISASLOptions } from '../utils/kafka';

export default async function createTopic(topic: string, opts: any, { parent }: any) {
  const { brokers, logLevel, ssl, ...rest } = { ...parent.opts(), ...opts } as any;
  const sasl = getSASL(rest as CLISASLOptions);
  const client = createClient(brokers, ssl, sasl, logLevel);
  const admin = await createAdmin(client);

  const topics = await admin.createTopics({
    topics: [{ topic }],
  });
  console.log(topics);
  await admin.disconnect();
}
