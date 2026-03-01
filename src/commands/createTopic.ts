import { createAdmin, createClient, getSASL, CLISASLOptions } from '../utils/kafka';

export default async function createTopic(topic: string, opts: any, { parent }: any) {
  const { brokers, logLevel, ssl, pretty, partitions = 1, replicas = 1, ...rest } = { ...parent.opts(), ...opts } as any;
  const sasl = getSASL(rest as CLISASLOptions);
  const client = createClient(brokers, ssl, sasl, logLevel);
  const admin = await createAdmin(client);
  try {
    const topics = await admin.createTopics({
      topics: [topic],
      partitions,
      replicas,
    });
    const space = pretty ? 2 : 0;
    console.log(JSON.stringify(topics, null, space));
  } finally {
    await admin.close();
  }
}
