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

const Admin = vi.fn().mockImplementation(() => ({
  metadata: vi.fn().mockResolvedValue({ brokers: new Map(), topics: new Map(), id: 'test' }),
  createTopics: vi.fn().mockResolvedValue([]),
  deleteTopics: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
}));

export const adminClient = { Admin };

export const Consumer = vi.fn().mockImplementation(() => ({
  consume: vi.fn().mockResolvedValue({
    [Symbol.asyncIterator]: async function* () {},
    close: vi.fn().mockResolvedValue(undefined),
  }),
  listOffsets: vi.fn().mockResolvedValue(new Map()),
  listCommittedOffsets: vi.fn().mockResolvedValue(new Map()),
  close: vi.fn().mockResolvedValue(undefined),
}));

export const Producer = vi.fn().mockImplementation(() => ({
  send: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
}));
