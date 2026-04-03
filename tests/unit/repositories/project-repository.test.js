import { describe, expect, it } from 'vitest';
import { InMemoryProjectRepository } from '../../../src/repositories/project-repository';
describe('InMemoryProjectRepository', () => {
    it('should store project records in memory', async () => {
        const repo = new InMemoryProjectRepository();
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
    });
    it('should protect stored project records from caller mutations', async () => {
        const repo = new InMemoryProjectRepository();
        const inputRecord = {
            id: 'p1',
            slug: 'project-1',
            name: 'Project 1',
            owner_user_id: 'user-1',
        };
        await repo.insert(inputRecord);
        const storedRecord = await repo.findById('p1');
        expect(storedRecord?.id).toBe('p1');
        if (!storedRecord) {
            throw new Error('storedRecord should exist');
        }
        storedRecord.id = 'mutated';
        const reloadedRecord = await repo.findById('p1');
        expect(reloadedRecord?.id).toBe('p1');
    });
    it('should find project by slug', async () => {
        const repo = new InMemoryProjectRepository();
        await repo.insert({
            id: 'p1',
            slug: 'my-project',
            name: 'My Project',
            owner_user_id: 'user-1',
        });
        const record = await repo.findBySlug('my-project');
        expect(record?.id).toBe('p1');
    });
    it('should find all projects by owner id', async () => {
        const repo = new InMemoryProjectRepository();
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
        expect(projects.map(p => p.id).sort()).toEqual(['p1', 'p2']);
    });
    it('should update project fields', async () => {
        const repo = new InMemoryProjectRepository();
        await repo.insert({
            id: 'p1',
            slug: 'project-1',
            name: 'Old Name',
            owner_user_id: 'user-1',
        });
        await repo.update('p1', { name: 'New Name', description: 'Updated desc' });
        const record = await repo.findById('p1');
        expect(record?.name).toBe('New Name');
        expect(record?.description).toBe('Updated desc');
        expect(record?.updated_at).toBeDefined();
    });
    it('should delete project', async () => {
        const repo = new InMemoryProjectRepository();
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
});
