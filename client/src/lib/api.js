import { supabase } from '../Supabase'
const base = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '')
export class ApiError extends Error {
  constructor(message, status = 0, code = 'NETWORK_ERROR', fieldErrors = {}) {
    super(message)
    Object.assign(this, { status, code, fieldErrors })
  }
}
export async function api(path, { body, signal, ...options } = {}) {
  let response
  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession()
    if (error)
      throw new ApiError(
        'Your session could not be loaded. Please sign in again.',
        401,
        'SESSION_EXPIRED',
      )
    response = await fetch(`${base}${path}`, {
      ...options,
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
        : AbortSignal.timeout(15000),
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
  } catch (error) {
    if (signal?.aborted || error instanceof ApiError) throw error
    throw new ApiError(
      options.method && options.method !== 'GET'
        ? 'The response was interrupted. Check the saved state before trying again.'
        : 'Could not reach DevMate. Please try again.',
    )
  }
  const data = await response.json().catch(() => null)
  if (!response.ok)
    throw new ApiError(
      data?.error?.message || 'The request failed. Please try again.',
      response.status,
      data?.error?.code,
      data?.error?.fieldErrors,
    )
  if (data === null) throw new ApiError('DevMate returned an unreadable response. Please reload.')
  return data
}
