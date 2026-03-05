import { Admin } from '@platformatic/kafka';
import { getClientConfigFromOpts, type CommandContext } from '../utils/kafka.js';

interface CreateTopicOptions {
  partitions?: number;
  replicas?: number;
}

export default async function createTopic(topic: string, opts: CreateTopicOptions, { parent }: CommandContext) {
  const globalOpts = parent.opts();
  const config = getClientConfigFromOpts(globalOpts);
  const admin = new Admin(config);
  try {
    const topics = await admin.createTopics({
      topics: [topic],
      partitions: opts.partitions ?? 1,
      replicas: opts.replicas ?? 1,
    });
    const space = globalOpts.pretty ? 2 : 0;
    console.log(JSON.stringify(topics, null, space));
  } finally {
    await admin.close();
  }
}
