import { describe, expect, it } from 'vitest';
import { validateIngestEventInput } from '../../../../src/services/validators/ingest-event-validator';
describe('validateIngestEventInput', () => {
    it('should reject empty projectId', () => {
        expect(() => validateIngestEventInput({
            projectId: '',
            userId: 'u1',
            event: {
                eventType: 'message',
                sourceType: 'claude',
                scope: { type: 'project' },
            },
        })).toThrow('projectId is required');
    });
    it('should reject empty userId', () => {
        expect(() => validateIngestEventInput({
            projectId: 'p1',
            userId: '',
            event: {
                eventType: 'message',
                sourceType: 'claude',
                scope: { type: 'project' },
            },
        })).toThrow('userId is required');
    });
    it('should reject blank projectId', () => {
        expect(() => validateIngestEventInput({
            projectId: '   ',
            userId: 'u1',
            event: {
                eventType: 'message',
                sourceType: 'claude',
                scope: { type: 'project' },
            },
        })).toThrow('projectId is required');
    });
    it('should reject blank userId', () => {
        expect(() => validateIngestEventInput({
            projectId: 'p1',
            userId: '   ',
            event: {
                eventType: 'message',
                sourceType: 'claude',
                scope: { type: 'project' },
            },
        })).toThrow('userId is required');
    });
    it('should reject empty eventType', () => {
        expect(() => validateIngestEventInput({
            projectId: 'p1',
            userId: 'u1',
            event: {
                eventType: '',
                sourceType: 'claude',
                scope: { type: 'project' },
            },
        })).toThrow('event.eventType is required');
    });
    it('should reject empty sourceType', () => {
        expect(() => validateIngestEventInput({
            projectId: 'p1',
            userId: 'u1',
            event: {
                eventType: 'message',
                sourceType: '',
                scope: { type: 'project' },
            },
        })).toThrow('event.sourceType is required');
    });
    it('should reject empty scope type', () => {
        expect(() => validateIngestEventInput({
            projectId: 'p1',
            userId: 'u1',
            event: {
                eventType: 'message',
                sourceType: 'claude',
                scope: { type: '' },
            },
        })).toThrow('event.scope.type is required');
    });
    it('should reject importanceScore above upper bound', () => {
        expect(() => validateIngestEventInput({
            projectId: 'p1',
            userId: 'u1',
            event: {
                eventType: 'message',
                sourceType: 'claude',
                scope: { type: 'project' },
                importanceScore: 2,
            },
        })).toThrow('importanceScore must be between 0 and 1');
    });
    it('should reject importanceScore below lower bound', () => {
        expect(() => validateIngestEventInput({
            projectId: 'p1',
            userId: 'u1',
            event: {
                eventType: 'message',
                sourceType: 'claude',
                scope: { type: 'project' },
                importanceScore: -0.1,
            },
        })).toThrow('importanceScore must be between 0 and 1');
    });
    it('should reject non-finite importanceScore', () => {
        expect(() => validateIngestEventInput({
            projectId: 'p1',
            userId: 'u1',
            event: {
                eventType: 'message',
                sourceType: 'claude',
                scope: { type: 'project' },
                importanceScore: Number.NaN,
            },
        })).toThrow('importanceScore must be between 0 and 1');
    });
    it('should reject positive infinity importanceScore', () => {
        expect(() => validateIngestEventInput({
            projectId: 'p1',
            userId: 'u1',
            event: {
                eventType: 'message',
                sourceType: 'claude',
                scope: { type: 'project' },
                importanceScore: Number.POSITIVE_INFINITY,
            },
        })).toThrow('importanceScore must be between 0 and 1');
    });
    it('should reject negative infinity importanceScore', () => {
        expect(() => validateIngestEventInput({
            projectId: 'p1',
            userId: 'u1',
            event: {
                eventType: 'message',
                sourceType: 'claude',
                scope: { type: 'project' },
                importanceScore: Number.NEGATIVE_INFINITY,
            },
        })).toThrow('importanceScore must be between 0 and 1');
    });
    it('should reject unsupported eventType', () => {
        expect(() => validateIngestEventInput({
            projectId: 'p1',
            userId: 'u1',
            event: {
                eventType: 'unknown',
                sourceType: 'claude',
                scope: { type: 'project' },
            },
        })).toThrow('event.eventType is invalid');
    });
    it('should accept any string sourceType (no validation)', () => {
        expect(() => validateIngestEventInput({
            projectId: 'p1',
            userId: 'u1',
            event: {
                eventType: 'message',
                sourceType: 'unknown',
                scope: { type: 'project' },
            },
        })).not.toThrow();
    });
    it('should reject unsupported scope type', () => {
        expect(() => validateIngestEventInput({
            projectId: 'p1',
            userId: 'u1',
            event: {
                eventType: 'message',
                sourceType: 'claude',
                scope: { type: 'unknown' },
            },
        })).toThrow('event.scope.type is invalid');
    });
    it('should accept valid minimal input', () => {
        expect(() => validateIngestEventInput({
            projectId: 'p1',
            userId: 'u1',
            event: {
                eventType: 'message',
                sourceType: 'claude',
                scope: { type: 'project' },
            },
        })).not.toThrow();
    });
});
