# Kafka CLI tool

Command line tool to sufficiently and easy work with Kafka

[![NPM version][npm-image]][npm-url]
[![Downloads][downloads-image]][npm-url]


## Installation

```sh
npm install -g kafka-console
```

## Usage

### Consumer usage

General usage with authentication
```sh
kcli consume $KAFKA_TOPIC -g $KAFKA_TOPIC_GROUP -b $KAFKA_BROKERS --ssl --mechanism plain --username $KAFKA_USERNAME --password $KAFKA_PASSWORD
```

Stdout `jq` example
```sh
kcli consume $KAFKA_TOPIC | jq .value
```

Custom data formatter example
```sh
kcli consume $KAFKA_TOPIC --format ./formatter/avro.js | jq
```

### Producer usage

General usage
```sh
kcli produce $KAFKA_TOPIC -b $KAFKA_BROKERS --ssl --mechanism plain --username $KAFKA_USERNAME --password $KAFKA_PASSWORD
```

Produce a json data from stdin with custom formatter
```sh
cat payload.txt|kcli produce $KAFKA_TOPIC --format ./formatter/avro.js
```

Produce a json data from stdin
```sh
node payloadGenerator.js|kcli produce $KAFKA_TOPIC
```

Produce a json array data from stdin
```sh
cat payload.json|jq -r -c .[]|kcli produce $KAFKA_TOPIC
```

Payload single message input interface
```typescript
interface Payload {
  key?: string; // kafka
  value: any;
  headers?: { [key: string]: value };
}
```

### Formatters

```typescript
export interface Encoder<T> {
  (value: T): Promise<string | Buffer> | string | Buffer;
}

export interface Decoder<T> {
  (value: string | Buffer): Promise<T> | T;
}

export interface Formatter<T> {
  encode: Encoder<T>;
  decode: Decoder<T>;
}
```

## License
License [The MIT License](http://opensource.org/licenses/MIT)
Copyright (c) 2021 Ivan Zakharchanka

[npm-url]: https://www.npmjs.com/package/kafka-console
[downloads-image]: https://img.shields.io/npm/dw/kafka-console.svg?maxAge=43200
[npm-image]: https://img.shields.io/npm/v/kafka-console.svg?maxAge=43200
