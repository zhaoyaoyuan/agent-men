import Database from 'better-sqlite3'
import type { SqliteClient } from '../db/client/sqlite'
import type { EventMemoryLinkRecord, EventMemoryLinkRecordLike } from './event-memory-link-repository'

export class SQLiteEventMemoryLinkRepository {
  private db: Database.Database

  constructor(client: SqliteClient) {
    this.db = client.db
  }

  async insert(record: EventMemoryLinkRecordLike): Promise<void> {
    const now = new Date().toISOString()
    const fullRecord: EventMemoryLinkRecord = {
      evidence_role: null,
      weight: null,
      created_at: now,
      ...record,
    }

    this.db.prepare(`
      INSERT INTO event_memory_links (event_id, memory_id, evidence_role, weight, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      fullRecord.event_id,
      fullRecord.memory_id,
      fullRecord.evidence_role,
      fullRecord.weight,
      fullRecord.created_at
    )
  }

  async findByEventId(eventId: string): Promise<EventMemoryLinkRecord[]> {
    const rows = this.db.prepare(`
      SELECT event_id, memory_id, evidence_role, weight, created_at
      FROM event_memory_links
      WHERE event_id = ?
    `).all(eventId) as EventMemoryLinkRecord[]

    return rows.map(row => ({ ...row }))
  }

  async findByMemoryId(memoryId: string): Promise<EventMemoryLinkRecord[]> {
    const rows = this.db.prepare(`
      SELECT event_id, memory_id, evidence_role, weight, created_at
      FROM event_memory_links
      WHERE memory_id = ?
    `).all(memoryId) as EventMemoryLinkRecord[]

    return rows.map(row => ({ ...row }))
  }

  async delete(eventId: string, memoryId: string): Promise<void> {
    this.db.prepare(`
      DELETE FROM event_memory_links
      WHERE event_id = ? AND memory_id = ?
    `).run(eventId, memoryId)
  }

  async deleteByEventId(eventId: string): Promise<void> {
    this.db.prepare(`
      DELETE FROM event_memory_links
      WHERE event_id = ?
    `).run(eventId)
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close()
  }
}
