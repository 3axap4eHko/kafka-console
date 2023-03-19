import { logLevel, ConfigResourceTypes } from 'kafkajs';
import * as Kafka from '../kafka';

describe('Kafka test suite', () => {
    describe('logLevelParser', () => {
        it('Should covert a string to logLevel', () => {
            expect(Kafka.logLevelParser('error')).toEqual(logLevel.ERROR);
            expect(Kafka.logLevelParser('warn')).toEqual(logLevel.WARN);
            expect(Kafka.logLevelParser('info')).toEqual(logLevel.INFO);
            expect(Kafka.logLevelParser('debug')).toEqual(logLevel.DEBUG);
            expect(Kafka.logLevelParser('')).toEqual(logLevel.NOTHING);
        });
    });

    describe('resourceParser', () => {
        it('Should parse a string to ResourceTypes', () => {
            expect(Kafka.resourceParser('any')).toEqual(ConfigResourceTypes.UNKNOWN);
            expect(Kafka.resourceParser('topic')).toEqual(ConfigResourceTypes.TOPIC);
            expect(Kafka.resourceParser('broker')).toEqual(ConfigResourceTypes.BROKER);
            expect(Kafka.resourceParser('broker_logger')).toEqual(ConfigResourceTypes.BROKER_LOGGER);
            expect(Kafka.resourceParser('logger')).toEqual(ConfigResourceTypes.BROKER_LOGGER);
            expect(Kafka.resourceParser('')).toEqual(ConfigResourceTypes.UNKNOWN);
        });
    });

    describe('resourceParser', () => {
        it('Should parse a string to ResourceTypes', () => {

        });
    });
});
