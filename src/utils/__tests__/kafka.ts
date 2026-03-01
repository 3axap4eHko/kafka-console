import { describe, it, expect } from 'vitest';
import * as Kafka from '../kafka';

describe('Kafka test suite', () => {
    describe('logLevelParser', () => {
        it('Should convert a string to logLevel', () => {
            expect(Kafka.logLevelParser('error')).toEqual('error');
            expect(Kafka.logLevelParser('warn')).toEqual('warn');
            expect(Kafka.logLevelParser('info')).toEqual('info');
            expect(Kafka.logLevelParser('debug')).toEqual('debug');
            expect(Kafka.logLevelParser('')).toEqual('nothing');
        });
    });

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
});
