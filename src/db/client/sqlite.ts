import Database from 'better-sqlite3'
import type DatabaseType from 'better-sqlite3'
import { projectsTable } from '../schema/projects'
import { eventsTable } from '../schema/events'
import { memoriesTable } from '../schema/memories'
import { eventMemoryLinksTable } from '../schema/event-memory-links'

export interface SqliteClient {
  db: DatabaseType.Database
  path: string
}

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
  // indexDef is already "idx_name (columns)", so we need to insert IF NOT EXISTS after the name
  return table.indexes.map((indexDef: string) => {
    // Split "idx_event_memory_links_memory_id (memory_id)" into name and columns
    const spaceIndex = indexDef.indexOf(' ')
    if (spaceIndex === -1) {
      return `CREATE INDEX IF NOT EXISTS ${indexDef} ON ${table.name};`
    }
    const name = indexDef.slice(0, spaceIndex)
    const columns = indexDef.slice(spaceIndex)
    return `CREATE INDEX IF NOT EXISTS ${name} ON ${table.name}${columns};`
  })
}

export function createSqliteClient(path: string): SqliteClient {
  const db = new Database(path)

  // Enable foreign keys
  db.exec('PRAGMA foreign_keys = ON;')

  // Create tables if they don't exist
  db.exec(generateCreateTableDDL(projectsTable))
  db.exec(generateCreateTableDDL(eventsTable))
  db.exec(generateCreateTableDDL(memoriesTable))
  db.exec(generateCreateTableDDL(eventMemoryLinksTable))

  // Create indexes
  for (const indexDDL of generateCreateIndexesDDL(eventMemoryLinksTable)) {
    db.exec(indexDDL)
  }

  return { db, path }
}
