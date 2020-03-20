import event, { Listener } from 'evnty';

export interface Item<T = any> {
  promise?: Promise<T>;
  resolve?: (value: any) => void;
  reject?: (value: any) => void
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

}

export default class Pool<T> {
  private pool: Item<T>[] = [createItem<T>()];
  private doneEvent = event();

  constructor(values: T[] = []) {
    values.forEach(value => this.push(value));
  }

  push(value: T | Promise<T>) {
    this.pool[this.pool.length - 1].resolve(value);
    this.pool.push(createItem<T>());

    return this;
  }

  done() {
    this.pool[this.pool.length - 1].resolve(new CancelToken());

    return this;
  }

  onDone(callback: Listener) {
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
          this.doneEvent();
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
  };
}
