import commander from 'commander';
import { createAdmin, createClient, getSASL, CLISASLOptions } from '../utils/kafka';

export default async function config({ resource, resourceName: name }: any) {
  const { brokers, logLevel, ssl, ...rest } = commander.opts();
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
    console.log(resource);
  }
  await admin.disconnect();
}
