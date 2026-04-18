import { useState } from 'react'
import { supabase } from '../Supabase'

function Auth() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    setMessage(null)

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name }
        }
      })
      if (error) setError(error.message)
      else setMessage('Check your email to confirm your account!')
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      if (error) setError(error.message)
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-md">
        
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-blue-500 font-bold text-3xl">DevMate</h1>
          <p className="text-gray-400 text-sm mt-1">Find your team, build your dream</p>
        </div>

        {/* Title */}
        <h2 className="text-white font-semibold text-xl mb-6">
          {isSignUp ? 'Create your account' : 'Welcome back'}
        </h2>

        {/* Name field (sign up only) */}
        {isSignUp && (
          <div className="mb-4">
            <label className="text-gray-400 text-sm mb-1 block">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="John Doe"
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 text-sm outline-none border border-gray-700 focus:border-blue-500 transition"
            />
          </div>
        )}

        {/* Email */}
        <div className="mb-4">
          <label className="text-gray-400 text-sm mb-1 block">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 text-sm outline-none border border-gray-700 focus:border-blue-500 transition"
          />
        </div>

        {/* Password */}
        <div className="mb-6">
          <label className="text-gray-400 text-sm mb-1 block">Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 text-sm outline-none border border-gray-700 focus:border-blue-500 transition"
          />
        </div>

        {/* Error / Success messages */}
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        {message && <p className="text-green-400 text-sm mb-4">{message}</p>}

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition disabled:opacity-50"
        >
          {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
        </button>

        {/* Toggle sign in / sign up */}
        <p className="text-center text-gray-400 text-sm mt-6">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-blue-400 hover:text-blue-300 ml-1"
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </p>

      </div>
    </div>
  )
}

export default Auth
