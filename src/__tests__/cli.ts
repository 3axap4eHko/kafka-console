import { Command } from 'commander';
import '../cli';

const commander = new Command();

describe('Cli test suite', () => {
  it('Should call commander', () => {
    expect(commander.parseAsync).toHaveBeenCalled();
  });
});
