import commander from '../index';

describe('Cli test suite', () => {
  it('Should call commander', () => {
    expect(commander.parse).toHaveBeenCalled();
  });
});
