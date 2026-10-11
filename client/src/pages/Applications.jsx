import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useResource } from '../hooks/useResource'
import { api } from '../lib/api'
import { APPLICATION_STATUSES } from '../../../shared/validation'
import { Confirm, ErrorNotice, Loading, Status } from '../components/UI'
export default function Applications({ user }) {
  const { id } = useParams(),
    [params, setParams] = useSearchParams()
  const path = id ? `/api/projects/${id}/applications` : '/api/applications/me'
  const { data, loading, error, reload } = useResource(`${path}?${params}`, user.id)
  const [decision, setDecision] = useState(null),
    [busy, setBusy] = useState(false),
    [mutationError, setMutationError] = useState(null)
  async function decide() {
    setBusy(true)
    setMutationError(null)
    try {
      await api(`/api/applications/${decision.id}/decision`, {
        method: 'PATCH',
        body: { status: decision.status },
      })
      setDecision(null)
      reload()
    } catch (error) {
      setMutationError(error)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section>
      <div className="actions spread">
        <h1>{id ? 'Review applications' : 'My applications'}</h1>
        {id && <Link to={`/projects/${id}`}>Back to project</Link>}
      </div>
      <label className="compact">
        Status
        <select
          value={params.get('status') || 'all'}
          onChange={(e) => setParams(e.target.value === 'all' ? {} : { status: e.target.value })}
        >
          <option value="all">All applications</option>
          {APPLICATION_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <ErrorNotice error={error} retry={reload} />
      {loading ? (
        <Loading />
      ) : (
        data && (
          <>
            {!data.items.length && <p className="empty">No applications here yet.</p>}
            <div className="stack">
              {data.items.map((a) => (
                <article className="card" key={a.id}>
                  <div className="actions spread">
                    <h2>
                      {id ? (
                        a.applicant.name
                      ) : (
                        <Link to={`/projects/${a.project_id}`}>{a.project_title}</Link>
                      )}
                    </h2>
                    <Status value={a.status} />
                  </div>
                  {id && (
                    <>
                      <p>{a.applicant.bio}</p>
                      <div className="skills">
                        {a.applicant.skills.map((s) => (
                          <span className="badge" key={s}>
                            {s}
                          </span>
                        ))}
                      </div>
                      <div className="actions">
                        {a.applicant.github_url && (
                          <a
                            href={a.applicant.github_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            GitHub
                          </a>
                        )}
                        {a.applicant.linkedin_url && (
                          <a
                            href={a.applicant.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            LinkedIn
                          </a>
                        )}
                      </div>
                    </>
                  )}
                  <p className="description">{a.message}</p>
                  <p className="muted">
                    Applied {new Date(a.created_at).toLocaleDateString()}
                    {a.decided_at && ` · Finalized ${new Date(a.decided_at).toLocaleDateString()}`}
                  </p>
                  {a.status === 'closed' && <p>Recruitment ended before a decision was made.</p>}
                  {id && a.status === 'pending' && a.project_status === 'open' && (
                    <div className="actions">
                      <button
                        className="primary"
                        onClick={() => setDecision({ id: a.id, status: 'accepted' })}
                      >
                        Accept
                      </button>
                      <button onClick={() => setDecision({ id: a.id, status: 'rejected' })}>
                        Reject
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
            <div className="pagination">
              {params.has('cursor') && (
                <button
                  onClick={() => {
                    const p = new URLSearchParams(params)
                    p.delete('cursor')
                    setParams(p)
                  }}
                >
                  First page
                </button>
              )}
              {data.hasMore && (
                <button
                  onClick={() => {
                    const p = new URLSearchParams(params)
                    p.set('cursor', data.nextCursor)
                    setParams(p)
                  }}
                >
                  Next page
                </button>
              )}
            </div>
          </>
        )
      )}
      {decision && (
        <Confirm
          title={`${decision.status === 'accepted' ? 'Accept' : 'Reject'} this application?`}
          busy={busy}
          onClose={() => {
            setDecision(null)
            setMutationError(null)
          }}
          onConfirm={decide}
        >
          <p>This decision is final.</p>
          <ErrorNotice error={mutationError} />
        </Confirm>
      )}
    </section>
  )
}
