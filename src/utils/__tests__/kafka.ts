import { describe, it, expect } from 'vitest';
import * as Kafka from '../kafka';

describe('Kafka test suite', () => {
  describe('resourceParser', () => {
    it('Should parse a string to ResourceTypes', () => {
      expect(Kafka.resourceParser('any')).toEqual('UNKNOWN');
      expect(Kafka.resourceParser('topic')).toEqual('TOPIC');
      expect(Kafka.resourceParser('broker')).toEqual('BROKER');
      expect(Kafka.resourceParser('broker_logger')).toEqual('BROKER_LOGGER');
      expect(Kafka.resourceParser('logger')).toEqual('BROKER_LOGGER');
      expect(Kafka.resourceParser('')).toEqual('UNKNOWN');
    });
  });

  describe('getClientConfig', () => {
    it('Should verify TLS certificates by default when SSL is enabled', () => {
      const config = Kafka.getClientConfig('localhost:9092', true);

      expect(config.tls).toEqual({ rejectUnauthorized: true });
    });

    it('Should disable TLS verification only when insecure is set', () => {
      const config = Kafka.getClientConfig('localhost:9092', true, undefined, true);

      expect(config.tls).toEqual({ rejectUnauthorized: false });
    });
  });
});
