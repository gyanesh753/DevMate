import { Router } from 'express'
import { transaction } from '../db/index.js'
import { parse, fail } from '../lib/errors.js'
import { profileSchema, uuid } from '../../shared/validation.js'
import { checkSkills } from '../services/projects.js'
async function profile(c, id) {
  const {
    rows: [user],
  } = await c.query(
    `SELECT u.id,u.name,u.bio,u.location,u.github_url,u.linkedin_url,u.updated_at,
   COALESCE((SELECT jsonb_agg(jsonb_build_object('id',s.id,'name',s.name) ORDER BY s.name) FROM public.user_skills us JOIN public.skills s ON s.id=us.skill_id WHERE us.user_id=u.id),'[]'::jsonb) AS skills FROM public.users u WHERE id=$1`,
    [id],
  )
  if (!user) fail(404, 'NOT_FOUND', 'Profile not found.')
  return user
}
export default function usersRouter({ pool, auth, writeLimiter }) {
  const router = Router()
  router.use(auth)
  router.use('/:id', (req, res, next) => {
    if (parse(uuid, req.params.id) !== req.user.id)
      fail(403, 'FORBIDDEN', 'You can only manage your own profile.')
    next()
  })
  router.get('/:id', async (req, res) =>
    res.json(await transaction(pool, req.user.id, (c) => profile(c, req.user.id))),
  )
  router.put('/:id', writeLimiter, async (req, res) => {
    const d = parse(profileSchema, req.body)
    res.json(
      await transaction(pool, req.user.id, async (c) => {
        await checkSkills(c, d.skill_ids)
        await c.query(
          'UPDATE public.users SET name=$1,bio=$2,location=$3,github_url=$4,linkedin_url=$5 WHERE id=$6',
          [d.name, d.bio, d.location, d.github_url, d.linkedin_url, req.user.id],
        )
        await c.query('DELETE FROM public.user_skills WHERE user_id=$1', [req.user.id])
        await c.query(
          'INSERT INTO public.user_skills(user_id,skill_id) SELECT $1,unnest($2::uuid[])',
          [req.user.id, d.skill_ids],
        )
        return profile(c, req.user.id)
      }),
    )
  })
  return router
}
