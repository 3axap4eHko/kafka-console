type WritableLike = Pick<NodeJS.WritableStream, 'write'>;

export function writeJsonl(value: unknown, output: WritableLike = process.stdout): void {
  output.write(`${JSON.stringify(value)}\n`);
}

export function writeJsonlMany(values: unknown, output: WritableLike = process.stdout): void {
  if (Array.isArray(values)) {
    for (const value of values) {
      writeJsonl(value, output);
    }
    return;
  }

  writeJsonl(values, output);
}
