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
  -p, --pretty                           pretty print (default: false)
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
  topic:create <topic>                   Creates kafka topic
  topic:delete <topic>                   Deletes kafka topic
  topic:offsets <topic> [timestamp]      Shows kafka topic offsets
  help [command]                         display help for command
```

### Consumer

`npx kafka-console consume [options] <topic>`

#### Options
```
  -g, --group <group>              consumer group name (default: "kafka-console-consumer-TIMESTAMP")
  -d, --data-format <data-format>  messages data-format: json, js, raw (default: "json")
  -o, --output <filename>          write output to specified filename
  -f, --from <from>                read messages from the specific timestamp in milliseconds or ISO 8601 format. Set 0 to read from the beginning
  -c, --count <count>              a number of messages to read (default: null)
  -s, --skip <skip>                a number of messages to skip (default: 0)
  -h, --help                       display help for command
```

General usage with authentication
```sh
npx kafka-console --brokers $KAFKA_BROKERS --ssl --mechanism plain --username $KAFKA_USERNAME --password $KAFKA_PASSWORD consume $KAFKA_TOPIC --group $KAFKA_TOPIC_GROUP
```

Stdout from timestamp `jq` example
```sh
npx kafka-console consume $KAFKA_TOPIC --from 0 | jq .value
```

Custom data formatter example
```sh
npx kafka-console consume $KAFKA_TOPIC --data-format ./formatter/avro.js | jq
```

### Producer

```sh
npx kafka-console produce [options] <topic>
```

#### Options
```
  -d, --data-format <data-format>  messages data-format: json, js, raw (default: "json")
  -i, --input <filename>           input filename
  -w, --wait <wait>                wait the time in ms after sending a message (default: 0)
  -h, --header <header>            set a static header (default: [])
  --help                           display help for command
```

General usage
```sh
npx kafka-console produce $KAFKA_TOPIC -b $KAFKA_BROKERS --ssl --mechanism plain --username $KAFKA_USERNAME --password $KAFKA_PASSWORD
```

Produce a json data from stdin with custom formatter
```sh
npx kafka-console payload.txt|kcli produce $KAFKA_TOPIC --data-format ./formatter/avro.js
```

Produce a json data from stdin
```sh
node payloadGenerator.js|npx kafka-console produce $KAFKA_TOPIC
```

Produce a json array data from stdin
```sh
cat payload.json|jq -r -c .[]|npx kafka-console produce $KAFKA_TOPIC
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

## Supported Environment Variables

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
Copyright (c) 2024 Ivan Zakharchanka

[npm-url]: https://www.npmjs.com/package/kafka-console
[downloads-image]: https://img.shields.io/npm/dw/kafka-console.svg?maxAge=43200
[npm-image]: https://img.shields.io/npm/v/kafka-console.svg?maxAge=43200
