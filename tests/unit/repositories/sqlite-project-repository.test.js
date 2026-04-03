import { describe, expect, it, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { createSqliteClient } from '../../../src/db/client/sqlite';
import { projectsTable } from '../../../src/db/schema/projects';
import { SQLiteProjectRepository } from '../../../src/repositories/sqlite-project-repository';
describe('SQLiteProjectRepository', () => {
    let db;
    let repo;
    beforeEach(() => {
        // Create in-memory database for testing
        db = new Database(':memory:');
        // Create table
        const columns = Object.entries(projectsTable.columns)
            .map(([name, definition]) => `${name} ${definition}`)
            .join(', ');
        db.exec(`CREATE TABLE ${projectsTable.name} (${columns})`);
        const client = createSqliteClient(':memory:');
        // Override the db connection for testing
        repo = new SQLiteProjectRepository(client);
        // @ts-expect-error - Inject our in-memory db for testing
        repo.db = db;
    });
    it('should insert and find project by id', async () => {
        await repo.insert({
            id: 'p1',
            slug: 'project-1',
            name: 'Project 1',
            owner_user_id: 'user-1',
        });
        const record = await repo.findById('p1');
        expect(record?.id).toBe('p1');
        expect(record?.slug).toBe('project-1');
        expect(record?.name).toBe('Project 1');
        expect(record?.owner_user_id).toBe('user-1');
        expect(record?.status).toBe('active');
        expect(record?.created_at).toBeDefined();
        expect(record?.updated_at).toBeDefined();
    });
    it('should protect against mutation by returning copies', async () => {
        await repo.insert({
            id: 'p1',
            slug: 'project-1',
            name: 'Project 1',
            owner_user_id: 'user-1',
        });
        const record = await repo.findById('p1');
        expect(record?.id).toBe('p1');
        if (!record) {
            throw new Error('record should exist');
        }
        record.name = 'mutated';
        const freshRecord = await repo.findById('p1');
        expect(freshRecord?.name).toBe('Project 1');
    });
    it('should find project by slug', async () => {
        await repo.insert({
            id: 'p1',
            slug: 'my-project',
            name: 'My Project',
            owner_user_id: 'user-1',
        });
        const record = await repo.findBySlug('my-project');
        expect(record?.id).toBe('p1');
        expect(record?.slug).toBe('my-project');
    });
    it('should return null when project not found by id', async () => {
        const record = await repo.findById('non-existent');
        expect(record).toBeNull();
    });
    it('should return null when project not found by slug', async () => {
        const record = await repo.findBySlug('non-existent');
        expect(record).toBeNull();
    });
    it('should find all projects by owner id', async () => {
        await repo.insert({
            id: 'p1',
            slug: 'project-1',
            name: 'Project 1',
            owner_user_id: 'user-1',
        });
        await repo.insert({
            id: 'p2',
            slug: 'project-2',
            name: 'Project 2',
            owner_user_id: 'user-1',
        });
        await repo.insert({
            id: 'p3',
            slug: 'project-3',
            name: 'Project 3',
            owner_user_id: 'user-2',
        });
        const projects = await repo.findByOwnerId('user-1');
        expect(projects.length).toBe(2);
        const ids = projects.map(p => p.id).sort();
        expect(ids).toEqual(['p1', 'p2']);
    });
    it('should return empty array when owner has no projects', async () => {
        const projects = await repo.findByOwnerId('empty-user');
        expect(projects).toEqual([]);
    });
    it('should update project fields', async () => {
        await repo.insert({
            id: 'p1',
            slug: 'project-1',
            name: 'Old Name',
            description: 'Old description',
            owner_user_id: 'user-1',
        });
        const original = await repo.findById('p1');
        expect(original?.name).toBe('Old Name');
        // Wait a tiny bit to ensure timestamp changes
        await new Promise(resolve => setTimeout(resolve, 2));
        await repo.update('p1', {
            name: 'New Name',
            description: 'New description',
            status: 'archived',
        });
        const updated = await repo.findById('p1');
        expect(updated?.name).toBe('New Name');
        expect(updated?.description).toBe('New description');
        expect(updated?.status).toBe('archived');
        expect(updated?.updated_at).not.toBe(original?.updated_at);
    });
    it('should not throw when updating non-existent project', async () => {
        await expect(repo.update('non-existent', { name: 'test' })).resolves.not.toThrow();
    });
    it('should delete project by id', async () => {
        await repo.insert({
            id: 'p1',
            slug: 'project-1',
            name: 'Project 1',
            owner_user_id: 'user-1',
        });
        expect(await repo.findById('p1')).not.toBeNull();
        await repo.delete('p1');
        expect(await repo.findById('p1')).toBeNull();
    });
    it('should enforce unique slug constraint', async () => {
        await repo.insert({
            id: 'p1',
            slug: 'same-slug',
            name: 'Project 1',
            owner_user_id: 'user-1',
        });
        // Inserting another project with same slug should throw
        await expect(repo.insert({
            id: 'p2',
            slug: 'same-slug',
            name: 'Project 2',
            owner_user_id: 'user-2',
        })).rejects.toThrow();
    });
    it('should handle nullable fields correctly', async () => {
        await repo.insert({
            id: 'p1',
            slug: 'project-1',
            name: 'Project 1',
            owner_user_id: 'user-1',
            description: null,
            settings_json: null,
        });
        const record = await repo.findById('p1');
        expect(record?.description).toBeNull();
        expect(record?.settings_json).toBeNull();
    });
    it('should store and retrieve settings json', async () => {
        const settings = JSON.stringify({ theme: 'dark', notifications: true });
        await repo.insert({
            id: 'p1',
            slug: 'project-1',
            name: 'Project 1',
            owner_user_id: 'user-1',
            settings_json: settings,
        });
        const record = await repo.findById('p1');
        expect(record?.settings_json).toBe(settings);
    });
});
