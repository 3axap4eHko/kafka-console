import { Admin } from '@platformatic/kafka';
import { getClientConfigFromOpts, type CommandContext } from '../utils/kafka.js';
import { writeJsonlMany } from '../utils/output.js';

interface CreateTopicOptions {
  partitions?: number;
  replicas?: number;
}

export default async function createTopic(topic: string, opts: CreateTopicOptions, { parent }: CommandContext) {
  const config = getClientConfigFromOpts(parent.opts());
  const admin = new Admin(config);
  try {
    const topics = await admin.createTopics({
      topics: [topic],
      partitions: opts.partitions ?? 1,
      replicas: opts.replicas ?? 1,
    });
    writeJsonlMany(topics);
  } finally {
    await admin.close();
  }
}
