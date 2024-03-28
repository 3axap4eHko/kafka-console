import { createAdmin, createClient, getSASL, CLISASLOptions } from '../utils/kafka';

export default async function config(opts: any, { parent }: any) {
  const { resource, resourceName: name, brokers, logLevel, ssl, pretty, ...rest } = { ...parent.opts(), ...opts } as any;
  const space = pretty ? 2 : 0;
  const sasl = getSASL(rest as CLISASLOptions);
  const client = createClient(brokers, ssl, sasl, logLevel);
  const admin = await createAdmin(client);
  const { resources } = await admin.describeConfigs({
    includeSynonyms: true,
    resources: [
      {
        type: resource,
        name,
      },
    ],
  });
  for (let resource of resources) {
    console.log(JSON.stringify(resource, null, space));
  }
  await admin.disconnect();
}
