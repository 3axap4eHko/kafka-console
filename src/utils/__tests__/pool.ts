import Pool from '../pool';

describe('PullIterator test suite', () => {
  it('Should iterate an empty pool', async () => {
    const pool = new Pool().done();
    const result = [];
    for await (let item of pool) {
      result.push(item);
    }
    expect(result).toEqual([]);
  });
  it('Should iterate a pool with initial values', async () => {
    const pool = new Pool([1, 2, 3, 4, 5]).done();
    const result = [];
    for await (let item of pool) {
      result.push(item);
    }
    expect(result).toEqual([1, 2, 3, 4, 5]);
  });

  it('Should iterate a pool with initial values and pushed values', async () => {
    const pool = new Pool([1, 2, 3, 4]);
    pool.push(5);
    pool.done();
    const result = [];
    for await (let item of pool) {
      result.push(item);
    }
    expect(result).toEqual([1, 2, 3, 4, 5]);
  });

  it('Should ignore values after pool is done', async () => {
    const pool = new Pool([1, 2, 3, 4]).done();
    pool.push(5);
    const result = [];
    for await (let item of pool) {
      result.push(item);
    }
    expect(result).toEqual([1, 2, 3, 4]);
  });

  it('Should convert a pool to an array', async () => {
    const pool = new Pool([1, 2, 3, 4]).done();
    const result = await pool.toArray();
    expect(result).toEqual([1, 2, 3, 4]);
  });
});
