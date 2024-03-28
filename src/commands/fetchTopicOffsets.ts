import { createAdmin, createClient, getSASL, CLISASLOptions } from '../utils/kafka';

export default async function fetchTopicOffset(topic: string, timestamp: string, opts: any, { parent }: any) {
  const { brokers, logLevel, ssl, pretty, ...rest } = { ...parent.opts(), ...opts } as any;
  const space = pretty ? 2 : 0;
  const sasl = getSASL(rest as CLISASLOptions);
  const client = createClient(brokers, ssl, sasl, logLevel);
  const admin = await createAdmin(client);
  if (timestamp) {
    const unixTimestamp = new Date(timestamp).getTime();
    if (Number.isNaN(unixTimestamp)) {
      throw new Error(`Invalid timestamp "${timestamp}"`);
    }
    const topicOffsets = await admin.fetchTopicOffsetsByTimestamp(topic, unixTimestamp);
    console.log(JSON.stringify(topicOffsets, null, space));
  } else {
    const topicOffsets = await admin.fetchTopicOffsets(topic);
    console.log(JSON.stringify(topicOffsets, null, space));
  }
  await admin.disconnect();
}
