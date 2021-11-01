import { Command } from 'commander';
import { collect } from '../index';

const commander = new Command();

describe('Cli test suite', () => {
  it('Should collect values', () => {
    const result: number[] = [];

    expect(collect(1, result)).toContain(1);
  });

  it('Should call commander', () => {
    expect(commander.parse).toHaveBeenCalled();
  });
});
