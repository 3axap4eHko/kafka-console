import { PassThrough } from 'stream';
import { ConsumerConfig, Kafka, KafkaConfig } from 'kafkajs';
import consume, { SubscribeOptions } from '../consume';
import * as JSON from '../formats/JSON';

const BROKERS = process.env.KAFKA_BROKERS.split(',');
const GROUP = 'test-group';
const TOPIC = 'test-topic';

const options: KafkaConfig = {
  clientId: 'CLI consumer',
  brokers: BROKERS,
};
const consumerConfig: ConsumerConfig = {
  groupId: GROUP,
};
const consumerOptions: SubscribeOptions = {
  topic: TOPIC,
  fromBeginning: true,
};

const client = new Kafka(options);

function outputStream() {
  const stream = new PassThrough();
  const promise = new Promise(resolve => {
    let buffer = Buffer.from([]);
    stream.on('data', data => buffer = Buffer.concat([buffer, data]));
    stream.on('end', () => resolve(buffer));
  });
  return {
    stream,
    promise,
  };
}

describe('Consume e2e test suite', () => {
  it('', () => {
    const output = outputStream();
    consume(options, consumerConfig, consumerOptions, message => JSON.decode(message), output.stream);
  });
});
