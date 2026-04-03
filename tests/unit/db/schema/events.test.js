import { describe, expect, it } from 'vitest';
import { eventsTable } from '../../../../src/db/schema/events';
describe('eventsTable', () => {
    it('should define expected table name and required columns', () => {
        expect(eventsTable.name).toBe('events');
        expect(eventsTable.columns.project_id).toBeDefined();
        expect(eventsTable.columns.event_type).toBeDefined();
    });
});
