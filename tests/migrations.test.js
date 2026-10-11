import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import pg from 'pg'
import { config } from 'dotenv'
import { assertLocal } from './helpers.js'
config({ path: '.env.test', quiet: true })
test('baseline upgrade preserves valid records and archives invalid dependent data', async () => {
  assertLocal(process.env.TEST_DATABASE_URL)
  const control = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL })
  await control.connect()
  const name = `devmate_upgrade_${Date.now()}`
  const url = new URL(process.env.TEST_DATABASE_URL)
  url.pathname = `/${name}`
  let db
  try {
    await control.query(`CREATE DATABASE ${name}`)
    db = new pg.Client({ connectionString: url.toString() })
    await db.connect()
    // Auth belongs to Supabase. This isolated upgrade fixture needs its stable FK surface only.
    await db.query(`CREATE SCHEMA auth; CREATE SCHEMA extensions;
    CREATE TABLE auth.users(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),email text,raw_user_meta_data jsonb);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (NULLIF(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;`)
    await db.query(readFileSync('supabase/migrations/20261010210939_baseline.sql', 'utf8'))
    const { rows: users } = await db.query(
      'INSERT INTO auth.users(email,raw_user_meta_data) VALUES(\'owner@example.test\',\'{"name":"Owner"}\'),(\'applicant@example.test\',\'{"name":"Applicant"}\') RETURNING id',
    )
    const {
      rows: [valid],
    } = await db.query(
      "INSERT INTO public.projects(title,description,owner_id,skills_needed) VALUES('Valid','Keep this project',$1,ARRAY['React','CustomSkill']) RETURNING id",
      [users[0].id],
    )
    const {
      rows: [invalid],
    } = await db.query(
      "INSERT INTO public.projects(title,description) VALUES('Ownerless','Archive this sample') RETURNING id",
    )
    await db.query(
      "INSERT INTO public.applications(project_id,applicant_id,message) VALUES($1,$2,'Valid application'),($1,$3,'Self application'),($4,$2,'Orphan dependent')",
      [valid.id, users[1].id, users[0].id, invalid.id],
    )
    await db.query(
      "INSERT INTO public.messages(project_id,sender_id,receiver_id,content) VALUES($1,$2,$3,'Archive message')",
      [invalid.id, users[0].id, users[1].id],
    )
    await db.query(
      'INSERT INTO public.reviews(project_id,reviewer_id,reviewee_id,rating) VALUES($1,$2,$3,4)',
      [invalid.id, users[0].id, users[1].id],
    )
    await db.query(readFileSync('supabase/migrations/20261010210952_mvp.sql', 'utf8'))
    assert.equal((await db.query('SELECT count(*)::int n FROM auth.users')).rows[0].n, 2)
    assert.equal((await db.query('SELECT count(*)::int n FROM public.users')).rows[0].n, 2)
    assert.equal((await db.query('SELECT count(*)::int n FROM public.projects')).rows[0].n, 1)
    assert.equal((await db.query('SELECT count(*)::int n FROM public.applications')).rows[0].n, 1)
    assert.equal(
      (await db.query('SELECT count(*)::int n FROM private.migration_archive')).rows[0].n,
      5,
    )
    assert.equal(
      (await db.query('SELECT count(*)::int n FROM public.project_members')).rows[0].n,
      1,
    )
    assert.equal((await db.query('SELECT count(*)::int n FROM public.project_skills')).rows[0].n, 2)
    assert.equal(
      (await db.query("SELECT name FROM public.skills WHERE name='CustomSkill'")).rows[0].name,
      'CustomSkill',
    )
  } finally {
    if (db) await db.end()
    await control.query(`DROP DATABASE IF EXISTS ${name}`)
    await control.end()
  }
})
