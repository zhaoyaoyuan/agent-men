import { isValidEventType, isValidScopeType, isValidSourceType } from '../../domain/event/contracts';
import { ApiError } from '../../shared/errors';
export function validateIngestEventInput(input) {
    if (typeof input.projectId !== 'string' || input.projectId.trim() === '') {
        throw new ApiError('INVALID_INPUT', 'projectId is required');
    }
    if (typeof input.userId !== 'string' || input.userId.trim() === '') {
        throw new ApiError('INVALID_INPUT', 'userId is required');
    }
    if (!input.event?.eventType) {
        throw new ApiError('INVALID_INPUT', 'event.eventType is required');
    }
    if (!isValidEventType(input.event.eventType)) {
        throw new ApiError('INVALID_INPUT', 'event.eventType is invalid');
    }
    // sourceType 允许任意字符串，但不能为空
    // sourceType 在类型上是必填的，但实际调用可能省略
    const sourceType = input.event?.sourceType;
    if (sourceType !== undefined) {
        if (typeof sourceType !== 'string') {
            throw new ApiError('INVALID_INPUT', 'event.sourceType must be a string');
        }
        if (sourceType.trim() === '') {
            throw new ApiError('INVALID_INPUT', 'event.sourceType is required');
        }
    }
    if (!input.event?.scope?.type) {
        throw new ApiError('INVALID_INPUT', 'event.scope.type is required');
    }
    if (!isValidScopeType(input.event.scope.type)) {
        throw new ApiError('INVALID_INPUT', 'event.scope.type is invalid');
    }
    if (input.event.importanceScore !== undefined &&
        (!Number.isFinite(input.event.importanceScore) ||
            input.event.importanceScore < 0 ||
            input.event.importanceScore > 1)) {
        throw new ApiError('INVALID_INPUT', 'importanceScore must be between 0 and 1');
    }
}
