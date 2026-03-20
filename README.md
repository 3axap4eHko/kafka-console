# Kafka Console CLI

A command-line interface for Apache Kafka operations.

[![NPM version][npm-image]][npm-url]
[![Downloads][downloads-image]][npm-url]

## Installation

```bash
npm install -g kafka-console
```

Or run without installing:
```bash
npx kafka-console [command]
```

## Quick Start

```bash
# List topics
kafka-console list -b localhost:9092

# Consume messages
kafka-console consume my-topic -b localhost:9092 --from 0 --count 10

# Produce a message
echo '{"key":"k1","value":"hello"}' | kafka-console produce my-topic -b localhost:9092
```

## Global Options

These options apply to all commands:

| Option | Description | Default | Env |
|--------|-------------|---------|-----|
| `-b, --brokers <brokers>` | Comma-separated broker addresses | `localhost:9092` | `KAFKA_BROKERS` |
| `-t, --timeout <ms>` | Operation timeout in milliseconds | `0` (no timeout) | `KAFKA_TIMEOUT` |
| `--ssl` | Enable TLS connection | `false` | |
| `--insecure` | Disable TLS certificate verification (requires `--ssl`) | `false` | |
| `--mechanism <mech>` | SASL mechanism: `plain`, `scram-sha-256`, `scram-sha-512`, `oauthbearer` | | `KAFKA_MECHANISM` |
| `--username <user>` | SASL username (for plain/scram) | | `KAFKA_USERNAME` |
| `--password <pass>` | SASL password (for plain/scram) | | `KAFKA_PASSWORD` |
| `--oauth-bearer <token>` | SASL OAuth bearer token | | `KAFKA_OAUTH_BEARER` |

## Commands

### consume

Consume messages from a Kafka topic. Outputs one JSON object per line (JSONL).

```bash
kafka-console consume <topic> [options]
```

Each output line contains: `partition`, `offset`, `timestamp`, `headers`, `key`, `value`, `ahead`.

| Option | Description | Default |
|--------|-------------|---------|
| `-g, --group <group>` | Consumer group name | auto-generated |
| `-f, --from <from>` | Start position: `0` (beginning), timestamp in ms, or ISO 8601 date | latest |
| `-c, --count <count>` | Maximum number of messages to consume | unlimited |
| `-s, --skip <skip>` | Number of messages to skip before outputting | `0` |
| `-o, --output <file>` | Write output to a file instead of stdout | stdout |
| `-d, --data-format <fmt>` | Value format: `json`, `raw`, or path to custom formatter | `json` |
| `--snapshot` | Consume all existing messages and exit (records high watermark on start) | `false` |

**Examples:**
```bash
# Consume from the beginning, stop after 10 messages
kafka-console consume my-topic --from 0 --count 10

# Snapshot: dump all existing messages to a file and exit
kafka-console consume my-topic --snapshot -o dump.jsonl

# Consume from a specific timestamp
kafka-console consume my-topic --from "2024-06-01T00:00:00Z"

# Skip first 100 messages, take next 50
kafka-console consume my-topic --from 0 --skip 100 --count 50

# Pipe to jq for filtering
kafka-console consume my-topic | jq 'select(.value.level == "ERROR")'

# Use raw format for non-JSON message values
kafka-console consume my-topic -d raw
```

### produce

Produce messages to a Kafka topic. Reads JSONL from stdin or a JSON array from a file.

```bash
kafka-console produce <topic> [options]
```

Each input line must be a JSON object with a `value` field. Optional fields: `key`, `headers`.

| Option | Description | Default |
|--------|-------------|---------|
| `-d, --data-format <fmt>` | Value format: `json`, `raw`, or path to custom formatter | `json` |
| `-i, --input <file>` | Read messages from a JSON array file instead of stdin | stdin |
| `-w, --wait <ms>` | Delay between messages in milliseconds | `0` |
| `-H, --header <header>` | Static header added to every message (`key:value`), repeatable | none |

