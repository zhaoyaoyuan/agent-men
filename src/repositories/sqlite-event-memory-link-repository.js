import Database from 'better-sqlite3';
export class SQLiteEventMemoryLinkRepository {
    db;
    constructor(client) {
        this.db = new Database(client.path);
    }
    async insert(record) {
        const now = new Date().toISOString();
        const fullRecord = {
            evidence_role: null,
            weight: null,
            created_at: now,
            ...record,
        };
        this.db.prepare(`
      INSERT INTO event_memory_links (event_id, memory_id, evidence_role, weight, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(fullRecord.event_id, fullRecord.memory_id, fullRecord.evidence_role, fullRecord.weight, fullRecord.created_at);
    }
    async findByEventId(eventId) {
        const rows = this.db.prepare(`
      SELECT event_id, memory_id, evidence_role, weight, created_at
      FROM event_memory_links
      WHERE event_id = ?
    `).all(eventId);
        return rows.map(row => ({ ...row }));
    }
    async findByMemoryId(memoryId) {
        const rows = this.db.prepare(`
      SELECT event_id, memory_id, evidence_role, weight, created_at
      FROM event_memory_links
      WHERE memory_id = ?
    `).all(memoryId);
        return rows.map(row => ({ ...row }));
    }
    async delete(eventId, memoryId) {
        this.db.prepare(`
      DELETE FROM event_memory_links
      WHERE event_id = ? AND memory_id = ?
    `).run(eventId, memoryId);
    }
    async deleteByEventId(eventId) {
        this.db.prepare(`
      DELETE FROM event_memory_links
      WHERE event_id = ?
    `).run(eventId);
    }
    /**
     * Close the database connection
     */
    close() {
        this.db.close();
    }
}
