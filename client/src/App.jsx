import { useState, useEffect } from 'react'
import { supabase } from './Supabase'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Auth from './pages/Auth'
import PostProject from './pages/PostProject'

function App() {
  const [user, setUser] = useState(null)
  const [showAuth, setShowAuth] = useState(false)
  const [showPostProject, setShowPostProject] = useState(false)
  const [newProject, setNewProject] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) setShowAuth(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (showAuth) return <Auth />

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Navbar
        user={user}
        onSignInClick={() => setShowAuth(true)}
        onPostProject={() => {
          if (!user) setShowAuth(true)
          else setShowPostProject(true)
        }}
      />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <Home newProject={newProject} />
      </main>
      {showPostProject && (
        <PostProject
          onClose={() => setShowPostProject(false)}
          onProjectPosted={(project) => {
            setNewProject(project)
            setShowPostProject(false)
          }}
        />
      )}
    </div>
  )
}

export default App
