import { lazy, Suspense, useEffect, useState } from 'react'
import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom'
import { supabase, configurationError } from './Supabase'
import Navbar from './components/Navbar'
import { ErrorNotice, Loading } from './components/UI'
const Home = lazy(() => import('./pages/Home'))
const Auth = lazy(() => import('./pages/Auth'))
const PostProject = lazy(() => import('./pages/PostProject'))
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'))
const Profile = lazy(() => import('./pages/Profile'))
const Applications = lazy(() => import('./pages/Applications'))
function Protected({ user, children }) {
  const location = useLocation()
  return user ? (
    children
  ) : (
    <Navigate
      to={`/auth?returnTo=${encodeURIComponent(location.pathname + location.search)}`}
      replace
    />
  )
}
export default function App() {
  const [state, setState] = useState({ user: null, loading: true, error: null })
  const location = useLocation()
  useEffect(() => {
    if (!supabase) return
    let active = true,
      changed = false
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      changed = true
      if (active) setState({ user: session?.user || null, loading: false, error: null })
    })
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (active && !changed)
          setState({ user: data.session?.user || null, loading: false, error })
      })
      .catch((error) => {
        if (active && !changed) setState({ user: null, loading: false, error })
      })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])
  if (configurationError)
    return (
      <main className="container">
        <ErrorNotice error={configurationError} />
      </main>
    )
  if (state.loading)
    return (
      <main className="container">
        <Loading />
      </main>
    )
  const user = state.user
  return (
    <>
      <Navbar user={user} />
      <main className="container">
        <ErrorNotice error={state.error} />
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Home user={user} />} />
            <Route path="/auth" element={<Auth user={user} />} />
            <Route
              path="/projects/new"
              element={
                <Protected user={user}>
                  <PostProject user={user} />
                </Protected>
              }
            />
            <Route
              path="/projects/:id/edit"
              element={
                <Protected user={user}>
                  <PostProject key={location.pathname} user={user} />
                </Protected>
              }
            />
            <Route
              path="/projects/:id/applications"
              element={
                <Protected user={user}>
                  <Applications key={location.pathname + user?.id} user={user} />
                </Protected>
              }
            />
            <Route
              path="/projects/:id"
              element={<ProjectDetail key={location.pathname + user?.id} user={user} />}
            />
            <Route
              path="/profile"
              element={
                <Protected user={user}>
                  <Profile key={user?.id} user={user} />
                </Protected>
              }
            />
            <Route
              path="/applications"
              element={
                <Protected user={user}>
                  <Applications key={user?.id} user={user} />
                </Protected>
              }
            />
            <Route
              path="*"
              element={
                <section className="empty">
                  <h1>Page not found</h1>
                  <Link to="/">Browse projects</Link>
                </section>
              }
            />
          </Routes>
        </Suspense>
      </main>
      <footer className="footer">DevMate · Build something together.</footer>
    </>
  )
}
