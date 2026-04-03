export interface ProjectRecord {
  id: string
  slug: string
  name: string
  description: string | null
  owner_user_id: string
  status: 'active' | 'archived' | 'deleted'
  settings_json: string | null
  created_at: string
  updated_at: string
}

export interface ProjectRecordLike {
  id: string
  slug: string
  name: string
  description?: string | null
  owner_user_id: string
  status?: 'active' | 'archived' | 'deleted'
  settings_json?: string | null
  created_at?: string
  updated_at?: string
}

export class InMemoryProjectRepository {
  private store = new Map<string, ProjectRecord>()

  async insert(record: ProjectRecordLike): Promise<void> {
    const now = record.created_at || new Date().toISOString()
    const fullRecord: ProjectRecord = {
      status: 'active',
      settings_json: null,
      description: null,
      created_at: now,
      updated_at: now,
      ...record,
    }
    this.store.set(record.id, { ...fullRecord })
  }

  async findById(id: string): Promise<ProjectRecord | null> {
    const record = this.store.get(id)
    return record ? { ...record } : null
  }

  async findBySlug(slug: string): Promise<ProjectRecord | null> {
    const record = Array.from(this.store.values()).find(r => r.slug === slug)
    return record ? { ...record } : null
  }

  async findByOwnerId(ownerId: string): Promise<ProjectRecord[]> {
    return Array.from(this.store.values())
      .filter(record => record.owner_user_id === ownerId)
      .map(record => ({ ...record }))
  }

  async update(id: string, updates: Partial<ProjectRecord>): Promise<void> {
    const existing = this.store.get(id)
    if (existing) {
      this.store.set(id, {
        ...existing,
        ...updates,
        updated_at: new Date().toISOString(),
      })
    }
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id)
  }
}
