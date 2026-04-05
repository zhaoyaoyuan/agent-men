
import { validateIngestEventInput } from './src/services/validators/ingest-event-validator.js';

try {
  validateIngestEventInput({
    projectId: 'p1',
    userId: 'u1',
    event: {
      eventType: 'message',
      sourceType: 'unknown',
      scope: { type: 'project' },
    },
  });
  console.log('OK - no error thrown');
} catch (e) {
  console.log('ERROR:', e.message);
  console.log(e);
}
