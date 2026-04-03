import { describe, expect, it } from 'vitest'
import { createIngestEventService } from '../../src/services/ingest-event-service'
import { InMemoryEventRepository } from '../../src/repositories/event-repository'
import { InMemoryProjectRepository } from '../../src/repositories/project-repository'

describe('ingest event integration', () => {
  it('should validate then persist event', async () => {
    const eventRepository = new InMemoryEventRepository()
    const projectRepository = new InMemoryProjectRepository()
    await projectRepository.insert({
      id: 'p1',
      slug: 'project-1',
      name: 'Project 1',
      owner_user_id: 'u1',
    })

    const service = createIngestEventService({ eventRepository, projectRepository })

    const response = await service({
      projectId: 'p1',
      userId: 'u1',
      event: {
        eventType: 'message',
        sourceType: 'claude',
        scope: { type: 'project' },
        contentText: 'hello world',
      },
    })

    expect(response.success).toBe(true)

    if (!response.success) {
      throw new Error('response should be successful')
    }

    expect(await eventRepository.findById(response.data.eventId)).not.toBeNull()
  })

  it('should reject missing project before persisting event', async () => {
    const eventRepository = new InMemoryEventRepository()
    const projectRepository = new InMemoryProjectRepository()
    const service = createIngestEventService({ eventRepository, projectRepository })

    const response = await service({
      projectId: 'p-missing',
      userId: 'u1',
      event: {
        eventType: 'message',
        sourceType: 'claude',
        scope: { type: 'project' },
      },
    })

    expect(response.success).toBe(false)

    if (response.success) {
      throw new Error('response should be a failure response')
    }

    expect(response.error.code).toBe('NOT_FOUND')
    expect(response.error.message).toBe('project not found')
    expect(await eventRepository.findById('p-missing')).toBeNull()
  })
})
