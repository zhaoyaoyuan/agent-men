import { describe, expect, it, vi } from 'vitest'
import { createRecallMemoriesService } from '../../../src/services/recall-memories-service'

describe('createRecallMemoriesService', () => {
  it('should reject blank projectId', async () => {
    const service = createRecallMemoriesService({
      projectRepository: {
        async findById(id: string) {
          return { id }
        },
      },
      memoryRepository: {
        async findByProjectId() {
          return []
        },
      },
      eventMemoryLinkRepository: {
        async findByMemoryId() {
          return []
        },
      },
    })

    await expect(
      service({
        projectId: '   ',
        userId: 'u1',
        query: 'what should I remember?',
      }),
    ).rejects.toThrow('projectId is required')
  })

  it('should reject blank userId', async () => {
    const service = createRecallMemoriesService({
      projectRepository: {
        async findById(id: string) {
          return { id }
        },
      },
      memoryRepository: {
        async findByProjectId() {
          return []
        },
      },
      eventMemoryLinkRepository: {
        async findByMemoryId() {
          return []
        },
      },
    })

    await expect(
      service({
        projectId: 'p1',
        userId: '   ',
        query: 'what should I remember?',
      }),
    ).rejects.toThrow('userId is required')
  })

  it('should reject blank query', async () => {
    const service = createRecallMemoriesService({
      projectRepository: {
        async findById(id: string) {
          return { id }
        },
      },
      memoryRepository: {
        async findByProjectId() {
          return []
        },
      },
      eventMemoryLinkRepository: {
        async findByMemoryId() {
          return []
        },
      },
    })

    await expect(
      service({
        projectId: 'p1',
        userId: 'u1',
        query: '   ',
      }),
    ).rejects.toThrow('query is required')
  })

  it('should return not found when project does not exist', async () => {
    const service = createRecallMemoriesService({
      projectRepository: {
        async findById() {
          return null
        },
      },
      memoryRepository: {
        async findByProjectId() {
          return []
        },
      },
      eventMemoryLinkRepository: {
        async findByMemoryId() {
          return []
        },
      },
    })

    const result = await service({
      projectId: 'p-missing',
      userId: 'u1',
      query: 'what should I remember?',
    })

    expect(result.success).toBe(false)

    if (result.success) {
      throw new Error('result should be a failure response')
    }

    expect(result.error.code).toBe('NOT_FOUND')
    expect(result.error.message).toBe('project not found')
  })

  it('should return empty packet and default meta when no memories are found', async () => {
    const service = createRecallMemoriesService({
      projectRepository: {
        async findById(id: string) {
          return { id }
        },
      },
      memoryRepository: {
        async findByProjectId() {
          return []
        },
      },
      eventMemoryLinkRepository: {
        async findByMemoryId() {
          return []
        },
      },
    })

    const result = await service({
      projectId: 'p1',
      userId: 'u1',
      query: 'what should I remember?',
    })

    expect(result).toEqual({
      success: true,
      data: {
        items: [],
        packet: {
          activeFacts: [],
          constraints: [],
          preferences: [],
          taskState: [],
          experiences: [],
          supportingDocuments: [],
          trace: [],
        },
        meta: {
          totalCandidates: 0,
          returnedItems: 0,
          explainabilityEnabled: true,
          evidenceEnabled: false,
          documentsEnabled: true,
        },
      },
    })
  })

  it('should return storage error when project lookup fails', async () => {
    const service = createRecallMemoriesService({
      projectRepository: {
        async findById() {
          throw new Error('db unavailable')
        },
      },
      memoryRepository: {
        async findByProjectId() {
          return []
        },
      },
      eventMemoryLinkRepository: {
        async findByMemoryId() {
          return []
        },
      },
    })

    const result = await service({
      projectId: 'p1',
      userId: 'u1',
      query: 'what should I remember?',
    })

    expect(result.success).toBe(false)

    if (result.success) {
      throw new Error('result should be a failure response')
    }

    expect(result.error.code).toBe('STORAGE_ERROR')
    expect(result.error.message).toBe('failed to load project')
    expect(result.error.retryable).toBe(true)
  })

  it('should reject invalid options.limit', async () => {
    const service = createRecallMemoriesService({
      projectRepository: {
        async findById(id: string) {
          return { id }
        },
      },
      memoryRepository: {
        async findByProjectId() {
          return []
        },
      },
      eventMemoryLinkRepository: {
        async findByMemoryId() {
          return []
        },
      },
    })

    await expect(
      service({
        projectId: 'p1',
        userId: 'u1',
        query: 'what should I remember?',
        options: { limit: 0 },
      }),
    ).rejects.toThrow('options.limit must be an integer between 1 and 100')
  })

  it('should not query memories when project does not exist', async () => {
    const findByProjectId = vi.fn(async () => [])
    const service = createRecallMemoriesService({
      projectRepository: {
        async findById() {
          return null
        },
      },
      memoryRepository: {
        findByProjectId,
      },
      eventMemoryLinkRepository: {
        async findByMemoryId() {
          return []
        },
      },
    })

    await service({
      projectId: 'p-missing',
      userId: 'u1',
      query: 'what should I remember?',
    })

    expect(findByProjectId).not.toHaveBeenCalled()
  })

  it('should map repository memories into items and packet groups', async () => {
    const factMemory = {
      id: 'm1',
      memoryType: 'fact' as const,
      status: 'active',
      projectId: 'p1',
      userId: 'u1',
      title: 'Fact title',
      content: 'Fact content',
    }
    const preferenceMemory = {
      id: 'm2',
      memoryType: 'preference' as const,
      status: 'active',
      projectId: 'p1',
      userId: 'u1',
      title: 'Preference title',
      content: 'Preference content',
    }

    const service = createRecallMemoriesService({
      projectRepository: {
        async findById(id: string) {
          return { id }
        },
      },
      memoryRepository: {
        async findByProjectId() {
          return [factMemory, preferenceMemory]
        },
      },
      eventMemoryLinkRepository: {
        async findByMemoryId() {
          return []
        },
      },
    })

    const result = await service({
      projectId: 'p1',
      userId: 'u1',
      query: 'remember my preferences',
      options: { limit: 1 },
    })

    expect(result.success).toBe(true)

    if (!result.success) {
      throw new Error('result should be successful')
    }

    expect(result.data.items).toEqual([{ memory: factMemory, score: 0 }])
    expect(result.data.packet.activeFacts).toEqual([factMemory])
    expect(result.data.packet.preferences).toEqual([])
    expect(result.data.meta.totalCandidates).toBe(2)
    expect(result.data.meta.returnedItems).toBe(1)
  })

  it('should return storage error when memory lookup fails', async () => {
    const service = createRecallMemoriesService({
      projectRepository: {
        async findById(id: string) {
          return { id }
        },
      },
      memoryRepository: {
        async findByProjectId() {
          throw new Error('db unavailable')
        },
      },
      eventMemoryLinkRepository: {
        async findByMemoryId() {
          return []
        },
      },
    })

    const result = await service({
      projectId: 'p1',
      userId: 'u1',
      query: 'what should I remember?',
    })

    expect(result.success).toBe(false)

    if (result.success) {
      throw new Error('result should be a failure response')
    }

    expect(result.error.code).toBe('STORAGE_ERROR')
    expect(result.error.message).toBe('failed to load memories')
    expect(result.error.retryable).toBe(true)
  })

  it('should sort memories by similarity score descending', async () => {
    const memoryRepository = {
      async findByProjectId() {
        return [
          {
            id: 'm1',
            projectId: 'p1',
            memoryType: 'fact' as const,
            title: 'Coding',
            content: 'We write TypeScript code',
          },
          {
            id: 'm2',
            projectId: 'p1',
            memoryType: 'fact' as const,
            title: 'Cooking',
            content: 'We cook Italian pasta',
          },
          {
            id: 'm3',
            projectId: 'p1',
            memoryType: 'fact' as const,
            title: 'Typescript',
            content: 'TypeScript is a typed superset of JavaScript',
          },
        ]
      },
    }

    const service = createRecallMemoriesService({
      projectRepository: {
        async findById(id: string) {
          return { id }
        },
      },
      memoryRepository,
      eventMemoryLinkRepository: {
        async findByMemoryId() {
          return []
        },
      },
    })

    const result = await service({
      projectId: 'p1',
      userId: 'u1',
      query: 'TypeScript',
      options: {
        limit: 3,
      },
    })

    expect(result.success).toBe(true)

    if (!result.success) {
      throw new Error('result should be success')
    }

    expect(result.data.items.length).toBe(3)
    expect(result.data.items[0].memory.id).toBe('m3')
    expect(result.data.items[1].memory.id).toBe('m1')
    expect(result.data.items[2].memory.id).toBe('m2')
    expect(result.data.items[0].score).toBeGreaterThan(result.data.items[1].score)
    expect(result.data.items[1].score).toBeGreaterThan(result.data.items[2].score)
  })

  it('should limit results after sorting by score', async () => {
    const memoryRepository = {
      async findByProjectId() {
        return [
          { id: 'm1', projectId: 'p1', memoryType: 'fact' as const, title: 'A', content: 'about x' },
          { id: 'm2', projectId: 'p1', memoryType: 'fact' as const, title: 'B', content: 'about y' },
          { id: 'm3', projectId: 'p1', memoryType: 'fact' as const, title: 'C', content: 'about x y' },
          { id: 'm4', projectId: 'p1', memoryType: 'fact' as const, title: 'D', content: 'x is great' },
        ]
      },
    }

    const service = createRecallMemoriesService({
      projectRepository: {
        async findById(id: string) {
          return { id }
        },
      },
      memoryRepository,
      eventMemoryLinkRepository: {
        async findByMemoryId() {
          return []
        },
      },
    })

    const result = await service({
      projectId: 'p1',
      userId: 'u1',
      query: 'x',
      options: {
        limit: 2,
      },
    })

    expect(result.success).toBe(true)

    if (!result.success) {
      throw new Error('result should be success')
    }

    expect(result.data.items.length).toBe(2)
  })

  it('should populate trace with associated evidence event ids for each memory', async () => {
    const factMemory1 = {
      id: 'm1',
      memoryType: 'fact' as const,
      status: 'active',
      projectId: 'p1',
      userId: 'u1',
      title: 'Fact 1',
      content: 'First fact',
    }
    const factMemory2 = {
      id: 'm2',
      memoryType: 'fact' as const,
      status: 'active',
      projectId: 'p1',
      userId: 'u1',
      title: 'Fact 2',
      content: 'Second fact',
    }

    const service = createRecallMemoriesService({
      projectRepository: {
        async findById(id: string) {
          return { id }
        },
      },
      memoryRepository: {
        async findByProjectId() {
          return [factMemory1, factMemory2]
        },
      },
      eventMemoryLinkRepository: {
        async findByMemoryId(memoryId: string) {
          if (memoryId === 'm1') {
            return [
              { event_id: 'e1', memory_id: 'm1', evidence_role: 'source', weight: 1.0, created_at: new Date().toISOString() },
              { event_id: 'e2', memory_id: 'm1', evidence_role: 'source', weight: 1.0, created_at: new Date().toISOString() },
            ]
          }
          if (memoryId === 'm2') {
            return [
              { event_id: 'e3', memory_id: 'm2', evidence_role: 'source', weight: 1.0, created_at: new Date().toISOString() },
            ]
          }
          return []
        },
      },
    })

    const result = await service({
      projectId: 'p1',
      userId: 'u1',
      query: 'fact',
    })

    expect(result.success).toBe(true)

    if (!result.success) {
      throw new Error('result should be successful')
    }

    expect(result.data.packet.trace).toEqual([
      { memoryId: 'm1', evidenceEventIds: ['e1', 'e2'] },
      { memoryId: 'm2', evidenceEventIds: ['e3'] },
    ])
    expect(result.data.packet.trace).toHaveLength(2)
  })

  it('should return empty evidenceEventIds when memory has no associated events', async () => {
    const factMemory = {
      id: 'm1',
      memoryType: 'fact' as const,
      status: 'active',
      projectId: 'p1',
      userId: 'u1',
      title: 'Fact',
      content: 'Some fact',
    }

    const service = createRecallMemoriesService({
      projectRepository: {
        async findById(id: string) {
          return { id }
        },
      },
      memoryRepository: {
        async findByProjectId() {
          return [factMemory]
        },
      },
      eventMemoryLinkRepository: {
        async findByMemoryId() {
          return []
        },
      },
    })

    const result = await service({
      projectId: 'p1',
      userId: 'u1',
      query: 'fact',
    })

    expect(result.success).toBe(true)

    if (!result.success) {
      throw new Error('result should be successful')
    }

    expect(result.data.packet.trace).toEqual([
      { memoryId: 'm1', evidenceEventIds: [] },
    ])
  })

  it('should return storage error when event memory link lookup fails', async () => {
    const factMemory = {
      id: 'm1',
      memoryType: 'fact' as const,
      status: 'active',
      projectId: 'p1',
      userId: 'u1',
      title: 'Fact',
      content: 'Some fact',
    }

    const service = createRecallMemoriesService({
      projectRepository: {
        async findById(id: string) {
          return { id }
        },
      },
      memoryRepository: {
        async findByProjectId() {
          return [factMemory]
        },
      },
      eventMemoryLinkRepository: {
        async findByMemoryId() {
          throw new Error('db unavailable')
        },
      },
    })

    const result = await service({
      projectId: 'p1',
      userId: 'u1',
      query: 'fact',
    })

    expect(result.success).toBe(false)

    if (!result.success) {
      expect(result.error.code).toBe('STORAGE_ERROR')
      expect(result.error.message).toBe('failed to load evidence links')
      expect(result.error.retryable).toBe(true)
    }
  })
})
