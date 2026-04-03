import { ApiError } from '../../shared/errors'

export function validateExtractMemoriesInput(input: {
  projectId: string
  userId: string
  eventIds: string[]
}) {
  if (typeof input.projectId !== 'string' || input.projectId.trim() === '') {
    throw new ApiError('INVALID_INPUT', 'projectId is required')
  }

  if (typeof input.userId !== 'string' || input.userId.trim() === '') {
    throw new ApiError('INVALID_INPUT', 'userId is required')
  }

  if (!Array.isArray(input.eventIds) || input.eventIds.length === 0) {
    throw new ApiError('INVALID_INPUT', 'eventIds is required')
  }

  if (input.eventIds.some((id) => typeof id !== 'string' || id.trim() === '')) {
    throw new ApiError('INVALID_INPUT', 'eventIds must contain non-empty strings')
  }

  if (new Set(input.eventIds).size !== input.eventIds.length) {
    throw new ApiError('INVALID_INPUT', 'eventIds must be unique')
  }
}
