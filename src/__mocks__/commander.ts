import { vi } from 'vitest';

export const commander: any = {
  name: vi.fn(() => commander),
  command: vi.fn(() => commander),
  option: vi.fn(() => commander),
  version: vi.fn(() => commander),
  requiredOption: vi.fn(() => commander),
  description: vi.fn(() => commander),
  action: vi.fn(() => commander),
  alias: vi.fn(() => commander),
  on: vi.fn(() => commander),
  parse: vi.fn(() => commander),
  parseAsync: vi.fn(() => Promise.resolve()),
};

export class Command {
  constructor() {
    Object.assign(this, commander);
  }
}

