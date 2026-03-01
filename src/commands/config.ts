import { createAdmin, createClient, getSASL, CLISASLOptions, resourceTypeToNumber } from '../utils/kafka';

export default async function config(opts: any, { parent }: any) {
  const { resource, resourceName, brokers, logLevel, ssl, pretty, ...rest } = { ...parent.opts(), ...opts } as any;
  const sasl = getSASL(rest as CLISASLOptions);
  const client = createClient(brokers, ssl, sasl, logLevel);
  const admin = await createAdmin(client);
  try {
    const resourceType = resourceTypeToNumber(resource);
    const results = await admin.describeConfigs({
      resources: [{ resourceType, resourceName }],
    });
    const space = pretty ? 2 : 0;
    console.log(JSON.stringify(results, null, space));
  } finally {
    await admin.close();
  }
}
