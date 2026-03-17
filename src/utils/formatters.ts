import Path from 'node:path';
import { createRequire } from 'node:module';

export interface Encoder<T> {
  (value: T): Promise<string | Buffer> | string | Buffer;
}

export interface Decoder<T> {
  (value: Buffer | string | null): Promise<T> | T;
}

export interface Formatter<T> {
  encode: Encoder<T>;
  decode: Decoder<T>;
}

export const json: Formatter<unknown> = {
  encode: (value: unknown) => JSON.stringify(value),
  decode: (value: Buffer | string | null) => {
    if (value === null) return null;
    const str = typeof value === 'string' ? value : value.toString();
    return JSON.parse(str) as unknown;
  },
};

export const raw: Formatter<unknown> = {
  encode: (value: unknown) => (typeof value === 'string' ? value : String(value)),
  decode: (value: Buffer | string | null) => {
    if (value === null) return null;
    return typeof value === 'string' ? value : value.toString('utf8');
  },
};

export function getFormatter(format: string): Formatter<unknown> {
  switch (format) {
    case 'json':
      return json;
    case 'raw':
      return raw;
    default: {
      const modulePath = Path.resolve(process.cwd(), format);
      return createRequire(import.meta.url)(modulePath) as Formatter<unknown>;
    }
  }
}
