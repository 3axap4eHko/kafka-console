export class Command {
  constructor() {
    const self = this as any;

    self.command = jest.fn(() => this);
    self.option = jest.fn(() => this);
    self.version = jest.fn(() => this);
    self.requiredOption = jest.fn(() => this);
    self.description = jest.fn(() => this);
    self.action = jest.fn(() => this);
    self.alias = jest.fn(() => this);
    self.on = jest.fn(() => this);
    self.parse = jest.fn(() => this);
  }
}

