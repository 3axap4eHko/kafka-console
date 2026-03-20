import { Command } from 'commander';
import { resourceParser } from './utils/kafka.ts';

import consumeCommand from './commands/consume.ts';
import produceCommand from './commands/produce.ts';
import metadataCommand from './commands/metadata.ts';
import listCommand from './commands/list.ts';
import configCommand from './commands/config.ts';
import createTopicCommand from './commands/createTopic.ts';
import deleteTopicCommand from './commands/deleteTopic.ts';
import fetchTopicOffsets from './commands/fetchTopicOffsets.ts';

import { createRequire } from 'node:module';
const { version } = createRequire(import.meta.url)('../package.json') as { version: string };

export function collect(value: string, previous: string[]) {
  return previous.concat([value]);
}

export function toInt(value: string) {
  return parseInt(value, 10);
}

const commander = new Command();

commander
  .name('kafka-console')
  .description('A command-line interface for Apache Kafka operations')
  .option('-b, --brokers <brokers>', 'comma-separated list of bootstrap broker addresses', process.env.KAFKA_BROKERS || 'localhost:9092')
  .option('-t, --timeout <timeout>', 'operation timeout in milliseconds', toInt, toInt(process.env.KAFKA_TIMEOUT || '0'))
  .option('--ssl', 'enable TLS connection', false)
  .option('--insecure', 'disable TLS certificate verification (requires --ssl)', false)
  .option('--mechanism <mechanism>', 'SASL mechanism: plain, scram-sha-256, scram-sha-512, oauthbearer', process.env.KAFKA_MECHANISM)
  .option('--username <username>', 'SASL username (for plain/scram mechanisms)', process.env.KAFKA_USERNAME)
  .option('--password <password>', 'SASL password (for plain/scram mechanisms)', process.env.KAFKA_PASSWORD)
  .option('--oauth-bearer <oauthBearer>', 'SASL OAuth bearer token', process.env.KAFKA_OAUTH_BEARER)
  .version(version);

commander
  .command('consume <topic>')
  .description('Consume messages from a Kafka topic. Outputs one JSON object per line (JSONL) to stdout or a file.')
  .option('-g, --group <group>', 'consumer group name', `kafka-console-consumer-${Date.now()}`)
  .option('-d, --data-format <data-format>', 'message value format: json, raw, or path to a custom formatter module', 'json')
  .option('-o, --output <filename>', 'write output to a file instead of stdout')
  .option('-f, --from <from>', 'start consuming from a timestamp (ms), ISO 8601 date, or 0 for the beginning', undefined)
  .option('-c, --count <count>', 'maximum number of messages to consume', toInt, Infinity)
  .option('-s, --skip <skip>', 'number of messages to skip before outputting', toInt, 0)
  .option('--snapshot', 'consume all existing messages and exit; records the high watermark on start and stops when reached')
  .action(consumeCommand);

commander
  .command('produce <topic>')
  .description(
    'Produce messages to a Kafka topic. Reads JSONL from stdin or a file. Each line must be a JSON object with a "value" field, and optional "key" and "headers" fields.',
  )
  .option('-d, --data-format <data-format>', 'message value format: json, raw, or path to a custom formatter module', 'json')
  .option('-i, --input <filename>', 'read messages from a JSON array file instead of stdin')
  .option('-w, --wait <wait>', 'delay in milliseconds between sending each message', toInt, 0)
  .option('-H, --header <header>', 'static header added to every message (format: key:value), repeatable', collect, [])
  .action(produceCommand);

commander.command('metadata').description('Display cluster metadata: broker list, controller, topic partitions, replicas, and ISR').action(metadataCommand);

commander
  .command('list')
  .alias('ls')
  .description('List topic names, one per line (JSONL). Use --all to include Kafka internal topics.')
  .option('-a, --all', 'include internal topics (e.g. __consumer_offsets)')
  .action(listCommand);

commander
  .command('config')
  .description('Describe the configuration of a Kafka resource (topic, broker, or broker logger)')
  .requiredOption('-r, --resource <resource>', 'resource type: topic, broker, broker_logger', resourceParser)
  .requiredOption('-n, --resourceName <resourceName>', 'resource name (topic name or broker ID)')
  .action(configCommand);

commander
  .command('topic:create <topic>')
  .description('Create a new Kafka topic')
  .option('-p, --partitions <partitions>', 'number of partitions', toInt, 1)
  .option('-r, --replicas <replicas>', 'replication factor', toInt, 1)
  .action(createTopicCommand);

commander.command('topic:delete <topic>').description('Delete a Kafka topic').action(deleteTopicCommand);

commander
  .command('topic:offsets <topic> [timestamp]')
  .description(
    'Show topic partition offsets. Without arguments shows high/low watermarks. With a timestamp (ms or ISO 8601) shows offsets at that point. With --group shows committed offsets for a consumer group.',
  )
  .option('-g, --group <group>', 'show committed offsets for this consumer group instead of watermarks')
  .action(fetchTopicOffsets);

commander.parseAsync(process.argv).catch((e: Error) => {
  console.error(e.message);
  process.exit(1);
});

export default commander;
