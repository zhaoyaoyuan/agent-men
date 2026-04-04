import { Hono } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import fs from 'node:fs'
import path from 'node:path'
import { validateIngestEventInput } from '../services/validators/ingest-event-validator'
import { validateExtractMemoriesInput } from '../services/validators/extract-memories-validator'
import { validateRecallMemoriesInput } from '../services/validators/recall-memories-validator'
import { ApiError } from '../shared/errors'
import type { ApiResponse } from '../shared/result'
import type { createIngestEventService } from '../services/ingest-event-service'
import type { createExtractMemoriesService } from '../services/extract-memories-service'
import type { createRecallMemoriesService } from '../services/recall-memories-service'
import type { ProjectRepository } from '../repositories/project-repository'
import type { MemoryRepository } from '../repositories/memory-repository'

export type IngestEventService = Awaited<ReturnType<typeof createIngestEventService>>
export type ExtractMemoriesService = Awaited<ReturnType<typeof createExtractMemoriesService>>
export type RecallMemoriesService = Awaited<ReturnType<typeof createRecallMemoriesService>>

interface AppDependencies {
  ingestEventService: IngestEventService
  extractMemoriesService: ExtractMemoriesService
  recallMemoriesService: RecallMemoriesService
  projectRepository: ProjectRepository
  memoryRepository: MemoryRepository
}

const statusCodeMap: Record<string, ContentfulStatusCode> = {
  INVALID_INPUT: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNSUPPORTED_OPERATION: 400,
  STORAGE_ERROR: 500,
  RECALL_ERROR: 500,
  LLM_ERROR: 500,
  INTERNAL_ERROR: 500,
}

function getStatusCode(code: string): ContentfulStatusCode {
  return (statusCodeMap[code] as ContentfulStatusCode) ?? 500
}

