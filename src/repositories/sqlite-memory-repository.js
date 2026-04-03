import Database from 'better-sqlite3';
export class SQLiteMemoryRepository {
    db;
    constructor(client) {
        this.db = new Database(client.path);
    }
    async insert(record) {
        const now = new Date().toISOString();
        // Convert camelCase to snake_case for database
        const fullRecord = {
            user_id: record.userId ?? 'default',
            memory_type: record.memoryType,
            scope_type: record.scopeType ?? 'global',
            scope_key: record.scopeKey ?? null,
            title: record.title ?? '',
            content: record.content ?? '',
            summary: record.summary ?? null,
            status: record.status ?? 'active',
            confidence: record.confidence ?? 0.5,
            strength: record.strength ?? 0.5,
            decay_score: record.decayScore ?? 0,
            importance_score: record.importanceScore ?? 0.5,
            access_count: record.accessCount ?? 0,
            success_count: record.successCount ?? 0,
            failure_count: record.failureCount ?? 0,
            last_accessed_at: record.lastAccessedAt ?? null,
            last_verified_at: record.lastVerifiedAt ?? null,
            last_reinforced_at: record.lastReinforcedAt ?? null,
            expires_at: record.expiresAt ?? null,
            source_strategy: record.sourceStrategy ?? 'auto_extract',
            explanation_json: record.explanationJson ?? null,
            metadata_json: record.metadataJson ?? null,
            project_id: record.projectId,
            id: record.id,
            created_at: now,
            updated_at: now,
            // CamelCase aliases for service consumption
            projectId: record.projectId,
            userId: record.userId ?? 'default',
            memoryType: record.memoryType,
            scopeType: record.scopeType ?? 'global',
            scopeKey: record.scopeKey ?? null,
            decayScore: record.decayScore ?? 0,
            importanceScore: record.importanceScore ?? 0.5,
            accessCount: record.accessCount ?? 0,
            successCount: record.successCount ?? 0,
            failureCount: record.failureCount ?? 0,
            lastAccessedAt: record.lastAccessedAt ?? null,
            lastVerifiedAt: record.lastVerifiedAt ?? null,
            lastReinforcedAt: record.lastReinforcedAt ?? null,
            expiresAt: record.expiresAt ?? null,
            sourceStrategy: record.sourceStrategy ?? 'auto_extract',
            explanationJson: record.explanationJson ?? null,
            metadataJson: record.metadataJson ?? null,
            createdAt: now,
            updatedAt: now,
        };
        this.db.prepare(`
      INSERT INTO memories (
        id, project_id, user_id, memory_type, scope_type, scope_key, title, content, summary,
        status, confidence, strength, decay_score, importance_score, access_count,
        success_count, failure_count, last_accessed_at, last_verified_at, last_reinforced_at,
        expires_at, source_strategy, explanation_json, metadata_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(fullRecord.id, fullRecord.project_id, fullRecord.user_id, fullRecord.memory_type, fullRecord.scope_type, fullRecord.scope_key, fullRecord.title, fullRecord.content, fullRecord.summary, fullRecord.status, fullRecord.confidence, fullRecord.strength, fullRecord.decay_score, fullRecord.importance_score, fullRecord.access_count, fullRecord.success_count, fullRecord.failure_count, fullRecord.last_accessed_at, fullRecord.last_verified_at, fullRecord.last_reinforced_at, fullRecord.expires_at, fullRecord.source_strategy, fullRecord.explanation_json, fullRecord.metadata_json, fullRecord.created_at, fullRecord.updated_at);
    }
    async findById(id) {
        const row = this.db.prepare(`
      SELECT id, project_id, user_id, memory_type, scope_type, scope_key, title, content, summary,
             status, confidence, strength, decay_score, importance_score, access_count,
             success_count, failure_count, last_accessed_at, last_verified_at, last_reinforced_at,
             expires_at, source_strategy, explanation_json, metadata_json, created_at, updated_at
      FROM memories
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
            memoryType: row.memory_type,
            scopeType: row.scope_type,
            scopeKey: row.scope_key,
            confidence: row.confidence,
            strength: row.strength,
            decayScore: row.decay_score,
            importanceScore: row.importance_score,
            accessCount: row.access_count,
            successCount: row.success_count,
            failureCount: row.failure_count,
            lastAccessedAt: row.last_accessed_at,
            lastVerifiedAt: row.last_verified_at,
            lastReinforcedAt: row.last_reinforced_at,
            expiresAt: row.expires_at,
            sourceStrategy: row.source_strategy,
            explanationJson: row.explanation_json,
            metadataJson: row.metadata_json,
        };
    }
    async findByProjectId(projectId) {
        const rows = this.db.prepare(`
      SELECT id, project_id, user_id, memory_type, scope_type, scope_key, title, content, summary,
             status, confidence, strength, decay_score, importance_score, access_count,
             success_count, failure_count, last_accessed_at, last_verified_at, last_reinforced_at,
             expires_at, source_strategy, explanation_json, metadata_json, created_at, updated_at
      FROM memories
      WHERE project_id = ?
      ORDER BY created_at DESC
    `).all(projectId);
        return rows.map(row => ({
            ...row,
            projectId: row.project_id,
            userId: row.user_id,
            memoryType: row.memory_type,
            scopeType: row.scope_type,
            scopeKey: row.scope_key,
            confidence: row.confidence,
            strength: row.strength,
            decayScore: row.decay_score,
            importanceScore: row.importance_score,
            accessCount: row.access_count,
            successCount: row.success_count,
            failureCount: row.failure_count,
            lastAccessedAt: row.last_accessed_at,
            lastVerifiedAt: row.last_verified_at,
            lastReinforcedAt: row.last_reinforced_at,
            expiresAt: row.expires_at,
            sourceStrategy: row.source_strategy,
            explanationJson: row.explanation_json,
            metadataJson: row.metadata_json,
        }));
    }
    async findByProjectIdAndType(projectId, memoryType) {
        const rows = this.db.prepare(`
      SELECT id, project_id, user_id, memory_type, scope_type, scope_key, title, content, summary,
             status, confidence, strength, decay_score, importance_score, access_count,
             success_count, failure_count, last_accessed_at, last_verified_at, last_reinforced_at,
             expires_at, source_strategy, explanation_json, metadata_json, created_at, updated_at
      FROM memories
      WHERE project_id = ? AND memory_type = ?
      ORDER BY created_at DESC
    `).all(projectId, memoryType);
        return rows.map(row => ({
            ...row,
            projectId: row.project_id,
            userId: row.user_id,
            memoryType: row.memory_type,
            scopeType: row.scope_type,
            scopeKey: row.scope_key,
            confidence: row.confidence,
            strength: row.strength,
            decayScore: row.decay_score,
            importanceScore: row.importance_score,
            accessCount: row.access_count,
            successCount: row.success_count,
            failureCount: row.failure_count,
            lastAccessedAt: row.last_accessed_at,
            lastVerifiedAt: row.last_verified_at,
            lastReinforcedAt: row.last_reinforced_at,
            expiresAt: row.expires_at,
            sourceStrategy: row.source_strategy,
            explanationJson: row.explanation_json,
            metadataJson: row.metadata_json,
        }));
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
        values.push(new Date().toISOString());
        values.push(id);
        this.db.prepare(`
      UPDATE memories
      SET ${setClause}, updated_at = ?
      WHERE id = ?
    `).run(...values);
    }
    async delete(id) {
        this.db.prepare(`DELETE FROM memories WHERE id = ?`).run(id);
    }
    /**
     * Close the database connection
     */
    close() {
        this.db.close();
    }
}
