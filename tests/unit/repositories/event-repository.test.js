import { describe, expect, it } from 'vitest';
import { InMemoryEventRepository } from '../../../src/repositories/event-repository';
describe('InMemoryEventRepository', () => {
    it('should store event records in memory', async () => {
        const repo = new InMemoryEventRepository();
        await repo.insert({
            id: 'e1',
            project_id: 'p1',
            user_id: 'u1',
            event_type: 'message',
            source_type: 'claude',
            scope_type: 'project',
            content_text: 'hello',
            importance_score: 0.8,
            happened_at: new Date().toISOString(),
        });
        const record = await repo.findById('e1');
        expect(record).toMatchObject({
            id: 'e1',
            project_id: 'p1',
            user_id: 'u1',
            event_type: 'message',
            source_type: 'claude',
            scope_type: 'project',
            content_text: 'hello',
            importance_score: 0.8,
        });
    });
    it('should protect stored records from caller mutations', async () => {
        const repo = new InMemoryEventRepository();
        const inputRecord = {
            id: 'e1',
            project_id: 'p1',
            user_id: 'u1',
            event_type: 'message',
            source_type: 'claude',
            scope_type: 'project',
            content_text: 'hello',
            importance_score: 0.8,
            happened_at: new Date().toISOString(),
        };
        await repo.insert(inputRecord);
        inputRecord.event_type = 'tool_call';
        inputRecord.source_type = 'system';
        inputRecord.content_text = 'mutated';
        inputRecord.importance_score = 0.1;
        const storedRecord = await repo.findById('e1');
        expect(storedRecord?.event_type).toBe('message');
        expect(storedRecord?.source_type).toBe('claude');
        expect(storedRecord?.content_text).toBe('hello');
        expect(storedRecord?.importance_score).toBe(0.8);
        if (!storedRecord) {
            throw new Error('storedRecord should exist');
        }
        storedRecord.event_type = 'decision';
        storedRecord.source_type = 'external';
        storedRecord.content_text = 'changed again';
        storedRecord.importance_score = 0.3;
        const reloadedRecord = await repo.findById('e1');
        expect(reloadedRecord?.event_type).toBe('message');
        expect(reloadedRecord?.source_type).toBe('claude');
        expect(reloadedRecord?.content_text).toBe('hello');
        expect(reloadedRecord?.importance_score).toBe(0.8);
    });
});
