import { createAdmin, createClient, getSASL } from '../utils/kafka';

export default async function config({ resource, resourceName: name, parent: { brokers, logLevel, ssl, ...rest } }: any) {
  const sasl = getSASL(rest);
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
