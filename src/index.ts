import { Command } from 'commander';
import {
  resourceParser,
} from './utils/kafka';

import consumeCommand from './commands/consume';
import produceCommand from './commands/produce';
import metadataCommand from './commands/metadata';
import listCommand from './commands/list';
import configCommand from './commands/config';
import createTopicCommand from './commands/createTopic';
import deleteTopicCommand from './commands/deleteTopic';

const { version } = require('../package.json');

export function collect(value: any, result: any[]) {
  return result.concat([value]);
}

export function toInt(value: any, result: any) {
  return parseInt(value, 10);
}

const commander = new Command();

commander
.option('-b, --brokers <brokers>', 'bootstrap server host', process.env.KAFKA_BROKERS || 'localhost:9092')
.option('-l, --log-level <logLevel>', 'log level')
.option('-t, --timeout <timeout>', 'set a timeout of operation', toInt, process.env.KAFKA_TIMEOUT || '0')
.option('--ssl', 'enable ssl', false)
.option('--mechanism <mechanism>', 'sasl mechanism', process.env.KAFKA_MECHANISM)
.option('--username <username>', 'sasl username', process.env.KAFKA_USERNAME)
.option('--password <password>', 'sasl password', process.env.KAFKA_PASSWORD)
.option('--auth-id <authId>', 'sasl aws authorization identity', process.env.KAFKA_AUTH_ID)
.option('--access-key-id <accessKeyId>', 'sasl aws access key id', process.env.KAFKA_ACCESS_KEY_ID)
.option('--secret-access-key <secretAccessKey>', 'sasl aws secret access key', process.env.KAFKA_SECRET_ACCESS_KEY)
.option('--session-token <seccionToken>', 'sasl aws session token', process.env.KAFKA_SESSION_TOKEN)
.option('--oauth-bearer <oauthBearer>', 'sasl oauth bearer token', process.env.KAFKA_OAUTH_BEARER)
.version(version);

commander
.command('consume <topic>')
.requiredOption('-g, --group <group>', 'consumer group name')
.option('-f, --format <format>', 'message type decoding json, js, raw', 'json')
.option('-o, --output <filename>', 'write output to specified filename')
.option('-a, --from-beginning', 'read messages from the beginning', false)
.option('-c, --count <count>', 'a number of messages to read', toInt, Infinity)
.option('-s, --skip <skip>', 'a number of messages to skip', toInt, 0)
.description('Consume kafka topic events')
.action(consumeCommand);


commander
.command('produce <topic>')
.option('-f, --format <format>', 'message format encoding json, js, raw', 'json')
.option('-i, --input <filename>', 'input filename')
.option('-d, --delay <delay>', 'delay in ms after event emitting', toInt, 0)
.option('-h, --header <header>', 'set a static header', collect, [])
.description('Produce kafka topic events')
.action(produceCommand);

commander
.command('metadata')
.description('Displays kafka server metadata')
.action(metadataCommand);

commander
.command('list')
.alias('ls')
.option('-a, --all', 'include internal topics')
.description('Lists kafka topics')
.action(listCommand);


commander
.command('config')
.requiredOption('-r, --resource <resource>', 'resource', resourceParser)
.requiredOption('-n, --resourceName <resourceName>', 'resource name')
.description('Describes config for specific resource')
.action(configCommand);

commander
.command('create <topic>')
.description('Creates kafka topic')
.action(createTopicCommand);

commander
.command('delete <topic>')
.description('Deletes kafka topic')
.action(deleteTopicCommand);

commander.on('--help', function() {
  [
    '',
    'Examples:',
    '',
    '  General consumer usage',
    '  $ kcli consume $KAFKA_TOPIC -g $KAFKA_TOPIC_GROUP -b $KAFKA_BROKERS --ssl --mechanism plain --username $KAFKA_USERNAME --password $KAFKA_PASSWORD',
    '',
    '  Extracting consumer output with jq',
    '  $ kcli consume $KAFKA_TOPIC -g $KAFKA_TOPIC_GROUP --f ./formatter/avro.js | jq .value',
    '',
    '  General producer usage',
    '  $ kcli produce $KAFKA_TOPIC -b $KAFKA_BROKERS --ssl --mechanism plain --username $KAFKA_USERNAME --password $KAFKA_PASSWORD',
    '',
    '  Preparing producer payload json data with jq',
    '  $ cat payload.json|jq -r -c .[]|kcli produce $KAFKA_TOPIC -f ./formatter/avro.js',
    '',
  ].forEach(msg => console.log(msg));
});

commander.parse(process.argv);

export default commander;
