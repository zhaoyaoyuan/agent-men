import Database from 'better-sqlite3';
export class SQLiteProjectRepository {
    db;
    constructor(client) {
        this.db = new Database(client.path);
    }
    async insert(record) {
        const now = new Date().toISOString();
        const fullRecord = {
            status: 'active',
            settings_json: null,
            description: null,
            created_at: now,
            updated_at: now,
            ...record,
        };
        this.db.prepare(`
      INSERT INTO projects (id, slug, name, description, owner_user_id, status, settings_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(fullRecord.id, fullRecord.slug, fullRecord.name, fullRecord.description, fullRecord.owner_user_id, fullRecord.status, fullRecord.settings_json, fullRecord.created_at, fullRecord.updated_at);
    }
    async findById(id) {
        const row = this.db.prepare(`
      SELECT id, slug, name, description, owner_user_id, status, settings_json, created_at, updated_at
      FROM projects
      WHERE id = ?
    `).get(id);
        if (!row) {
            return null;
        }
        return { ...row };
    }
    async findBySlug(slug) {
        const row = this.db.prepare(`
      SELECT id, slug, name, description, owner_user_id, status, settings_json, created_at, updated_at
      FROM projects
      WHERE slug = ?
    `).get(slug);
        if (!row) {
            return null;
        }
        return { ...row };
    }
    async findByOwnerId(ownerId) {
        const rows = this.db.prepare(`
      SELECT id, slug, name, description, owner_user_id, status, settings_json, created_at, updated_at
      FROM projects
      WHERE owner_user_id = ?
      ORDER BY created_at DESC
    `).all(ownerId);
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
        values.push(new Date().toISOString());
        values.push(id);
        this.db.prepare(`
      UPDATE projects
      SET ${setClause}, updated_at = ?
      WHERE id = ?
    `).run(...values);
    }
    async delete(id) {
        this.db.prepare(`DELETE FROM projects WHERE id = ?`).run(id);
    }
    /**
     * Close the database connection
     */
    close() {
        this.db.close();
    }
}
