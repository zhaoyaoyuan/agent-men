export interface EventMemoryLinkRecord {
  event_id: string
  memory_id: string
  evidence_role: string | null
  weight: number | null
  created_at: string
}

export interface EventMemoryLinkRecordLike {
  event_id: string
  memory_id: string
  evidence_role?: string | null
  weight?: number | null
}

export class InMemoryEventMemoryLinkRepository {
  private store = new Map<string, EventMemoryLinkRecord>()

  private getKey(eventId: string, memoryId: string): string {
    return `${eventId}:${memoryId}`
  }

  async insert(record: EventMemoryLinkRecordLike): Promise<void> {
    const now = new Date().toISOString()
    const fullRecord: EventMemoryLinkRecord = {
      evidence_role: null,
      weight: null,
      created_at: now,
      ...record,
    }
    const key = this.getKey(fullRecord.event_id, fullRecord.memory_id)
    this.store.set(key, { ...fullRecord })
  }

  async findByEventId(eventId: string): Promise<EventMemoryLinkRecord[]> {
    const records = Array.from(this.store.values())
      .filter(r => r.event_id === eventId)
      .map(r => ({ ...r }))
    return records
  }

  async findByMemoryId(memoryId: string): Promise<EventMemoryLinkRecord[]> {
    const records = Array.from(this.store.values())
      .filter(r => r.memory_id === memoryId)
      .map(r => ({ ...r }))
    return records
  }

  async delete(eventId: string, memoryId: string): Promise<void> {
    const key = this.getKey(eventId, memoryId)
    this.store.delete(key)
  }

  async deleteByEventId(eventId: string): Promise<void> {
    const keysToDelete = Array.from(this.store.entries())
      .filter(([_, record]) => record.event_id === eventId)
      .map(([key]) => key)
    keysToDelete.forEach(key => this.store.delete(key))
  }
}
