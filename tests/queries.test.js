import { test } from 'node:test'
import assert from 'node:assert/strict'
import { environment } from './helpers.js'
import { transaction } from '../server/db/index.js'
import { projectSelect } from '../server/services/projects.js'
function nodes(plan) {
  return [plan, ...(plan.Plans || []).flatMap(nodes)]
}
test('indexed feed, search and review queries with representative data', async () => {
  const env = await environment(),
    owner = await env.user('query-owner'),
    applicant = await env.user('query-applicant'),
    c = await env.admin.connect()
  try {
    await c.query('BEGIN')
    await c.query("SELECT set_config('request.jwt.claims',$1,true)", [
      JSON.stringify({ sub: owner.id }),
    ])
    await c.query(
      `INSERT INTO public.projects(title,description,owner_id,type,experience_level,is_remote,location,max_members,created_at)
   SELECT CASE WHEN n<=5 THEN 'RareNeedle '||n ELSE 'Project '||n END,'Representative project description', $1,'passion','any',true,'',3,now()-(n*interval '1 second') FROM generate_series(1,2500) n`,
      [owner.id],
    )
    await c.query("SELECT set_config('request.jwt.claims',$1,true)", [
      JSON.stringify({ sub: applicant.id }),
    ])
    await c.query(
      "INSERT INTO public.applications(project_id,applicant_id,message) SELECT id,$1,'I can help with this project' FROM public.projects WHERE owner_id=$2",
      [applicant.id, owner.id],
    )
    const {
      rows: [reviewProject],
    } = await c.query('SELECT id FROM public.projects WHERE owner_id=$1 LIMIT 1', [owner.id])
    await c.query("SELECT set_config('request.jwt.claims',$1,true)", [
      JSON.stringify({ sub: owner.id }),
    ])
    await c.query(
      'ANALYZE public.projects; ANALYZE public.project_members; ANALYZE public.applications',
    )
    await c.query('COMMIT')
    await transaction(env.pool, owner.id, async (c) => {
      for (const [name, sql, values] of [
        [
          'feed',
          `${projectSelect} WHERE p.status='open' ORDER BY p.created_at DESC,p.id DESC LIMIT 21`,
          [],
        ],
        [
          'search',
          'SELECT id FROM public.projects WHERE title ILIKE $1 LIMIT 21',
          ['%RareNeedle%'],
        ],
        [
          'review',
          'SELECT id FROM public.applications WHERE project_id=$1 ORDER BY created_at DESC,id DESC LIMIT 21',
          [reviewProject.id],
        ],
        [
          'owner',
          `${projectSelect} WHERE p.owner_id=$1 ORDER BY p.created_at DESC,p.id DESC LIMIT 21`,
          [owner.id],
        ],
      ]) {
        const { rows } = await c.query(`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) ${sql}`, values)
        const result = rows[0]['QUERY PLAN'][0],
          indexes = nodes(result.Plan)
            .map((n) => n['Index Name'])
            .filter(Boolean)
        assert.ok(result.Plan['Actual Rows'] <= 21)
        if (name !== 'search') assert.ok(indexes.length > 0, `${name} should use an index`)
        else
          assert.equal(
            result.Plan['Actual Rows'],
            5,
            'substring search returns exactly the matching projects',
          )
        console.log(
          `${name}: ${result['Execution Time']} ms; indexes: ${[...new Set(indexes)].join(', ') || 'planner chose a sequential scan for this small fixture'}`,
        )
      }
    })
  } finally {
    await c.query('ROLLBACK')
    c.release()
    await env.close()
  }
})
