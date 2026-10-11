// Explicit local-only bootstrap. Never accepts a remote database or project.
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { writeFileSync, existsSync } from 'node:fs'
import pg from 'pg'
const status = JSON.parse(
  execFileSync('npx', ['--no-install', 'supabase', 'status', '--output', 'json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  }),
)
const db = new URL(status.DB_URL)
if (!['127.0.0.1', 'localhost'].includes(db.hostname) || db.port !== '54322')
  throw new Error('Refusing non-local database')
const pool = new pg.Pool({ connectionString: status.DB_URL })
const password = randomBytes(24).toString('base64url')
await pool.query(`ALTER ROLE devmate_api LOGIN PASSWORD '${password}'`)
await pool.end()
db.username = 'devmate_api'
db.password = password
const key = status.PUBLISHABLE_KEY || status.ANON_KEY
const values = {
  TEST_DATABASE_URL: status.DB_URL,
  DATABASE_URL: db.toString(),
  SUPABASE_URL: status.API_URL,
  SUPABASE_PUBLISHABLE_KEY: key,
  SUPABASE_TEST_SECRET_KEY: status.SECRET_KEY || status.SERVICE_ROLE_KEY,
}
writeFileSync(
  '.env.test',
  Object.entries(values)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n') + '\n',
  { mode: 0o600 },
)
if (!existsSync('client/.env.local'))
  writeFileSync(
    'client/.env.local',
    `VITE_API_URL=http://localhost:5000\nVITE_SUPABASE_URL=${status.API_URL}\nVITE_SUPABASE_PUBLISHABLE_KEY=${key}\n`,
  )
// This file is dedicated to generated local config; production .env is untouched.
writeFileSync(
  'server/.env.local',
  `DATABASE_URL=${db}\nSUPABASE_URL=${status.API_URL}\nSUPABASE_PUBLISHABLE_KEY=${key}\nALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173\n`,
  { mode: 0o600 },
)
console.log(
  'Configured .env.test and local development environment files (no credentials printed).',
)
