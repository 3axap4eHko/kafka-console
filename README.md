# Kafka CLI tool

Command line tool to sufficiently and easy work with Kafka

[![NPM version][npm-image]][npm-url]
[![Downloads][downloads-image]][npm-url]

## Table of Contents

  - [Features](#features)
  - [Installing](#installing)
  - [Examples](#examples)
    - [Consumer](#consumer)
    - [Producer](#producer)
    - [Formatters](#formatters)
  - [Environment](#environment)
  - [License](#license)

## Features

- Producer
- Consumer groups with seek and timeout
- Built-in message encoders/decoders with types: json, js, raw
- Custom message encoders/decoders as a js module
- Message headers
- GZIP compression
- Plain, SSL and SASL_SSL implementations
- Admin client
- TypeScript support

## Installing

```sh
npm install -g kafka-console
```

## Examples

### Common options
```
  -b, --brokers <brokers>                bootstrap server host (default: "localhost:9092")
  -l, --log-level <logLevel>             log level
  -t, --timeout <timeout>                set a timeout of operation (default: "0")
  -p, --pretty                           pretty print json
  --ssl                                  enable ssl (default: false)
  --mechanism <mechanism>                sasl mechanism
  --username <username>                  sasl username
  --password <password>                  sasl password
  --auth-id <authId>                     sasl aws authorization identity
  --access-key-id <accessKeyId>          sasl aws access key id
  --secret-access-key <secretAccessKey>  sasl aws secret access key
  --session-token <seccionToken>         sasl aws session token
  --oauth-bearer <oauthBearer>           sasl oauth bearer token
  -V, --version                          output the version number
  -h, --help                             display help for command
```

### Commands
```
  consume [options] <topic>              Consume kafka topic events
  produce [options] <topic>              Produce kafka topic events
  metadata                               Displays kafka server metadata
  list|ls [options]                      Lists kafka topics
  config [options]                       Describes config for specific resource
  create <topic>                         Creates kafka topic
  delete <topic>                         Deletes kafka topic
  help [command]                         display help for command
```

### Consumer

`kcli consume [options] <topic>`

#### Options
```
  -g, --group <group>      consumer group name
  -f, --format <format>    message type decoding json, js, raw (default: "json")
  -o, --output <filename>  write output to specified filename
  -a, --from-beginning     read messages from the beginning (default: false)
  -c, --count <count>      a number of messages to read (default: null)
  -s, --skip <skip>        a number of messages to skip (default: 0)
  -h, --help               display help for command
```

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

### Producer

`kcli produce [options] <topic>`

#### Options
```
  -f, --format <format>   message format encoding json, js, raw (default: "json")
  -i, --input <filename>  input filename
  -d, --delay <delay>     delay in ms after event emitting (default: 0)
  -h, --header <header>   set a static header (default: [])
  --help                  display help for command
```

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
  (value: Buffer): Promise<T> | T;
}

export interface Formatter<T> {
  encode: Encoder<T>;
  decode: Decoder<T>;
}
```

## Environment

 - KAFKA_BROKERS
 - KAFKA_TIMEOUT
 - KAFKA_MECHANISM
 - KAFKA_USERNAME
 - KAFKA_PASSWORD
 - KAFKA_AUTH_ID
 - KAFKA_ACCESS_KEY_ID
 - KAFKA_SECRET_ACCESS_KEY
 - KAFKA_SESSION_TOKEN
 - KAFKA_OAUTH_BEARER

## License
License [The MIT License](http://opensource.org/licenses/MIT)
Copyright (c) 2023 Ivan Zakharchanka

[npm-url]: https://www.npmjs.com/package/kafka-console
[downloads-image]: https://img.shields.io/npm/dw/kafka-console.svg?maxAge=43200
[npm-image]: https://img.shields.io/npm/v/kafka-console.svg?maxAge=43200
