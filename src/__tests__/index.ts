import { describe, it, expect } from 'vitest';
import { collect, toInt } from '../index';

describe('Cli test suite', () => {
  it('Should collect values', () => {
    const result: string[] = [];

    expect(collect('1', result)).toContain('1');
  });

  it('Should parse integers', () => {
    expect(toInt('42')).toBe(42);
  });
});
