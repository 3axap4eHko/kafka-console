import { getClientConfigFromOpts, fetchTopicOffsets, fetchTopicOffsetsByTimestamp, fetchConsumerGroupOffsets, type CommandContext } from '../utils/kafka.js';
import { writeJsonlMany } from '../utils/output.js';

interface FetchTopicOffsetsOptions {
  group?: string;
}

export default async function fetchTopicOffset(topic: string, timestamp: string | undefined, opts: FetchTopicOffsetsOptions, { parent }: CommandContext) {
  const config = getClientConfigFromOpts(parent.opts());

  if (timestamp) {
    const unixTimestamp = /^\d+$/.test(timestamp) ? parseInt(timestamp, 10) : new Date(timestamp).getTime();
    if (Number.isNaN(unixTimestamp)) {
      throw new Error(`Invalid timestamp "${timestamp}"`);
    }
    const topicOffsets = await fetchTopicOffsetsByTimestamp(config, topic, unixTimestamp);
    writeJsonlMany(topicOffsets);
  } else if (opts.group) {
    const topicOffsets = await fetchConsumerGroupOffsets(config, opts.group, [topic]);
    writeJsonlMany(topicOffsets);
  } else {
    const topicOffsets = await fetchTopicOffsets(config, topic);
    writeJsonlMany(topicOffsets);
  }
}
