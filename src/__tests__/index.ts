import '../index.ts';
import commander from 'commander';

describe('Cli test suite', () => {
  it('Should call commander', () => {
    expect(commander.parse).toHaveBeenCalled();
  });
});
