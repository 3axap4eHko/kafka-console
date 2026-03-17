import { afterEach, describe, expect, it, vi } from 'vitest';

function createContext() {
  return {
    parent: {
      opts: () => ({
        brokers: 'localhost:9092',
        timeout: 0,
        ssl: false,
        insecure: false,
      }),
    },
  };
}

describe('metadata command', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('includes partition ISR data in output', async () => {
    const kafka = await import('@platformatic/kafka');
    const close = vi.fn().mockResolvedValue(undefined);
    const listTopics = vi.fn().mockResolvedValue(['topic-a']);
    const metadata = vi.fn().mockResolvedValue({
      brokers: new Map([[1, { host: 'localhost', port: 9092 }]]),
      topics: new Map([
        [
          'topic-a',
          {
            partitions: [
              {
                leader: 1,
                replicas: [1, 2],
                isr: [1],
              },
            ],
          },
        ],
      ]),
      id: 'cluster-id',
    });

    vi.mocked(kafka.Admin).mockImplementationOnce(function () {
      return {
        listTopics,
        metadata,
        close,
      };
    });

    const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const { default: metadataCommand } = await import('../metadata');

    await metadataCommand({}, createContext());

    const [output] = writeSpy.mock.calls[0] as [string];
    const result = JSON.parse(output);
    expect(result.topicMetadata[0].partitionMetadata[0].isr).toEqual([1]);
    expect(close).toHaveBeenCalledTimes(1);
  });
});
