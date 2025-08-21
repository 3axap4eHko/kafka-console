# Kafka Console CLI

A powerful and easy-to-use command-line interface for Apache Kafka operations.

[![NPM version][npm-image]][npm-url]
[![Downloads][downloads-image]][npm-url]

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Commands](#commands)
  - [Consuming Messages](#consuming-messages)
  - [Producing Messages](#producing-messages)
  - [Topic Management](#topic-management)
  - [Cluster Information](#cluster-information)
- [Authentication](#authentication)
- [Message Formats](#message-formats)
- [Environment Variables](#environment-variables)
- [Common Use Cases](#common-use-cases)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Features

- ✅ **Consumer & Producer** - Full support for consuming and producing messages
- ✅ **Multiple Authentication Methods** - Plain, SCRAM-SHA-256/512, AWS IAM, OAuth Bearer
- ✅ **Flexible Message Formats** - JSON, JavaScript, raw text, or custom formatters
- ✅ **Consumer Groups** - Full consumer group support with offset management
- ✅ **Time-based Consumption** - Read messages from specific timestamps
- ✅ **SSL/TLS Support** - Secure connections to Kafka clusters
- ✅ **Topic Management** - Create, delete, and inspect topics
- ✅ **Headers Support** - Read and write message headers
- ✅ **GZIP Compression** - Automatic compression support
- ✅ **TypeScript** - Full TypeScript support

## Installation

### Global Installation (Recommended)
```bash
npm install -g kafka-console
```

### Local Installation
```bash
npm install kafka-console
```

### Using without Installation
```bash
npx kafka-console [command]
```

## Quick Start

### 1. List all topics
```bash
kafka-console list --brokers localhost:9092
```

### 2. Consume messages from a topic
```bash
kafka-console consume my-topic --brokers localhost:9092
```

### 3. Produce a message to a topic
```bash
echo '{"message": "Hello Kafka!"}' | kafka-console produce my-topic --brokers localhost:9092
```

## Commands

### Consuming Messages

```bash
kafka-console consume <topic> [options]
```

#### Options
| Option | Description | Default |
|--------|-------------|---------|
| `-g, --group <group>` | Consumer group name | `kafka-console-consumer-{timestamp}` |
| `-f, --from <from>` | Start position (timestamp/ISO date/0 for beginning) | latest |
| `-c, --count <count>` | Number of messages to read | unlimited |
| `-s, --skip <skip>` | Number of messages to skip | 0 |
| `-o, --output <file>` | Write output to file | stdout |
| `-d, --data-format <format>` | Message format (json/js/raw/custom) | json |
| `-p, --pretty` | Pretty print JSON output | false |

#### Examples

**Consume from beginning and pretty print:**
```bash
kafka-console consume my-topic --from 0 --pretty
```

**Consume last 10 messages:**
```bash
kafka-console consume my-topic --count 10
```

**Consume from specific timestamp:**
```bash
kafka-console consume my-topic --from "2024-01-01T00:00:00Z"
```

**Consume with specific consumer group:**
```bash
kafka-console consume my-topic --group my-consumer-group
```

**Save output to file:**
```bash
kafka-console consume my-topic --output messages.json
```

**Extract specific fields with jq:**
```bash
kafka-console consume my-topic | jq '.value.userId'
```

### Producing Messages

```bash
kafka-console produce <topic> [options]
```

#### Options
| Option | Description | Default |
|--------|-------------|---------|
| `-i, --input <file>` | Read input from file | stdin |
| `-d, --data-format <format>` | Message format (json/js/raw/custom) | json |
| `-h, --header <header>` | Add message header (format: key:value) | none |
| `-w, --wait <ms>` | Wait time between messages | 0 |

#### Examples

**Produce single message:**
```bash
echo '{"user": "john", "action": "login"}' | kafka-console produce my-topic
```

**Produce from file:**
```bash
kafka-console produce my-topic --input messages.json
```

**Produce with headers:**
```bash
echo '{"data": "test"}' | kafka-console produce my-topic --header "source:api" --header "version:1.0"
```

**Produce multiple messages from JSON array:**
```bash
cat users.json | jq -c '.[]' | kafka-console produce my-topic
```

**Produce with key (for partitioning):**
```bash
echo '{"key": "user123", "value": {"name": "John"}}' | kafka-console produce my-topic
```

### Topic Management

#### Create Topic
```bash
kafka-console topic:create my-new-topic
```

#### Delete Topic
```bash
kafka-console topic:delete old-topic
```

#### Show Topic Offsets
```bash
kafka-console topic:offsets my-topic
```

#### Show Topic Offsets for Specific Timestamp
```bash
kafka-console topic:offsets my-topic "2024-01-01T00:00:00Z"
```

### Cluster Information

#### List All Topics
```bash
kafka-console list
```

#### List Including Internal Topics
```bash
kafka-console list --all
```

#### Show Cluster Metadata
```bash
kafka-console metadata
```

#### Show Topic Configuration
```bash
kafka-console config --resource topic --resourceName my-topic
```

## Authentication

### SSL/TLS Connection
```bash
kafka-console consume my-topic \
  --brokers broker1:9093,broker2:9093 \
  --ssl
```

### SASL/PLAIN
```bash
kafka-console consume my-topic \
  --brokers broker:9093 \
  --ssl \
  --mechanism plain \
  --username myuser \
  --password mypassword
```

### SASL/SCRAM-SHA-256
```bash
kafka-console consume my-topic \
  --brokers broker:9093 \
  --ssl \
  --mechanism scram-sha-256 \
  --username myuser \
  --password mypassword
```

### AWS IAM
```bash
kafka-console consume my-topic \
  --brokers broker:9093 \
  --ssl \
  --mechanism aws \
  --access-key-id AKIAXXXXXXXX \
  --secret-access-key XXXXXXXXXX \
  --session-token XXXXXXXXXX
```

### OAuth Bearer
```bash
kafka-console consume my-topic \
  --brokers broker:9093 \
  --ssl \
  --mechanism oauthbearer \
  --oauth-bearer "eyJhbGciOiJIUzI1NiIs..."
```

## Message Formats

### JSON Format (Default)
Messages are parsed as JSON:
```bash
echo '{"name": "Alice", "age": 30}' | kafka-console produce my-topic
```

### Raw Format
Messages are sent as plain text:
```bash
echo "Plain text message" | kafka-console produce my-topic --data-format raw
```

### JavaScript Format
Messages can contain JavaScript exports:
```bash
echo 'module.exports = { timestamp: Date.now() }' | kafka-console produce my-topic --data-format js
```

### Custom Formatter
Create a custom formatter module:

```javascript
// formatter/custom.js
module.exports = {
  encode: (value) => Buffer.from(JSON.stringify(value)),
  decode: (buffer) => JSON.parse(buffer.toString())
};
```

Use the custom formatter:
```bash
kafka-console consume my-topic --data-format ./formatter/custom.js
```

## Environment Variables

Set environment variables to avoid repeating common options:

```bash
export KAFKA_BROKERS=broker1:9092,broker2:9092
export KAFKA_USERNAME=myuser
export KAFKA_PASSWORD=mypassword
export KAFKA_MECHANISM=plain
export KAFKA_TIMEOUT=30000
```

All supported environment variables:
- `KAFKA_BROKERS` - Comma-separated list of brokers
- `KAFKA_TIMEOUT` - Operation timeout in milliseconds
- `KAFKA_MECHANISM` - SASL mechanism
- `KAFKA_USERNAME` - SASL username
- `KAFKA_PASSWORD` - SASL password
- `KAFKA_AUTH_ID` - AWS authorization identity
- `KAFKA_ACCESS_KEY_ID` - AWS access key ID
- `KAFKA_SECRET_ACCESS_KEY` - AWS secret access key
- `KAFKA_SESSION_TOKEN` - AWS session token
- `KAFKA_OAUTH_BEARER` - OAuth bearer token

## Common Use Cases

### Monitor Topic in Real-time
```bash
kafka-console consume logs --group monitor-group --pretty
```

### Replay Messages from Yesterday
```bash
kafka-console consume events --from "$(date -d yesterday --iso-8601)"
```

### Copy Messages Between Topics
```bash
kafka-console consume source-topic | kafka-console produce destination-topic
```

### Filter Messages
```bash
kafka-console consume all-events | jq 'select(.value.type == "ERROR")' 
```

### Count Messages in Topic
```bash
kafka-console consume my-topic --from 0 | wc -l
```

### Sample Messages
```bash
kafka-console consume large-topic --count 100 --pretty
```

### Debug Message Headers
```bash
kafka-console consume my-topic | jq '.headers'
```

## Troubleshooting

### Connection Issues

**Problem:** Cannot connect to Kafka broker
```bash
Error: KafkaJSConnectionError: Connection timeout
```
**Solution:** 
- Verify broker addresses are correct
- Check network connectivity: `telnet broker-host 9092`
- Ensure security groups/firewalls allow connection
- For Docker: use host network or proper port mapping

### Authentication Failures

**Problem:** Authentication failed
```bash
Error: KafkaJSProtocolError: SASL authentication failed
```
**Solution:**
- Verify credentials are correct
- Check SASL mechanism matches broker configuration
- Ensure SSL is enabled if required: `--ssl`

### Consumer Group Issues

**Problem:** Not receiving messages
**Solution:**
- Check consumer group offset: `kafka-console topic:offsets my-topic --group my-group`
- Reset to beginning: `--from 0`
- Use a new consumer group name

### Message Format Errors

**Problem:** JSON parsing errors
```bash
SyntaxError: Unexpected token...
```
**Solution:**
- Verify message format matches specified data-format
- Use `--data-format raw` for non-JSON messages
- Check for malformed JSON with: `jq . < input.json`

### Performance Issues

**Problem:** Slow message consumption
**Solution:**
- Increase batch size in consumer configuration
- Use multiple consumer instances with same group
- Check network latency to brokers

### SSL/TLS Issues

**Problem:** SSL handshake failed
**Solution:**
- Ensure `--ssl` flag is used
- Verify broker SSL port (usually 9093)
- Check certificate validity

## License

License [The MIT License](http://opensource.org/licenses/MIT)
Copyright (c) 2024 Ivan Zakharchanka

[npm-url]: https://www.npmjs.com/package/kafka-console
[downloads-image]: https://img.shields.io/npm/dw/kafka-console.svg?maxAge=43200
[npm-image]: https://img.shields.io/npm/v/kafka-console.svg?maxAge=43200