import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { environment, projectBody } from './helpers.js'
import { transaction, verifyDatabaseRole } from '../server/db/index.js'
let env, owner, alice, bob, outsider, skill
before(async () => {
  env = await environment()
  ;[owner, alice, bob, outsider] = await Promise.all(
    ['owner', 'alice', 'bob', 'outsider'].map((n) => env.user(n)),
  )
  skill = (await request(env.app).get('/api/skills')).body[0]
})
after(async () => {
  if (env) await env.close()
})
const send = (method, path, user, body) => {
  let r = request(env.app)[method](path)
  if (user) r = r.set('Authorization', `Bearer ${user.token}`)
  return body ? r.send(body) : r
}
async function create(overrides = {}) {
  const r = await send('post', '/api/projects', owner, projectBody(overrides))
  assert.equal(r.status, 201, JSON.stringify(r.body))
  return r.body
}
async function apply(p, user = alice) {
  const r = await send('post', '/api/applications', user, {
    project_id: p.id,
    message: 'I can help build this project.',
  })
  assert.equal(r.status, 201, JSON.stringify(r.body))
  return r.body
}
const decide = (a, status = 'accepted', user = owner) =>
  send('patch', `/api/applications/${a.id}/decision`, user, { status })
test('restricted runtime role, auth boundaries, public data and validation', async () => {
  await verifyDatabaseRole(env.pool)
  assert.equal((await send('post', '/api/projects', null, projectBody())).status, 401)
  assert.equal(
    (await send('post', '/api/projects', owner, projectBody({ owner_id: outsider.id }))).status,
    400,
  )
  assert.equal(
    (await send('post', '/api/projects', owner, projectBody({ is_remote: false }))).status,
    400,
  )
  assert.equal(
    (await send('post', '/api/projects', owner, projectBody({ max_members: 1 }))).status,
    400,
  )
  assert.equal((await request(env.app).get('/api/projects/not-a-uuid')).status, 400)
  assert.equal((await request(env.app).get('/api/projects?is_remote=maybe')).status, 400)
  assert.equal((await request(env.app).get('/api/projects?owner_id=bad')).status, 400)
  assert.equal((await request(env.app).get('/api/projects?limit=51')).status, 400)
  const p = await create()
  assert.equal(p.member_count, 1)
  assert.equal(p.remaining_places, 2)
  assert.equal(p.members[0].role, 'owner')
  assert.ok(!JSON.stringify(p).includes(owner.email))
  assert.equal((await send('get', `/api/projects/${p.id}/applications`)).status, 401)
  assert.equal((await send('get', `/api/applications/project/${p.id}`)).status, 401)
  assert.equal((await send('get', `/api/projects/${p.id}/applications`, outsider)).status, 403)
  assert.equal(
    (
      await send('patch', `/api/projects/${p.id}`, outsider, {
        ...projectBody(),
        version: p.version,
      })
    ).status,
    403,
  )
  assert.equal((await send('get', `/api/users/${owner.id}`, outsider)).status, 403)
  assert.equal(
    (
      await send('put', `/api/users/${owner.id}`, owner, {
        name: 'owner',
        bio: '',
        location: '',
        github_url: 'javascript:alert(1)',
        linkedin_url: '',
        skill_ids: [],
      })
    ).status,
    400,
  )
  const malformed = await request(env.app)
    .post('/api/projects')
    .set('Content-Type', 'application/json')
    .send('{')
  assert.equal(malformed.status, 400)
  assert.equal(malformed.body.error.code, 'INVALID_JSON')
  assert.ok(malformed.body.error.requestId)
})
test('one application, owner-only review, private caches and persisted status', async () => {
  const p = await create(),
    a = await apply(p)
  assert.equal(
    (await send('post', '/api/applications', alice, { project_id: p.id, message: 'again' })).status,
    409,
  )
  assert.equal(
    (await send('post', '/api/applications', owner, { project_id: p.id, message: 'my own' }))
      .status,
    409,
  )
  const mine = await send('get', '/api/applications/me', alice)
  assert.ok(mine.body.items.some((x) => x.id === a.id))
  assert.equal(mine.headers['cache-control'], 'no-store')
  assert.equal(
    (await send('get', `/api/projects/${p.id}/applications`, owner)).body.items.length,
    1,
  )
  assert.equal(
    (await send('get', `/api/projects/${p.id}`, alice)).body.my_application.status,
    'pending',
  )
  assert.equal((await decide(a, 'accepted', alice)).status, 403)
  assert.equal((await decide(a, 'accepted', outsider)).status, 404)
  assert.equal((await decide(a, 'rejected')).status, 200)
  assert.equal((await decide(a, 'rejected')).status, 200)
  assert.equal((await decide(a, 'accepted')).status, 409)
  assert.equal(
    (await send('get', `/api/projects/${p.id}`, alice)).body.my_application.status,
    'rejected',
  )
})
test('concurrent acceptance takes exactly one last slot', async () => {
  const p = await create({ max_members: 2 }),
    a = await apply(p, alice),
    b = await apply(p, bob)
  const results = await Promise.all([decide(a), decide(b)])
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409])
  const current = (await send('get', `/api/projects/${p.id}`, owner)).body
  assert.equal(current.member_count, 2)
  const accepted = results[0].status === 200 ? a : b
  assert.equal((await decide(accepted)).status, 200)
  assert.equal((await decide(accepted, 'rejected')).status, 409)
  assert.equal(
    (await send('post', '/api/applications', outsider, { project_id: p.id, message: 'late' })).body
      .error.code,
    'PROJECT_FULL',
  )
})
test('closing pending applications preserves final decisions and idempotent retries', async () => {
  const p = await create(),
    a = await apply(p, alice),
    b = await apply(p, bob)
  assert.equal((await decide(a)).status, 200)
  const closed = await send('patch', `/api/projects/${p.id}/status`, owner, {
    status: 'closed',
    version: p.version,
  })
  assert.equal(closed.status, 200)
  assert.equal(
    (await send('get', `/api/projects/${p.id}`, bob)).body.my_application.status,
    'closed',
  )
  assert.equal((await decide(b)).status, 409)
  assert.equal((await decide(a)).status, 200)
  assert.equal(closed.body.member_count, 2)
  assert.equal(
    (
      await send('patch', `/api/projects/${p.id}/status`, owner, {
        status: 'open',
        version: closed.body.version,
      })
    ).status,
    409,
  )
})
test('submission and closing serialize without leaving pending applications', async () => {
  const p = await create()
  const [application, closure] = await Promise.all([
    send('post', '/api/applications', alice, {
      project_id: p.id,
      message: 'Concurrent application',
    }),
    send('patch', `/api/projects/${p.id}/status`, owner, { status: 'closed', version: p.version }),
  ])
  assert.ok([201, 409].includes(application.status))
  assert.equal(closure.status, 200)
  const { rows } = await env.admin.query(
    "SELECT status FROM public.applications WHERE project_id=$1 AND status='pending'",
    [p.id],
  )
  assert.equal(rows.length, 0)
})
test('capacity edits and acceptance serialize; stale edits cannot overwrite', async () => {
  const p = await create({ max_members: 3 }),
    a = await apply(p, alice),
    b = await apply(p, bob)
  await decide(a)
  const [decision, edit] = await Promise.all([
    decide(b),
    send('patch', `/api/projects/${p.id}`, owner, {
      ...projectBody({ max_members: 2 }),
      version: p.version,
    }),
  ])
  assert.deepEqual([decision.status, edit.status].sort(), [200, 409])
  const current = (await send('get', `/api/projects/${p.id}`, owner)).body
  assert.ok(current.member_count <= current.max_members)
  const edits = await Promise.all(
    ['First edit', 'Second edit'].map((title) =>
      send('patch', `/api/projects/${p.id}`, owner, {
        ...projectBody({ title, max_members: current.max_members }),
        version: current.version,
      }),
    ),
  )
  assert.deepEqual(edits.map((r) => r.status).sort(), [200, 409])
})
test('start/completion rules and terminal editing', async () => {
  const p = await create(),
    a = await apply(p)
  const started = await send('patch', `/api/projects/${p.id}/status`, owner, {
    status: 'in-progress',
    version: p.version,
  })
  assert.equal(started.status, 200)
  assert.equal(
    (await send('get', `/api/projects/${p.id}`, alice)).body.my_application.status,
    'closed',
  )
  assert.equal((await decide(a)).status, 409)
  assert.equal(
    (
      await send('patch', `/api/projects/${p.id}`, owner, {
        ...projectBody({ max_members: 4 }),
        version: started.body.version,
      })
    ).status,
    409,
  )
  const complete = await send('patch', `/api/projects/${p.id}/status`, owner, {
    status: 'completed',
    version: started.body.version,
  })
  assert.equal(complete.status, 200)
  assert.equal(
    (
      await send('patch', `/api/projects/${p.id}`, owner, {
        ...projectBody(),
        version: complete.body.version,
      })
    ).status,
    409,
  )
})
test('search by skills, literal wildcards, stable microsecond cursors and filter binding', async () => {
  const marker = `search-${Date.now()}`
  const p1 = await create({ title: `${marker} one`, skill_ids: [skill.id] }),
    p2 = await create({ title: `${marker} two` }),
    p3 = await create({ title: `${marker} three` })
  const first = await send('get', `/api/projects?search=${marker}&limit=1`)
  assert.equal(first.body.items.length, 1)
  assert.ok(first.body.hasMore)
  const second = await send(
    'get',
    `/api/projects?search=${marker}&limit=1&cursor=${first.body.nextCursor}`,
  )
  assert.notEqual(first.body.items[0].id, second.body.items[0].id)
  const third = await send(
    'get',
    `/api/projects?search=${marker}&limit=1&cursor=${second.body.nextCursor}`,
  )
  assert.deepEqual(
    new Set([first.body.items[0].id, second.body.items[0].id, third.body.items[0].id]),
    new Set([p1.id, p2.id, p3.id]),
  )
  assert.equal(third.body.hasMore, false)
  assert.equal(
    (await send('get', `/api/projects?search=changed&limit=1&cursor=${first.body.nextCursor}`))
      .status,
    400,
  )
  const bySkill = await send('get', `/api/projects?search=${encodeURIComponent(skill.name)}`)
  assert.ok(bySkill.body.items.some((p) => p.id === p1.id))
  assert.equal((await send('get', '/api/projects?search=%25')).body.items.length, 0)
})
test('RLS and transaction-local identity survive reuse and rollback', async () => {
  const p = await create(),
    a = await apply(p)
  await transaction(env.pool, alice.id, async (c) =>
    assert.equal(
      (await c.query('SELECT count(*)::int n FROM public.applications WHERE id=$1', [a.id])).rows[0]
        .n,
      1,
    ),
  )
  await assert.rejects(
    transaction(env.pool, alice.id, async () => {
      throw new Error('rollback')
    }),
  )
  await transaction(env.pool, null, async (c) => {
    assert.equal((await c.query('SELECT private.actor_id() id')).rows[0].id, null)
    assert.equal((await c.query('SELECT count(*)::int n FROM public.applications')).rows[0].n, 0)
  })
  const publicClient = env.supabase
  for (const table of [
    'users',
    'projects',
    'applications',
    'messages',
    'reviews',
    'project_members',
    'skills',
  ]) {
    const { error } = await publicClient.from(table).select('*').limit(1)
    assert.ok(error, `${table} should not be readable directly`)
  }
  await transaction(env.pool, outsider.id, async (c) => {
    assert.equal(
      (
        await c.query('UPDATE public.projects SET title=$1 WHERE id=$2 RETURNING id', [
          'Hijacked',
          p.id,
        ])
      ).rowCount,
      0,
    )
  })
  await assert.rejects(
    transaction(env.pool, outsider.id, (c) =>
      c.query('DELETE FROM public.project_members WHERE project_id=$1', [p.id]),
    ),
  )
})

