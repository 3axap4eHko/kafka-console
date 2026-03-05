import { execSync } from 'child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const BROKERS = process.env.KAFKA_BROKERS || 'localhost:9092';
const CLI_PATH = 'node build/cli.js';
const TEST_TOPIC = `e2e-test-${Date.now()}`;
const TEST_GROUP = `e2e-group-${Date.now()}`;
const TMP_DIR = mkdtempSync(join(tmpdir(), 'kafka-e2e-'));

function cli(args: string): string {
  return execSync(`${CLI_PATH} ${args} -b ${BROKERS}`, {
    encoding: 'utf-8',
    timeout: 15000,
  }).trim();
}

function cliWithInput(args: string, input: string): string {
  return execSync(`echo '${input}' | ${CLI_PATH} ${args} -b ${BROKERS}`, {
    encoding: 'utf-8',
    shell: '/bin/bash',
    timeout: 15000,
  }).trim();
}

function cliExpectFail(args: string): { stdout: string; stderr: string } {
  try {
    const stdout = cli(args);
    return { stdout, stderr: '' };
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string };
    return { stdout: (err.stdout ?? '').trim(), stderr: (err.stderr ?? '').trim() };
  }
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
    try {
      rmSync(TMP_DIR, { recursive: true });
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

    it('should pretty print metadata', () => {
      const output = cli('metadata -p');
      expect(output).toContain('\n');
      const metadata = JSON.parse(output);
      expect(metadata).toHaveProperty('brokers');
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

    it('should list topics with ls alias', () => {
      const output = cli('ls');
      const topics = JSON.parse(output);
      expect(topics).toContain(TEST_TOPIC);
    });

    it('should list topics with --all flag including internals', () => {
      const output = cli('list --all');
      const topics = JSON.parse(output) as string[];
      expect(topics).toContain(TEST_TOPIC);
    });

    it('should pretty print topic list', () => {
      const output = cli('list -p');
      expect(output).toContain('\n');
      const topics = JSON.parse(output);
      expect(topics).toContain(TEST_TOPIC);
    });
  });

  describe('config', () => {
    it('should describe topic config', () => {
      const output = cli(`config -r topic -n ${TEST_TOPIC}`);
      const configs = JSON.parse(output);

      expect(Array.isArray(configs)).toBe(true);
      expect(configs.length).toBeGreaterThan(0);
    });

    it('should describe broker config', () => {
      const output = cli('config -r broker -n 1');
      const configs = JSON.parse(output);

      expect(Array.isArray(configs)).toBe(true);
      expect(configs.length).toBeGreaterThan(0);
    });
  });

  describe('produce', () => {
    it('should produce messages via stdin', () => {
      const message = JSON.stringify({ key: 'test-key', value: 'test-value', headers: { h1: 'v1' } });
      cliWithInput(`produce ${TEST_TOPIC}`, message);
    });

    it('should produce multiple messages via stdin', () => {
      for (let i = 0; i < 3; i++) {
        const message = JSON.stringify({ key: `key-${i}`, value: `value-${i}` });
        cliWithInput(`produce ${TEST_TOPIC}`, message);
      }
    });

    it('should produce with static headers', () => {
      const message = JSON.stringify({ key: 'header-key', value: 'header-value' });
      cliWithInput(`produce ${TEST_TOPIC} -h x-source:test -h x-env:e2e`, message);
    });

    it('should produce from input file', () => {
      const filePath = join(TMP_DIR, 'produce-input.json');
      const messages = [
        { key: 'file-key-0', value: 'file-value-0' },
        { key: 'file-key-1', value: 'file-value-1' },
      ];
      writeFileSync(filePath, JSON.stringify(messages));

      cli(`produce ${TEST_TOPIC} --input ${filePath}`);
    });

    it('should produce with raw data format', () => {
      const message = JSON.stringify({ key: 'raw-key', value: 'raw-value' });
      cliWithInput(`produce ${TEST_TOPIC} -d raw`, message);
    });

    it('should produce with --wait', () => {
      const message = JSON.stringify({ key: 'wait-key', value: 'wait-value' });
      cliWithInput(`produce ${TEST_TOPIC} --wait 10`, message);
    });
  });

  describe('consume', () => {
    it('should consume messages from the beginning', () => {
      const group = `${TEST_GROUP}-from0`;
      const output = cli(`consume ${TEST_TOPIC} -g ${group} --from 0 --count 4 -t 10000`);
      const messages = output.split('\n').map(line => JSON.parse(line));

      expect(messages.length).toBe(4);
      expect(messages[0]).toHaveProperty('key', 'test-key');
      expect(messages[0]).toHaveProperty('value', 'test-value');
      expect(messages[0]).toHaveProperty('headers');
      expect(messages[0].headers).toHaveProperty('h1', 'v1');
      expect(messages[0]).toHaveProperty('partition');
      expect(messages[0]).toHaveProperty('offset');
      expect(messages[0]).toHaveProperty('timestamp');
      expect(messages[0]).toHaveProperty('ahead');
    });

    it('should skip messages with --skip', () => {
      const group = `${TEST_GROUP}-skip`;
      const output = cli(`consume ${TEST_TOPIC} -g ${group} --from 0 --skip 2 --count 2 -t 10000`);
      const messages = output.split('\n').map(line => JSON.parse(line));

      expect(messages.length).toBe(2);
      expect(messages[0]).toHaveProperty('key', 'key-1');
      expect(messages[1]).toHaveProperty('key', 'key-2');
    });

    it('should consume with --from ISO timestamp', () => {
      const past = new Date(Date.now() - 120000).toISOString();
      const group = `${TEST_GROUP}-iso`;
      const output = cli(`consume ${TEST_TOPIC} -g ${group} --from "${past}" --count 1 -t 10000`);
      const messages = output.split('\n').map(line => JSON.parse(line));

      expect(messages.length).toBe(1);
      expect(messages[0]).toHaveProperty('key');
      expect(messages[0]).toHaveProperty('value');
    });

    it('should pretty print consumed messages', () => {
      const group = `${TEST_GROUP}-pretty`;
      const output = cli(`consume ${TEST_TOPIC} -g ${group} --from 0 --count 1 -t 10000 -p`);
      expect(output).toContain('\n');
      const message = JSON.parse(output);
      expect(message).toHaveProperty('key', 'test-key');
    });

    it('should write output to file', () => {
      const outPath = join(TMP_DIR, 'consume-output.json');
      const group = `${TEST_GROUP}-file`;
      cli(`consume ${TEST_TOPIC} -g ${group} --from 0 --count 2 -t 10000 --output ${outPath}`);

      expect(existsSync(outPath)).toBe(true);
      const content = readFileSync(outPath, 'utf8').trim();
      const messages = content.split('\n').map(line => JSON.parse(line));
      expect(messages.length).toBe(2);
      expect(messages[0]).toHaveProperty('key', 'test-key');
    });

    it('should consume with raw data format', () => {
      const group = `${TEST_GROUP}-raw`;
      const output = cli(`consume ${TEST_TOPIC} -g ${group} --from 0 --count 1 -t 10000 -d raw`);
      const message = JSON.parse(output);
      expect(message).toHaveProperty('key', 'test-key');
      // raw decoder returns the string as-is (JSON-encoded value from producer)
      expect(message).toHaveProperty('value', '"test-value"');
    });

    it('should consume static headers from producer', () => {
      const group = `${TEST_GROUP}-headers`;
      // Message at offset 4 has static headers x-source:test and x-env:e2e
      const output = cli(`consume ${TEST_TOPIC} -g ${group} --from 0 --skip 4 --count 1 -t 10000`);
      const message = JSON.parse(output);
      expect(message).toHaveProperty('key', 'header-key');
      expect(message.headers).toHaveProperty('x-source', 'test');
      expect(message.headers).toHaveProperty('x-env', 'e2e');
    });

    it('should consume messages produced from file', () => {
      const group = `${TEST_GROUP}-fileinput`;
      // Messages at offsets 5-6 were produced from file
      const output = cli(`consume ${TEST_TOPIC} -g ${group} --from 0 --skip 5 --count 2 -t 10000`);
      const messages = output.split('\n').map(line => JSON.parse(line));
      expect(messages.length).toBe(2);
      expect(messages[0]).toHaveProperty('key', 'file-key-0');
      expect(messages[1]).toHaveProperty('key', 'file-key-1');
    });

    it('should timeout when no messages available', () => {
      const group = `${TEST_GROUP}-timeout`;
      const result = cliExpectFail(`consume ${TEST_TOPIC} -g ${group} -t 2000`);
      expect(result.stderr).toContain('TIMEOUT');
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
      const output = cli(`topic:offsets ${TEST_TOPIC} -g ${TEST_GROUP}-from0`);
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
