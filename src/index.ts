import Fs from 'fs';
import Path from 'path';
import { Message } from 'kafkajs';
import { PassThrough } from 'stream';
import { createInterface } from 'readline';
import { promisify } from 'util';
import commander from 'commander';
import {
  createClient,
  createCluster,
  createAdmin,
  createConsumer,
  createProducer,
  resourceParser,
} from './utils/kafka';
import * as formatters from './utils/formatters';
import { Formatter, Format } from './utils/formatters';
import Pool from './utils/pool';

const { version } = require('../package.json');

const readFile = promisify(Fs.readFile);

function getFormatter<T>(format: Format): Formatter<T> {
  switch (format) {
    case 'json':
      return formatters.json;
    case 'js':
      return formatters.js;
    default:
      const modulePath = Path.resolve(process.cwd(), format);
      return require(modulePath) as Formatter<T>;
  }
}

commander
.option('-b, --brokers <brokers>', 'bootstrap server host', 'localhost:9092')
.option('-l, --log-level <logLevel>', 'log level')
.option('--ssl', 'enable ssl', false)
.option('--sasl-mechanism <mechanism>', 'sasl mechanism', 'plain')
.option('--sasl-username <username>', 'sasl username')
.option('--sasl-password <password>', 'sasl password')
.version(version);

commander
.command('consume <topic>')
.requiredOption('-g, --group <group>', 'consumer group name')
.option('-f, --format <format>', 'message type decoding', 'json')
.option('-o, --output <filename>', 'write output to specified filename')
.option('-a, --from-beginning', 'read messages from the beginning', true)
.description('Consume kafka topic events')
.action(async (topic, {
  group,
  format,
  fromBeginning,
  filename,
  parent: { brokers, logLevel, ssl, mechanism, username, password },
}) => {
  const client = createClient(brokers, ssl, mechanism, username, password, logLevel);
  const output = filename ? Fs.createWriteStream(filename) : process.stdout;

  const consumer = await createConsumer(client, group, topic, fromBeginning);
  const formatter = getFormatter(format);
  for await (let { message: { headers, key, value } } of consumer) {
    const parsedHeaders = Object.entries(headers).reduce((result: any, [key, value]) => {
      return {
        ...result,
        [key]: value.toString(),
      };
    }, {});
    const message = { headers: parsedHeaders, key: key.toString(), value: await formatter.decode(value) };
    output.write(JSON.stringify(message, null, '  ') + '\n');
  }
});

function collect(value: any, result: any[]) {
  return result.concat([value]);
}

async function getInput<T>(filename: string): Promise<Pool<T>> {
  if (filename) {
    const content = await readFile(filename, 'utf8');
    const result = JSON.parse(content) as T[];
    return new Pool<T>(result).done();
  } else {
    const input = new PassThrough();
    const readLine = createInterface({ input });
    const dataPool = new Pool<T>();
    readLine.on('line', async (line) => {
      dataPool.push(await JSON.parse(line));
    });
    readLine.on('close', () => dataPool.done());
    process.stdin.pipe(input);
    return dataPool;
  }
}

