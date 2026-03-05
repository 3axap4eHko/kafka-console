import { Admin } from '@platformatic/kafka';
import { getClientConfigFromOpts, type CommandContext } from '../utils/kafka.js';

export default async function deleteTopic(topic: string, _opts: object, { parent }: CommandContext) {
  const config = getClientConfigFromOpts(parent.opts());
  const admin = new Admin(config);
  try {
    await admin.deleteTopics({
      topics: [topic],
    });
  } finally {
    await admin.close();
  }
}
