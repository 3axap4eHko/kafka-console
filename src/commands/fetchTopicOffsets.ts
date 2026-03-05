import { getClientConfigFromOpts, fetchTopicOffsets, fetchTopicOffsetsByTimestamp, fetchConsumerGroupOffsets, type CommandContext } from '../utils/kafka.js';

interface FetchTopicOffsetsOptions {
  group?: string;
}

export default async function fetchTopicOffset(topic: string, timestamp: string | undefined, opts: FetchTopicOffsetsOptions, { parent }: CommandContext) {
  const globalOpts = parent.opts();
  const config = getClientConfigFromOpts(globalOpts);
  const space = globalOpts.pretty ? 2 : 0;

  if (timestamp) {
    const unixTimestamp = /^\d+$/.test(timestamp) ? parseInt(timestamp, 10) : new Date(timestamp).getTime();
    if (Number.isNaN(unixTimestamp)) {
      throw new Error(`Invalid timestamp "${timestamp}"`);
    }
    const topicOffsets = await fetchTopicOffsetsByTimestamp(config, topic, unixTimestamp);
    console.log(JSON.stringify(topicOffsets, null, space));
  } else if (opts.group) {
    const topicOffsets = await fetchConsumerGroupOffsets(config, opts.group, [topic]);
    console.log(JSON.stringify(topicOffsets, null, space));
  } else {
    const topicOffsets = await fetchTopicOffsets(config, topic);
    console.log(JSON.stringify(topicOffsets, null, space));
  }
}