commander
.command('produce <topic>')
.option('-f, --format <format>', 'message format encoding', 'json')
.option('-i, --input <filename>', 'input filename')
.option('-d, --delay <delay>', 'delay in ms after event emitting', parseInt, 0)
.option('-h, --header <header>', 'set a static header', collect, [])
.description('Produce kafka topic events')
.action(async (topic, options) => {
  const {
    format,
    header,
    input: filename,
    delay,
    parent: { brokers, logLevel, ssl, mechanism, username, password },
  } = options;
  const client = createClient(brokers, ssl, mechanism, username, password, logLevel);
  const producer = await createProducer(client, topic);
  const staticHeaders = header.reduce((result: any, header: string) => {
    try {
      const [, key, value] = header.match(/^([^:]+):(.*)$/);
      return {
        ...result,
        [key.trim()]: value.trim(),
      };
    } catch (e) {
      console.error(e);
    }
    return result;
  }, {});

  const formatter = getFormatter(format);
  const input = await getInput<Message>(filename);
  for await (let { key, value, headers } of input) {
    const encodedValue = await formatter.encode(value);
    const message = { key, value: encodedValue, headers: { ...staticHeaders, ...headers } };
    producer.push(message);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  producer.done();
});

commander
.command('metadata')
.description('Displays kafka server metadata')
.action(async ({ parent: { brokers, logLevel, ssl, mechanism, username, password } }) => {
  const client = createClient(brokers, ssl, mechanism, username, password, logLevel);
  const cluster = await createCluster(client);
  const metadata = await cluster.metadata();
  console.log(JSON.stringify(metadata, null, '  '));
  await cluster.disconnect();
});

commander
.command('list')
.alias('ls')
.option('-a, --all', 'include internal topics')
.description('Lists kafka topics')
.action(async ({ all, parent: { brokers, logLevel, ssl, mechanism, username, password } }) => {
  const client = createClient(brokers, ssl, mechanism, username, password, logLevel);
  const cluster = await createCluster(client);
  const topics = (await cluster.metadata()).topicMetadata
  .filter(topic => all || !topic.isInternal)
  .map(({ topic }) => topic);
  console.log(JSON.stringify(topics, null, '  '));
  await cluster.disconnect();
});


commander
.command('config')
.requiredOption('-r, --resource <resource>', 'resource', resourceParser)
.requiredOption('-n, --resourceName <resourceName>', 'resource name')
.description('Describes config for specific resource')
.action(async ({ resource, resourceName: name, parent: { brokers, logLevel, ssl, mechanism, username, password } }) => {
  const client = createClient(brokers, ssl, mechanism, username, password, logLevel);
  const admin = await createAdmin(client);
  const { resources } = await admin.describeConfigs({
    includeSynonyms: true,
    resources: [
      {
        type: resource,
        name,
      },
    ],
  });
  for (let resource of resources) {
    console.log(resource);
  }
  await admin.disconnect();
});

commander
.command('create <topic>')
.description('Creates kafka topic')
.action(async (topic, { parent: { brokers, logLevel, ssl, mechanism, username, password } }) => {
  const client = createClient(brokers, ssl, mechanism, username, password, logLevel);
  const admin = await createAdmin(client);

  const topics = await admin.createTopics({
    topics: [{ topic }],
  });
  console.log(topics);
  await admin.disconnect();
});

commander
.command('delete <topic>')
.description('Deletes kafka topic')
.action(async (topic, { parent: { brokers, logLevel, ssl, mechanism, username, password } }) => {
  const client = createClient(brokers, ssl, mechanism, username, password, logLevel);
  const admin = await createAdmin(client);

  await admin.deleteTopics({
    topics: [topic],
  });
  await admin.disconnect();
});

commander.on('--help', function() {
  [
    '',
    'Examples:',
    '',
    '  General consumer usage',
    '  $ kcli consume $KAFKA_TOPIC -g $KAFKA_TOPIC_GROUP -b $KAFKA_BROKERS --ssl --sasl-username $KAFKA_USERNAME --sasl-password $KAFKA_PASSWORD',
    '',
    '  Extracting consumer output with jq',
    '  $ kcli consume $KAFKA_TOPIC -g $KAFKA_TOPIC_GROUP --f ./formatter/avro.js | jq .value',
    '',
    '  General producer usage',
    '  $ kcli produce $KAFKA_TOPIC -b $KAFKA_BROKERS --ssl --sasl-username $KAFKA_USERNAME --sasl-password $KAFKA_PASSWORD',
    '',
    '  Preparing producer payload json data with jq',
    '  $ cat payload.json|jq -r -c .[]|kcli produce $KAFKA_TOPIC -f ./formatter/avro.js',
    '',
  ].forEach(msg => console.log(msg));
});

commander.parse(process.argv);
