// Helper to normalize input to snake_case
export function normalizeEventInput(input) {
    // Check if it's already snake_case by checking for project_id
    if ('project_id' in input) {
        return {
            agent_id: null,
            scope_key: null,
            title: null,
            summary: null,
            content_text: null,
            payload_json: null,
            content_storage_mode: 'full_text',
            importance_score: 0.5,
            ...input,
        };
    }
    // Convert camelCase to snake_case
    return {
        id: input.id,
        project_id: input.projectId,
        user_id: input.userId,
        agent_id: input.agentId ?? null,
        event_type: input.eventType,
        source_type: input.sourceType,
        scope_type: input.scopeType,
        scope_key: input.scopeKey ?? null,
        title: input.title ?? null,
        summary: input.summary ?? null,
        content_text: input.contentText ?? null,
        payload_json: input.payloadJson ?? null,
        content_storage_mode: input.contentStorageMode ?? 'full_text',
        importance_score: input.importanceScore ?? 0.5,
        happened_at: input.happenedAt ?? new Date().toISOString(),
    };
}
export class InMemoryEventRepository {
    store = new Map();
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
        this.store.set(fullRecord.id, { ...fullRecord });
    }
    async findById(id) {
        const record = this.store.get(id);
        return record ? { ...record } : null;
    }
    async findByProjectId(projectId) {
        const records = Array.from(this.store.values())
            .filter(r => r.project_id === projectId)
            .sort((a, b) => b.happened_at.localeCompare(a.happened_at))
            .map(r => ({ ...r }));
        return records;
    }
    async findByUserId(userId) {
        const records = Array.from(this.store.values())
            .filter(r => r.user_id === userId)
            .sort((a, b) => b.happened_at.localeCompare(a.happened_at))
            .map(r => ({ ...r }));
        return records;
    }
    async delete(id) {
        this.store.delete(id);
    }
    async update(id, updates) {
        const existing = this.store.get(id);
        if (!existing) {
            return;
        }
        const updated = {
            ...existing,
            ...updates,
        };
        this.store.set(id, updated);
    }
}
