import 'dotenv/config'
import { createSqliteClient } from './src/db/client/sqlite'
import { SQLiteProjectRepository } from './src/repositories/sqlite-project-repository'
import { randomUUID } from 'crypto'

const client = createSqliteClient('./data/memory-os.sqlite')
const repo = new SQLiteProjectRepository(client)

const projectId = 'agent-mem'

await repo.insert({
  id: projectId,
  slug: 'agent-mem',
  name: 'agent-mem',
  owner_user_id: 'me',
})

console.log('Created project:')
console.log(`id: ${projectId}`)
console.log(`slug: agent-mem`)
console.log(`name: agent-mem`)
