import { describe, expect, it } from 'vitest'
import { createSqliteClient } from '../../../src/db/client/sqlite'

describe('createSqliteClient', () => {
  it('should return client metadata with configured path', () => {
    const client = createSqliteClient('/tmp/memory-os.sqlite')
    expect(client.path).toBe('/tmp/memory-os.sqlite')
  })
})
