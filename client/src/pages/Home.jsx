import { useState, useEffect } from 'react'
import ProjectCard from '../components/ProjectCard'

function Home({ newProject }) {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('http://localhost:5000/api/projects')
      .then(res => res.json())
      .then(data => {
        setProjects(data)
        setLoading(false)
      })
      .catch(err => {
        setError('Failed to load projects')
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (newProject) {
      setProjects(prev => [newProject, ...prev])
    }
  }, [newProject])

  if (loading) return (
    <div className="text-center text-gray-400 py-20">Loading projects...</div>
  )

  if (error) return (
    <div className="text-center text-red-400 py-20">{error}</div>
  )

  return (
    <div>
      {/* Hero */}
      <div className="text-center py-12 px-4">
        <h1 className="text-4xl font-bold text-white mb-3">
          Find Your Next <span className="text-blue-500">Collaboration</span>
        </h1>
        <p className="text-gray-400 text-lg max-w-xl mx-auto">
          A platform where developers, designers, and creators worldwide post project ideas and find teammates to build them together.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {['All', 'Passion', 'Paid', 'Open Source', 'Hackathon', 'Startup'].map(filter => (
          <button
            key={filter}
            className="px-4 py-1.5 rounded-full text-sm border border-gray-700 text-gray-300 hover:border-blue-500 hover:text-blue-400 transition"
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div className="text-center text-gray-500 py-20">
          No projects yet. Be the first to post one!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(project => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  )
}

export default Home