import { describe, expect, it } from 'vitest'
import { isValidEventType } from '../../../../src/domain/event/contracts'

describe('event contracts', () => {
  it('should validate supported event type', () => {
    expect(isValidEventType('message')).toBe(true)
    expect(isValidEventType('unknown')).toBe(false)
  })
})
