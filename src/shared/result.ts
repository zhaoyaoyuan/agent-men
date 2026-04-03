import type { ApiErrorCode } from './errors'

export type ApiResponse<T> =
  | {
      success: true
      data: T
    }
  | {
      success: false
      error: {
        code: ApiErrorCode
        message: string
        details?: Record<string, unknown>
        retryable?: boolean
      }
    }
