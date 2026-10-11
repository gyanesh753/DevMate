import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../Supabase'
import { useState } from 'react'
import { ErrorNotice } from './UI'
export default function Navbar({ user }) {
  const navigate = useNavigate(),
    [params] = useSearchParams(),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false)
  async function signOut() {
    setBusy(true)
    setError(null)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      navigate('/')
    } catch (error) {
      setError(error)
    } finally {
      setBusy(false)
    }
  }
  return (
    <header className="site-header">
      <nav className="nav">
        <Link to="/" className="brand">
          DevMate<span>Find your team. Build together.</span>
        </Link>
        <form
          key={params.get('search') || ''}
          className="nav-search"
          role="search"
          onSubmit={(e) => {
            e.preventDefault()
            const search = new FormData(e.currentTarget).get('search').trim()
            navigate(search ? `/?search=${encodeURIComponent(search)}` : '/')
          }}
        >
          <input
            name="search"
            aria-label="Search projects"
            defaultValue={params.get('search') || ''}
            placeholder="Search projects or skills"
            maxLength={200}
          />
          <button>Search</button>
        </form>
        <div className="actions">
          {user ? (
            <>
              <Link to="/applications">My applications</Link>
              <Link to="/profile">Profile</Link>
              <Link className="button primary" to="/projects/new">
                Post a project
              </Link>
              <button onClick={signOut} disabled={busy}>
                {busy ? 'Signing out…' : 'Sign out'}
              </button>
            </>
          ) : (
            <>
              <Link to="/auth">Sign in</Link>
              <Link className="button primary" to="/projects/new">
                Post a project
              </Link>
            </>
          )}
        </div>
      </nav>
      <ErrorNotice error={error} />
    </header>
  )
}
