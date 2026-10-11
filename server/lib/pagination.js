import { createHash } from 'node:crypto'
import { z } from 'zod'
import { parse, HttpError } from './errors.js'
import { uuid } from '../../shared/validation.js'
const schema = z.strictObject({
  at: z.iso.datetime({ offset: true }),
  id: uuid,
  filter: z.string().length(16),
})
export function pagination(query, filters) {
  const raw = query.limit ?? '20'
  if (typeof raw !== 'string' || !/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > 50)
    throw new HttpError(400, 'INVALID_LIMIT', 'Limit must be between 1 and 50.')
  const filter = createHash('sha256').update(JSON.stringify(filters)).digest('hex').slice(0, 16)
  let cursor = null
  if (query.cursor !== undefined) {
    if (
      typeof query.cursor !== 'string' ||
      query.cursor.length > 512 ||
      !/^[\w-]+$/.test(query.cursor)
    )
      throw new HttpError(400, 'INVALID_CURSOR', 'Invalid cursor.')
    try {
      cursor = parse(schema, JSON.parse(Buffer.from(query.cursor, 'base64url').toString()))
    } catch {
      throw new HttpError(400, 'INVALID_CURSOR', 'Invalid cursor.')
    }
    if (cursor.filter !== filter)
      throw new HttpError(400, 'INVALID_CURSOR', 'Cursor does not match these filters.')
  }
  return { limit: Number(raw), cursor, filter }
}
export function page(rows, paging) {
  const hasMore = rows.length > paging.limit,
    items = rows.slice(0, paging.limit)
  const last = items.at(-1)
  // Use the exact PostgreSQL timestamp text: JS Date would lose microseconds.
  const nextCursor = hasMore
    ? Buffer.from(
        JSON.stringify({ at: last.cursor_at, id: last.id, filter: paging.filter }),
      ).toString('base64url')
    : null
  return {
    items: items.map((row) => {
      const item = { ...row }
      delete item.cursor_at
      return item
    }),
    nextCursor,
    hasMore,
  }
}
export const cursorTimestamp = (alias) =>
  `to_char(${alias}.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_at`
