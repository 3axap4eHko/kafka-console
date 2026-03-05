import { Sequence } from 'evnty';

export interface PoolOptions {
  skip?: number;
  count?: number;
  timeout?: number;
}

export default class Pool<T> {
  private queue = new Sequence<T>();
  private doneCallback?: (timeout: boolean) => void;
  private index = 0;
  private skip: number;
  private count: number;
  private timerId: NodeJS.Timeout;
  private isDone = false;
  private isTimeout = false;

  constructor(values: T[] = [], { skip = 0, count = Infinity, timeout }: PoolOptions = {}) {
    this.skip = skip;
    this.count = count + skip;
    if (typeof timeout === 'number') {
      this.timerId = setTimeout(() => this.done(true), timeout);
    }
    for (const value of values) this.push(value);
  }

  push(value: T) {
    if (this.isDone) return this;
    if (this.index >= this.skip && this.index < this.count) {
      this.queue.emit(value);
    }
    this.index++;

    if (this.index >= this.count) {
      this.done();
    }

    return this;
  }

  done(timeout = false) {
    if (this.isDone) return this;
    this.isDone = true;
    this.isTimeout = timeout;
    this.queue.dispose();

    return this;
  }

  onDone(callback: (timeout: boolean) => void) {
    this.doneCallback = callback;

    return this;
  }

  async toArray() {
    const result: T[] = [];
    for await (const item of this) {
      result.push(item);
    }
    return result;
  }

  async *[Symbol.asyncIterator]() {
    if (this.count === 0) {
      this.done();
      return;
    }
    try {
      for await (const value of this.queue) {
        yield value;
      }
    } catch {
      // Sequence throws on dispose - this is our "done" signal
    } finally {
      clearTimeout(this.timerId);
      this.doneCallback?.(this.isTimeout);
    }
  }
}
