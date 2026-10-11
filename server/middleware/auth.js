import { HttpError } from '../lib/errors.js'
export function authenticate(supabase, required = false) {
  return async (req, res, next) => {
    const header = req.headers.authorization
    if (!header) {
      if (required) throw new HttpError(401, 'AUTH_REQUIRED', 'Please sign in to continue.')
      req.user = null
      return next()
    }
    if (!/^Bearer \S+$/i.test(header))
      throw new HttpError(401, 'INVALID_TOKEN', 'Invalid authentication token.')
    let result
    try {
      result = await supabase.auth.getUser(header.slice(7))
    } catch {
      throw new HttpError(
        503,
        'AUTH_UNAVAILABLE',
        'Sign-in verification is temporarily unavailable.',
      )
    }
    if (result.error) {
      if (result.error.status >= 500 || result.error.name === 'AuthRetryableFetchError')
        throw new HttpError(
          503,
          'AUTH_UNAVAILABLE',
          'Sign-in verification is temporarily unavailable.',
        )
      throw new HttpError(401, 'SESSION_EXPIRED', 'Your session expired. Please sign in again.')
    }
    if (!result.data.user || result.data.user.is_anonymous)
      throw new HttpError(401, 'AUTH_REQUIRED', 'Please sign in to continue.')
    req.user = result.data.user
    next()
  }
}
