export class InMemoryMemoryRepository {
    store = new Map();
    async insert(record) {
        if (this.store.has(record.id)) {
            throw new Error('memory already exists');
        }
        this.store.set(record.id, { ...record });
    }
    async findById(id) {
        const record = this.store.get(id);
        return record ? { ...record } : null;
    }
    async findByProjectId(projectId) {
        return Array.from(this.store.values())
            .filter((record) => record.projectId === projectId)
            .map((record) => ({ ...record }));
    }
    async findByProjectIdAndType(projectId, memoryType) {
        return Array.from(this.store.values())
            .filter((record) => record.projectId === projectId && record.memoryType === memoryType)
            .map((record) => ({ ...record }));
    }
    async update(id, updates) {
        const existing = this.store.get(id);
        if (!existing) {
            return;
        }
        this.store.set(id, {
            ...existing,
            ...updates,
        });
    }
    async delete(id) {
        this.store.delete(id);
    }
    close() {
        // No-op for in-memory implementation
    }
}
