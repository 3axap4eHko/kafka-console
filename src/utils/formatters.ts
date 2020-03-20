import { runInNewContext } from 'vm';

export interface Encoder<T> {
  (value: T): Promise<string | Buffer> | string | Buffer;
}

export interface Decoder<T> {
  (value: string | Buffer): Promise<T> | T;
}

export interface Formatter<T> {
  encode: Encoder<T>;
  decode: Decoder<T>;
}

export type Format = 'json' | 'js' | string;

export const js: Formatter<any> = {
  encode: (value: any) => JSON.stringify(value, null, '  '),
  decode: (value: string | Buffer) => runInNewContext(value.toString(), { module: {} }),
};

export const json: Formatter<any> = {
  encode: (value: any) => JSON.stringify(value),
  decode: (value: string | Buffer) => JSON.parse(value.toString()),
};
