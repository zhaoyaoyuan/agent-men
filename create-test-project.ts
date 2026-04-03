import 'dotenv/config'
import { createSqliteClient } from './src/db/client/sqlite'
import { SQLiteProjectRepository } from './src/repositories/sqlite-project-repository'
import { randomUUID } from 'crypto'

const client = createSqliteClient('./data/memory-os.sqlite')
const repo = new SQLiteProjectRepository(client)

const projectId = randomUUID()

await repo.insert({
  id: projectId,
  slug: 'test-project',
  name: 'Test Project',
  owner_user_id: 'test-user',
})

console.log('Created test project:')
console.log(`id: ${projectId}`)
console.log(`slug: test-project`)
console.log(`name: Test Project`)
