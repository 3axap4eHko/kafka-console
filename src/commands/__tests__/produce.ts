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

describe('produce command', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unmock('fs');
    vi.unmock('readline');
  });

  it('skips stdin messages that do not contain a value field', async () => {
    const line = JSON.stringify({ key: 'missing-value' });

    vi.doMock('readline', () => ({
      createInterface: vi.fn(() => ({
        [Symbol.asyncIterator]: async function* () {
          yield line;
        },
      })),
    }));

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { default: produce } = await import('../produce');
    const kafka = await import('@platformatic/kafka');

    await expect(
      produce(
        'topic',
        {
          dataFormat: 'json',
          header: [],
          wait: 0,
        },
        createContext(),
      ),
    ).resolves.toBeUndefined();

    const producer = vi.mocked(kafka.Producer).mock.results[0]?.value;
    expect(producer.send).not.toHaveBeenCalled();
    expect(producer.close).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(`Invalid message payload: missing or undefined "value" field: ${line}`);
  });

  it('skips stdin messages whose value resolves to undefined', async () => {
    const line = JSON.stringify({ value: 'placeholder' });

    vi.doMock('readline', () => ({
      createInterface: vi.fn(() => ({
        [Symbol.asyncIterator]: async function* () {
          yield line;
        },
      })),
    }));

    vi.spyOn(JSON, 'parse').mockReturnValueOnce({ value: undefined });

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { default: produce } = await import('../produce');
    const kafka = await import('@platformatic/kafka');

    await expect(
      produce(
        'topic',
        {
          dataFormat: 'json',
          header: [],
          wait: 0,
        },
        createContext(),
      ),
    ).resolves.toBeUndefined();

    const producer = vi.mocked(kafka.Producer).mock.results[0]?.value;
    expect(producer.send).not.toHaveBeenCalled();
    expect(producer.close).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(`Invalid message payload: missing or undefined "value" field: ${line}`);
  });

  it('skips invalid file entries and still sends valid messages', async () => {
    const readFile = vi.fn().mockResolvedValue(JSON.stringify([{ key: 'missing-value' }, { key: 'ok', value: 'payload' }]));

    vi.doMock('fs', async () => {
      const actual = await vi.importActual<typeof import('fs')>('fs');
      return {
        ...actual,
        promises: {
          ...actual.promises,
          readFile,
        },
      };
    });

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { default: produce } = await import('../produce');
    const kafka = await import('@platformatic/kafka');

    await expect(
      produce(
        'topic',
        {
          dataFormat: 'json',
          header: [],
          input: 'messages.json',
          wait: 0,
        },
        createContext(),
      ),
    ).resolves.toBeUndefined();

    const producer = vi.mocked(kafka.Producer).mock.results[0]?.value;
    expect(readFile).toHaveBeenCalledWith('messages.json', 'utf8');
    expect(errorSpy).toHaveBeenCalledWith('Invalid message at index 0: missing or undefined "value" field');
    expect(producer.send).toHaveBeenCalledTimes(1);
    expect(producer.send).toHaveBeenCalledWith({
      messages: [
        {
          topic: 'topic',
          key: 'ok',
          value: '"payload"',
          headers: new Map(),
        },
      ],
    });
  });
});
