export class InMemoryProjectRepository {
    store = new Map();
    async insert(record) {
        const now = record.created_at || new Date().toISOString();
        const fullRecord = {
            status: 'active',
            settings_json: null,
            description: null,
            created_at: now,
            updated_at: now,
            ...record,
        };
        this.store.set(record.id, { ...fullRecord });
    }
    async findById(id) {
        const record = this.store.get(id);
        return record ? { ...record } : null;
    }
    async findBySlug(slug) {
        const record = Array.from(this.store.values()).find(r => r.slug === slug);
        return record ? { ...record } : null;
    }
    async findByOwnerId(ownerId) {
        return Array.from(this.store.values())
            .filter(record => record.owner_user_id === ownerId)
            .map(record => ({ ...record }));
    }
    async update(id, updates) {
        const existing = this.store.get(id);
        if (existing) {
            this.store.set(id, {
                ...existing,
                ...updates,
                updated_at: new Date().toISOString(),
            });
        }
    }
    async delete(id) {
        this.store.delete(id);
    }
}
