import { Router } from 'express'
import { z } from 'zod'
import { transaction } from '../db/index.js'
import { parse, fail } from '../lib/errors.js'
import { pagination, page, cursorTimestamp } from '../lib/pagination.js'
import { lockProject } from '../services/projects.js'
import {
  uuid,
  applicationSchema,
  decisionSchema,
  APPLICATION_STATUSES,
} from '../../shared/validation.js'
const filtersSchema = z.strictObject({
  status: z.enum([...APPLICATION_STATUSES, 'all']).default('all'),
  limit: z.string().optional(),
  cursor: z.string().optional(),
})
const fields = `a.id,a.project_id,a.applicant_id,a.message,a.status,a.created_at,a.updated_at,a.decided_at,a.decided_by,a.decision_reason`
export async function listApplications(pool, req, projectId) {
  const q = parse(filtersSchema, req.query),
    paging = pagination(q, { projectId: projectId || null, user: req.user.id, status: q.status })
  return transaction(pool, req.user.id, async (c) => {
    if (projectId) {
      const {
        rows: [p],
      } = await c.query('SELECT owner_id FROM public.projects WHERE id=$1', [projectId])
      if (!p) fail(404, 'NOT_FOUND', 'Project not found.')
      if (p.owner_id !== req.user.id)
        fail(403, 'FORBIDDEN', 'Only the project owner can review applications.')
    }
    const { rows } = await c.query(
      `SELECT ${fields},${cursorTimestamp('a')},p.title AS project_title,p.status AS project_status,
      jsonb_build_object('id',u.id,'name',u.name,'bio',u.bio,'github_url',u.github_url,'linkedin_url',u.linkedin_url,
        'skills',COALESCE((SELECT jsonb_agg(s.name ORDER BY s.name) FROM public.user_skills us JOIN public.skills s ON s.id=us.skill_id WHERE us.user_id=u.id),'[]'::jsonb)) AS applicant
      FROM public.applications a JOIN public.projects p ON p.id=a.project_id JOIN public.users u ON u.id=a.applicant_id
      WHERE ($1::uuid IS NULL OR a.project_id=$1) AND ($1::uuid IS NOT NULL OR a.applicant_id=$2)
      AND ($3::text='all' OR a.status=$3) AND ($4::timestamptz IS NULL OR (a.created_at,a.id)<($4,$5::uuid))
      ORDER BY a.created_at DESC,a.id DESC LIMIT $6`,
      [
        projectId || null,
        req.user.id,
        q.status,
        paging.cursor?.at || null,
        paging.cursor?.id || null,
        paging.limit + 1,
      ],
    )
    return page(rows, paging)
  })
}
export default function applicationsRouter({ pool, auth, writeLimiter }) {
  const router = Router()
  router.use(auth)
  router.get('/me', async (req, res) => res.json(await listApplications(pool, req)))
  // Transitional endpoint retains exactly the same owner authorization.
  router.get('/project/:project_id', async (req, res) =>
    res.json(await listApplications(pool, req, parse(uuid, req.params.project_id))),
  )
  router.post('/', writeLimiter, async (req, res) => {
    const d = parse(applicationSchema, req.body)
    const result = await transaction(pool, req.user.id, async (c) => {
      const p = await lockProject(c, d.project_id)
      if (p.owner_id === req.user.id) fail(409, 'SELF_APPLICATION', 'You already own this project.')
      const {
        rows: [existing],
      } = await c.query(
        'SELECT id FROM public.applications WHERE project_id=$1 AND applicant_id=$2',
        [p.id, req.user.id],
      )
      if (existing) fail(409, 'ALREADY_APPLIED', 'You have already applied to this project.')
      if (p.status !== 'open')
        fail(409, 'RECRUITMENT_CLOSED', 'This project is no longer recruiting.')
      const {
        rows: [count],
      } = await c.query(
        'SELECT count(*)::int AS count FROM public.project_members WHERE project_id=$1',
        [p.id],
      )
      if (count.count >= p.max_members) fail(409, 'PROJECT_FULL', 'This team is full.')
      const {
        rows: [a],
      } = await c.query(
        `INSERT INTO public.applications(project_id,applicant_id,message) VALUES($1,$2,$3) RETURNING *`,
        [p.id, req.user.id, d.message],
      )
      return a
    })
    res.status(201).json(result)
  })
  router.patch('/:id/decision', writeLimiter, async (req, res) => {
    const id = parse(uuid, req.params.id),
      d = parse(decisionSchema, req.body)
    const result = await transaction(pool, req.user.id, async (c) => {
      const {
        rows: [lookup],
      } = await c.query('SELECT project_id FROM public.applications WHERE id=$1', [id])
      if (!lookup) fail(404, 'NOT_FOUND', 'Application not found.')
      const p = await lockProject(c, lookup.project_id, req.user.id)
      const {
        rows: [a],
      } = await c.query('SELECT * FROM public.applications WHERE id=$1 FOR UPDATE', [id])
      if (a.status === d.status) return a
      if (a.status !== 'pending')
        fail(409, 'DECISION_FINAL', 'This application has a final outcome.')
      if (p.status !== 'open')
        fail(409, 'RECRUITMENT_CLOSED', 'This project is no longer recruiting.')
      if (d.status === 'accepted') {
        const {
          rows: [n],
        } = await c.query(
          'SELECT count(*)::int AS count FROM public.project_members WHERE project_id=$1',
          [p.id],
        )
        if (n.count >= p.max_members) fail(409, 'PROJECT_FULL', 'This team is full.')
      }
      const {
        rows: [updated],
      } = await c.query('UPDATE public.applications SET status=$1 WHERE id=$2 RETURNING *', [
        d.status,
        id,
      ])
      return updated
    })
    res.json(result)
  })
  return router
}
