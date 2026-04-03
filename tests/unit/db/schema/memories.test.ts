import { describe, expect, it } from 'vitest'
import { memoriesTable } from '../../../../src/db/schema/memories'

describe('memoriesTable', () => {
  it('should define expected table name and required columns', () => {
    expect(memoriesTable.name).toBe('memories')
    expect(memoriesTable.columns.project_id).toBeDefined()
    expect(memoriesTable.columns.memory_type).toBeDefined()
    expect(memoriesTable.columns.content).toBeDefined()
  })
})