**Examples:**
```bash
# Produce a single message
echo '{"key":"user-1","value":{"name":"Alice"}}' | kafka-console produce my-topic

# Produce with static headers
echo '{"value":"data"}' | kafka-console produce my-topic -H source:cli -H env:prod

# Produce from a file (JSON array of messages)
kafka-console produce my-topic --input messages.json

# Produce raw text values
echo '{"value":"plain text"}' | kafka-console produce my-topic -d raw

# Pipe from another topic
kafka-console consume source --snapshot | kafka-console produce dest
```

### list

List topic names. Outputs one topic name per line (JSONL).

```bash
kafka-console list [options]
kafka-console ls [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `-a, --all` | Include internal topics (e.g. `__consumer_offsets`) | `false` |

### metadata

Display cluster metadata: brokers, controller, topics, partitions, replicas, and ISR.

```bash
kafka-console metadata
```

Output is a single JSONL object with `brokers`, `clusterId`, `controllerId`, and `topicMetadata` fields.

### config

Describe the configuration of a Kafka resource.

```bash
kafka-console config [options]
```

| Option | Description |
|--------|-------------|
| `-r, --resource <type>` | Resource type: `topic`, `broker`, `broker_logger` (required) |
| `-n, --resourceName <name>` | Resource name: topic name or broker ID (required) |

**Examples:**
```bash
kafka-console config -r topic -n my-topic
kafka-console config -r broker -n 1
```

### topic:create

Create a new Kafka topic.

```bash
kafka-console topic:create <topic> [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `-p, --partitions <n>` | Number of partitions | `1` |
| `-r, --replicas <n>` | Replication factor | `1` |

### topic:delete

Delete a Kafka topic.

```bash
kafka-console topic:delete <topic>
```

### topic:offsets

Show topic partition offsets.

```bash
kafka-console topic:offsets <topic> [timestamp] [options]
```

Without arguments: shows high/low watermarks per partition.
With a timestamp (ms or ISO 8601): shows offsets at that point in time.
With `--group`: shows committed offsets for a consumer group.

| Option | Description |
|--------|-------------|
| `-g, --group <group>` | Show committed offsets for this consumer group |

**Examples:**
```bash
# High/low watermarks
kafka-console topic:offsets my-topic

# Offsets at a specific time
kafka-console topic:offsets my-topic "2024-06-01T00:00:00Z"

# Consumer group committed offsets
kafka-console topic:offsets my-topic -g my-consumer-group
```

## Authentication

```bash
# TLS (certificate verification enabled by default)
kafka-console consume my-topic -b broker:9093 --ssl

# TLS with self-signed certificate (skip verification)
kafka-console consume my-topic -b broker:9093 --ssl --insecure

# SASL/PLAIN
kafka-console consume my-topic -b broker:9093 --ssl \
  --mechanism plain --username myuser --password mypass

# SASL/SCRAM-SHA-256
kafka-console consume my-topic -b broker:9093 --ssl \
  --mechanism scram-sha-256 --username myuser --password mypass

# OAuth Bearer
kafka-console consume my-topic -b broker:9093 --ssl \
  --mechanism oauthbearer --oauth-bearer "eyJhbG..."
```

## Message Formats

**json** (default) - values are JSON-serialized on produce and JSON-parsed on consume.

**raw** - values are passed as plain text strings, no serialization.

**Custom formatter** - provide a path to a module exporting `encode` and `decode` functions:

```javascript
// formatter/custom.js
module.exports = {
  encode: (value) => Buffer.from(JSON.stringify(value)),
  decode: (buffer) => JSON.parse(buffer.toString())
};
```

```bash
kafka-console consume my-topic -d ./formatter/custom.js
```

## License

License [The MIT License](http://opensource.org/licenses/MIT)

[npm-url]: https://www.npmjs.com/package/kafka-console
[downloads-image]: https://img.shields.io/npm/dw/kafka-console.svg?maxAge=43200
[npm-image]: https://img.shields.io/npm/v/kafka-console.svg?maxAge=43200
