import { describe, expect, it } from 'vitest'
import { createIngestEventService } from '../../../src/services/ingest-event-service'
import { InMemoryEventRepository } from '../../../src/repositories/event-repository'
import { InMemoryProjectRepository } from '../../../src/repositories/project-repository'

describe('createIngestEventService', () => {
  it('should persist event and return success response', async () => {
    const eventRepository = new InMemoryEventRepository()
    const projectRepository = new InMemoryProjectRepository()
    await projectRepository.insert({
      id: 'p1',
      slug: 'project-1',
      name: 'Project 1',
      owner_user_id: 'u1',
    })

    const service = createIngestEventService({ eventRepository, projectRepository })

    const result = await service({
      projectId: 'p1',
      userId: 'u1',
      event: {
        eventType: 'message',
        sourceType: 'claude',
        scope: { type: 'project' },
        contentText: 'hello',
      },
    })

    expect(result.success).toBe(true)

    if (!result.success) {
      throw new Error('result should be successful')
    }

    expect(result.data.accepted).toBe(true)
    expect(result.data.eventId).toBeDefined()
  })

  it('should reject unknown project before persisting event', async () => {
    const insertSpy = {
      async insert() {
        throw new Error('insert should not be called')
      },
    }

    const service = createIngestEventService({
      eventRepository: insertSpy,
      projectRepository: {
        async findById() {
          return null
        },
      },
    })

    const result = await service({
      projectId: 'p-missing',
      userId: 'u1',
      event: {
        eventType: 'message',
        sourceType: 'claude',
        scope: { type: 'project' },
      },
    })

    expect(result.success).toBe(false)

    if (result.success) {
      throw new Error('result should be a failure response')
    }

    expect(result.error.code).toBe('NOT_FOUND')
    expect(result.error.message).toBe('project not found')
  })

  it('should return storage error response when repository insert fails', async () => {
    const projectRepository = new InMemoryProjectRepository()
    await projectRepository.insert({
      id: 'p1',
      slug: 'project-1',
      name: 'Project 1',
      owner_user_id: 'u1',
    })

    const service = createIngestEventService({
      eventRepository: {
        async insert() {
          throw new Error('db unavailable')
        },
      },
      projectRepository,
    })

    const result = await service({
      projectId: 'p1',
      userId: 'u1',
      event: {
        eventType: 'message',
        sourceType: 'claude',
        scope: { type: 'project' },
      },
    })

    expect(result.success).toBe(false)

    if (result.success) {
      throw new Error('result should be a failure response')
    }

    expect(result.error.code).toBe('STORAGE_ERROR')
    expect(result.error.message).toBe('failed to persist event')
    expect(result.error.retryable).toBe(true)
  })
})
