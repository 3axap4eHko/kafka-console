import Path from 'path';
import { runInNewContext } from 'vm';

export interface Encoder<T> {
  (value: T): Promise<string | Buffer> | string | Buffer;
}

export interface Decoder<T> {
  (value: Buffer): Promise<T> | T;
}

export interface Formatter<T> {
  encode: Encoder<T>;
  decode: Decoder<T>;
}

export type Format = 'json' | 'js' | 'raw' | string;

export const json: Formatter<any> = {
  encode: (value: string) => JSON.stringify(value),
  decode: (value: Buffer) => JSON.parse(value.toString()),
};

export const js: Formatter<any> = {
  encode: (value: string) => JSON.stringify(value, null, '  '),
  decode: (value: Buffer) => {
    const m = { exports: {} };
    runInNewContext(value.toString(), { module: m });
    return m.exports;
  },
};

export const raw: Formatter<any> = {
  encode: (value: any) => value,
  decode: (value: Buffer) => value.toString('utf8'),
};

export function getFormatter<T>(format: Format): Formatter<T> {
  switch (format) {
    case 'json':
      return json;
    case 'js':
      return js;
    case 'raw':
      return raw;
    default:
      const modulePath = Path.resolve(process.cwd(), format);
      return require(modulePath) as Formatter<T>;
  }
}
