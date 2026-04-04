import Database from 'better-sqlite3'
import type { SqliteClient } from '../db/client/sqlite'
import type { ProjectRecord, ProjectRecordLike, ProjectRepository } from './project-repository'

export class SQLiteProjectRepository implements ProjectRepository {
  private db: Database.Database

  constructor(client: SqliteClient) {
    this.db = client.db
  }

  async insert(record: ProjectRecordLike): Promise<void> {
    const now = new Date().toISOString()
    const fullRecord: ProjectRecord = {
      status: 'active',
      settings_json: null,
      description: null,
      created_at: now,
      updated_at: now,
      ...record,
    }

    this.db.prepare(`
      INSERT INTO projects (id, slug, name, description, owner_user_id, status, settings_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      fullRecord.id,
      fullRecord.slug,
      fullRecord.name,
      fullRecord.description,
      fullRecord.owner_user_id,
      fullRecord.status,
      fullRecord.settings_json,
      fullRecord.created_at,
      fullRecord.updated_at
    )
  }

  async findById(id: string): Promise<ProjectRecord | null> {
    const row = this.db.prepare(`
      SELECT id, slug, name, description, owner_user_id, status, settings_json, created_at, updated_at
      FROM projects
      WHERE id = ?
    `).get(id) as ProjectRecord | undefined

    if (!row) {
      return null
    }

    return { ...row }
  }

  async findBySlug(slug: string): Promise<ProjectRecord | null> {
    const row = this.db.prepare(`
      SELECT id, slug, name, description, owner_user_id, status, settings_json, created_at, updated_at
      FROM projects
      WHERE slug = ?
    `).get(slug) as ProjectRecord | undefined

    if (!row) {
      return null
    }

    return { ...row }
  }

  async findByOwnerId(ownerId: string): Promise<ProjectRecord[]> {
    const rows = this.db.prepare(`
      SELECT id, slug, name, description, owner_user_id, status, settings_json, created_at, updated_at
      FROM projects
      WHERE owner_user_id = ?
      ORDER BY created_at DESC
    `).all(ownerId) as ProjectRecord[]

    return rows.map(row => ({ ...row }))
  }

  async update(id: string, updates: Partial<Omit<ProjectRecord, 'id' | 'created_at'>>): Promise<void> {
    const updateEntries = Object.entries(updates)
      .filter(([key]) => !['id', 'created_at'].includes(key))

    if (updateEntries.length === 0) {
      return
    }

    const setClause = updateEntries
      .map(([key]) => `${key} = ?`)
      .join(', ')

    const values = updateEntries.map(([, value]) => value)
    values.push(new Date().toISOString())
    values.push(id)

    this.db.prepare(`
      UPDATE projects
      SET ${setClause}, updated_at = ?
      WHERE id = ?
    `).run(...values)
  }

  async delete(id: string): Promise<void> {
    this.db.prepare(`DELETE FROM projects WHERE id = ?`).run(id)
  }

  async findAll(): Promise<ProjectRecord[]> {
    const rows = this.db.prepare(`
      SELECT id, slug, name, description, owner_user_id, status, settings_json, created_at, updated_at
      FROM projects
      WHERE status != 'deleted'
      ORDER BY created_at DESC
    `).all() as ProjectRecord[]

    return rows.map(row => ({ ...row }))
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close()
  }
}
