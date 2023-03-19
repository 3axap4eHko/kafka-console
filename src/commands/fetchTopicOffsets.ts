import { createAdmin, createClient, getSASL, CLISASLOptions } from '../utils/kafka';

export default async function fetchTopicOffset(topic: string, timestamp: string, opts: any, { parent }: any) {
  const { brokers, logLevel, ssl, ...rest } = { ...parent.opts(), ...opts } as any;
  const sasl = getSASL(rest as CLISASLOptions);
  const client = createClient(brokers, ssl, sasl, logLevel);
  const admin = await createAdmin(client);
  if (timestamp) {
    const unixTimestamp = new Date(timestamp).getTime();
    if (Number.isNaN(unixTimestamp)) {
      throw new Error(`Invalid timestamp "${timestamp}"`);
    }
    const topicOffsets = await admin.fetchTopicOffsetsByTimestamp(topic, unixTimestamp);
    console.log(topicOffsets);
  } else {
    const topicOffsets = await admin.fetchTopicOffsets(topic);
    console.log(topicOffsets);
  }
  await admin.disconnect();
}
