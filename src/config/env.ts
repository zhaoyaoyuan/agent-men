export interface AppConfig {
  dbPath: string
  port: number
  anthropicApiKey: string
  anthropicBaseUrl?: string
  anthropicModel: string
}

const DEFAULT_DATABASE_PATH = './data/memory-os.sqlite'
const DEFAULT_PORT = 3000
const DEFAULT_ANTHROPIC_MODEL = 'claude-3-sonnet-20240229'

export function readEnv(): AppConfig {
  const configuredDatabasePath = process.env.MEMORY_OS_DB_PATH?.trim()
  const configuredPort = process.env.PORT ? parseInt(process.env.PORT, 10) : DEFAULT_PORT
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY || ''
  const anthropicBaseUrl = process.env.ANTHROPIC_BASE_URL?.trim()
  const anthropicModel = process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL

  return {
    dbPath: configuredDatabasePath || DEFAULT_DATABASE_PATH,
    port: configuredPort,
    anthropicApiKey,
    anthropicBaseUrl,
    anthropicModel,
  }
}

export const config = readEnv()
