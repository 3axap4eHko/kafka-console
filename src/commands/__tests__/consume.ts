import { EventEmitter } from 'node:events';
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

describe('consume command', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unmock('fs');
    vi.unmock('node:stream/promises');
  });

  it('resolves file output cleanup even when finish fires during end', async () => {
    const output = new EventEmitter() as EventEmitter & {
      end: ReturnType<typeof vi.fn>;
      write: ReturnType<typeof vi.fn>;
      writableFinished: boolean;
    };

    output.writableFinished = false;
    output.write = vi.fn(() => true);
    output.end = vi.fn(() => {
      output.writableFinished = true;
      output.emit('finish');
    });

    const createWriteStream = vi.fn(() => output);
    const finishedMock = vi.fn(async () => undefined);

    vi.doMock('fs', async () => {
      const actual = await vi.importActual<typeof import('fs')>('fs');
      return {
        ...actual,
        createWriteStream,
      };
    });

    vi.doMock('node:stream/promises', () => ({
      finished: finishedMock,
    }));

    const { default: consume } = await import('../consume');

    const consumePromise = consume(
      'topic',
      {
        group: 'group',
        dataFormat: 'json',
        count: 0,
        skip: 0,
        output: 'messages.jsonl',
      },
      createContext(),
    );

    await expect(
      Promise.race([
        consumePromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('consume hung waiting for finish')), 100)),
      ]),
    ).resolves.toBeUndefined();

    expect(createWriteStream).toHaveBeenCalledWith('messages.jsonl');
    expect(output.end).toHaveBeenCalledTimes(1);
    expect(finishedMock).toHaveBeenCalledWith(output);
  });

  it('closes consumer cleanly on SIGINT without timeout', async () => {
    let releaseStream: (() => void) | undefined;
    let markIteratorReady: (() => void) | undefined;
    const iteratorReady = new Promise<void>((resolve) => {
      markIteratorReady = resolve;
    });
    const stream = {
      close: vi.fn(async () => {
        releaseStream?.();
      }),
      [Symbol.asyncIterator]: async function* () {
        markIteratorReady?.();
        await new Promise<void>((resolve) => {
          releaseStream = resolve;
        });
      },
    };
    const consumerClose = vi.fn().mockResolvedValue(undefined);

    const kafka = await import('@platformatic/kafka');
    vi.mocked(kafka.Consumer).mockImplementationOnce(function () {
      return {
        consume: vi.fn().mockResolvedValue(stream),
        listOffsets: vi.fn().mockResolvedValue(new Map()),
        listCommittedOffsets: vi.fn().mockResolvedValue(new Map()),
        close: consumerClose,
      };
    });

    const { default: consume } = await import('../consume');

    const consumePromise = consume(
      'topic',
      {
        group: 'group',
        dataFormat: 'json',
        count: Infinity,
        skip: 0,
      },
      createContext(),
    );

    await iteratorReady;
    process.emit('SIGINT');

    await expect(
      Promise.race([
        consumePromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('consume hung after SIGINT')), 100)),
      ]),
    ).resolves.toBeUndefined();

    expect(stream.close).toHaveBeenCalledTimes(2);
    expect(consumerClose).toHaveBeenCalledTimes(1);
  });

  it('closes cleanly when SIGINT arrives before consume setup finishes', async () => {
    let rejectConsume: ((error: Error) => void) | undefined;
    const consumerClose = vi.fn().mockImplementation(async () => {
      rejectConsume?.(new Error('interrupted'));
    });

    const kafka = await import('@platformatic/kafka');
    vi.mocked(kafka.Consumer).mockImplementationOnce(function () {
      return {
        consume: vi.fn(
          () =>
            new Promise((_, reject: (error: Error) => void) => {
              rejectConsume = reject;
            }),
        ),
        listOffsets: vi.fn().mockResolvedValue(new Map()),
        listCommittedOffsets: vi.fn().mockResolvedValue(new Map()),
        close: consumerClose,
      };
    });

    const { default: consume } = await import('../consume');

    const consumePromise = consume(
      'topic',
      {
        group: 'group',
        dataFormat: 'json',
        count: Infinity,
        skip: 0,
      },
      createContext(),
    );

    await new Promise((r) => setTimeout(r, 0));
    process.emit('SIGINT');

    await expect(
      Promise.race([
        consumePromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('consume hung during startup SIGINT')), 100)),
      ]),
    ).resolves.toBeUndefined();

    expect(consumerClose).toHaveBeenCalledTimes(2);
  });

  it('preserves the first cleanup error when file finalization also fails', async () => {
    const consumerCloseError = new Error('consumer close failed');
    const outputFinishError = new Error('output finish failed');
    const output = new EventEmitter() as EventEmitter & {
      end: ReturnType<typeof vi.fn>;
      write: ReturnType<typeof vi.fn>;
      writableFinished: boolean;
    };

    output.writableFinished = false;
    output.write = vi.fn(() => true);
    output.end = vi.fn(() => {
      output.writableFinished = true;
    });

    const createWriteStream = vi.fn(() => output);
    const finishedMock = vi.fn(async () => {
      throw outputFinishError;
    });

    vi.doMock('fs', async () => {
      const actual = await vi.importActual<typeof import('fs')>('fs');
      return {
        ...actual,
        createWriteStream,
      };
    });

    vi.doMock('node:stream/promises', () => ({
      finished: finishedMock,
    }));

    const kafka = await import('@platformatic/kafka');
    vi.mocked(kafka.Consumer).mockImplementationOnce(function () {
      return {
        consume: vi.fn().mockResolvedValue({
          [Symbol.asyncIterator]: async function* () {},
          close: vi.fn().mockResolvedValue(undefined),
        }),
        listOffsets: vi.fn().mockResolvedValue(new Map()),
        listCommittedOffsets: vi.fn().mockResolvedValue(new Map()),
        close: vi.fn().mockRejectedValue(consumerCloseError),
      };
    });

    const { default: consume } = await import('../consume');

    await expect(
      consume(
        'topic',
        {
          group: 'group',
          dataFormat: 'json',
          count: 0,
          skip: 0,
          output: 'messages.jsonl',
        },
        createContext(),
      ),
    ).rejects.toBe(consumerCloseError);

    expect(createWriteStream).toHaveBeenCalledWith('messages.jsonl');
    expect(output.end).toHaveBeenCalledTimes(1);
    expect(finishedMock).toHaveBeenCalledWith(output);
  });
});
