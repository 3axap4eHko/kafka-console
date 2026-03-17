import { vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const actualPath = require.resolve('@platformatic/kafka');
const actual = await import(/* @vite-ignore */ actualPath);

export const {
  ConfigResourceTypes,
  ListOffsetTimestamps,
  MessagesStreamModes,
  stringDeserializers,
  stringSerializers,
} = actual;

export const Admin = vi.fn().mockImplementation(function () {
  return {
    metadata: vi.fn().mockResolvedValue({ brokers: new Map(), topics: new Map(), id: 'test' }),
    listTopics: vi.fn().mockResolvedValue([]),
    createTopics: vi.fn().mockResolvedValue([]),
    deleteTopics: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };
});

export const Consumer = vi.fn().mockImplementation(function () {
  return {
    consume: vi.fn().mockResolvedValue({
      [Symbol.asyncIterator]: async function* () {},
      close: vi.fn().mockResolvedValue(undefined),
    }),
    listOffsets: vi.fn().mockResolvedValue(new Map()),
    listCommittedOffsets: vi.fn().mockResolvedValue(new Map()),
    close: vi.fn().mockResolvedValue(undefined),
  };
});

export const Producer = vi.fn().mockImplementation(function () {
  return {
    send: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };
});
