import { Link } from 'react-router-dom'
import { useEffect, useRef } from 'react'
export function ErrorNotice({ error, retry }) {
  if (!error) return null
  return (
    <div className="notice error" role="alert">
      <p>{error.message || error}</p>
      {error.fieldErrors && (
        <ul>
          {Object.entries(error.fieldErrors).map(([field, message]) => (
            <li key={field}>
              {field}: {message}
            </li>
          ))}
        </ul>
      )}
      {error.status === 401 && (
        <Link to={`/auth?returnTo=${encodeURIComponent(location.pathname + location.search)}`}>
          Sign in again
        </Link>
      )}
      {retry && (
        <button type="button" onClick={retry}>
          Try again
        </button>
      )}
    </div>
  )
}
export function Loading() {
  return (
    <p role="status" className="muted">
      Loading…
    </p>
  )
}
export function Status({ value }) {
  return <span className={`badge status-${value}`}>{value}</span>
}
export function Pagination({ previous, next }) {
  return (
    <nav className="pagination" aria-label="Pagination">
      <button disabled={!previous} onClick={previous}>
        First page
      </button>
      <button disabled={!next} onClick={next}>
        Next
      </button>
    </nav>
  )
}
export function Confirm({ title, children, onConfirm, onClose, busy }) {
  const ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current
    dialog.showModal()
    return () => dialog.close()
  }, [])
  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
      aria-labelledby="confirmation-title"
    >
      <h2 id="confirmation-title">{title}</h2>
      <div>{children}</div>
      <div className="actions">
        <button disabled={busy} onClick={onClose}>
          Cancel
        </button>
        <button className="primary" disabled={busy} onClick={onConfirm}>
          {busy ? 'Saving…' : 'Confirm'}
        </button>
      </div>
    </dialog>
  )
}
export function SkillPicker({ catalog, selected, onChange }) {
  return (
    <fieldset>
      <legend>Skills</legend>
      <div className="skills">
        {catalog.map((skill) => (
          <label className="skill" key={skill.id}>
            <input
              type="checkbox"
              checked={selected.includes(skill.id)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...selected, skill.id]
                    : selected.filter((id) => id !== skill.id),
                )
              }
            />
            {skill.name}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
