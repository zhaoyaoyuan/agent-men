import { projectsTable } from './src/db/schema/projects'
import { eventsTable } from './src/db/schema/events'
import { memoriesTable } from './src/db/schema/memories'
import { eventMemoryLinksTable } from './src/db/schema/event-memory-links'

function generateCreateTableDDL(table: any): string {
  const columns = Object.entries(table.columns)
    .map(([name, definition]) => `${name} ${definition}`)
    .join(', ')

  let extra = ''
  if (table.constraints && table.constraints.length > 0) {
    extra = ', ' + table.constraints.join(', ')
  }

  return `CREATE TABLE IF NOT EXISTS ${table.name} (${columns}${extra});`
}

function generateCreateIndexesDDL(table: any): string[] {
  if (!table.indexes || table.indexes.length === 0) {
    return []
  }
  return table.indexes.map(indexDef => `CREATE INDEX IF NOT EXISTS ${indexDef};`)
}

console.log('projectsTable DDL:')
console.log(generateCreateTableDDL(projectsTable))
console.log()
console.log('eventsTable DDL:')
console.log(generateCreateTableDDL(eventsTable))
console.log()
console.log('memoriesTable DDL:')
console.log(generateCreateTableDDL(memoriesTable))
console.log()
console.log('eventMemoryLinksTable DDL:')
console.log(generateCreateTableDDL(eventMemoryLinksTable))
console.log()
console.log('eventMemoryLinksTable indexes:')
console.log(generateCreateIndexesDDL(eventMemoryLinksTable))
