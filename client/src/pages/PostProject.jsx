import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useResource } from '../hooks/useResource'
import { ErrorNotice, Loading, SkillPicker } from '../components/UI'
import { TYPES, LEVELS, LIMITS, projectSchema } from '../../../shared/validation'
export function ProjectForm({ project, catalog, onSaved }) {
  const [form, setForm] = useState(
    project
      ? {
          title: project.title,
          description: project.description,
          type: project.type,
          experience_level: project.experience_level,
          industry: project.industry || '',
          location: project.location || '',
          is_remote: project.is_remote,
          max_members: project.max_members,
          skill_ids: project.skills.map((s) => s.id),
        }
      : {
          title: '',
          description: '',
          type: 'passion',
          experience_level: 'any',
          industry: '',
          location: '',
          is_remote: true,
          max_members: 3,
          skill_ids: [],
        },
  )
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(null)
  const change = (key, value) => setForm((f) => ({ ...f, [key]: value }))
  async function submit(e) {
    e.preventDefault()
    setError(null)
    const parsed = projectSchema.safeParse(form)
    if (!parsed.success) {
      setError(
        new Error(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('. ')),
      )
      return
    }
    setBusy(true)
    try {
      const saved = await api(project ? `/api/projects/${project.id}` : '/api/projects', {
        method: project ? 'PATCH' : 'POST',
        body: { ...parsed.data, ...(project ? { version: project.version } : {}) },
      })
      onSaved(saved)
    } catch (error) {
      setError(error)
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit}>
      <label>
        Project title
        <input
          value={form.title}
          onChange={(e) => change('title', e.target.value)}
          required
          maxLength={LIMITS.title}
        />
      </label>
      <label>
        Description
        <textarea
          value={form.description}
          onChange={(e) => change('description', e.target.value)}
          required
          maxLength={LIMITS.description}
          rows={6}
        />
      </label>
      <div className="form-grid">
        <label>
          Project type
          <select value={form.type} onChange={(e) => change('type', e.target.value)}>
            {TYPES.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Experience level
          <select
            value={form.experience_level}
            onChange={(e) => change('experience_level', e.target.value)}
          >
            {LEVELS.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
      </div>
      <SkillPicker
        catalog={catalog}
        selected={form.skill_ids}
        onChange={(ids) => change('skill_ids', ids)}
      />
      <label>
        Industry
        <input
          value={form.industry}
          onChange={(e) => change('industry', e.target.value)}
          maxLength={120}
        />
      </label>
      <div className="form-grid">
        <label>
          Work arrangement
          <select
            value={String(form.is_remote)}
            onChange={(e) => change('is_remote', e.target.value === 'true')}
          >
            <option value="true">Remote</option>
            <option value="false">In person</option>
          </select>
        </label>
        <label>
          Total team capacity (including you)
          <input
            type="number"
            min={2}
            max={20}
            required
            disabled={project && project.status !== 'open'}
            value={Number.isNaN(form.max_members) ? '' : form.max_members}
            onChange={(e) => change('max_members', e.target.valueAsNumber)}
          />
        </label>
      </div>
      {!form.is_remote && (
        <label>
          Location
          <input
            required
            value={form.location}
            onChange={(e) => change('location', e.target.value)}
            maxLength={LIMITS.location}
          />
        </label>
      )}
      <ErrorNotice error={error} />
      <button className="primary" disabled={busy}>
        {busy ? 'Saving…' : project ? 'Save changes' : 'Post project'}
      </button>
    </form>
  )
}
export default function PostProject({ user }) {
  const { id } = useParams(),
    navigate = useNavigate()
  const catalog = useResource('/api/skills'),
    project = useResource(id ? `/api/projects/${id}` : null, user.id)
  if (catalog.loading || project.loading) return <Loading />
  if (catalog.error || project.error)
    return (
      <ErrorNotice
        error={catalog.error || project.error}
        retry={() => {
          catalog.reload()
          project.reload()
        }}
      />
    )
  if (
    id &&
    (project.data.owner_id !== user.id || !['open', 'in-progress'].includes(project.data.status))
  )
    return <ErrorNotice error="You cannot edit this project." />
  return (
    <section className="card editor">
      <h1>{id ? 'Edit project' : 'Post a project'}</h1>
      <p className="muted">Tell your future teammates what you want to build.</p>
      <ProjectForm
        key={id || 'new'}
        project={project.data}
        catalog={catalog.data}
        onSaved={(p) => navigate(`/projects/${p.id}`)}
      />
    </section>
  )
}
