import { createClient, getSASL, CLISASLOptions, fetchTopicOffsets, fetchTopicOffsetsByTimestamp, fetchConsumerGroupOffsets } from '../utils/kafka';

export default async function fetchTopicOffset(topic: string, timestamp: string, opts: any, { parent }: any) {
  const { brokers, group, logLevel, ssl, pretty, ...rest } = { ...parent.opts(), ...opts } as any;
  const space = pretty ? 2 : 0;
  const sasl = getSASL(rest as CLISASLOptions);
  const client = createClient(brokers, ssl, sasl, logLevel);

  if (timestamp) {
    const unixTimestamp = /^\d+$/.test(timestamp)
      ? parseInt(timestamp, 10)
      : new Date(timestamp).getTime();
    if (Number.isNaN(unixTimestamp)) {
      throw new Error(`Invalid timestamp "${timestamp}"`);
    }
    const topicOffsets = await fetchTopicOffsetsByTimestamp(client, topic, unixTimestamp);
    console.log(JSON.stringify(topicOffsets, null, space));
  } else if (group) {
    const topicOffsets = await fetchConsumerGroupOffsets(client, group, [topic]);
    console.log(JSON.stringify(topicOffsets, null, space));
  } else {
    const topicOffsets = await fetchTopicOffsets(client, topic);
    console.log(JSON.stringify(topicOffsets, null, space));
  }
}
