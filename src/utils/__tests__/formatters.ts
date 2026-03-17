import { describe, it, expect, vi } from 'vitest';
import * as Formatters from '../formatters';

describe('Formatters test suite', () => {
  it.each([
    ['json'],
    ['raw'],
  ])('Should export %s formatter', (type: string) => {
    expect(Formatters).toHaveProperty(type);
  });

  it('JSON formatter should encode via JSON object', () => {
    const data = {};
    const stringify = vi.spyOn(JSON, 'stringify');
    Formatters.json.encode(data);
    expect(stringify).toHaveBeenCalledWith(data);
    stringify.mockRestore();
  });

  it('JSON formatter should decode via JSON object', () => {
    const json = Buffer.from('{}');
    const parse = vi.spyOn(JSON, 'parse');
    const result = Formatters.json.decode(json);
    expect(result).toEqual({});
    expect(parse).toHaveBeenCalledWith(json.toString());
    parse.mockRestore();
  });

  it('Raw formatter should encode strings without JSON serialization', () => {
    const data = 'payload';

    expect(Formatters.raw.encode(data)).toBe(data);
  });

  it('Raw formatter should decode buffers to UTF-8 strings', () => {
    const result = Formatters.raw.decode(Buffer.from('payload'));

    expect(result).toBe('payload');
  });

  it('Should not export js formatter', () => {
    expect(Formatters).not.toHaveProperty('js');
  });
});
