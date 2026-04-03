export class InMemoryEventMemoryLinkRepository {
    store = new Map();
    getKey(eventId, memoryId) {
        return `${eventId}:${memoryId}`;
    }
    async insert(record) {
        const now = new Date().toISOString();
        const fullRecord = {
            evidence_role: null,
            weight: null,
            created_at: now,
            ...record,
        };
        const key = this.getKey(fullRecord.event_id, fullRecord.memory_id);
        this.store.set(key, { ...fullRecord });
    }
    async findByEventId(eventId) {
        const records = Array.from(this.store.values())
            .filter(r => r.event_id === eventId)
            .map(r => ({ ...r }));
        return records;
    }
    async findByMemoryId(memoryId) {
        const records = Array.from(this.store.values())
            .filter(r => r.memory_id === memoryId)
            .map(r => ({ ...r }));
        return records;
    }
    async delete(eventId, memoryId) {
        const key = this.getKey(eventId, memoryId);
        this.store.delete(key);
    }
    async deleteByEventId(eventId) {
        const keysToDelete = Array.from(this.store.entries())
            .filter(([_, record]) => record.event_id === eventId)
            .map(([key]) => key);
        keysToDelete.forEach(key => this.store.delete(key));
    }
}
