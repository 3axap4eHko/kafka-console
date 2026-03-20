import { Admin } from '@platformatic/kafka';
import { getClientConfigFromOpts, type CommandContext } from '../utils/kafka.ts';
import { writeJsonlMany } from '../utils/output.ts';

export default async function metadata(_opts: object, { parent }: CommandContext) {
  const config = getClientConfigFromOpts(parent.opts());
  const admin = new Admin(config);
  try {
    const topics = await admin.listTopics({ includeInternals: true });
    const meta = await admin.metadata({ topics });

    const brokerList: { nodeId: number; host: string; port: number; rack: null }[] = [];
    for (const [nodeId, broker] of meta.brokers) {
      brokerList.push({ nodeId, host: broker.host, port: broker.port, rack: null });
    }

    const topicMetadata: {
      topicErrorCode: number;
      topic: string;
      isInternal: boolean;
      partitionMetadata: {
        partitionErrorCode: number;
        partitionId: number;
        leader: number;
        replicas: number[];
        isr: number[];
      }[];
    }[] = [];
    for (const [topicName, topicMeta] of meta.topics) {
      if (!topicMeta) continue;
      const partitionMetadata: {
        partitionErrorCode: number;
        partitionId: number;
        leader: number;
        replicas: number[];
        isr: number[];
      }[] = [];
      for (let partitionId = 0; partitionId < topicMeta.partitions.length; partitionId++) {
        const partition = topicMeta.partitions[partitionId];
        partitionMetadata.push({
          partitionErrorCode: 0,
          partitionId,
          leader: partition.leader,
          replicas: partition.replicas,
          isr: partition.isr,
        });
      }
      topicMetadata.push({
        topicErrorCode: 0,
        topic: topicName,
        isInternal: topicName.startsWith('__'),
        partitionMetadata,
      });
    }

    const result = {
      throttleTime: 0,
      brokers: brokerList,
      clusterId: meta.id,
      controllerId: meta.controllerId,
      topicMetadata,
    };

    writeJsonlMany(result);
  } finally {
    await admin.close();
  }
}
