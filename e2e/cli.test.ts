import { execSync, spawn } from 'child_process';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const BROKERS = process.env.KAFKA_BROKERS || 'localhost:9092';
const CLI_PATH = 'node build/cli.js';
const TEST_TOPIC = `e2e-test-${Date.now()}`;
const TEST_GROUP = `e2e-group-${Date.now()}`;

function cli(args: string): string {
  return execSync(`${CLI_PATH} ${args} -b ${BROKERS}`, {
    encoding: 'utf-8',
    timeout: 10000,
  }).trim();
}

function cliWithInput(args: string, input: string): string {
  return execSync(`echo '${input}' | ${CLI_PATH} ${args} -b ${BROKERS}`, {
    encoding: 'utf-8',
    shell: '/bin/bash',
    timeout: 10000,
  }).trim();
}

describe('CLI e2e tests', () => {
  beforeAll(() => {
    execSync('pnpm build', { encoding: 'utf-8' });
  });

  afterAll(() => {
    try {
      cli(`topic:delete ${TEST_TOPIC}`);
    } catch {
      // ignore cleanup errors
    }
  });

  describe('metadata', () => {
    it('should return cluster metadata', () => {
      const output = cli('metadata');
      const metadata = JSON.parse(output);

      expect(metadata).toHaveProperty('brokers');
      expect(metadata).toHaveProperty('clusterId');
      expect(metadata).toHaveProperty('controllerId');
      expect(Array.isArray(metadata.brokers)).toBe(true);
      expect(metadata.brokers.length).toBeGreaterThan(0);
      expect(metadata.brokers[0]).toHaveProperty('host');
      expect(metadata.brokers[0]).toHaveProperty('port');
    });
  });

  describe('topic:create', () => {
    it('should create a topic', () => {
      const output = cli(`topic:create ${TEST_TOPIC}`);
      const topics = JSON.parse(output);

      expect(Array.isArray(topics)).toBe(true);
      expect(topics.length).toBe(1);
      expect(topics[0]).toHaveProperty('name', TEST_TOPIC);
      expect(topics[0]).toHaveProperty('partitions');
      expect(topics[0]).toHaveProperty('replicas');
    });
  });

  describe('list', () => {
    it('should list topics including the created one', () => {
      const output = cli('list');
      const topics = JSON.parse(output);

      expect(Array.isArray(topics)).toBe(true);
      expect(topics).toContain(TEST_TOPIC);
    });
  });

  describe('produce', () => {
    it('should produce messages', () => {
      const message = JSON.stringify({ key: 'test-key', value: 'test-value', headers: { h1: 'v1' } });
      cliWithInput(`produce ${TEST_TOPIC}`, message);
    });

    it('should produce multiple messages', () => {
      for (let i = 0; i < 3; i++) {
        const message = JSON.stringify({ key: `key-${i}`, value: `value-${i}` });
        cliWithInput(`produce ${TEST_TOPIC}`, message);
      }
    });
  });

  describe('consume', () => {
    it('should consume messages from the beginning', () => {
      const output = cli(`consume ${TEST_TOPIC} -g ${TEST_GROUP} --from 0 --count 4 --timeout 5000`);
      const messages = output.split('\n').map(line => JSON.parse(line));

      expect(messages.length).toBe(4);
      expect(messages[0]).toHaveProperty('key', 'test-key');
      expect(messages[0]).toHaveProperty('value', 'test-value');
      expect(messages[0]).toHaveProperty('headers');
      expect(messages[0].headers).toHaveProperty('h1', 'v1');
    });
  });

  describe('topic:offsets', () => {
    it('should return topic offsets (high/low)', () => {
      const output = cli(`topic:offsets ${TEST_TOPIC}`);
      const offsets = JSON.parse(output);

      expect(Array.isArray(offsets)).toBe(true);
      expect(offsets.length).toBeGreaterThan(0);
      expect(offsets[0]).toHaveProperty('partition');
      expect(offsets[0]).toHaveProperty('offset');
      expect(offsets[0]).toHaveProperty('high');
      expect(offsets[0]).toHaveProperty('low');
      expect(Number(offsets[0].high)).toBeGreaterThanOrEqual(4);
    });

    it('should return consumer group offsets', () => {
      const output = cli(`topic:offsets ${TEST_TOPIC} -g ${TEST_GROUP}`);
      const offsets = JSON.parse(output);

      expect(Array.isArray(offsets)).toBe(true);
      expect(offsets.length).toBe(1);
      expect(offsets[0]).toHaveProperty('topic', TEST_TOPIC);
      expect(offsets[0]).toHaveProperty('partitions');
      expect(Array.isArray(offsets[0].partitions)).toBe(true);
    });

    it('should return offsets by timestamp', () => {
      const timestamp = new Date(Date.now() - 60000).toISOString();
      const output = cli(`topic:offsets ${TEST_TOPIC} "${timestamp}"`);
      const offsets = JSON.parse(output);

      expect(Array.isArray(offsets)).toBe(true);
      expect(offsets.length).toBeGreaterThan(0);
      expect(offsets[0]).toHaveProperty('partition');
      expect(offsets[0]).toHaveProperty('offset');
      expect(offsets[0]).not.toHaveProperty('high');
      expect(offsets[0]).not.toHaveProperty('low');
    });
  });

  describe('topic:delete', () => {
    it('should delete the topic', () => {
      cli(`topic:delete ${TEST_TOPIC}`);

      const output = cli('list');
      const topics = JSON.parse(output);
      expect(topics).not.toContain(TEST_TOPIC);
    });
  });
});
