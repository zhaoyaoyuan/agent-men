import { afterEach, describe, expect, it } from 'vitest'
import { readEnv } from '../../../src/config/env'

const ORIGINAL_MEMORY_OS_DB_PATH = process.env.MEMORY_OS_DB_PATH

afterEach(() => {
  if (ORIGINAL_MEMORY_OS_DB_PATH === undefined) {
    delete process.env.MEMORY_OS_DB_PATH
    return
  }

  process.env.MEMORY_OS_DB_PATH = ORIGINAL_MEMORY_OS_DB_PATH
})

describe('readEnv', () => {
  it('should return default database path when env is missing', () => {
    delete process.env.MEMORY_OS_DB_PATH
    delete process.env.PORT
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.ANTHROPIC_MODEL

    expect(readEnv()).toEqual(expect.objectContaining({
      dbPath: './data/memory-os.sqlite',
    }))
  })

  it('should return database path from env when env is present', () => {
    process.env.MEMORY_OS_DB_PATH = '/tmp/memory-os.sqlite'

    expect(readEnv()).toEqual(expect.objectContaining({
      dbPath: '/tmp/memory-os.sqlite',
    }))
  })

  it('should fallback to default database path when env is empty', () => {
    process.env.MEMORY_OS_DB_PATH = ''

    expect(readEnv()).toEqual(expect.objectContaining({
      dbPath: './data/memory-os.sqlite',
    }))
  })

  it('should fallback to default database path when env is blank', () => {
    process.env.MEMORY_OS_DB_PATH = '   '

    expect(readEnv()).toEqual(expect.objectContaining({
      dbPath: './data/memory-os.sqlite',
    }))
  })
})
