import { config } from 'dotenv'
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { createApp } from '../server/app.js'
config({ path: '.env.test', quiet: true })
export function assertLocal(url) {
  const u = new URL(url)
  if (!['localhost', '127.0.0.1', '::1'].includes(u.hostname))
    throw new Error('Tests may only access an isolated local database/Auth service')
}
export async function environment() {
  for (const name of ['TEST_DATABASE_URL', 'DATABASE_URL', 'SUPABASE_URL'])
    assertLocal(process.env[name])
  const admin = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL })
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 })
  const options = { auth: { persistSession: false, autoRefreshToken: false } }
  const authAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_TEST_SECRET_KEY,
    options,
  )
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    options,
  )
  const app = createApp({ pool, supabase, rateLimits: false })
  const users = []
  async function user(label = 'member') {
    const email = `${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${randomUUID()}@example.test`,
      password = `Test-${randomUUID()}!`
    const { data, error } = await authAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: label },
    })
    if (error) throw error
    users.push(data.user.id)
    const auth = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_PUBLISHABLE_KEY,
      options,
    )
    const signed = await auth.auth.signInWithPassword({ email, password })
    if (signed.error) throw signed.error
    return { id: data.user.id, email, password, token: signed.data.session.access_token }
  }
  async function close() {
    // API deliberately has no deletion paths. Test administrator removes isolated fixtures.
    await admin.query(
      'DELETE FROM public.project_members WHERE user_id=ANY($1::uuid[]) OR project_id IN (SELECT id FROM public.projects WHERE owner_id=ANY($1::uuid[]))',
      [users],
    )
    await admin.query(
      'DELETE FROM public.applications WHERE applicant_id=ANY($1::uuid[]) OR project_id IN (SELECT id FROM public.projects WHERE owner_id=ANY($1::uuid[]))',
      [users],
    )
    for (const id of users) {
      const { error } = await authAdmin.auth.admin.deleteUser(id)
      if (error) throw error
    }
    await pool.end()
    await admin.end()
  }
  return { app, pool, admin, supabase, authAdmin, user, close }
}
export const projectBody = (overrides = {}) => ({
  title: 'Build a collaboration app',
  description: 'Build a useful tool with a friendly team.',
  type: 'passion',
  experience_level: 'any',
  industry: '',
  is_remote: true,
  location: '',
  max_members: 3,
  skill_ids: [],
  ...overrides,
})
