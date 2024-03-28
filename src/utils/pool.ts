import event, { Listener } from 'evnty';

export interface Item<T = any> {
  promise?: Promise<T>;
  resolve?: (value: any) => void;
  reject?: (value: any) => void;
}

export function createItem<T>() {
  const result: Item = {};
  result.promise = new Promise<T>((resolve, reject) => {
    result.resolve = resolve;
    result.reject = reject;
  });
  return result;
}

export class CancelToken {
  constructor(public timeout: boolean) {}
}

export interface PoolOptions {
  skip?: number;
  count?: number;
  timeout?: number;
}

export default class Pool<T> {
  private pool: Item<T>[] = [createItem<T>()];
  private doneEvent = event<boolean, unknown>();
  private index: number;
  private skip: number;
  private count: number;
  private timerId: NodeJS.Timeout;

  constructor(values: T[] = [], { skip = 0, count = Infinity, timeout }: PoolOptions = {}) {
    this.index = 0;
    this.skip = skip;
    this.count = count + skip;
    if (typeof timeout === 'number') {
      this.timerId = setTimeout(() => this.done(true), timeout);
    }
    values.forEach((value) => this.push(value));
    if (count === 0) {
      Promise.resolve().then(() => this.done());
    }
  }

  push(value: T | Promise<T>) {
    if (this.index >= this.skip && this.index < this.count) {
      this.pool[this.pool.length - 1].resolve(value);
      this.pool.push(createItem<T>());
    }
    this.index++;

    if (this.index >= this.count) {
      this.done();
    }

    return this;
  }

  done(timeout: boolean = false) {
    this.pool[this.pool.length - 1].resolve(new CancelToken(timeout));

    return this;
  }

  onDone(callback: Listener<boolean>) {
    this.doneEvent.on(callback);

    return this;
  }

  async toArray() {
    const result = [];
    for await (let item of this) {
      result.push(item);
    }
    return result;
  }

  [Symbol.asyncIterator]() {
    let i = 0;
    return {
      i,
      next: async () => {
        const value = await this.pool[0].promise;
        this.pool.shift();

        if (value instanceof CancelToken) {
          clearTimeout(this.timerId);
          this.doneEvent(value.timeout);
          return {
            i: ++i,
            done: true,
          };
        }
        return {
          i: ++i,
          value,
          done: false,
        };
      },
    };
  }
}
