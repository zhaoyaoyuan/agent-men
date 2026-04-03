import { describe, expect, it } from 'vitest'
import { projectsTable } from '../../../../src/db/schema/projects'

describe('projectsTable', () => {
  it('should define expected table name', () => {
    expect(projectsTable.name).toBe('projects')
  })
})
