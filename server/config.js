import 'dotenv/config'
import { readFileSync } from 'node:fs'
export function loadConfig(env = process.env) {
  for (const key of ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY'])
    if (!env[key]) throw new Error(`Missing ${key}`)
  const database = new URL(env.DATABASE_URL)
  if (!['postgres:', 'postgresql:'].includes(database.protocol))
    throw new Error('Invalid DATABASE_URL')
  if (
    database.searchParams.has('sslmode') ||
    database.searchParams.has('sslcert') ||
    database.searchParams.has('sslrootcert')
  )
    throw new Error('Configure TLS with DATABASE_SSL and DATABASE_CA_FILE, not URL SSL parameters')
  const production = env.NODE_ENV === 'production'
  const authUrl = new URL(env.SUPABASE_URL)
  if (
    !['http:', 'https:'].includes(authUrl.protocol) ||
    (production && authUrl.protocol !== 'https:')
  )
    throw new Error('Invalid SUPABASE_URL')
  if (env.SUPABASE_PUBLISHABLE_KEY.startsWith('sb_secret_'))
    throw new Error('Use a publishable key, not a secret key')
  const useTLS = production || env.DATABASE_SSL === 'true'
  const origins = (env.ALLOWED_ORIGINS || (production ? '' : 'http://localhost:5173'))
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
  if (!origins.length || origins.includes('*'))
    throw new Error('Explicit ALLOWED_ORIGINS is required')
  for (const origin of origins)
    if (new URL(origin).origin !== origin) throw new Error('Origins must be exact origins')
  const port = Number(env.PORT || 5000),
    proxyHops = Number(env.TRUST_PROXY_HOPS || 0)
  if (
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    !Number.isInteger(proxyHops) ||
    proxyHops < 0 ||
    proxyHops > 5
  )
    throw new Error('Invalid port/proxy configuration')
  return {
    port,
    proxyHops,
    origins,
    supabaseUrl: env.SUPABASE_URL,
    supabaseKey: env.SUPABASE_PUBLISHABLE_KEY,
    database: {
      connectionString: env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      statement_timeout: 10000,
      ssl: useTLS
        ? {
            rejectUnauthorized: true,
            ...(env.DATABASE_CA_FILE ? { ca: readFileSync(env.DATABASE_CA_FILE, 'utf8') } : {}),
          }
        : false,
    },
  }
}
