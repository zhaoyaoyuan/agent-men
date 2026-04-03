import { describe, expect, it } from 'vitest'
import { ApiError } from '../../../src/shared/errors'

describe('ApiError', () => {
  it('should create structured error with code and message', () => {
    const error = new ApiError('INVALID_INPUT', 'bad input')

    expect(error.code).toBe('INVALID_INPUT')
    expect(error.message).toBe('bad input')
    expect(error.retryable).toBe(false)
  })
})
