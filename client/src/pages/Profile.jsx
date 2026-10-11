import { useState } from 'react'
import { useResource } from '../hooks/useResource'
import { api } from '../lib/api'
import { ErrorNotice, Loading, SkillPicker } from '../components/UI'
import ProjectCard from '../components/ProjectCard'
import { profileSchema } from '../../../shared/validation'
function ProfileForm({ profile, catalog, onSave }) {
  const [form, setForm] = useState({
    name: profile.name,
    bio: profile.bio || '',
    location: profile.location || '',
    github_url: profile.github_url || '',
    linkedin_url: profile.linkedin_url || '',
    skill_ids: profile.skills.map((s) => s.id),
  })
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(null)
  async function save(e) {
    e.preventDefault()
    setError(null)
    const parsed = profileSchema.safeParse(form)
    if (!parsed.success) {
      setError(
        new Error(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('. ')),
      )
      return
    }
    setBusy(true)
    try {
      await api(`/api/users/${profile.id}`, { method: 'PUT', body: parsed.data })
      onSave()
    } catch (error) {
      setError(error)
    } finally {
      setBusy(false)
    }
  }
  const change = (field, value) => setForm((f) => ({ ...f, [field]: value }))
  return (
    <form onSubmit={save}>
      <label>
        Name
        <input
          required
          maxLength={80}
          value={form.name}
          onChange={(e) => change('name', e.target.value)}
        />
      </label>
      <label>
        Bio
        <textarea
          maxLength={2000}
          value={form.bio}
          onChange={(e) => change('bio', e.target.value)}
        />
      </label>
      <label>
        Location
        <input
          maxLength={120}
          value={form.location}
          onChange={(e) => change('location', e.target.value)}
        />
      </label>
      <label>
        GitHub URL
        <input
          type="url"
          maxLength={2048}
          value={form.github_url}
          onChange={(e) => change('github_url', e.target.value)}
        />
      </label>
      <label>
        LinkedIn URL
        <input
          type="url"
          maxLength={2048}
          value={form.linkedin_url}
          onChange={(e) => change('linkedin_url', e.target.value)}
        />
      </label>
      <SkillPicker
        catalog={catalog}
        selected={form.skill_ids}
        onChange={(ids) => change('skill_ids', ids)}
      />
      <ErrorNotice error={error} />
      <button className="primary" disabled={busy}>
        {busy ? 'Saving…' : 'Save profile'}
      </button>
    </form>
  )
}
export default function Profile({ user }) {
  const profile = useResource(`/api/users/${user.id}`, user.id),
    catalog = useResource('/api/skills')
  const [cursor, setCursor] = useState(''),
    [editing, setEditing] = useState(false),
    [notice, setNotice] = useState('')
  const projects = useResource(
    `/api/projects?owner_id=${user.id}&status=all${cursor ? `&cursor=${cursor}` : ''}`,
    user.id,
  )
  return (
    <>
      <section className="card editor">
        <div className="actions spread">
          <h1>Your profile</h1>
          <button
            onClick={() => {
              setEditing(!editing)
              setNotice('')
            }}
          >
            {editing ? 'Cancel editing' : 'Edit profile'}
          </button>
        </div>
        <ErrorNotice
          error={profile.error || catalog.error}
          retry={() => {
            profile.reload()
            catalog.reload()
          }}
        />
        {profile.loading || catalog.loading ? (
          <Loading />
        ) : (
          profile.data &&
          catalog.data &&
          (editing ? (
            <ProfileForm
              profile={profile.data}
              catalog={catalog.data}
              onSave={() => {
                setEditing(false)
                setNotice('Profile saved.')
                profile.reload()
              }}
            />
          ) : (
            <>
              <h2>{profile.data.name}</h2>
              <p className="muted">{user.email}</p>
              <p className="description">{profile.data.bio}</p>
              <p>{profile.data.location}</p>
              <div className="actions">
                {profile.data.github_url && (
                  <a href={profile.data.github_url} target="_blank" rel="noopener noreferrer">
                    GitHub
                  </a>
                )}
                {profile.data.linkedin_url && (
                  <a href={profile.data.linkedin_url} target="_blank" rel="noopener noreferrer">
                    LinkedIn
                  </a>
                )}
              </div>
              <div className="skills">
                {profile.data.skills.map((s) => (
                  <span className="badge" key={s.id}>
                    {s.name}
                  </span>
                ))}
              </div>
            </>
          ))
        )}
        {notice && <p role="status">{notice}</p>}
      </section>
      <h2>Your projects</h2>
      <ErrorNotice error={projects.error} retry={projects.reload} />
      {projects.loading ? (
        <Loading />
      ) : (
        projects.data && (
          <>
            <div className="project-grid">
              {projects.data.items.map((p) => (
                <ProjectCard key={p.id} project={p} user={user} />
              ))}
            </div>
            {!projects.data.items.length && (
              <p className="empty">You haven’t posted any projects yet.</p>
            )}
            <div className="pagination">
              {cursor && <button onClick={() => setCursor('')}>First page</button>}
              {projects.data.hasMore && (
                <button onClick={() => setCursor(projects.data.nextCursor)}>Next page</button>
              )}
            </div>
          </>
        )
      )}
    </>
  )
}
