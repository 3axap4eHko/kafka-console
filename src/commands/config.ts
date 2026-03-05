import { Admin } from '@platformatic/kafka';
import { getClientConfigFromOpts, resourceTypeToNumber, type CommandContext, type ConfigResourceType } from '../utils/kafka.js';

interface ConfigOptions {
  resource: ConfigResourceType;
  resourceName: string;
}

export default async function config(opts: ConfigOptions, { parent }: CommandContext) {
  const globalOpts = parent.opts();
  const config = getClientConfigFromOpts(globalOpts);
  const admin = new Admin(config);
  try {
    const resourceType = resourceTypeToNumber(opts.resource);
    const results = await admin.describeConfigs({
      resources: [{ resourceType, resourceName: opts.resourceName }],
    });
    const space = globalOpts.pretty ? 2 : 0;
    console.log(JSON.stringify(results, null, space));
  } finally {
    await admin.close();
  }
}
