import type { MemoryRecordLike } from '../repositories/memory-repository'
import type { ApiResponse } from '../shared/result'
import { validateExtractMemoriesInput } from './validators/extract-memories-validator'

interface ExtractMemoriesInput {
  projectId: string
  userId: string
  eventIds: string[]
  strategy?: {
    memoryTypes?: string[]
    mergeSimilar?: boolean
    createEntities?: boolean
    overwriteExisting?: boolean
  }
}

interface ExtractMemoriesResult {
  created: string[]
  updated: string[]
  skipped: Array<{
    eventId: string
    reason: string
  }>
}

export interface ExtractedMemory {
  memoryType: 'fact' | 'constraint' | 'preference' | 'task_state' | 'experience'
  title: string
  content: string
}

export interface LLMClient {
  extractMemoriesFromEvent(eventContent: string): Promise<ExtractedMemory[]>
}

export function createExtractMemoriesService(deps: {
  projectRepository: {
    findById(id: string): Promise<{ id: string } | null>
  }
  eventRepository: {
    findById(id: string): Promise<{
      id: string
      projectId: string
      userId: string
      contentText?: string | null
      content_text?: string | null
    } | null>
  }
  memoryRepository: {
    insert(record: MemoryRecordLike): Promise<void>
  }
  eventMemoryLinkRepository: {
    insert(record: {
      event_id: string
      memory_id: string
      evidence_role?: string
      weight?: number
      created_at: string
    }): Promise<void>
  }
  llmClient: LLMClient
}) {
  return async function extractMemories(
    input: ExtractMemoriesInput,
  ): Promise<ApiResponse<ExtractMemoriesResult>> {
    validateExtractMemoriesInput(input)

    if (input.strategy) {
      const hasUnsupportedOption =
        input.strategy.memoryTypes !== undefined ||
        input.strategy.mergeSimilar !== undefined ||
        input.strategy.createEntities !== undefined ||
        input.strategy.overwriteExisting !== undefined

      if (hasUnsupportedOption) {
        return {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'strategy options are not supported yet',
          },
        }
      }
    }

    let project: { id: string } | null

    try {
      project = await deps.projectRepository.findById(input.projectId)
    } catch {
      return {
        success: false,
        error: {
          code: 'STORAGE_ERROR',
          message: 'failed to load project',
          retryable: true,
        },
      }
    }

    if (!project) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'project not found',
        },
      }
    }

    const created: string[] = []
    const skipped: ExtractMemoriesResult['skipped'] = []

    for (const eventId of input.eventIds) {
      let event: {
        id: string
        projectId: string
        userId: string
        contentText?: string | null
        content_text?: string | null
      } | null

      try {
        event = await deps.eventRepository.findById(eventId)
      } catch {
        return {
          success: false,
          error: {
            code: 'STORAGE_ERROR',
            message: 'failed to load event',
            retryable: true,
          },
        }
      }

      if (!event) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'event not found',
          },
        }
      }

      if (event.projectId !== input.projectId) {
        return {
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'event does not belong to project',
          },
        }
      }

      if (event.userId !== input.userId) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'event not accessible',
          },
        }
      }

      // Get content text from event (support both camelCase and snake_case)
      const contentText = event.contentText ?? event.content_text ?? ''
      if (!contentText.trim()) {
        skipped.push({
          eventId,
          reason: 'empty content, nothing to extract',
        })
        continue
      }

      let extractedMemories: ExtractedMemory[]
      try {
        extractedMemories = await deps.llmClient.extractMemoriesFromEvent(contentText)
      } catch {
        return {
          success: false,
          error: {
            code: 'LLM_ERROR',
            message: 'failed to extract memories from event',
            retryable: true,
          },
        }
      }

      if (extractedMemories.length === 0) {
        skipped.push({
          eventId,
          reason: 'no memories extracted by LLM',
        })
        continue
      }

      // Create a memory record for each extracted memory
      for (let i = 0; i < extractedMemories.length; i++) {
        const extracted = extractedMemories[i]
        const memoryId = `memory-${eventId}-${extracted.memoryType}-${i}`

        const memoryRecord: MemoryRecordLike = {
          id: memoryId,
          projectId: input.projectId,
          userId: input.userId,
          memoryType: extracted.memoryType,
          title: extracted.title,
          content: extracted.content,
          confidence: 1.0,
          importanceScore: 0.5,
          sourceStrategy: 'llm_extraction',
        }

        try {
          await deps.memoryRepository.insert(memoryRecord)
        } catch {
          return {
            success: false,
            error: {
              code: 'STORAGE_ERROR',
              message: 'failed to store memory',
              retryable: true,
            },
          }
        }

        try {
          await deps.eventMemoryLinkRepository.insert({
            event_id: eventId,
            memory_id: memoryId,
            evidence_role: 'source',
            weight: 1.0,
            created_at: new Date().toISOString(),
          })
        } catch {
          return {
            success: false,
            error: {
              code: 'STORAGE_ERROR',
              message: 'failed to store event-memory link',
              retryable: true,
            },
          }
        }

        created.push(memoryId)
      }
    }

    return {
      success: true,
      data: {
        created,
        updated: [],
        skipped,
      },
    }
  }
}
