import { Hono } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { validateIngestEventInput } from '../services/validators/ingest-event-validator'
import { validateExtractMemoriesInput } from '../services/validators/extract-memories-validator'
import { validateRecallMemoriesInput } from '../services/validators/recall-memories-validator'
import { ApiError } from '../shared/errors'
import type { ApiResponse } from '../shared/result'
import type { createIngestEventService } from '../services/ingest-event-service'
import type { createExtractMemoriesService } from '../services/extract-memories-service'
import type { createRecallMemoriesService } from '../services/recall-memories-service'

export type IngestEventService = Awaited<ReturnType<typeof createIngestEventService>>
export type ExtractMemoriesService = Awaited<ReturnType<typeof createExtractMemoriesService>>
export type RecallMemoriesService = Awaited<ReturnType<typeof createRecallMemoriesService>>

interface AppDependencies {
  ingestEventService: IngestEventService
  extractMemoriesService: ExtractMemoriesService
  recallMemoriesService: RecallMemoriesService
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

  return app
}
