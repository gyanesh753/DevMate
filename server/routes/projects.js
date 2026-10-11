import { Router } from 'express'
import { z } from 'zod'
import { transaction } from '../db/index.js'
import { parse, fail } from '../lib/errors.js'
import { pagination, page, cursorTimestamp } from '../lib/pagination.js'
import {
  projectSelect,
  projectDetail,
  lockProject,
  setProjectSkills,
  checkVersion,
} from '../services/projects.js'
import {
  uuid,
  TYPES,
  LEVELS,
  STATUSES,
  projectSchema,
  projectEditSchema,
  statusSchema,
} from '../../shared/validation.js'
const listSchema = z.strictObject({
  search: z.string().trim().max(200).optional(),
  type: z.enum([...TYPES, 'all']).optional(),
  experience_level: z.enum(LEVELS).optional(),
  is_remote: z.enum(['true', 'false', '']).optional(),
  owner_id: uuid.optional(),
  status: z.enum([...STATUSES, 'all']).default('open'),
  limit: z.string().optional(),
  cursor: z.string().optional(),
})
export default function projectsRouter({ pool, auth, optionalAuth, writeLimiter }) {
  const router = Router()
  router.get('/', optionalAuth, async (req, res) => {
    const q = parse(listSchema, req.query)
    const filters = {
      search: q.search || '',
      type: q.type || 'all',
      experience_level: q.experience_level || 'any',
      is_remote: q.is_remote || '',
      owner_id: q.owner_id || null,
      status: q.status,
      user: req.user?.id || null,
    }
    const paging = pagination(q, filters)
    const search = filters.search ? `%${filters.search.replace(/[\\%_]/g, '\\$&')}%` : null
    const result = await transaction(pool, req.user?.id, async (c) => {
      const { rows } = await c.query(
        `${projectSelect.replace(' FROM public.projects p JOIN', `,${cursorTimestamp('p')} FROM public.projects p JOIN`)}
       WHERE ($1::text IS NULL OR p.title ILIKE $1 OR p.description ILIKE $1 OR EXISTS(SELECT 1 FROM public.project_skills ps JOIN public.skills s ON s.id=ps.skill_id WHERE ps.project_id=p.id AND s.name ILIKE $1))
       AND ($2::text='all' OR p.type=$2) AND ($3::text='any' OR p.experience_level IN ($3,'any'))
       AND ($4::boolean IS NULL OR p.is_remote=$4) AND ($5::uuid IS NULL OR p.owner_id=$5)
       AND ($6::text='all' OR p.status=$6)
       AND ($7::timestamptz IS NULL OR (p.created_at,p.id)<($7,$8::uuid))
       ORDER BY p.created_at DESC,p.id DESC LIMIT $9`,
        [
          search,
          filters.type,
          filters.experience_level,
          filters.is_remote === '' ? null : filters.is_remote === 'true',
          filters.owner_id,
          filters.status,
          paging.cursor?.at || null,
          paging.cursor?.id || null,
          paging.limit + 1,
        ],
      )
      return page(rows, paging)
    })
    res.json(result)
  })
  router.get('/:id', optionalAuth, async (req, res) =>
    res.json(
      await transaction(pool, req.user?.id, (c) => projectDetail(c, parse(uuid, req.params.id))),
    ),
  )
  router.post('/', auth, writeLimiter, async (req, res) => {
    const d = parse(projectSchema, req.body)
    const result = await transaction(pool, req.user.id, async (c) => {
      const {
        rows: [p],
      } = await c.query(
        `INSERT INTO public.projects(title,description,type,owner_id,experience_level,industry,is_remote,location,max_members) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [
          d.title,
          d.description,
          d.type,
          req.user.id,
          d.experience_level,
          d.industry,
          d.is_remote,
          d.location,
          d.max_members,
        ],
      )
      await setProjectSkills(c, p.id, d.skill_ids)
      return projectDetail(c, p.id)
    })
    res.status(201).json(result)
  })
  router.patch('/:id', auth, writeLimiter, async (req, res) => {
    const id = parse(uuid, req.params.id),
      d = parse(projectEditSchema, req.body)
    const result = await transaction(pool, req.user.id, async (c) => {
      const p = await lockProject(c, id, req.user.id)
      checkVersion(p, d.version)
      if (!['open', 'in-progress'].includes(p.status))
        fail(409, 'PROJECT_FINAL', 'This project can no longer be edited.')
      if (p.status !== 'open' && p.max_members !== d.max_members)
        fail(409, 'RECRUITMENT_CLOSED', 'Team capacity can only change while recruiting.')
      await c.query(
        `UPDATE public.projects SET title=$1,description=$2,type=$3,experience_level=$4,industry=$5,is_remote=$6,location=$7,max_members=$8 WHERE id=$9`,
        [
          d.title,
          d.description,
          d.type,
          d.experience_level,
          d.industry,
          d.is_remote,
          d.location,
          d.max_members,
          id,
        ],
      )
      await setProjectSkills(c, id, d.skill_ids)
      return projectDetail(c, id)
    })
    res.json(result)
  })
  router.patch('/:id/status', auth, writeLimiter, async (req, res) => {
    const id = parse(uuid, req.params.id),
      d = parse(statusSchema, req.body)
    const result = await transaction(pool, req.user.id, async (c) => {
      const p = await lockProject(c, id, req.user.id)
      checkVersion(p, d.version)
      const allowed = { open: ['in-progress', 'closed'], 'in-progress': ['completed', 'closed'] }
      if (!allowed[p.status]?.includes(d.status))
        fail(409, 'INVALID_TRANSITION', 'This project status change is not allowed.')
      await c.query('UPDATE public.projects SET status=$1 WHERE id=$2', [d.status, id])
      return projectDetail(c, id)
    })
    res.json(result)
  })
  return router
}
