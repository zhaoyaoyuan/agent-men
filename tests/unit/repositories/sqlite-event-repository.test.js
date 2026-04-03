import { describe, expect, it, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { createSqliteClient } from '../../../src/db/client/sqlite';
import { eventsTable } from '../../../src/db/schema/events';
import { eventMemoryLinksTable } from '../../../src/db/schema/event-memory-links';
import { memoriesTable } from '../../../src/db/schema/memories';
import { SQLiteEventRepository } from '../../../src/repositories/sqlite-event-repository';
describe('SQLiteEventRepository', () => {
    let db;
    let repo;
    beforeEach(() => {
        // Enable foreign keys
        db = new Database(':memory:');
        db.exec('PRAGMA foreign_keys = ON');
        // Create memories table (required for foreign key constraints in event_memory_links)
        const memoryColumns = Object.entries(memoriesTable.columns)
            .map(([name, definition]) => `${name} ${definition}`)
            .join(', ');
        db.exec(`CREATE TABLE ${memoriesTable.name} (${memoryColumns})`);
        // Create events table
        const columns = Object.entries(eventsTable.columns)
            .map(([name, definition]) => `${name} ${definition}`)
            .join(', ');
        db.exec(`CREATE TABLE ${eventsTable.name} (${columns})`);
        // Create event_memory_links table (for foreign key constraints)
        const linkColumns = Object.entries(eventMemoryLinksTable.columns)
            .map(([name, definition]) => `${name} ${definition}`)
            .join(', ');
        const constraints = eventMemoryLinksTable.constraints
            .map(c => `, ${c}`)
            .join('');
        db.exec(`CREATE TABLE ${eventMemoryLinksTable.name} (${linkColumns}${constraints})`);
        // Create indexes for links
        db.exec('CREATE INDEX idx_event_memory_links_memory_id ON event_memory_links (memory_id)');
        const client = createSqliteClient(':memory:');
        // Override the db connection for testing
        repo = new SQLiteEventRepository(client);
        // @ts-expect-error - Inject our in-memory db for testing
        repo.db = db;
    });
    it('should insert and find event by id', async () => {
        await repo.insert({
            id: 'e1',
            project_id: 'p1',
            user_id: 'u1',
            event_type: 'message',
            source_type: 'claude',
            scope_type: 'project',
            content_text: 'Hello world',
            happened_at: new Date().toISOString(),
        });
        const record = await repo.findById('e1');
        expect(record?.id).toBe('e1');
        expect(record?.project_id).toBe('p1');
        expect(record?.user_id).toBe('u1');
        expect(record?.event_type).toBe('message');
        expect(record?.source_type).toBe('claude');
        expect(record?.scope_type).toBe('project');
        expect(record?.content_text).toBe('Hello world');
        expect(record?.importance_score).toBe(0.5);
        expect(record?.content_storage_mode).toBe('full_text');
        expect(record?.created_at).toBeDefined();
        expect(record?.happened_at).toBeDefined();
    });
    it('should protect against mutation by returning copies', async () => {
        await repo.insert({
            id: 'e1',
            project_id: 'p1',
            user_id: 'u1',
            event_type: 'message',
            source_type: 'claude',
            scope_type: 'project',
            content_text: 'Original',
            happened_at: new Date().toISOString(),
        });
        const record = await repo.findById('e1');
        expect(record?.id).toBe('e1');
        if (!record) {
            throw new Error('record should exist');
        }
        record.content_text = 'mutated';
        const freshRecord = await repo.findById('e1');
        expect(freshRecord?.content_text).toBe('Original');
    });
    it('should return null when event not found by id', async () => {
        const record = await repo.findById('non-existent');
        expect(record).toBeNull();
    });
    it('should find all events by project id ordered by happened_at desc', async () => {
        const earlier = new Date(Date.now() - 3600000).toISOString();
        const later = new Date().toISOString();
        await repo.insert({
            id: 'e1',
            project_id: 'p1',
            user_id: 'u1',
            event_type: 'message',
            source_type: 'claude',
            scope_type: 'project',
            happened_at: earlier,
        });
        await repo.insert({
            id: 'e2',
            project_id: 'p1',
            user_id: 'u1',
            event_type: 'tool_call',
            source_type: 'system',
            scope_type: 'project',
            happened_at: later,
        });
        await repo.insert({
            id: 'e3',
            project_id: 'p2',
            user_id: 'u1',
            event_type: 'decision',
            source_type: 'claude',
            scope_type: 'project',
            happened_at: later,
        });
        const events = await repo.findByProjectId('p1');
        expect(events.length).toBe(2);
        expect(events[0].id).toBe('e2'); // later first
        expect(events[1].id).toBe('e1'); // earlier last
        const ids = events.map(e => e.id).sort();
        expect(ids).toEqual(['e1', 'e2']);
    });
    it('should return empty array when project has no events', async () => {
        const events = await repo.findByProjectId('empty-project');
        expect(events).toEqual([]);
    });
    it('should find all events by user id ordered by happened_at desc', async () => {
        const earlier = new Date(Date.now() - 3600000).toISOString();
        const later = new Date().toISOString();
        await repo.insert({
            id: 'e1',
            project_id: 'p1',
            user_id: 'u1',
            event_type: 'message',
            source_type: 'claude',
            scope_type: 'project',
            happened_at: earlier,
        });
        await repo.insert({
            id: 'e2',
            project_id: 'p1',
            user_id: 'u1',
            event_type: 'tool_call',
            source_type: 'system',
            scope_type: 'project',
            happened_at: later,
        });
        await repo.insert({
            id: 'e3',
            project_id: 'p1',
            user_id: 'u2',
            event_type: 'decision',
            source_type: 'claude',
            scope_type: 'project',
            happened_at: later,
        });
        const events = await repo.findByUserId('u1');
        expect(events.length).toBe(2);
        const ids = events.map(e => e.id).sort();
        expect(ids).toEqual(['e1', 'e2']);
    });
    it('should return empty array when user has no events', async () => {
        const events = await repo.findByUserId('empty-user');
        expect(events).toEqual([]);
    });
    it('should update event fields', async () => {
        await repo.insert({
            id: 'e1',
            project_id: 'p1',
            user_id: 'u1',
            event_type: 'message',
            source_type: 'claude',
            scope_type: 'project',
            title: 'Old Title',
            summary: 'Old summary',
            content_text: 'Old content',
            happened_at: new Date().toISOString(),
        });
        const original = await repo.findById('e1');
        expect(original?.title).toBe('Old Title');
        await repo.update('e1', {
            title: 'New Title',
            summary: 'New summary',
            content_text: 'New content',
            importance_score: 0.9,
        });
        const updated = await repo.findById('e1');
        expect(updated?.title).toBe('New Title');
        expect(updated?.summary).toBe('New summary');
        expect(updated?.content_text).toBe('New content');
        expect(updated?.importance_score).toBe(0.9);
    });
    it('should not throw when updating non-existent event', async () => {
        await expect(repo.update('non-existent', { title: 'test' })).resolves.not.toThrow();
    });
    it('should delete event by id', async () => {
        await repo.insert({
            id: 'e1',
            project_id: 'p1',
            user_id: 'u1',
            event_type: 'message',
            source_type: 'claude',
            scope_type: 'project',
            happened_at: new Date().toISOString(),
        });
        expect(await repo.findById('e1')).not.toBeNull();
        await repo.delete('e1');
        expect(await repo.findById('e1')).toBeNull();
    });
    it('should handle nullable fields correctly', async () => {
        await repo.insert({
            id: 'e1',
            project_id: 'p1',
            user_id: 'u1',
            event_type: 'message',
            source_type: 'claude',
            scope_type: 'project',
            happened_at: new Date().toISOString(),
        });
        const record = await repo.findById('e1');
        expect(record?.agent_id).toBeNull();
        expect(record?.scope_key).toBeNull();
        expect(record?.title).toBeNull();
        expect(record?.summary).toBeNull();
        expect(record?.content_text).toBeNull();
        expect(record?.payload_json).toBeNull();
    });
    it('should store and retrieve payload json', async () => {
        const payload = JSON.stringify({ action: 'created', tool: 'write' });
        await repo.insert({
            id: 'e1',
            project_id: 'p1',
            user_id: 'u1',
            event_type: 'tool_call',
            source_type: 'system',
            scope_type: 'project',
            payload_json: payload,
            happened_at: new Date().toISOString(),
        });
        const record = await repo.findById('e1');
        expect(record?.payload_json).toBe(payload);
    });
    it('should handle custom importance score and storage mode', async () => {
        await repo.insert({
            id: 'e1',
            project_id: 'p1',
            user_id: 'u1',
            event_type: 'decision',
            source_type: 'claude',
            scope_type: 'project',
            importance_score: 0.95,
            content_storage_mode: 'reference',
            happened_at: new Date().toISOString(),
        });
        const record = await repo.findById('e1');
        expect(record?.importance_score).toBe(0.95);
        expect(record?.content_storage_mode).toBe('reference');
    });
    it('should handle all fields populated', async () => {
        const happenedAt = new Date().toISOString();
        await repo.insert({
            id: 'e1',
            project_id: 'p1',
            user_id: 'u1',
            agent_id: 'a1',
            event_type: 'message',
            source_type: 'user',
            scope_type: 'conversation',
            scope_key: 'c1',
            title: 'Test Event',
            summary: 'This is a test event',
            content_text: 'Full content here',
            payload_json: JSON.stringify({ key: 'value' }),
            content_storage_mode: 'full_text',
            importance_score: 0.8,
            happened_at: happenedAt,
        });
        const record = await repo.findById('e1');
        expect(record).toMatchObject({
            id: 'e1',
            project_id: 'p1',
            user_id: 'u1',
            agent_id: 'a1',
            event_type: 'message',
            source_type: 'user',
            scope_type: 'conversation',
            scope_key: 'c1',
            title: 'Test Event',
            summary: 'This is a test event',
            content_text: 'Full content here',
            payload_json: JSON.stringify({ key: 'value' }),
            content_storage_mode: 'full_text',
            importance_score: 0.8,
            happened_at: happenedAt,
        });
    });
    it('should enforce unique id constraint', async () => {
        await repo.insert({
            id: 'same-id',
            project_id: 'p1',
            user_id: 'u1',
            event_type: 'message',
            source_type: 'claude',
            scope_type: 'project',
            happened_at: new Date().toISOString(),
        });
        // Inserting another event with same id should throw
        await expect(repo.insert({
            id: 'same-id',
            project_id: 'p2',
            user_id: 'u2',
            event_type: 'tool_call',
            source_type: 'system',
            scope_type: 'project',
            happened_at: new Date().toISOString(),
        })).rejects.toThrow();
    });
});
