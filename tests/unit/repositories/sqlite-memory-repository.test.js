import { describe, expect, it, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { createSqliteClient } from '../../../src/db/client/sqlite';
import { memoriesTable } from '../../../src/db/schema/memories';
import { SQLiteMemoryRepository } from '../../../src/repositories/sqlite-memory-repository';
describe('SQLiteMemoryRepository', () => {
    let db;
    let repo;
    beforeEach(() => {
        // Create in-memory database for testing
        db = new Database(':memory:');
        db.exec('PRAGMA foreign_keys = ON');
        // Create memories table
        const columns = Object.entries(memoriesTable.columns)
            .map(([name, definition]) => `${name} ${definition}`)
            .join(', ');
        db.exec(`CREATE TABLE ${memoriesTable.name} (${columns})`);
        const client = createSqliteClient(':memory:');
        // Override the db connection for testing
        repo = new SQLiteMemoryRepository(client);
        // @ts-expect-error - Inject our in-memory db for testing
        repo.db = db;
    });
    it('should insert a memory record with minimal fields', async () => {
        await repo.insert({
            id: 'm1',
            projectId: 'p1',
            memoryType: 'fact',
        });
        const record = await repo.findById('m1');
        expect(record).not.toBeNull();
        expect(record?.id).toBe('m1');
        expect(record?.project_id).toBe('p1');
        expect(record?.memory_type).toBe('fact');
        expect(record?.status).toBe('active');
        expect(record?.confidence).toBe(0.5);
        expect(record?.strength).toBe(0.5);
        expect(record?.importance_score).toBe(0.5);
        expect(record?.access_count).toBe(0);
        expect(record?.created_at).toBeDefined();
        expect(record?.updated_at).toBeDefined();
    });
    it('should insert a memory record with full fields', async () => {
        await repo.insert({
            id: 'm1',
            projectId: 'p1',
            userId: 'u1',
            memoryType: 'fact',
            scopeType: 'project',
            scopeKey: 'p1',
            title: 'Test Fact',
            content: 'This is a test fact',
            summary: 'Test fact summary',
            status: 'active',
            confidence: 0.9,
            strength: 0.8,
            importanceScore: 0.7,
        });
        const record = await repo.findById('m1');
        expect(record).not.toBeNull();
        expect(record?.user_id).toBe('u1');
        expect(record?.title).toBe('Test Fact');
        expect(record?.content).toBe('This is a test fact');
        expect(record?.confidence).toBe(0.9);
        expect(record?.strength).toBe(0.8);
        expect(record?.importance_score).toBe(0.7);
    });
    it('should return null when finding non-existent memory', async () => {
        const record = await repo.findById('non-existent');
        expect(record).toBeNull();
    });
    it('should find all memories by project id', async () => {
        await repo.insert({ id: 'm1', projectId: 'p1', memoryType: 'fact' });
        await repo.insert({ id: 'm2', projectId: 'p1', memoryType: 'preference' });
        await repo.insert({ id: 'm3', projectId: 'p2', memoryType: 'constraint' });
        const records = await repo.findByProjectId('p1');
        expect(records.length).toBe(2);
        const ids = records.map(r => r.id).sort();
        expect(ids).toEqual(['m1', 'm2']);
    });
    it('should return empty array when no memories found for project', async () => {
        const records = await repo.findByProjectId('non-existent');
        expect(records).toEqual([]);
    });
    it('should find all memories by project id and type', async () => {
        await repo.insert({ id: 'm1', projectId: 'p1', memoryType: 'fact' });
        await repo.insert({ id: 'm2', projectId: 'p1', memoryType: 'fact' });
        await repo.insert({ id: 'm3', projectId: 'p1', memoryType: 'preference' });
        await repo.insert({ id: 'm4', projectId: 'p2', memoryType: 'fact' });
        const records = await repo.findByProjectIdAndType('p1', 'fact');
        expect(records.length).toBe(2);
        const ids = records.map(r => r.id).sort();
        expect(ids).toEqual(['m1', 'm2']);
    });
    it('should return empty array when no memories found for project and type', async () => {
        const records = await repo.findByProjectIdAndType('p1', 'experience');
        expect(records).toEqual([]);
    });
    it('should update a memory record', async () => {
        await repo.insert({
            id: 'm1',
            projectId: 'p1',
            memoryType: 'fact',
            title: 'Original Title',
        });
        await repo.update('m1', {
            title: 'Updated Title',
            confidence: 0.95,
            importance_score: 0.85,
        });
        const updated = await repo.findById('m1');
        expect(updated?.title).toBe('Updated Title');
        expect(updated?.confidence).toBe(0.95);
        expect(updated?.importance_score).toBe(0.85);
        expect(updated?.updated_at).toBeDefined();
    });
    it('should do nothing when update has no fields', async () => {
        await repo.insert({ id: 'm1', projectId: 'p1', memoryType: 'fact', title: 'Original' });
        await repo.update('m1', {});
        const record = await repo.findById('m1');
        expect(record?.title).toBe('Original');
    });
    it('should delete a memory record', async () => {
        await repo.insert({ id: 'm1', projectId: 'p1', memoryType: 'fact' });
        expect(await repo.findById('m1')).not.toBeNull();
        await repo.delete('m1');
        expect(await repo.findById('m1')).toBeNull();
    });
    it('should reject duplicate memory ids', async () => {
        await repo.insert({ id: 'm1', projectId: 'p1', memoryType: 'fact' });
        await expect(repo.insert({ id: 'm1', projectId: 'p2', memoryType: 'preference' })).rejects.toThrow();
    });
    it('should handle nullable fields correctly', async () => {
        await repo.insert({
            id: 'm1',
            projectId: 'p1',
            memoryType: 'fact',
        });
        const record = await repo.findById('m1');
        expect(record?.summary).toBeNull();
        expect(record?.scope_key).toBeNull();
        expect(record?.explanation_json).toBeNull();
        expect(record?.metadata_json).toBeNull();
        expect(record?.last_accessed_at).toBeNull();
        expect(record?.expires_at).toBeNull();
    });
    it('should close database connection', () => {
        // Just verify the method exists and can be called
        expect(() => repo.close()).not.toThrow();
    });
    it('should return all records sorted by created_at descending', async () => {
        // Insert in reverse order to check sorting
        await new Promise(resolve => setTimeout(resolve, 10));
        await repo.insert({ id: 'm3', projectId: 'p1', memoryType: 'fact' });
        await new Promise(resolve => setTimeout(resolve, 10));
        await repo.insert({ id: 'm2', projectId: 'p1', memoryType: 'fact' });
        await new Promise(resolve => setTimeout(resolve, 10));
        await repo.insert({ id: 'm1', projectId: 'p1', memoryType: 'fact' });
        const records = await repo.findByProjectId('p1');
        expect(records.length).toBe(3);
        // Should be ordered m1 (newest), m2, m3 (oldest)
        expect(records[0].id).toBe('m1');
        expect(records[1].id).toBe('m2');
        expect(records[2].id).toBe('m3');
    });
    it('should correctly map camelCase input to snake_case database fields', async () => {
        // Insert with camelCase properties (MemoryRecordLike interface)
        await repo.insert({
            id: 'm1',
            projectId: 'p1',
            userId: 'u1',
            memoryType: 'fact',
            scopeType: 'project',
            scopeKey: 'key1',
            title: 'Test',
            content: 'Content',
            importanceScore: 0.9,
        });
        const record = await repo.findById('m1');
        expect(record?.project_id).toBe('p1');
        expect(record?.user_id).toBe('u1');
        expect(record?.memory_type).toBe('fact');
        expect(record?.scope_type).toBe('project');
        expect(record?.scope_key).toBe('key1');
        expect(record?.importance_score).toBe(0.9);
    });
});
