import { logLevel, ResourceTypes } from 'kafkajs';
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
            expect(Kafka.resourceParser('any')).toEqual(ResourceTypes.ANY);
            expect(Kafka.resourceParser('topic')).toEqual(ResourceTypes.TOPIC);
            expect(Kafka.resourceParser('group')).toEqual(ResourceTypes.GROUP);
            expect(Kafka.resourceParser('cluster')).toEqual(ResourceTypes.CLUSTER);
            expect(Kafka.resourceParser('transactional_id')).toEqual(ResourceTypes.TRANSACTIONAL_ID);
            expect(Kafka.resourceParser('delegation_token')).toEqual(ResourceTypes.DELEGATION_TOKEN);
            expect(Kafka.resourceParser('')).toEqual(ResourceTypes.UNKNOWN);
        });
    });

    describe('resourceParser', () => {
        it('Should parse a string to ResourceTypes', () => {

        });
    });
});
