import { ApiError } from '../../shared/errors';
export function validateRecallMemoriesInput(input) {
    if (typeof input.projectId !== 'string' || input.projectId.trim() === '') {
        throw new ApiError('INVALID_INPUT', 'projectId is required');
    }
    if (typeof input.userId !== 'string' || input.userId.trim() === '') {
        throw new ApiError('INVALID_INPUT', 'userId is required');
    }
    if (typeof input.query !== 'string' || input.query.trim() === '') {
        throw new ApiError('INVALID_INPUT', 'query is required');
    }
    if (input.options?.limit !== undefined &&
        (!Number.isInteger(input.options.limit) || input.options.limit < 1 || input.options.limit > 100)) {
        throw new ApiError('INVALID_INPUT', 'options.limit must be an integer between 1 and 100');
    }
}
