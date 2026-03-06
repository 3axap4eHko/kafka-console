import { Admin } from '@platformatic/kafka';
import { getClientConfigFromOpts, type CommandContext } from '../utils/kafka.js';
import { writeJsonlMany } from '../utils/output.js';

interface ListOptions {
  all?: boolean;
}

export default async function list(opts: ListOptions, { parent }: CommandContext) {
  const config = getClientConfigFromOpts(parent.opts());
  const admin = new Admin(config);
  try {
    const topics = await admin.listTopics({ includeInternals: opts.all });
    writeJsonlMany(topics);
  } finally {
    await admin.close();
  }
}
