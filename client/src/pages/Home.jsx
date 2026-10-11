import { useSearchParams } from 'react-router-dom'
import { useResource } from '../hooks/useResource'
import ProjectCard from '../components/ProjectCard'
import { ErrorNotice, Loading, Pagination } from '../components/UI'
import { TYPES, LEVELS } from '../../../shared/validation'
export default function Home({ user }) {
  const [params, setParams] = useSearchParams()
  const { data, loading, error, reload } = useResource(`/api/projects?${params}`, user?.id)
  function change(key, value) {
    const p = new URLSearchParams(params)
    value ? p.set(key, value) : p.delete(key)
    p.delete('cursor')
    setParams(p)
  }
  return (
    <>
      <section className="hero">
        <p className="eyebrow">MAKE SOMETHING TOGETHER</p>
        <h1>
          Find your next
          <br />
          <span>collaboration.</span>
        </h1>
        <p>Connect with developers, designers, and creators. Find an idea worth building.</p>
        <form
          className="search-form"
          key={params.get('search') || ''}
          onSubmit={(e) => {
            e.preventDefault()
            change('search', new FormData(e.currentTarget).get('search').trim())
          }}
        >
          <input
            name="search"
            aria-label="Search by title, description or skill"
            maxLength={200}
            defaultValue={params.get('search') || ''}
            placeholder="Search by title, description or skill"
          />
          <button className="primary">Search</button>
          <button type="button" onClick={() => setParams({})}>
            Clear
          </button>
        </form>
      </section>
      <div className="filters">
        <label>
          Project type
          <select
            value={params.get('type') || 'all'}
            onChange={(e) => change('type', e.target.value)}
          >
            <option value="all">All types</option>
            {TYPES.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Experience
          <select
            value={params.get('experience_level') || 'any'}
            onChange={(e) => change('experience_level', e.target.value)}
          >
            {LEVELS.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Location
          <select
            value={params.get('is_remote') || ''}
            onChange={(e) => change('is_remote', e.target.value)}
          >
            <option value="">Anywhere</option>
            <option value="true">Remote</option>
            <option value="false">In person</option>
          </select>
        </label>
      </div>
      <ErrorNotice error={error} retry={reload} />
      {loading ? (
        <Loading />
      ) : (
        data && (
          <>
            <p className="muted">{data.items.length} projects loaded</p>
            {data.items.length ? (
              <div className="project-grid">
                {data.items.map((p) => (
                  <ProjectCard key={p.id} project={p} user={user} />
                ))}
              </div>
            ) : (
              <div className="empty">
                No projects found. Try another search or change your filters.
              </div>
            )}
            <Pagination
              previous={params.has('cursor') ? () => change('cursor', '') : null}
              next={
                data.hasMore
                  ? () => {
                      const p = new URLSearchParams(params)
                      p.set('cursor', data.nextCursor)
                      setParams(p)
                    }
                  : null
              }
            />
          </>
        )
      )}
    </>
  )
}
