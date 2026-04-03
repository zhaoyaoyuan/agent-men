export class ApiError extends Error {
    code;
    details;
    retryable;
    constructor(code, message, details, retryable = false) {
        super(message);
        this.code = code;
        this.details = details;
        this.retryable = retryable;
        this.name = 'ApiError';
    }
}
