import { describe, expect, it } from 'vitest'
import { InMemoryMemoryRepository } from '../../../src/repositories/memory-repository'

describe('InMemoryMemoryRepository', () => {
  it('should store memory records in memory', async () => {
    const repo = new InMemoryMemoryRepository()

    await repo.insert({
      id: 'm1',
      projectId: 'p1',
      memoryType: 'fact',
    })

    const record = await repo.findById('m1')

    expect(record).toEqual({
      id: 'm1',
      projectId: 'p1',
      memoryType: 'fact',
    })
  })

  it('should return only records from the requested project', async () => {
    const repo = new InMemoryMemoryRepository()

    await repo.insert({
      id: 'm1',
      projectId: 'p1',
      memoryType: 'fact',
    })
    await repo.insert({
      id: 'm2',
      projectId: 'p1',
      memoryType: 'preference',
    })
    await repo.insert({
      id: 'm3',
      projectId: 'p2',
      memoryType: 'constraint',
    })

    const records = await repo.findByProjectId('p1')

    expect(records).toEqual([
      {
        id: 'm1',
        projectId: 'p1',
        memoryType: 'fact',
      },
      {
        id: 'm2',
        projectId: 'p1',
        memoryType: 'preference',
      },
    ])
  })

  it('should protect stored memory records from caller mutations', async () => {
    const repo = new InMemoryMemoryRepository()
    const inputRecord = {
      id: 'm1',
      projectId: 'p1',
      memoryType: 'fact' as const,
    }

    await repo.insert(inputRecord)
    inputRecord.projectId = 'p2'

    const storedRecord = await repo.findById('m1')

    expect(storedRecord).toEqual({
      id: 'm1',
      projectId: 'p1',
      memoryType: 'fact',
    })

    if (!storedRecord) {
      throw new Error('storedRecord should exist')
    }

    storedRecord.memoryType = 'experience'

    const reloadedRecord = await repo.findById('m1')

    expect(reloadedRecord).toEqual({
      id: 'm1',
      projectId: 'p1',
      memoryType: 'fact',
    })
  })

  it('should reject duplicate memory ids', async () => {
    const repo = new InMemoryMemoryRepository()

    await repo.insert({
      id: 'm1',
      projectId: 'p1',
      memoryType: 'fact',
    })

    await expect(
      repo.insert({
        id: 'm1',
        projectId: 'p2',
        memoryType: 'preference',
      }),
    ).rejects.toThrow('memory already exists')

    await expect(repo.findById('m1')).resolves.toEqual({
      id: 'm1',
      projectId: 'p1',
      memoryType: 'fact',
    })
  })

  it('should find memories by project id and type', async () => {
    const repo = new InMemoryMemoryRepository()

    await repo.insert({ id: 'm1', projectId: 'p1', memoryType: 'fact' })
    await repo.insert({ id: 'm2', projectId: 'p1', memoryType: 'fact' })
    await repo.insert({ id: 'm3', projectId: 'p1', memoryType: 'preference' })
    await repo.insert({ id: 'm4', projectId: 'p2', memoryType: 'fact' })

    const results = await repo.findByProjectIdAndType('p1', 'fact')
    expect(results.length).toBe(2)
    const ids = results.map(r => r.id).sort()
    expect(ids).toEqual(['m1', 'm2'])
  })

  it('should return empty array when no memories found by project id and type', async () => {
    const repo = new InMemoryMemoryRepository()
    const results = await repo.findByProjectIdAndType('p1', 'experience')
    expect(results).toEqual([])
  })

  it('should update an existing memory', async () => {
    const repo = new InMemoryMemoryRepository()
    await repo.insert({ id: 'm1', projectId: 'p1', memoryType: 'fact', title: 'Original' })

    await repo.update('m1', { title: 'Updated', content: 'New content' })
    const record = await repo.findById('m1')
    expect(record?.title).toBe('Updated')
    expect(record?.content).toBe('New content')
  })

  it('should do nothing when updating non-existent memory', async () => {
    const repo = new InMemoryMemoryRepository()
    await expect(repo.update('non-existent', { title: 'Updated' })).resolves.not.toThrow()
  })

  it('should delete a memory', async () => {
    const repo = new InMemoryMemoryRepository()
    await repo.insert({ id: 'm1', projectId: 'p1', memoryType: 'fact' })
    expect(await repo.findById('m1')).not.toBeNull()

    await repo.delete('m1')
    expect(await repo.findById('m1')).toBeNull()
  })

  it('should have close method that does nothing', () => {
    const repo = new InMemoryMemoryRepository()
    expect(() => repo.close()).not.toThrow()
  })
})
