import { Admin } from '@platformatic/kafka';
import { getClientConfigFromOpts, type CommandContext } from '../utils/kafka.js';

interface ListOptions {
  all?: boolean;
}

export default async function list(opts: ListOptions, { parent }: CommandContext) {
  const globalOpts = parent.opts();
  const config = getClientConfigFromOpts(globalOpts);
  const admin = new Admin(config);
  try {
    const topics = await admin.listTopics({ includeInternals: opts.all });
    const space = globalOpts.pretty ? 2 : 0;
    console.log(JSON.stringify(topics, null, space));
  } finally {
    await admin.close();
  }
}
