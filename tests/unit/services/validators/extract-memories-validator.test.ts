import { describe, expect, it } from 'vitest'
import { validateExtractMemoriesInput } from '../../../../src/services/validators/extract-memories-validator'

describe('validateExtractMemoriesInput', () => {
  it('should accept valid input', () => {
    expect(() =>
      validateExtractMemoriesInput({
        projectId: 'p1',
        userId: 'u1',
        eventIds: ['e1', 'e2'],
      }),
    ).not.toThrow()
  })

  it('should reject blank projectId', () => {
    expect(() =>
      validateExtractMemoriesInput({
        projectId: '   ',
        userId: 'u1',
        eventIds: ['e1'],
      }),
    ).toThrow('projectId is required')
  })

  it('should reject blank userId', () => {
    expect(() =>
      validateExtractMemoriesInput({
        projectId: 'p1',
        userId: '   ',
        eventIds: ['e1'],
      }),
    ).toThrow('userId is required')
  })

  it('should reject empty eventIds', () => {
    expect(() =>
      validateExtractMemoriesInput({
        projectId: 'p1',
        userId: 'u1',
        eventIds: [],
      }),
    ).toThrow('eventIds is required')
  })

  it('should reject empty string eventId in array', () => {
    expect(() =>
      validateExtractMemoriesInput({
        projectId: 'p1',
        userId: 'u1',
        eventIds: ['e1', '', 'e3'],
      }),
    ).toThrow('eventIds must contain non-empty strings')
  })

  it('should reject whitespace-only eventId in array', () => {
    expect(() =>
      validateExtractMemoriesInput({
        projectId: 'p1',
        userId: 'u1',
        eventIds: ['e1', '   ', 'e3'],
      }),
    ).toThrow('eventIds must contain non-empty strings')
  })

  it('should reject duplicate eventIds', () => {
    expect(() =>
      validateExtractMemoriesInput({
        projectId: 'p1',
        userId: 'u1',
        eventIds: ['e1', 'e2', 'e1'],
      }),
    ).toThrow('eventIds must be unique')
  })
})
