export const commander: any = {
  command: jest.fn(() => commander),
  option: jest.fn(() => commander),
  version: jest.fn(() => commander),
  requiredOption: jest.fn(() => commander),
  description: jest.fn(() => commander),
  action: jest.fn(() => commander),
  alias: jest.fn(() => commander),
  on: jest.fn(() => commander),
  parse: jest.fn(() => commander),
  parseAsync: jest.fn(() => Promise.resolve()),
};

export class Command {
  constructor() {
    Object.assign(this, commander);
  }
}

