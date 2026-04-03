import { validateRecallMemoriesInput } from './validators/recall-memories-validator';
function tokenize(text) {
    return text.toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(token => token.length > 2);
}
function calculateSimilarity(query, memory) {
    const queryTokens = new Set(tokenize(query));
    const contentText = [memory.title || '', memory.content || ''].join(' ');
    const contentTokens = tokenize(contentText);
    let overlap = 0;
    for (const token of contentTokens) {
        if (queryTokens.has(token)) {
            overlap++;
        }
    }
    return overlap / Math.max(contentTokens.length, 1);
}
export function createRecallMemoriesService(deps) {
    return async function recallMemories(input) {
        validateRecallMemoriesInput(input);
        const options = {
            limit: input.options?.limit ?? 10,
            includeExplanation: input.options?.includeExplanation ?? true,
            includeEvidence: input.options?.includeEvidence ?? false,
            includeDocuments: input.options?.includeDocuments ?? true,
        };
        let project;
        try {
            project = await deps.projectRepository.findById(input.projectId);
        }
        catch {
            return {
                success: false,
                error: {
                    code: 'STORAGE_ERROR',
                    message: 'failed to load project',
                    retryable: true,
                },
            };
        }
        if (!project) {
            return {
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'project not found',
                },
            };
        }
        let memories;
        try {
            memories = await deps.memoryRepository.findByProjectId(input.projectId);
        }
        catch {
            return {
                success: false,
                error: {
                    code: 'STORAGE_ERROR',
                    message: 'failed to load memories',
                    retryable: true,
                },
            };
        }
        const scoredItems = memories.map((memory) => ({
            memory,
            score: calculateSimilarity(input.query, memory),
        }));
        const items = scoredItems
            .sort((a, b) => b.score - a.score)
            .slice(0, options.limit);
        const packet = {
            activeFacts: [],
            constraints: [],
            preferences: [],
            taskState: [],
            experiences: [],
            supportingDocuments: [],
            trace: [],
        };
        for (const { memory } of items) {
            if (memory.memoryType === 'fact') {
                packet.activeFacts.push(memory);
            }
            else if (memory.memoryType === 'constraint') {
                packet.constraints.push(memory);
            }
            else if (memory.memoryType === 'preference') {
                packet.preferences.push(memory);
            }
            else if (memory.memoryType === 'task_state') {
                packet.taskState.push(memory);
            }
            else if (memory.memoryType === 'experience') {
                packet.experiences.push(memory);
            }
        }
        // Load associated evidence links for all returned memories if repository is provided
        if (deps.eventMemoryLinkRepository) {
            try {
                for (const { memory } of items) {
                    const links = await deps.eventMemoryLinkRepository.findByMemoryId(memory.id);
                    const evidenceEventIds = links.map(link => link.event_id);
                    packet.trace.push({
                        memoryId: memory.id,
                        evidenceEventIds,
                    });
                }
            }
            catch {
                return {
                    success: false,
                    error: {
                        code: 'STORAGE_ERROR',
                        message: 'failed to load evidence links',
                        retryable: true,
                    },
                };
            }
        }
        return {
            success: true,
            data: {
                items,
                packet,
                meta: {
                    totalCandidates: memories.length,
                    returnedItems: items.length,
                    explainabilityEnabled: options.includeExplanation,
                    evidenceEnabled: options.includeEvidence,
                    documentsEnabled: options.includeDocuments,
                },
            },
        };
    };
}
