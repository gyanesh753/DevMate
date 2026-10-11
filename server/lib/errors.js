import { randomUUID } from 'node:crypto'
export class HttpError extends Error {
  constructor(status, code, message, fieldErrors) {
    super(message)
    Object.assign(this, { status, code, fieldErrors })
  }
}
export const fail = (status, code, message) => {
  throw new HttpError(status, code, message)
}
export function parse(schema, input) {
  const result = schema.safeParse(input)
  if (!result.success) {
    const fields = {}
    for (const issue of result.error.issues) fields[issue.path.join('.') || 'form'] = issue.message
    throw new HttpError(400, 'VALIDATION_ERROR', 'Check the highlighted fields.', fields)
  }
  return result.data
}
export function requestContext(req, res, next) {
  req.requestId = randomUUID()
  res.setHeader('X-Request-ID', req.requestId)
  res.setHeader('Cache-Control', 'no-store')
  next()
}
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err)
  let status = err.status || 500,
    code = err.code,
    message = err.message
  const databaseErrors = {
    23505: [409, 'CONFLICT', 'This record already exists.'],
    23503: [400, 'INVALID_REFERENCE', 'A referenced record is unavailable.'],
    23514: [400, 'VALIDATION_ERROR', 'The submitted values are invalid.'],
    23502: [400, 'VALIDATION_ERROR', 'A required value is missing.'],
    42501: [403, 'FORBIDDEN', 'You do not have access to this action.'],
    P0001: [409, 'CONFLICT', 'The action conflicts with the current state. Refresh and try again.'],
    40001: [409, 'CONFLICT', 'Another update happened at the same time. Refresh and try again.'],
    '40P01': [409, 'CONFLICT', 'Another update happened at the same time. Refresh and try again.'],
    57014: [503, 'UNAVAILABLE', 'The service is busy. Please try again.'],
    '55P03': [503, 'UNAVAILABLE', 'The service is busy. Please try again.'],
  }
  if (databaseErrors[code]) [status, code, message] = databaseErrors[code]
  else if (err.type === 'entity.parse.failed')
    [status, code, message] = [400, 'INVALID_JSON', 'Invalid JSON body.']
  else if (err.type === 'entity.too.large')
    [status, code, message] = [413, 'PAYLOAD_TOO_LARGE', 'The request is too large.']
  else if (!(err instanceof HttpError))
    [status, code, message] = [500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.']
  if (status >= 500)
    console.error(
      JSON.stringify({ requestId: req.requestId, code: code || 'INTERNAL_ERROR', status }),
    )
  res.status(status).json({
    error: {
      code,
      message,
      ...(err.fieldErrors ? { fieldErrors: err.fieldErrors } : {}),
      requestId: req.requestId,
    },
  })
}
