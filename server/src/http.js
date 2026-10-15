export class HttpError extends Error {
  constructor(status, message, code = 'error') {
    super(message)
    this.status = status
    this.code = code
  }
}

export function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next)
  }
}

export function errorMiddleware(error, _req, res, _next) {
  if (error?.name === 'ZodError') {
    res.status(400).json({
      error: 'The request was not valid.',
      code: 'validation_error',
      details: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    })
    return
  }

  const status = error.status || 500
  if (status >= 500) {
    console.error(error)
  }
  res.status(status).json({
    error: status >= 500 ? 'The prototype could not complete that request.' : error.message,
    code: error.code || 'error',
  })
}
