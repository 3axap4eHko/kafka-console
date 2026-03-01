import { createAdmin, createClient, getSASL, CLISASLOptions } from '../utils/kafka';

export default async function list(opts: any, { parent }: any) {
  const { all, brokers, logLevel, ssl, pretty, ...rest } = { ...parent.opts(), ...opts } as any;
  const sasl = getSASL(rest as CLISASLOptions);
  const client = createClient(brokers, ssl, sasl, logLevel);
  const admin = await createAdmin(client);
  try {
    const topics = await admin.listTopics({ includeInternals: all });
    const space = pretty ? 2 : 0;
    console.log(JSON.stringify(topics, null, space));
  } finally {
    await admin.close();
  }
}
