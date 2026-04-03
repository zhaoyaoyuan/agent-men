export type ApiErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNSUPPORTED_OPERATION'
  | 'STORAGE_ERROR'
  | 'RECALL_ERROR'
  | 'LLM_ERROR'
  | 'INTERNAL_ERROR'

export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
    public details?: Record<string, unknown>,
    public retryable = false,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}
