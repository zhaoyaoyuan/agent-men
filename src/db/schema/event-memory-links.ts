export const eventMemoryLinksTable = {
  name: 'event_memory_links',
  columns: {
    event_id: 'TEXT NOT NULL',
    memory_id: 'TEXT NOT NULL',
    evidence_role: 'TEXT',
    weight: 'REAL',
    created_at: 'TEXT NOT NULL',
  },
  constraints: [
    'PRIMARY KEY (event_id, memory_id)',
    'FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE',
    'FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE',
    'CHECK (weight IS NULL OR (weight >= 0 AND weight <= 1))',
  ],
  indexes: ['idx_event_memory_links_memory_id (memory_id)'],
} as const
