import { useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../Supabase'
import { ErrorNotice } from '../components/UI'
import { signupSchema } from '../../../shared/validation'
export default function Auth({ user }) {
  const [params] = useSearchParams(),
    [signup, setSignup] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    [notice, setNotice] = useState('')
  const proposed = params.get('returnTo') || '/'
  const returnTo =
    /^\/(?!\/)/.test(proposed) && !proposed.includes('\\') && !proposed.startsWith('/auth')
      ? proposed
      : '/'
  if (user) return <Navigate to={returnTo} replace />
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setNotice('')
    const values = Object.fromEntries(new FormData(e.currentTarget))
    try {
      if (signup) {
        const parsed = signupSchema.safeParse(values)
        if (!parsed.success) throw new Error(parsed.error.issues[0].message)
        const { error, data } = await supabase.auth.signUp({
          email: values.email,
          password: values.password,
          options: {
            data: { name: values.name.trim() },
            emailRedirectTo: `${window.location.origin}/auth?returnTo=${encodeURIComponent(returnTo)}`,
          },
        })
        if (error) throw error
        if (!data.session) setNotice('Check your email to confirm your account, then sign in.')
      } else {
        const { error } = await supabase.auth.signInWithPassword(values)
        if (error) throw error
      }
    } catch (error) {
      setError(error)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="card narrow">
      <h1>{signup ? 'Join DevMate' : 'Welcome back'}</h1>
      <p className="muted">Your next collaboration starts here.</p>
      <form onSubmit={submit}>
        {signup && (
          <label>
            Full name
            <input name="name" required maxLength={80} autoComplete="name" />
          </label>
        )}
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" maxLength={254} />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            required
            minLength={signup ? 8 : 1}
            maxLength={128}
            autoComplete={signup ? 'new-password' : 'current-password'}
          />
        </label>
        <ErrorNotice error={error} />
        {notice && (
          <p role="status" className="notice">
            {notice}
          </p>
        )}
        <button className="primary" disabled={busy}>
          {busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setSignup(!signup)
            setError(null)
            setNotice('')
          }}
        >
          {signup ? 'Already have an account? Sign in' : 'Create an account'}
        </button>
      </form>
      <Link to="/">Back to projects</Link>
    </section>
  )
}
