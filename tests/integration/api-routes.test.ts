import { describe, it, expect, vi } from 'vitest'
import { createApp, type IngestEventService, type ExtractMemoriesService, type RecallMemoriesService } from '../../src/api/app'
import type { ProjectRepository } from '../../src/repositories/project-repository'
import type { MemoryRepository } from '../../src/repositories/memory-repository'

describe('API Routes', () => {
  const mockIngestEvent = vi.fn<IngestEventService>()
  const mockExtractMemories = vi.fn<ExtractMemoriesService>()
  const mockRecallMemories = vi.fn<RecallMemoriesService>()
  const mockProjectRepository: ProjectRepository = {
    insert: vi.fn(),
    findById: vi.fn().mockResolvedValue(null),
    findBySlug: vi.fn().mockResolvedValue(null),
    findByOwnerId: vi.fn().mockResolvedValue([]),
    findAll: vi.fn().mockResolvedValue([]),
    update: vi.fn(),
    delete: vi.fn(),
    close: vi.fn(),
  }
  const mockMemoryRepository: MemoryRepository = {
    insert: vi.fn(),
    findById: vi.fn().mockResolvedValue(null),
    findByProjectId: vi.fn().mockResolvedValue([]),
    findByProjectIdAndType: vi.fn().mockResolvedValue([]),
    update: vi.fn(),
    delete: vi.fn(),
    close: vi.fn(),
  }

  const app = createApp({
    ingestEventService: mockIngestEvent,
    extractMemoriesService: mockExtractMemories,
    recallMemoriesService: mockRecallMemories,
    projectRepository: mockProjectRepository,
    memoryRepository: mockMemoryRepository,
  })

  describe('POST /api/ingest', () => {
    it('returns 200 with success response when input is valid', async () => {
      mockIngestEvent.mockResolvedValue({
        success: true,
        data: {
          eventId: 'test-event-123',
          accepted: true,
          deduplicated: false,
          extractedMemoryIds: [],
          extractedEntityIds: [],
        },
      })

      const req = new Request('http://localhost/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: 'project-123',
          userId: 'user-456',
          event: {
            eventType: 'message',
            sourceType: 'claude',
            scope: { type: 'project' },
            contentText: 'User created a new task',
            importanceScore: 0.8,
          },
        }),
      })

      const res = await app.fetch(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.eventId).toBe('test-event-123')
      expect(mockIngestEvent).toHaveBeenCalled()
    })

    it('returns 400 when projectId is missing', async () => {
      const req = new Request('http://localhost/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'user-456',
          event: {
            eventType: 'user_message',
            sourceType: 'chat',
            scope: { type: 'project' },
          },
        }),
      })

      const res = await app.fetch(req)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INVALID_INPUT')
    })

    it('returns 400 when eventType is invalid', async () => {
      const req = new Request('http://localhost/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: 'project-123',
          userId: 'user-456',
          event: {
            eventType: 'invalid-type',
            sourceType: 'claude',
            scope: { type: 'project' },
          },
        }),
      })

      const res = await app.fetch(req)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INVALID_INPUT')
    })

    it('returns 400 when importanceScore is out of range', async () => {
      const req = new Request('http://localhost/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: 'project-123',
          userId: 'user-456',
          event: {
            eventType: 'message',
            sourceType: 'claude',
            scope: { type: 'project' },
            importanceScore: 2.5,
          },
        }),
      })

      const res = await app.fetch(req)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INVALID_INPUT')
    })

    it('returns correct error response when service returns NOT_FOUND', async () => {
      mockIngestEvent.mockResolvedValue({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'project not found',
        },
      })

      const req = new Request('http://localhost/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: 'non-existent',
          userId: 'user-456',
          event: {
            eventType: 'message',
            sourceType: 'claude',
            scope: { type: 'project' },
          },
        }),
      })

      const res = await app.fetch(req)
      const data = await res.json()

      expect(res.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('NOT_FOUND')
    })

    it('returns 500 when service throws unexpected error', async () => {
      mockIngestEvent.mockRejectedValue(new Error('Unexpected failure'))

      const req = new Request('http://localhost/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: 'project-123',
          userId: 'user-456',
          event: {
            eventType: 'message',
            sourceType: 'claude',
            scope: { type: 'project' },
          },
        }),
      })

      const res = await app.fetch(req)
      const data = await res.json()

      expect(res.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })

    it('returns 400 when body is not JSON', async () => {
      const req = new Request('http://localhost/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not valid json',
      })

      const res = await app.fetch(req)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INVALID_INPUT')
    })
  })

  describe('POST /api/extract', () => {
    it('returns 200 with success response when input is valid', async () => {
      mockExtractMemories.mockResolvedValue({
        success: true,
        data: {
          created: ['memory-1', 'memory-2'],
          updated: [],
          skipped: [],
        },
      })

      const req = new Request('http://localhost/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: 'project-123',
          userId: 'user-456',
          eventIds: ['event-1', 'event-2'],
        }),
      })

      const res = await app.fetch(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.created).toHaveLength(2)
      expect(mockExtractMemories).toHaveBeenCalled()
    })

    it('returns 400 when eventIds is empty', async () => {
      const req = new Request('http://localhost/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: 'project-123',
          userId: 'user-456',
          eventIds: [],
        }),
      })

      const res = await app.fetch(req)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INVALID_INPUT')
    })

    it('returns 400 when eventIds has duplicates', async () => {
      const req = new Request('http://localhost/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: 'project-123',
          userId: 'user-456',
          eventIds: ['event-1', 'event-1'],
        }),
      })

      const res = await app.fetch(req)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INVALID_INPUT')
    })

    it('returns 404 when project not found', async () => {
      mockExtractMemories.mockResolvedValue({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'project not found',
        },
      })

      const req = new Request('http://localhost/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: 'non-existent',
          userId: 'user-456',
          eventIds: ['event-1'],
        }),
      })

      const res = await app.fetch(req)
      const data = await res.json()

      expect(res.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('NOT_FOUND')
    })
  })

  describe('POST /api/recall', () => {
    it('returns 200 with success response when input is valid', async () => {
      mockRecallMemories.mockResolvedValue({
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

      const req = new Request('http://localhost/api/recall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: 'project-123',
          userId: 'user-456',
          query: 'user task creation',
          options: {
            limit: 10,
          },
        }),
      })

      const res = await app.fetch(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.meta).toBeDefined()
      expect(mockRecallMemories).toHaveBeenCalled()
    })

    it('returns 400 when query is empty', async () => {
      const req = new Request('http://localhost/api/recall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: 'project-123',
          userId: 'user-456',
          query: '',
        }),
      })

      const res = await app.fetch(req)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INVALID_INPUT')
    })

    it('returns 400 when limit is out of range', async () => {
      const req = new Request('http://localhost/api/recall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: 'project-123',
          userId: 'user-456',
          query: 'test',
          options: {
            limit: 200,
          },
        }),
      })

      const res = await app.fetch(req)
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('INVALID_INPUT')
    })

    it('returns 404 when project not found', async () => {
      mockRecallMemories.mockResolvedValue({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'project not found',
        },
      })

      const req = new Request('http://localhost/api/recall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: 'non-existent',
          userId: 'user-456',
          query: 'test query',
        }),
      })

      const res = await app.fetch(req)
      const data = await res.json()

      expect(res.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('NOT_FOUND')
    })
  })

  it('returns 404 for non-existent routes', async () => {
    const req = new Request('http://localhost/api/non-existent', {
      method: 'GET',
    })

    const res = await app.fetch(req)
    const data = await res.json()

    expect(res.status).toBe(404)
    expect(data.success).toBe(false)
    expect(data.error.code).toBe('NOT_FOUND')
  })

  it('returns 404 for wrong method', async () => {
    const req = new Request('http://localhost/api/ingest', {
      method: 'GET',
    })

    const res = await app.fetch(req)
    const data = await res.json()

    expect(res.status).toBe(404)
    expect(data.success).toBe(false)
    expect(data.error.code).toBe('NOT_FOUND')
  })
})
