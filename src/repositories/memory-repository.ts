export interface MemoryRecordLike {
  id: string
  projectId: string
  project_id?: string
  userId?: string
  user_id?: string
  memoryType: 'fact' | 'constraint' | 'preference' | 'task_state' | 'experience'
  memory_type?: string
  scopeType?: string
  scope_type?: string
  scopeKey?: string | null
  title?: string
  content?: string
  summary?: string | null
  status?: string
  confidence?: number
  strength?: number
  decayScore?: number
  decay_score?: number
  importanceScore?: number
  importance_score?: number
  accessCount?: number
  access_count?: number
  successCount?: number
  success_count?: number
  failureCount?: number
  failure_count?: number
  lastAccessedAt?: string | null
  last_accessed_at?: string | null
  lastVerifiedAt?: string | null
  last_verified_at?: string | null
  lastReinforcedAt?: string | null
  last_reinforced_at?: string | null
  expiresAt?: string | null
  expires_at?: string | null
  sourceStrategy?: string
  source_strategy?: string
  explanationJson?: string | null
  explanation_json?: string | null
  metadataJson?: string | null
  metadata_json?: string | null
  createdAt?: string
  created_at?: string
  updatedAt?: string
  updated_at?: string
}

export interface MemoryRepository {
  insert(record: MemoryRecordLike): Promise<void>
  findById(id: string): Promise<MemoryRecordLike | null>
  findByProjectId(projectId: string): Promise<MemoryRecordLike[]>
  findByProjectIdAndType(projectId: string, memoryType: MemoryRecordLike['memoryType']): Promise<MemoryRecordLike[]>
  update(id: string, updates: Partial<Omit<MemoryRecordLike, 'id'>>): Promise<void>
  delete(id: string): Promise<void>
  close(): void
}

export interface MemoryRecord extends Omit<MemoryRecordLike, 'projectId' | 'userId' | 'memoryType' | 'scopeType' | 'scopeKey' | 'confidence' | 'strength' | 'decayScore' | 'importanceScore' | 'accessCount' | 'successCount' | 'failureCount' | 'lastAccessedAt' | 'lastVerifiedAt' | 'lastReinforcedAt' | 'expiresAt' | 'sourceStrategy' | 'explanationJson' | 'metadataJson' | 'createdAt' | 'updatedAt'> {
  id: string
  project_id: string
  user_id: string
  memory_type: 'fact' | 'constraint' | 'preference' | 'task_state' | 'experience'
  scope_type: string
  scope_key: string | null
  title: string
  content: string
  summary: string | null
  status: string
  confidence: number
  strength: number
  decay_score: number
  importance_score: number
  access_count: number
  success_count: number
  failure_count: number
  last_accessed_at: string | null
  last_verified_at: string | null
  last_reinforced_at: string | null
  expires_at: string | null
  source_strategy: string
  explanation_json: string | null
  metadata_json: string | null
  created_at: string
  updated_at: string

  // CamelCase aliases for service consumption (already in MemoryRecordLike, required here for intersection typing)
  projectId: string
  userId: string
  memoryType: 'fact' | 'constraint' | 'preference' | 'task_state' | 'experience'
  scopeType: string
  scopeKey: string | null
  decayScore: number
  importanceScore: number
  accessCount: number
  successCount: number
  failureCount: number
  lastAccessedAt: string | null
  lastVerifiedAt: string | null
  lastReinforcedAt: string | null
  expiresAt: string | null
  sourceStrategy: string
  explanationJson: string | null
  metadataJson: string | null
  createdAt: string
  updatedAt: string
}

export class InMemoryMemoryRepository implements MemoryRepository {
  private store = new Map<string, MemoryRecordLike>()

  async insert(record: MemoryRecordLike): Promise<void> {
    if (this.store.has(record.id)) {
      throw new Error('memory already exists')
    }

    this.store.set(record.id, { ...record })
  }

  async findById(id: string): Promise<MemoryRecordLike | null> {
    const record = this.store.get(id)
    return record ? { ...record } : null
  }

  async findByProjectId(projectId: string): Promise<MemoryRecordLike[]> {
    return Array.from(this.store.values())
      .filter((record) => record.projectId === projectId)
      .map((record) => ({ ...record }))
  }

  async findByProjectIdAndType(projectId: string, memoryType: MemoryRecordLike['memoryType']): Promise<MemoryRecordLike[]> {
    return Array.from(this.store.values())
      .filter((record) => record.projectId === projectId && record.memoryType === memoryType)
      .map((record) => ({ ...record }))
  }

  async update(id: string, updates: Partial<Omit<MemoryRecordLike, 'id'>>): Promise<void> {
    const existing = this.store.get(id)
    if (!existing) {
      return
    }

    this.store.set(id, {
      ...existing,
      ...updates,
    })
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id)
  }

  close(): void {
    // No-op for in-memory implementation
  }
}
