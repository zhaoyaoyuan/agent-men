import 'dotenv/config'
import { serve } from '@hono/node-server'
import { config } from './config/env'
import { createApp } from './api/app'
import { createSqliteClient } from './db/client/sqlite'
import { SQLiteProjectRepository } from './repositories/sqlite-project-repository'
import { SQLiteEventRepository } from './repositories/sqlite-event-repository'
import { SQLiteMemoryRepository } from './repositories/sqlite-memory-repository'
import { SQLiteEventMemoryLinkRepository } from './repositories/sqlite-event-memory-link-repository'
import { createIngestEventService } from './services/ingest-event-service'
import { createExtractMemoriesService } from './services/extract-memories-service'
import { createRecallMemoriesService } from './services/recall-memories-service'
import { AnthropicLLMClient } from './clients/anthropic-llm-client'

console.log('Starting Memory OS...')

// Initialize database
const sqliteClient = createSqliteClient(config.dbPath)

// Initialize repositories
const projectRepository = new SQLiteProjectRepository(sqliteClient)
const eventRepository = new SQLiteEventRepository(sqliteClient)
const memoryRepository = new SQLiteMemoryRepository(sqliteClient)
const eventMemoryLinkRepository = new SQLiteEventMemoryLinkRepository(sqliteClient)

// Initialize LLM client
const llmClient = new AnthropicLLMClient({
  apiKey: config.anthropicApiKey,
  baseURL: config.anthropicBaseUrl,
  modelName: config.anthropicModel,
})

// Initialize services
const ingestEventService = createIngestEventService({
  projectRepository,
  eventRepository,
})

const extractMemoriesService = createExtractMemoriesService({
  projectRepository,
  eventRepository,
  memoryRepository,
  eventMemoryLinkRepository,
  llmClient,
})

const recallMemoriesService = createRecallMemoriesService({
  projectRepository,
  memoryRepository,
  eventMemoryLinkRepository,
})

// Create Hono app
const app = createApp({
  ingestEventService,
  extractMemoriesService,
  recallMemoriesService,
  projectRepository,
  memoryRepository,
})

const port = config.port
console.log(`Server starting on port ${port}...`)
console.log(`Endpoints:
  POST /api/ingest - Ingest event
  POST /api/extract - Extract memories
  POST /api/recall - Recall memories
`)

serve({
  fetch: app.fetch,
  port,
})