export function createApp(deps: AppDependencies) {
  const app = new Hono()

  app.notFound((c) => {
    return c.json(
      {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Route not found',
        },
      } satisfies ApiResponse<never>,
      404,
    )
  })

  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json(
        {
          success: false,
          error: {
            code: err.code,
            message: err.message,
            details: err.details,
            retryable: err.retryable,
          },
        } satisfies ApiResponse<never>,
        getStatusCode(err.code),
      )
    }

    console.error('Unexpected error:', err)
    return c.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
        },
      } satisfies ApiResponse<never>,
      500,
    )
  })

  app.post('/api/ingest', async (c) => {
    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      return c.json(
        {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Invalid JSON body',
          },
        } satisfies ApiResponse<never>,
        400,
      )
    }

    try {
      validateIngestEventInput(body as {
        projectId: string
        userId: string
        event: {
          eventType: string
          sourceType: string
          scope: { type: string }
          importanceScore?: number
        }
      })

      const result = await deps.ingestEventService(body as Parameters<IngestEventService>[0])

      if (result.success) {
        return c.json(result, 200)
      }

      return c.json(result, getStatusCode(result.error.code))
    } catch (err) {
      if (err instanceof ApiError) {
        return c.json(
          {
            success: false,
            error: {
              code: err.code,
              message: err.message,
              details: err.details,
              retryable: err.retryable,
            },
          } satisfies ApiResponse<never>,
          getStatusCode(err.code),
        )
      }
      throw err
    }
  })

  app.post('/api/extract', async (c) => {
    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      return c.json(
        {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Invalid JSON body',
          },
        } satisfies ApiResponse<never>,
        400,
      )
    }

    try {
      validateExtractMemoriesInput(body as {
        projectId: string
        userId: string
        eventIds: string[]
      })

      const result = await deps.extractMemoriesService(body as Parameters<ExtractMemoriesService>[0])

      if (result.success) {
        return c.json(result, 200)
      }

      return c.json(result, getStatusCode(result.error.code))
    } catch (err) {
      if (err instanceof ApiError) {
        return c.json(
          {
            success: false,
            error: {
              code: err.code,
              message: err.message,
              details: err.details,
              retryable: err.retryable,
            },
          } satisfies ApiResponse<never>,
          getStatusCode(err.code),
        )
      }
      throw err
    }
  })

  app.post('/api/recall', async (c) => {
    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      return c.json(
        {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Invalid JSON body',
          },
        } satisfies ApiResponse<never>,
        400,
      )
    }

    try {
      validateRecallMemoriesInput(body as {
        projectId: string
        userId: string
        query: string
        options?: { limit?: number }
      })

      const result = await deps.recallMemoriesService(body as Parameters<RecallMemoriesService>[0])

      if (result.success) {
        return c.json(result, 200)
      }

      return c.json(result, getStatusCode(result.error.code))
    } catch (err) {
      if (err instanceof ApiError) {
        return c.json(
          {
            success: false,
            error: {
              code: err.code,
              message: err.message,
              details: err.details,
              retryable: err.retryable,
            },
          } satisfies ApiResponse<never>,
          getStatusCode(err.code),
        )
      }
      throw err
    }
  })

  // List all projects
  app.get('/api/projects', async (c) => {
    try {
      // For now, get all projects (assuming default user for browsing)
      // In a multi-user system, this would need authentication
      const projects = await deps.projectRepository.findAll()
      return c.json({
        success: true,
        data: projects
      })
    } catch (err) {
      if (err instanceof ApiError) {
        return c.json(
          {
            success: false,
            error: {
              code: err.code,
              message: err.message,
              details: err.details,
              retryable: err.retryable,
            },
          } satisfies ApiResponse<never>,
          getStatusCode(err.code),
        )
      }
      throw err
    }
  })

  // Create a new project
  app.post('/api/projects', async (c) => {
    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      return c.json(
        {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Invalid JSON body',
          },
        } satisfies ApiResponse<never>,
        400,
      )
    }

    try {
      const { id, name, slug, description } = body as {
        id: string
        name: string
        slug?: string
        description?: string
      }

      if (!id || typeof id !== 'string' || id.trim() === '') {
        throw new ApiError('INVALID_INPUT', 'id is required')
      }
      if (!name || typeof name !== 'string' || name.trim() === '') {
        throw new ApiError('INVALID_INPUT', 'name is required')
      }

      // Check if project already exists
      const existing = await deps.projectRepository.findById(id)
      if (existing) {
        throw new ApiError('CONFLICT', 'project already exists with this id')
      }

      await deps.projectRepository.insert({
        id,
        name,
        slug: slug || id,
        description: description || null,
        owner_user_id: 'me',
      })

      return c.json({
        success: true,
        data: {
          id,
          name,
          slug: slug || id,
        },
      }, 201)
    } catch (err) {
      if (err instanceof ApiError) {
        return c.json(
          {
            success: false,
            error: {
              code: err.code,
              message: err.message,
              details: err.details,
              retryable: err.retryable,
            },
          } satisfies ApiResponse<never>,
          getStatusCode(err.code),
        )
      }
      throw err
    }
  })

  // List all memories for a project
  app.get('/api/projects/:projectId/memories', async (c) => {
    const { projectId } = c.req.param()

    try {
      const memories = await deps.memoryRepository.findByProjectId(projectId)
      // Convert to camelCase for frontend consumption
      const camelCased = memories.map(memory => ({
        id: memory.id,
        projectId: memory.projectId || memory.project_id,
        userId: memory.userId || memory.user_id,
        memoryType: memory.memoryType || memory.memory_type,
        title: memory.title,
        content: memory.content,
        summary: memory.summary,
        status: memory.status,
        confidence: memory.confidence,
        strength: memory.strength,
        importanceScore: memory.importanceScore || memory.importance_score,
        accessCount: memory.accessCount || memory.access_count,
        createdAt: memory.createdAt || memory.created_at,
        updatedAt: memory.updatedAt || memory.updated_at,
      }))
      return c.json({
        success: true,
        data: camelCased
      })
    } catch (err) {
      if (err instanceof ApiError) {
        return c.json(
          {
            success: false,
            error: {
              code: err.code,
              message: err.message,
              details: err.details,
              retryable: err.retryable,
            },
          } satisfies ApiResponse<never>,
          getStatusCode(err.code),
        )
      }
      throw err
    }
  })

  // Serve static UI files
  app.get('/*', async (c) => {
    try {
      let filePath = c.req.path
      if (filePath === '/') {
        filePath = '/index.html'
      }
      // Security: resolve against public root and validate it stays within public directory
      const publicRoot = path.resolve(process.cwd(), 'public')
      const requestedPath = path.resolve(path.join(publicRoot, filePath))
      // Ensure the requested path stays within the public directory (prevents path traversal)
      if (!requestedPath.startsWith(publicRoot)) {
        return c.notFound()
      }

      if (fs.existsSync(requestedPath)) {
        const content = fs.readFileSync(requestedPath)
        const ext = path.extname(requestedPath)
        let contentType = 'text/plain'
        if (ext === '.html') contentType = 'text/html'
        if (ext === '.css') contentType = 'text/css'
        if (ext === '.js') contentType = 'application/javascript'

        return new Response(content, {
          headers: { 'Content-Type': contentType }
        })
      }
    } catch (err) {
      console.error('Error serving static file:', err)
    }

    // Fall through to not found
    return c.notFound()
  })

  return app
}
