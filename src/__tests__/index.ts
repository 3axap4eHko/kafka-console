import commander, { collect } from '../index';

describe('Cli test suite', () => {
  it('Should collect values', () => {
    const result: number[] = [];
    collect(1, result);
    expect(result).toContain(1);
  });

  it('Should call commander', () => {
    expect(commander.parse).toHaveBeenCalled();
  });
});
