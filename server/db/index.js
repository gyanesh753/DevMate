import pg from 'pg'
export function createDatabase(config) {
  const pool = new pg.Pool(config)
  pool.on('error', () => console.error(JSON.stringify({ code: 'IDLE_DATABASE_CONNECTION_ERROR' })))
  return pool
}
export async function verifyDatabaseRole(pool) {
  const {
    rows: [role],
  } = await pool.query(`SELECT current_user AS name, rolsuper, rolbypassrls,
    EXISTS (SELECT 1 FROM pg_class WHERE relnamespace='public'::regnamespace AND relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)) AS owns_tables
    FROM pg_roles WHERE rolname=current_user`)
  if (role.name !== 'devmate_api' || role.rolsuper || role.rolbypassrls || role.owns_tables)
    throw new Error('DATABASE_URL must use the restricted devmate_api role')
}
export async function transaction(pool, userId, work) {
  const client = await pool.connect()
  let broken = false
  try {
    await client.query('BEGIN')
    await client.query(
      "SELECT set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true), set_config('lock_timeout', '5s', true), set_config('statement_timeout', '10s', true)",
      [JSON.stringify(userId ? { sub: userId } : {}), userId || ''],
    )
    const value = await work(client)
    await client.query('COMMIT')
    return value
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch {
      broken = true
    }
    throw error
  } finally {
    client.release(broken)
  }
}
