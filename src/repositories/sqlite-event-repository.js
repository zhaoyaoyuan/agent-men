import Database from 'better-sqlite3';
import { normalizeEventInput } from './event-repository';
export class SQLiteEventRepository {
    db;
    constructor(client) {
        this.db = new Database(client.path);
    }
    async insert(record) {
        const now = new Date().toISOString();
        const normalized = normalizeEventInput(record);
        const fullRecord = {
            agent_id: null,
            scope_key: null,
            title: null,
            summary: null,
            content_text: null,
            payload_json: null,
            content_storage_mode: 'full_text',
            importance_score: 0.5,
            ...normalized,
            happened_at: normalized.happened_at || new Date().toISOString(),
            created_at: now,
            // CamelCase aliases
            projectId: normalized.project_id,
            userId: normalized.user_id,
            eventType: normalized.event_type,
            sourceType: normalized.source_type,
            scopeType: normalized.scope_type,
            scopeKey: normalized.scope_key ?? null,
            contentText: normalized.content_text ?? null,
            contentStorageMode: normalized.content_storage_mode ?? 'full_text',
            importanceScore: normalized.importance_score ?? 0.5,
        };
        this.db.prepare(`
      INSERT INTO events (
        id, project_id, user_id, agent_id, event_type, source_type,
        scope_type, scope_key, title, summary, content_text, payload_json,
        content_storage_mode, importance_score, happened_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(fullRecord.id, fullRecord.project_id, fullRecord.user_id, fullRecord.agent_id, fullRecord.event_type, fullRecord.source_type, fullRecord.scope_type, fullRecord.scope_key, fullRecord.title, fullRecord.summary, fullRecord.content_text, fullRecord.payload_json, fullRecord.content_storage_mode, fullRecord.importance_score, fullRecord.happened_at, fullRecord.created_at);
    }
    async findById(id) {
        const row = this.db.prepare(`
      SELECT id, project_id, user_id, agent_id, event_type, source_type,
             scope_type, scope_key, title, summary, content_text, payload_json,
             content_storage_mode, importance_score, happened_at, created_at
      FROM events
      WHERE id = ?
    `).get(id);
        if (!row) {
            return null;
        }
        // Return both snake_case (for storage) and camelCase (for service consumption)
        return {
            ...row,
            projectId: row.project_id,
            userId: row.user_id,
            eventType: row.event_type,
            sourceType: row.source_type,
            scopeType: row.scope_type,
            scopeKey: row.scope_key,
            contentText: row.content_text,
            contentStorageMode: row.content_storage_mode,
            importanceScore: row.importance_score,
        };
    }
    async findByProjectId(projectId) {
        const rows = this.db.prepare(`
      SELECT id, project_id, user_id, agent_id, event_type, source_type,
             scope_type, scope_key, title, summary, content_text, payload_json,
             content_storage_mode, importance_score, happened_at, created_at
      FROM events
      WHERE project_id = ?
      ORDER BY happened_at DESC
    `).all(projectId);
        return rows.map(row => ({ ...row }));
    }
    async findByUserId(userId) {
        const rows = this.db.prepare(`
      SELECT id, project_id, user_id, agent_id, event_type, source_type,
             scope_type, scope_key, title, summary, content_text, payload_json,
             content_storage_mode, importance_score, happened_at, created_at
      FROM events
      WHERE user_id = ?
      ORDER BY happened_at DESC
    `).all(userId);
        return rows.map(row => ({ ...row }));
    }
    async update(id, updates) {
        const updateEntries = Object.entries(updates)
            .filter(([key]) => !['id', 'created_at'].includes(key));
        if (updateEntries.length === 0) {
            return;
        }
        const setClause = updateEntries
            .map(([key]) => `${key} = ?`)
            .join(', ');
        const values = updateEntries.map(([, value]) => value);
        values.push(id);
        this.db.prepare(`
      UPDATE events
      SET ${setClause}
      WHERE id = ?
    `).run(...values);
    }
    async delete(id) {
        this.db.prepare(`DELETE FROM events WHERE id = ?`).run(id);
    }
    /**
     * Close the database connection
     */
    close() {
        this.db.close();
    }
}
