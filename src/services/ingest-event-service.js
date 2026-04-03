import { randomUUID } from 'node:crypto';
import { validateIngestEventInput } from './validators/ingest-event-validator';
export function createIngestEventService(deps) {
    return async function ingestEvent(input) {
        validateIngestEventInput(input);
        const project = await deps.projectRepository.findById(input.projectId);
        if (!project) {
            return {
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'project not found',
                },
            };
        }
        const eventId = randomUUID();
        try {
            await deps.eventRepository.insert({
                id: eventId,
                projectId: input.projectId,
                userId: input.userId,
                eventType: input.event.eventType,
                sourceType: input.event.sourceType,
                scopeType: input.event.scope.type,
                contentText: input.event.contentText,
                importanceScore: input.event.importanceScore,
            });
        }
        catch {
            return {
                success: false,
                error: {
                    code: 'STORAGE_ERROR',
                    message: 'failed to persist event',
                    retryable: true,
                },
            };
        }
        return {
            success: true,
            data: {
                eventId,
                accepted: true,
                deduplicated: false,
                extractedMemoryIds: [],
                extractedEntityIds: [],
            },
        };
    };
}
