import { fail } from '../lib/errors.js'
export const projectColumns = `p.id,p.title,p.description,p.type,p.owner_id,p.experience_level,p.industry,p.is_remote,p.location,p.status,p.max_members,p.version,p.created_at,p.updated_at,p.started_at,p.completed_at,p.closed_at`
export const projectSelect = `SELECT ${projectColumns},u.name AS owner_name,
 (SELECT count(*)::int FROM public.project_members m WHERE m.project_id=p.id) AS member_count,
 COALESCE((SELECT jsonb_agg(jsonb_build_object('id',s.id,'name',s.name) ORDER BY s.name) FROM public.project_skills ps JOIN public.skills s ON s.id=ps.skill_id WHERE ps.project_id=p.id),'[]'::jsonb) AS skills,
 (SELECT jsonb_build_object('id',a.id,'status',a.status,'decision_reason',a.decision_reason) FROM public.applications a WHERE a.project_id=p.id AND a.applicant_id=private.actor_id()) AS my_application
 FROM public.projects p JOIN public.users u ON u.id=p.owner_id`
export async function lockProject(client, id, ownerId) {
  await client.query('SELECT private.lock_project($1)', [id])
  const {
    rows: [project],
  } = await client.query(
    'SELECT id,owner_id,status,max_members,version FROM public.projects WHERE id=$1',
    [id],
  )
  if (!project) fail(404, 'NOT_FOUND', 'Project not found.')
  if (ownerId && project.owner_id !== ownerId)
    fail(403, 'FORBIDDEN', 'Only the project owner can do this.')
  return project
}
export async function projectDetail(client, id) {
  const {
    rows: [project],
  } = await client.query(`${projectSelect} WHERE p.id=$1`, [id])
  if (!project) fail(404, 'NOT_FOUND', 'Project not found.')
  const { rows: members } = await client.query(
    `SELECT m.user_id,m.role,u.name,u.bio,u.github_url,u.linkedin_url FROM public.project_members m JOIN public.users u ON u.id=m.user_id WHERE m.project_id=$1 ORDER BY m.role DESC,m.created_at,m.user_id`,
    [id],
  )
  return { ...project, members, remaining_places: project.max_members - project.member_count }
}
export async function checkSkills(client, ids) {
  const {
    rows: [r],
  } = await client.query(
    'SELECT count(*)::int AS count FROM public.skills WHERE id=ANY($1::uuid[])',
    [ids],
  )
  if (r.count !== ids.length) fail(400, 'INVALID_SKILL', 'Choose skills from the catalog.')
}
export async function setProjectSkills(client, projectId, ids) {
  await checkSkills(client, ids)
  await client.query('DELETE FROM public.project_skills WHERE project_id=$1', [projectId])
  await client.query(
    'INSERT INTO public.project_skills(project_id,skill_id) SELECT $1,unnest($2::uuid[])',
    [projectId, ids],
  )
}
export function checkVersion(project, version) {
  if (project.version !== version)
    fail(409, 'STALE_VERSION', 'This project changed. Reload before saving.')
}
