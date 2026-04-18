import { supabase } from '../Supabase'

function Navbar({ user, onSignInClick, onPostProject }) {
  return (
    <nav className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between sticky top-0 z-50">

      {/* Logo */}
      <div className="flex items-center gap-2">
        <span className="text-blue-500 font-bold text-2xl">DevMate</span>
        <span className="text-gray-400 text-sm hidden md:block">— Find your team, build your dream</span>
      </div>

      {/* Search bar */}
      <div className="hidden md:flex items-center bg-gray-800 rounded-lg px-3 py-2 w-64">
        <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search projects..."
          className="bg-transparent text-sm text-white placeholder-gray-400 outline-none w-full"
        />
      </div>

      {/* Nav buttons */}
      <div className="flex items-center gap-3">
        {user ? (
          <>
            <span className="text-gray-300 text-sm">
              {user.user_metadata?.name || user.email}
            </span>
            <button
              onClick={onPostProject}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg transition"
            >
              Post a Project
            </button>
            <button
              onClick={() => supabase.auth.signOut()}
              className="text-gray-300 hover:text-white text-sm px-3 py-2 rounded-lg hover:bg-gray-800 transition"
            >
              Sign Out
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onSignInClick}
              className="text-gray-300 hover:text-white text-sm px-3 py-2 rounded-lg hover:bg-gray-800 transition"
            >
              Sign In
            </button>
            <button
              onClick={onPostProject}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg transition"
            >
              Post a Project
            </button>
          </>
        )}
      </div>

    </nav>
  )
}

export default Navbar
