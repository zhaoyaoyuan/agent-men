import { Hono } from 'hono';
import { validateIngestEventInput } from '../services/validators/ingest-event-validator';
import { validateExtractMemoriesInput } from '../services/validators/extract-memories-validator';
import { validateRecallMemoriesInput } from '../services/validators/recall-memories-validator';
import { ApiError } from '../shared/errors';
const statusCodeMap = {
    INVALID_INPUT: 400,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNSUPPORTED_OPERATION: 400,
    STORAGE_ERROR: 500,
    RECALL_ERROR: 500,
    LLM_ERROR: 500,
    INTERNAL_ERROR: 500,
};
function getStatusCode(code) {
    return statusCodeMap[code] ?? 500;
}
export function createApp(deps) {
    const app = new Hono();
    app.notFound((c) => {
        return c.json({
            success: false,
            error: {
                code: 'NOT_FOUND',
                message: 'Route not found',
            },
        }, 404);
    });
    app.onError((err, c) => {
        if (err instanceof ApiError) {
            return c.json({
                success: false,
                error: {
                    code: err.code,
                    message: err.message,
                    details: err.details,
                    retryable: err.retryable,
                },
            }, getStatusCode(err.code));
        }
        console.error('Unexpected error:', err);
        return c.json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Internal server error',
            },
        }, 500);
    });
    app.post('/api/ingest', async (c) => {
        let body;
        try {
            body = await c.req.json();
        }
        catch {
            return c.json({
                success: false,
                error: {
                    code: 'INVALID_INPUT',
                    message: 'Invalid JSON body',
                },
            }, 400);
        }
        try {
            validateIngestEventInput(body);
            const result = await deps.ingestEventService(body);
            if (result.success) {
                return c.json(result, 200);
            }
            return c.json(result, getStatusCode(result.error.code));
        }
        catch (err) {
            if (err instanceof ApiError) {
                return c.json({
                    success: false,
                    error: {
                        code: err.code,
                        message: err.message,
                        details: err.details,
                        retryable: err.retryable,
                    },
                }, getStatusCode(err.code));
            }
            throw err;
        }
    });
    app.post('/api/extract', async (c) => {
        let body;
        try {
            body = await c.req.json();
        }
        catch {
            return c.json({
                success: false,
                error: {
                    code: 'INVALID_INPUT',
                    message: 'Invalid JSON body',
                },
            }, 400);
        }
        try {
            validateExtractMemoriesInput(body);
            const result = await deps.extractMemoriesService(body);
            if (result.success) {
                return c.json(result, 200);
            }
            return c.json(result, getStatusCode(result.error.code));
        }
        catch (err) {
            if (err instanceof ApiError) {
                return c.json({
                    success: false,
                    error: {
                        code: err.code,
                        message: err.message,
                        details: err.details,
                        retryable: err.retryable,
                    },
                }, getStatusCode(err.code));
            }
            throw err;
        }
    });
    app.post('/api/recall', async (c) => {
        let body;
        try {
            body = await c.req.json();
        }
        catch {
            return c.json({
                success: false,
                error: {
                    code: 'INVALID_INPUT',
                    message: 'Invalid JSON body',
                },
            }, 400);
        }
        try {
            validateRecallMemoriesInput(body);
            const result = await deps.recallMemoriesService(body);
            if (result.success) {
                return c.json(result, 200);
            }
            return c.json(result, getStatusCode(result.error.code));
        }
        catch (err) {
            if (err instanceof ApiError) {
                return c.json({
                    success: false,
                    error: {
                        code: err.code,
                        message: err.message,
                        details: err.details,
                        retryable: err.retryable,
                    },
                }, getStatusCode(err.code));
            }
            throw err;
        }
    });
    return app;
}
