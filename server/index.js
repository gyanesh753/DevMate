import { createClient } from '@supabase/supabase-js'
import { loadConfig } from './config.js'
import { createDatabase, verifyDatabaseRole } from './db/index.js'
import { createApp } from './app.js'
const config = loadConfig()
const pool = createDatabase(config.database)
await verifyDatabaseRole(pool)
const supabase = createClient(config.supabaseUrl, config.supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(8000) }),
  },
})
const app = createApp({ pool, supabase, ...config })
const server = app.listen(config.port, () => console.log(`DevMate API listening on ${config.port}`))
server.requestTimeout = 15000
server.headersTimeout = 10000
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () =>
    server.close(async () => {
      await pool.end()
      process.exit(0)
    }),
  )
