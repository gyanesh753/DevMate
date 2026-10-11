import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useResource } from '../hooks/useResource'
import { ErrorNotice, Loading, Status, Confirm } from '../components/UI'
export default function ProjectDetail({ user }) {
  const { id } = useParams(),
    [params] = useSearchParams(),
    navigate = useNavigate()
  const { data: project, loading, error, reload } = useResource(`/api/projects/${id}`, user?.id)
  const [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [mutationError, setMutationError] = useState(null),
    [confirmation, setConfirmation] = useState(null)
  async function apply(e) {
    e.preventDefault()
    setBusy(true)
    setMutationError(null)
    try {
      await api('/api/applications', { method: 'POST', body: { project_id: id, message } })
      setMessage('')
      reload()
    } catch (error) {
      setMutationError(error)
      if (error.status === 409) reload()
    } finally {
      setBusy(false)
    }
  }
  async function transition() {
    setBusy(true)
    setMutationError(null)
    try {
      await api(`/api/projects/${id}/status`, {
        method: 'PATCH',
        body: { status: confirmation, version: project.version },
      })
      setConfirmation(null)
      reload()
    } catch (error) {
      setMutationError(error)
    } finally {
      setBusy(false)
    }
  }
  if (loading) return <Loading />
  if (error) return <ErrorNotice error={error} retry={reload} />
  const owned = user?.id === project.owner_id,
    full = project.member_count >= project.max_members
  return (
    <div className="detail">
      <Link to="/">← Browse projects</Link>
      <article className="card">
        <div className="actions spread">
          <span className="eyebrow">{project.type}</span>
          <Status value={project.status} />
        </div>
        <h1>{project.title}</h1>
        <p className="meta">
          {project.is_remote ? 'Remote' : project.location} · {project.experience_level} experience
          · {project.member_count}/{project.max_members} total members
        </p>
        <p className="description">{project.description}</p>
        <div className="skills">
          {project.skills.map((s) => (
            <span className="badge" key={s.id}>
              {s.name}
            </span>
          ))}
        </div>
        {project.industry && <p className="muted">Industry: {project.industry}</p>}
        <h2>Your potential team</h2>
        <ul className="team">
          {project.members.map((m) => (
            <li key={m.user_id}>
              <strong>{m.name}</strong> <span className="muted">{m.role}</span>
              {m.github_url && (
                <a href={m.github_url} target="_blank" rel="noopener noreferrer">
                  GitHub
                </a>
              )}
              {m.linkedin_url && (
                <a href={m.linkedin_url} target="_blank" rel="noopener noreferrer">
                  LinkedIn
                </a>
              )}
            </li>
          ))}
        </ul>
        {owned ? (
          <section>
            <h2>Manage project</h2>
            <div className="actions">
              <Link className="button" to={`/projects/${id}/applications`}>
                Review applications
              </Link>
              {['open', 'in-progress'].includes(project.status) && (
                <Link className="button" to={`/projects/${id}/edit`}>
                  Edit project
                </Link>
              )}
              {project.status === 'open' && (
                <button onClick={() => setConfirmation('in-progress')}>Start project</button>
              )}
              {project.status === 'in-progress' && (
                <button onClick={() => setConfirmation('completed')}>Mark completed</button>
              )}
              {['open', 'in-progress'].includes(project.status) && (
                <button onClick={() => setConfirmation('closed')}>Close project</button>
              )}
            </div>
          </section>
        ) : project.my_application ? (
          <section className="notice" role="status">
            <h2>Your application</h2>
            <Status value={project.my_application.status} />
            <p>
              {project.my_application.status === 'closed'
                ? 'Recruitment ended before a decision was made.'
                : project.my_application.status === 'pending'
                  ? 'The owner will review your application.'
                  : 'The owner has made a final decision.'}
            </p>
            <Link to="/applications">View my applications</Link>
          </section>
        ) : project.status !== 'open' || full ? (
          <p className="notice">
            {full && project.status === 'open'
              ? 'This team is full.'
              : 'This project is no longer recruiting.'}
          </p>
        ) : !user ? (
          <button
            className="primary"
            onClick={() =>
              navigate(`/auth?returnTo=${encodeURIComponent(`/projects/${id}?apply=1`)}`)
            }
          >
            Sign in to apply
          </button>
        ) : (
          <section id="apply">
            <h2>Apply to collaborate</h2>
            <form onSubmit={apply}>
              <label>
                Why would you like to join?
                <textarea
                  autoFocus={params.get('apply') === '1'}
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  minLength={1}
                  maxLength={2000}
                  placeholder="Introduce yourself and tell the owner how you can contribute."
                />
              </label>
              <button className="primary" disabled={busy}>
                {busy ? 'Submitting…' : 'Submit application'}
              </button>
            </form>
          </section>
        )}
        {!confirmation && <ErrorNotice error={mutationError} />}
      </article>
      {confirmation && (
        <Confirm
          title={`Set project to ${confirmation}?`}
          busy={busy}
          onClose={() => {
            setConfirmation(null)
            setMutationError(null)
          }}
          onConfirm={transition}
        >
          <p>
            This change is final. Pending applications will close when recruitment ends. Existing
            decisions and team membership are preserved.
          </p>
          <ErrorNotice error={mutationError} />
        </Confirm>
      )}
    </div>
  )
}
