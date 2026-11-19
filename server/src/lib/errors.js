// One error shape for the whole API: { error: { code, message } }
export class AppError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}
export const badRequest = (message, fields) => new AppError(400, 'INVALID_INPUT', message, fields ? { fields } : {});
export const unauthorized = (message = 'Sign in to continue.') => new AppError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'You are not allowed to do this.') => new AppError(403, 'FORBIDDEN', message);
export const notFound = (message = 'Not found.') => new AppError(404, 'NOT_FOUND', message);
export const conflict = (code, message, extra) => new AppError(409, code, message, extra);

export function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, ...err.extra } });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'The request body is not valid JSON.' } });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'The request body is too large.' } });
  }
  if (err?.name === 'MulterError') {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'The image is too large. The maximum size is 5 MB per image.'
      : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE'
        ? 'You can upload at most 5 images.'
        : 'The upload could not be read.';
    return res.status(400).json({ error: { code: 'BAD_UPLOAD', message } });
  }
  if (String(err?.code || '').startsWith('SQLITE_BUSY')) {
    return res.status(503).json({ error: { code: 'BUSY', message: 'The server is busy. Try again.' } });
  }
  console.error(err);
  res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong on our side.' } });
}

export const clean = (v) => (typeof v === 'string' ? v.trim() : '');
