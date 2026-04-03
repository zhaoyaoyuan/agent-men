import { describe, expect, it, vi } from 'vitest'
import { InMemoryMemoryRepository } from '../../../src/repositories/memory-repository'
import { createExtractMemoriesService } from '../../../src/services/extract-memories-service'

describe('createExtractMemoriesService', () => {
  it('should reject empty eventIds', async () => {
    const service = createExtractMemoriesService({
      projectRepository: {
        async findById() {
          return { id: 'p1' }
        },
      },
      eventRepository: {
        async findById() {
          return { id: 'e1', projectId: 'p1', userId: 'u1', contentText: 'test' }
        },
      },
      memoryRepository: {
        async insert() {},
      },
      eventMemoryLinkRepository: {
        async insert() {},
      },
      llmClient: {
        async extractMemoriesFromEvent() {
          return [{ memoryType: 'fact', title: 'test', content: 'test' }]
        },
      },
    })

    await expect(
      service({
        projectId: 'p1',
        userId: 'u1',
        eventIds: [],
      }),
    ).rejects.toThrow('eventIds is required')
  })

  it('should create memory records for existing project and events when content is provided', async () => {
    const memoryRepository = new InMemoryMemoryRepository()
    const service = createExtractMemoriesService({
      projectRepository: {
        async findById(id: string) {
          return { id }
        },
      },
      eventRepository: {
        async findById(id: string) {
          return { id, projectId: 'p1', userId: 'u1', contentText: 'default fact' }
        },
      },
      memoryRepository,
      eventMemoryLinkRepository: {
        async insert() {},
      },
      llmClient: {
        async extractMemoriesFromEvent() {
          return [{
            memoryType: 'fact',
            title: 'Default fact',
            content: 'default fact',
          }]
        },
      },
    })

    const result = await service({
      projectId: 'p1',
      userId: 'u1',
      eventIds: ['e1'],
    })

    expect(result.success).toBe(true)
    if (!result.success) {
      throw new Error('result should be a success response')
    }
    expect(result.data.created).toHaveLength(1)
  })

  it('should return not found when project does not exist', async () => {
    const service = createExtractMemoriesService({
      projectRepository: {
        async findById() {
          return null
        },
      },
      eventRepository: {
        async findById() {
          return { id: 'e1', projectId: 'p1', userId: 'u1', contentText: 'test' }
        },
      },
      memoryRepository: {
        async insert() {},
      },
      eventMemoryLinkRepository: {
        async insert() {},
      },
      llmClient: {
        async extractMemoriesFromEvent() {
          return [{ memoryType: 'fact', title: 'test', content: 'test' }]
        },
      },
    })

    const result = await service({
      projectId: 'p-missing',
      userId: 'u1',
      eventIds: ['e1'],
    })

    expect(result.success).toBe(false)

    if (result.success) {
      throw new Error('result should be a failure response')
    }

    expect(result.error.code).toBe('NOT_FOUND')
    expect(result.error.message).toBe('project not found')
  })

  it('should return not found when any event does not exist', async () => {
    const service = createExtractMemoriesService({
      projectRepository: {
        async findById(id: string) {
          return { id }
        },
      },
      eventRepository: {
        async findById() {
          return null
        },
      },
      memoryRepository: {
        async insert() {},
      },
      eventMemoryLinkRepository: {
        async insert() {},
      },
      llmClient: {
        async extractMemoriesFromEvent() {
          return [{ memoryType: 'fact', title: 'test', content: 'test' }]
        },
      },
    })

    const result = await service({
      projectId: 'p1',
      userId: 'u1',
      eventIds: ['e-missing'],
    })

    expect(result.success).toBe(false)

    if (result.success) {
      throw new Error('result should be a failure response')
    }

    expect(result.error.code).toBe('NOT_FOUND')
    expect(result.error.message).toBe('event not found')
  })

  it('should reject blank projectId', async () => {
    const service = createExtractMemoriesService({
      projectRepository: {
        async findById(id: string) {
          return { id }
        },
      },
      eventRepository: {
        async findById(id: string) {
          return { id, projectId: 'p1', userId: 'u1', contentText: 'test' }
        },
      },
      memoryRepository: {
        async insert() {},
      },
      eventMemoryLinkRepository: {
        async insert() {},
      },
      llmClient: {
        async extractMemoriesFromEvent() {
          return [{ memoryType: 'fact', title: 'test', content: 'test' }]
        },
      },
    })

    await expect(
      service({
        projectId: '   ',
        userId: 'u1',
        eventIds: ['e1'],
      }),
    ).rejects.toThrow('projectId is required')
  })

  it('should reject blank userId', async () => {
    const service = createExtractMemoriesService({
      projectRepository: {
        async findById(id: string) {
          return { id }
        },
      },
      eventRepository: {
        async findById(id: string) {
          return { id, projectId: 'p1', userId: 'u1', contentText: 'test' }
        },
      },
      memoryRepository: {
        async insert() {},
      },
      eventMemoryLinkRepository: {
        async insert() {},
      },
      llmClient: {
        async extractMemoriesFromEvent() {
          return [{ memoryType: 'fact', title: 'test', content: 'test' }]
        },
      },
    })

    await expect(
      service({
        projectId: 'p1',
        userId: '   ',
        eventIds: ['e1'],
      }),
    ).rejects.toThrow('userId is required')
  })

  it('should return conflict when event belongs to another project', async () => {
    const service = createExtractMemoriesService({
      projectRepository: {
        async findById(id: string) {
          return { id }
        },
      },
      eventRepository: {
        async findById(id: string) {
          return { id, projectId: 'p2', userId: 'u1', contentText: 'test' }
        },
      },
      memoryRepository: {
        async insert() {},
      },
      eventMemoryLinkRepository: {
        async insert() {},
      },
      llmClient: {
        async extractMemoriesFromEvent() {
          return [{ memoryType: 'fact', title: 'test', content: 'test' }]
        },
      },
    })

    const result = await service({
      projectId: 'p1',
      userId: 'u1',
      eventIds: ['e1'],
    })

    expect(result.success).toBe(false)

    if (result.success) {
      throw new Error('result should be a failure response')
    }

    expect(result.error.code).toBe('CONFLICT')
    expect(result.error.message).toBe('event does not belong to project')
  })

  it('should return not found when event belongs to another user', async () => {
    const service = createExtractMemoriesService({
      projectRepository: {
        async findById(id: string) {
          return { id }
        },
      },
      eventRepository: {
        async findById(id: string) {
          return { id, projectId: 'p1', userId: 'u2', contentText: 'test' }
        },
      },
      memoryRepository: {
        async insert() {},
      },
      eventMemoryLinkRepository: {
        async insert() {},
      },
      llmClient: {
        async extractMemoriesFromEvent() {
          return [{ memoryType: 'fact', title: 'test', content: 'test' }]
        },
      },
    })

    const result = await service({
      projectId: 'p1',
      userId: 'u1',
      eventIds: ['e1'],
    })

    expect(result.success).toBe(false)

    if (result.success) {
      throw new Error('result should be a failure response')
    }

    expect(result.error.code).toBe('NOT_FOUND')
    expect(result.error.message).toBe('event not accessible')
  })

  it('should return storage error when project lookup fails', async () => {
    const service = createExtractMemoriesService({
      projectRepository: {
        async findById() {
          throw new Error('db unavailable')
        },
      },
      eventRepository: {
        async findById(id: string) {
          return { id, projectId: 'p1', userId: 'u1', contentText: 'test' }
        },
      },
      memoryRepository: {
        async insert() {},
      },
      eventMemoryLinkRepository: {
        async insert() {},
      },
      llmClient: {
        async extractMemoriesFromEvent() {
          return [{ memoryType: 'fact', title: 'test', content: 'test' }]
        },
      },
    })

    const result = await service({
      projectId: 'p1',
      userId: 'u1',
      eventIds: ['e1'],
    })

    expect(result.success).toBe(false)

    if (result.success) {
      throw new Error('result should be a failure response')
    }

    expect(result.error.code).toBe('STORAGE_ERROR')
    expect(result.error.message).toBe('failed to load project')
    expect(result.error.retryable).toBe(true)
  })

  it('should return storage error when event lookup fails', async () => {
    const service = createExtractMemoriesService({
      projectRepository: {
        async findById(id: string) {
          return { id }
        },
      },
      eventRepository: {
        async findById() {
          throw new Error('db unavailable')
        },
      },
      memoryRepository: {
        async insert() {},
      },
      eventMemoryLinkRepository: {
        async insert() {},
      },
      llmClient: {
        async extractMemoriesFromEvent() {
          return [{ memoryType: 'fact', title: 'test', content: 'test' }]
        },
      },
    })

    const result = await service({
      projectId: 'p1',
      userId: 'u1',
      eventIds: ['e1'],
    })

    expect(result.success).toBe(false)

    if (result.success) {
      throw new Error('result should be a failure response')
    }

    expect(result.error.code).toBe('STORAGE_ERROR')
    expect(result.error.message).toBe('failed to load event')
    expect(result.error.retryable).toBe(true)
  })

  it('should reject empty eventId in eventIds array', async () => {
    const service = createExtractMemoriesService({
      projectRepository: {
        async findById(id: string) {
          return { id }
        },
      },
      eventRepository: {
        async findById(id: string) {
          return { id, projectId: 'p1', userId: 'u1', contentText: 'test' }
        },
      },
      memoryRepository: {
        async insert() {},
      },
      eventMemoryLinkRepository: {
        async insert() {},
      },
      llmClient: {
        async extractMemoriesFromEvent() {
          return [{ memoryType: 'fact', title: 'test', content: 'test' }]
        },
      },
    })

    await expect(
      service({
        projectId: 'p1',
        userId: 'u1',
        eventIds: ['e1', '', 'e3'],
      }),
    ).rejects.toThrow('eventIds must contain non-empty strings')
  })

  it('should reject duplicate eventIds in input', async () => {
    const service = createExtractMemoriesService({
      projectRepository: {
        async findById(id: string) {
          return { id }
        },
      },
      eventRepository: {
        async findById(id: string) {
          return { id, projectId: 'p1', userId: 'u1', contentText: 'test' }
        },
      },
      memoryRepository: {
        async insert() {},
      },
      eventMemoryLinkRepository: {
        async insert() {},
      },
      llmClient: {
        async extractMemoriesFromEvent() {
          return [{ memoryType: 'fact', title: 'test', content: 'test' }]
        },
      },
    })

    await expect(
      service({
        projectId: 'p1',
        userId: 'u1',
        eventIds: ['e1', 'e2', 'e1'],
      }),
    ).rejects.toThrow('eventIds must be unique')
  })

  it('should not leave partial writes when a later event lookup fails', async () => {
    const memoryRepository = new InMemoryMemoryRepository()
    const service = createExtractMemoriesService({
      projectRepository: {
        async findById(id: string) {
          return { id }
        },
      },
      eventRepository: {
        async findById(id: string) {
          if (id === 'e2') {
            throw new Error('db unavailable')
          }

          return { id, projectId: 'p1', userId: 'u1', contentText: 'test' }
        },
      },
      memoryRepository,
      eventMemoryLinkRepository: {
        async insert() {},
      },
      llmClient: {
        async extractMemoriesFromEvent() {
          return [{ memoryType: 'fact', title: 'test', content: 'test' }]
        },
      },
    })

    const result = await service({
      projectId: 'p1',
      userId: 'u1',
      eventIds: ['e1', 'e2'],
    })

    expect(result.success).toBe(false)

    if (result.success) {
      throw new Error('result should be a failure response')
    }

    expect(result.error.code).toBe('STORAGE_ERROR')
    expect(result.error.message).toBe('failed to load event')
    await expect(memoryRepository.findById('memory-e1-fact')).resolves.toBeNull()
  })

  it('should reject when strategy options are provided but not supported', async () => {
    const service = createExtractMemoriesService({
      projectRepository: {
        async findById(id: string) {
          return { id }
        },
      },
      eventRepository: {
        async findById(id: string) {
          return { id, projectId: 'p1', userId: 'u1', contentText: 'test' }
        },
      },
      memoryRepository: {
        async insert() {},
      },
      eventMemoryLinkRepository: {
        async insert() {},
      },
      llmClient: {
        async extractMemoriesFromEvent() {
          return [{ memoryType: 'fact', title: 'test', content: 'test' }]
        },
      },
    })

    const result = await service({
      projectId: 'p1',
      userId: 'u1',
      eventIds: ['e1'],
      strategy: {
        overwriteExisting: true,
      },
    })

    expect(result.success).toBe(false)

    if (result.success) {
      throw new Error('result should be a failure response')
    }

    expect(result.error.code).toBe('INVALID_INPUT')
    expect(result.error.message).toBe('strategy options are not supported yet')
  })

  it('should create event-memory links when extracting memories from events', async () => {
    const { vi } = await import('vitest')
    const memoryRepository = new InMemoryMemoryRepository()
    const eventMemoryLinkRepository = {
      insert: vi.fn(async () => {}),
    }

    const service = createExtractMemoriesService({
      projectRepository: {
        async findById(id: string) {
          return { id }
        },
      },
      eventRepository: {
        async findById(id: string) {
          return { id, projectId: 'p1', userId: 'u1', contentText: 'content' }
        },
      },
      memoryRepository,
      eventMemoryLinkRepository,
      llmClient: {
        async extractMemoriesFromEvent() {
          return [{
            memoryType: 'fact',
            title: 'Empty fact',
            content: 'content',
          }]
        },
      },
    })

    const result = await service({
      projectId: 'p1',
      userId: 'u1',
      eventIds: ['e1', 'e2'],
    })

    expect(result.success).toBe(true)

    expect(eventMemoryLinkRepository.insert).toHaveBeenCalledTimes(2)
    expect(eventMemoryLinkRepository.insert).toHaveBeenNthCalledWith(1, expect.objectContaining({
      event_id: 'e1',
      memory_id: expect.any(String),
      evidence_role: 'source',
      weight: 1.0,
      created_at: expect.any(String),
    }))
  })

  it('should extract multiple memories with title and content from event content using LLM', async () => {
    const memoryRepository = new InMemoryMemoryRepository()
    const eventMemoryLinkRepository = {
      insert: vi.fn(async () => {}),
    }

    // Mock LLM client that returns multiple memories
    const mockLLMClient = {
      extractMemoriesFromEvent: vi.fn(async () => [
        {
          memoryType: 'fact' as const,
          title: 'User prefers dark mode',
          content: 'The user explicitly stated they prefer dark mode for all applications.',
        },
        {
          memoryType: 'preference' as const,
          title: 'Notification preference',
          content: 'User wants to receive daily summary notifications only.',
        },
        {
          memoryType: 'constraint' as const,
          title: 'Working hours constraint',
          content: 'User only works between 9 AM to 5 PM UTC+8.',
        },
      ]),
    } as const satisfies import('../../../src/services/extract-memories-service').LLMClient

    const service = createExtractMemoriesService({
      projectRepository: {
        async findById(id: string) {
          return { id }
        },
      },
      eventRepository: {
        async findById(id: string) {
          return {
            id,
            projectId: 'p1',
            userId: 'u1',
            contentText: 'I prefer dark mode. I want daily summary notifications only. I work from 9 AM to 5 PM UTC+8.',
          }
        },
      },
      memoryRepository,
      eventMemoryLinkRepository,
      llmClient: mockLLMClient,
    })

    const result = await service({
      projectId: 'p1',
      userId: 'u1',
      eventIds: ['e1'],
    })

    expect(result.success).toBe(true)
    if (!result.success) throw new Error('should succeed')

    expect(result.data.created).toHaveLength(3)
    expect(mockLLMClient.extractMemoriesFromEvent).toHaveBeenCalledWith(
      expect.stringContaining('I prefer dark mode')
    )

    // Verify memories were stored with title and content
    const storedMemories = await memoryRepository.findByProjectId('p1')
    expect(storedMemories).toHaveLength(3)
    storedMemories.forEach(memory => {
      expect(memory.title).toBeDefined()
      expect(memory.content).toBeDefined()
      expect(memory.title).not.toBe('')
      expect(memory.content).not.toBe('')
    })

    // Verify links were created
    expect(eventMemoryLinkRepository.insert).toHaveBeenCalledTimes(3)
    expect(eventMemoryLinkRepository.insert).toHaveBeenCalledWith(expect.objectContaining({
      event_id: 'e1',
      evidence_role: 'source',
      weight: 1.0,
    }))
  })

  it('should skip when LLM extracts no memories from event', async () => {
    const memoryRepository = new InMemoryMemoryRepository()
    const eventMemoryLinkRepository = {
      insert: vi.fn(async () => {}),
    }

    const mockLLMClient = {
      extractMemoriesFromEvent: vi.fn(async () => []),
    } as const satisfies import('../../../src/services/extract-memories-service').LLMClient

    const service = createExtractMemoriesService({
      projectRepository: {
        async findById(id: string) {
          return { id }
        },
      },
      eventRepository: {
        async findById(id: string) {
          return {
            id,
            projectId: 'p1',
            userId: 'u1',
            contentText: 'Hello world',
          }
        },
      },
      memoryRepository,
      eventMemoryLinkRepository,
      llmClient: mockLLMClient,
    })

    const result = await service({
      projectId: 'p1',
      userId: 'u1',
      eventIds: ['e1'],
    })

    expect(result.success).toBe(true)
    if (!result.success) throw new Error('should succeed')

    expect(result.data.created).toHaveLength(0)
    expect(result.data.skipped).toHaveLength(1)
    expect(result.data.skipped[0].eventId).toBe('e1')
    expect(result.data.skipped[0].reason).toContain('no memories extracted')

    const storedMemories = await memoryRepository.findByProjectId('p1')
    expect(storedMemories).toHaveLength(0)
  })

  it('should handle different memory types correctly', async () => {
    const memoryRepository = new InMemoryMemoryRepository()
    const eventMemoryLinkRepository = {
      insert: vi.fn(async () => {}),
    }

    const mockLLMClient = {
      extractMemoriesFromEvent: vi.fn(async () => [
        { memoryType: 'fact' as const, title: 'Fact 1', content: 'Content 1' },
        { memoryType: 'constraint' as const, title: 'Constraint 1', content: 'Content 2' },
        { memoryType: 'preference' as const, title: 'Preference 1', content: 'Content 3' },
        { memoryType: 'task_state' as const, title: 'Task State', content: 'Task was completed' },
        { memoryType: 'experience' as const, title: 'Experience', content: 'This approach worked well' },
      ]),
    } as const satisfies import('../../../src/services/extract-memories-service').LLMClient

    const service = createExtractMemoriesService({
      projectRepository: {
        async findById(id: string) {
          return { id }
        },
      },
      eventRepository: {
        async findById(id: string) {
          return { id, projectId: 'p1', userId: 'u1', contentText: 'test' }
        },
      },
      memoryRepository,
      eventMemoryLinkRepository,
      llmClient: mockLLMClient,
    })

    const result = await service({
      projectId: 'p1',
      userId: 'u1',
      eventIds: ['e1'],
    })

    expect(result.success).toBe(true)
    if (!result.success) throw new Error('should succeed')
    expect(result.data.created).toHaveLength(5)

    const storedMemories = await memoryRepository.findByProjectId('p1')
    const types = storedMemories.map(m => m.memoryType).sort()
    expect(types).toEqual(['constraint', 'experience', 'fact', 'preference', 'task_state'])
  })

  it('should return error when LLM call fails', async () => {
    const memoryRepository = new InMemoryMemoryRepository()
    const eventMemoryLinkRepository = {
      insert: vi.fn(async () => {}),
    }

    const mockLLMClient = {
      extractMemoriesFromEvent: vi.fn(async () => {
        throw new Error('LLM API unavailable')
      }),
    } as const satisfies import('../../../src/services/extract-memories-service').LLMClient

    const service = createExtractMemoriesService({
      projectRepository: {
        async findById(id: string) {
          return { id }
        },
      },
      eventRepository: {
        async findById(id: string) {
          return { id, projectId: 'p1', userId: 'u1', contentText: 'test' }
        },
      },
      memoryRepository,
      eventMemoryLinkRepository,
      llmClient: mockLLMClient,
    })

    const result = await service({
      projectId: 'p1',
      userId: 'u1',
      eventIds: ['e1'],
    })

    expect(result.success).toBe(false)
    if (result.success) throw new Error('should fail')
    expect(result.error.code).toBe('LLM_ERROR')
    expect(result.error.message).toBe('failed to extract memories from event')
    expect(result.error.retryable).toBe(true)
  })

  it('should skip event when content is empty', async () => {
    const memoryRepository = new InMemoryMemoryRepository()
    const eventMemoryLinkRepository = {
      insert: vi.fn(async () => {}),
    }

    const mockLLMClient = {
      extractMemoriesFromEvent: vi.fn(async () => []),
    } as const satisfies import('../../../src/services/extract-memories-service').LLMClient

    const service = createExtractMemoriesService({
      projectRepository: {
        async findById(id: string) {
          return { id }
        },
      },
      eventRepository: {
        async findById(id: string) {
          return {
            id,
            projectId: 'p1',
            userId: 'u1',
            contentText: null,
          }
        },
      },
      memoryRepository,
      eventMemoryLinkRepository,
      llmClient: mockLLMClient,
    })

    const result = await service({
      projectId: 'p1',
      userId: 'u1',
      eventIds: ['e1'],
    })

    expect(result.success).toBe(true)
    if (!result.success) throw new Error('should succeed')
    expect(result.data.created).toHaveLength(0)
    expect(result.data.skipped).toHaveLength(1)
    expect(result.data.skipped[0].reason).toContain('empty content')
  })
})
