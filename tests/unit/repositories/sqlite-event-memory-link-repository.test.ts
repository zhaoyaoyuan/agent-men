import { describe, expect, it, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { createSqliteClient } from '../../../src/db/client/sqlite'
import { eventsTable } from '../../../src/db/schema/events'
import { eventMemoryLinksTable } from '../../../src/db/schema/event-memory-links'
import { memoriesTable } from '../../../src/db/schema/memories'
import { SQLiteEventMemoryLinkRepository } from '../../../src/repositories/sqlite-event-memory-link-repository'
import type { EventMemoryLinkRecord } from '../../../src/repositories/event-memory-link-repository'

describe('SQLiteEventMemoryLinkRepository', () => {
  let db: Database.Database
  let repo: SQLiteEventMemoryLinkRepository

  beforeEach(() => {
    // Create in-memory database for testing
    db = new Database(':memory:')
    db.exec('PRAGMA foreign_keys = ON')

    // Create required tables for foreign key constraints
    const memoryColumns = Object.entries(memoriesTable.columns)
      .map(([name, definition]) => `${name} ${definition}`)
      .join(', ')
    db.exec(`CREATE TABLE ${memoriesTable.name} (${memoryColumns})`)

    const eventColumns = Object.entries(eventsTable.columns)
      .map(([name, definition]) => `${name} ${definition}`)
      .join(', ')
    db.exec(`CREATE TABLE ${eventsTable.name} (${eventColumns})`)

    // Create event_memory_links table
    const linkColumns = Object.entries(eventMemoryLinksTable.columns)
      .map(([name, definition]) => `${name} ${definition}`)
      .join(', ')
    const constraints = eventMemoryLinksTable.constraints
      .map(c => `, ${c}`)
      .join('')
    db.exec(`CREATE TABLE ${eventMemoryLinksTable.name} (${linkColumns}${constraints})`)

    // Create indexes
    db.exec('CREATE INDEX idx_event_memory_links_memory_id ON event_memory_links (memory_id)')

    // Insert a sample event and memory for foreign key constraints
    db.exec(`
      INSERT INTO events (id, project_id, user_id, event_type, source_type, scope_type, happened_at, created_at)
      VALUES ('e1', 'p1', 'u1', 'message', 'claude', 'project', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z')
    `)
    db.exec(`
      INSERT INTO memories (id, project_id, user_id, memory_type, scope_type, title, content, created_at, updated_at)
      VALUES ('m1', 'p1', 'u1', 'insight', 'project', 'Test Memory', 'Test content', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z')
    `)
    db.exec(`
      INSERT INTO memories (id, project_id, user_id, memory_type, scope_type, title, content, created_at, updated_at)
      VALUES ('m2', 'p1', 'u1', 'insight', 'project', 'Test Memory 2', 'Test content 2', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z')
    `)

    const client = createSqliteClient(':memory:')
    // Override the db connection for testing
    repo = new SQLiteEventMemoryLinkRepository(client)
    // @ts-expect-error - Inject our in-memory db for testing
    repo.db = db
  })

  it('should insert a link', async () => {
    await repo.insert({
      event_id: 'e1',
      memory_id: 'm1',
      evidence_role: 'supporting',
      weight: 0.8,
    })

    const links = await repo.findByEventId('e1')
    expect(links.length).toBe(1)
    expect(links[0].event_id).toBe('e1')
    expect(links[0].memory_id).toBe('m1')
    expect(links[0].evidence_role).toBe('supporting')
    expect(links[0].weight).toBe(0.8)
    expect(links[0].created_at).toBeDefined()
  })

  it('should find all links by event id', async () => {
    await repo.insert({ event_id: 'e1', memory_id: 'm1', weight: 0.8 })
    await repo.insert({ event_id: 'e1', memory_id: 'm2', weight: 0.5 })

    const links = await repo.findByEventId('e1')
    expect(links.length).toBe(2)
    const memoryIds = links.map(l => l.memory_id).sort()
    expect(memoryIds).toEqual(['m1', 'm2'])
  })

  it('should find all links by memory id', async () => {
    // Insert another event
    db.exec(`
      INSERT INTO events (id, project_id, user_id, event_type, source_type, scope_type, happened_at, created_at)
      VALUES ('e2', 'p1', 'u1', 'message', 'claude', 'project', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z')
    `)

    await repo.insert({ event_id: 'e1', memory_id: 'm1', weight: 0.8 })
    await repo.insert({ event_id: 'e2', memory_id: 'm1', weight: 0.5 })

    const links = await repo.findByMemoryId('m1')
    expect(links.length).toBe(2)
    const eventIds = links.map(l => l.event_id).sort()
    expect(eventIds).toEqual(['e1', 'e2'])
  })

  it('should return empty array when no links found for event', async () => {
    const links = await repo.findByEventId('non-existent')
    expect(links).toEqual([])
  })

  it('should return empty array when no links found for memory', async () => {
    const links = await repo.findByMemoryId('non-existent')
    expect(links).toEqual([])
  })

  it('should delete a link', async () => {
    await repo.insert({ event_id: 'e1', memory_id: 'm1' })
    expect(await repo.findByEventId('e1')).toHaveLength(1)

    await repo.delete('e1', 'm1')
    expect(await repo.findByEventId('e1')).toHaveLength(0)
  })

  it('should delete all links for an event', async () => {
    await repo.insert({ event_id: 'e1', memory_id: 'm1' })
    await repo.insert({ event_id: 'e1', memory_id: 'm2' })
    expect(await repo.findByEventId('e1')).toHaveLength(2)

    await repo.deleteByEventId('e1')
    expect(await repo.findByEventId('e1')).toHaveLength(0)
  })

  it('should handle nullable fields correctly', async () => {
    await repo.insert({
      event_id: 'e1',
      memory_id: 'm1',
    })

    const links = await repo.findByEventId('e1')
    expect(links[0].evidence_role).toBeNull()
    expect(links[0].weight).toBeNull()
  })

  it('should enforce composite primary key constraint', async () => {
    await repo.insert({
      event_id: 'e1',
      memory_id: 'm1',
      weight: 0.5,
    })

    // Inserting the same (event_id, memory_id) pair should throw
    await expect(
      repo.insert({
        event_id: 'e1',
        memory_id: 'm1',
        weight: 0.8,
      })
    ).rejects.toThrow()
  })

  it('should enforce weight constraint between 0 and 1', async () => {
    // This should fail because weight > 1
    await expect(
      repo.insert({
        event_id: 'e1',
        memory_id: 'm1',
        weight: 1.5,
      })
    ).rejects.toThrow()

    // This should fail because weight < 0
    await expect(
      repo.insert({
        event_id: 'e1',
        memory_id: 'm1',
        weight: -0.5,
      })
    ).rejects.toThrow()

    // Insert another event for testing
    db.exec(`
      INSERT INTO events (id, project_id, user_id, event_type, source_type, scope_type, happened_at, created_at)
      VALUES ('e2', 'p1', 'u1', 'message', 'claude', 'project', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z')
    `)

    // 0 should work
    await expect(
      repo.insert({
        event_id: 'e1',
        memory_id: 'm2',
        weight: 0,
      })
    ).resolves.not.toThrow()

    // 1 should work
    await expect(
      repo.insert({
        event_id: 'e2',
        memory_id: 'm1',
        weight: 1,
      })
    ).resolves.not.toThrow()
  })
})