test('database rejects duplicate/self applications and tampering independently of HTTP validation', async () => {
  const p = await create(),
    a = await apply(p)
  await assert.rejects(
    transaction(env.pool, alice.id, (c) =>
      c.query('INSERT INTO public.applications(project_id,applicant_id,message) VALUES($1,$2,$3)', [
        p.id,
        alice.id,
        'Duplicate through SQL',
      ]),
    ),
    { code: '23505' },
  )
  await assert.rejects(
    transaction(env.pool, owner.id, (c) =>
      c.query('INSERT INTO public.applications(project_id,applicant_id,message) VALUES($1,$2,$3)', [
        p.id,
        owner.id,
        'Self through SQL',
      ]),
    ),
    { code: 'P0001' },
  )
  await assert.rejects(
    transaction(env.pool, owner.id, (c) =>
      c.query(
        "INSERT INTO public.project_members(project_id,user_id,role,application_id) VALUES($1,$2,'collaborator',$3)",
        [p.id, alice.id, a.id],
      ),
    ),
    { code: 'P0001' },
  )
  assert.equal((await decide(a)).status, 200)
  await assert.rejects(
    transaction(env.pool, owner.id, (c) =>
      c.query("UPDATE public.applications SET status='rejected' WHERE id=$1", [a.id]),
    ),
    { code: 'P0001' },
  )
  const direct = await fetch(`${process.env.SUPABASE_URL}/rest/v1/applications?select=id`, {
    headers: {
      apikey: process.env.SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${alice.token}`,
    },
  })
  assert.ok(
    [401, 403].includes(direct.status),
    'signed-in users cannot bypass Express through REST',
  )
  const invalid = await request(env.app)
    .get('/api/applications/me')
    .set('Authorization', 'Bearer invalid-token')
  assert.equal(invalid.status, 401)
  assert.equal(invalid.headers['cache-control'], 'no-store')
})
