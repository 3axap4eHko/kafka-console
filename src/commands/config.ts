import { Admin } from '@platformatic/kafka';
import { getClientConfigFromOpts, resourceTypeToNumber, type CommandContext, type ConfigResourceType } from '../utils/kafka.js';
import { writeJsonlMany } from '../utils/output.js';

interface ConfigOptions {
  resource: ConfigResourceType;
  resourceName: string;
}

export default async function config(opts: ConfigOptions, { parent }: CommandContext) {
  const config = getClientConfigFromOpts(parent.opts());
  const admin = new Admin(config);
  try {
    const resourceType = resourceTypeToNumber(opts.resource);
    const results = await admin.describeConfigs({
      resources: [{ resourceType, resourceName: opts.resourceName }],
    });
    writeJsonlMany(results);
  } finally {
    await admin.close();
  }
}
