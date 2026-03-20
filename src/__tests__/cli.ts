import { describe, it, expect } from 'vitest';
import commander from '../index';
import '../cli';

describe('Cli test suite', () => {
  it('Should call commander', () => {
    expect(commander.parseAsync).toHaveBeenCalled();
  });

  it('Should not advertise js as a built-in data format', () => {
    const descriptions = commander.option.mock.calls
      .filter(([value]: [string]) => value === '-d, --data-format <data-format>')
      .map(([, description]: [string, string]) => description);

    expect(descriptions).toHaveLength(2);
    expect(descriptions).toEqual(
      expect.arrayContaining([
        'message value format: json, raw, or path to a custom formatter module',
      ]),
    );
    expect(descriptions.join(' ')).not.toMatch(/\bjs\b/);
  });

  it('Should register the insecure TLS flag', () => {
    const flags = commander.option.mock.calls.map(([value]: [string]) => value);

    expect(flags).toContain('--insecure');
  });

  it('Should register -H as the header shorthand', () => {
    const flags = commander.option.mock.calls.map(([value]: [string]) => value);
    expect(flags).toContain('-H, --header <header>');
    expect(flags).not.toContain('-h, --header <header>');
  });
});
