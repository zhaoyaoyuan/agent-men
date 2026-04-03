import { describe, expect, it } from 'vitest';
import { eventMemoryLinksTable } from '../../../../src/db/schema/event-memory-links';
describe('eventMemoryLinksTable', () => {
    it('should define the full event_memory_links schema contract', () => {
        expect(eventMemoryLinksTable.name).toBe('event_memory_links');
        expect(eventMemoryLinksTable.columns).toEqual({
            event_id: 'TEXT NOT NULL',
            memory_id: 'TEXT NOT NULL',
            evidence_role: 'TEXT',
            weight: 'REAL',
            created_at: 'TEXT NOT NULL',
        });
        expect(eventMemoryLinksTable.constraints).toEqual([
            'PRIMARY KEY (event_id, memory_id)',
            'FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE',
            'FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE',
            'CHECK (weight IS NULL OR (weight >= 0 AND weight <= 1))',
        ]);
        expect(eventMemoryLinksTable.indexes).toEqual(['idx_event_memory_links_memory_id (memory_id)']);
    });
});
