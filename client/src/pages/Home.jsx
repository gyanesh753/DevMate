import { useState, useEffect } from 'react'
import ProjectCard from '../components/ProjectCard'
import { apiUrl } from '../lib/api'

function Home({ newProject }) {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeType, setActiveType] = useState('all')
  const [activeExperience, setActiveExperience] = useState('any')
  const [activeRemote, setActiveRemote] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  const fetchProjects = () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (activeType !== 'all') params.append('type', activeType)
    if (activeExperience !== 'any') params.append('experience_level', activeExperience)
    if (activeRemote !== '') params.append('is_remote', activeRemote)
    if (search) params.append('search', search)

      fetch(apiUrl(`/api/projects?${params.toString()}`))
      .then(res => res.json())
      .then(data => {
        setProjects(data)
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load projects')
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchProjects()
  }, [activeType, activeExperience, activeRemote, search])

  useEffect(() => {
    if (newProject) {
      setProjects(prev => [newProject, ...prev])
    }
  }, [newProject])

  const handleSearch = (e) => {
    if (e.key === 'Enter') {
      setSearch(searchInput)
    }
  }

  const typeFilters = [
    { label: 'All', value: 'all' },
    { label: 'Passion', value: 'passion' },
    { label: 'Paid', value: 'paid' },
    { label: 'Open Source', value: 'open-source' },
    { label: 'Hackathon', value: 'hackathon' },
    { label: 'Startup', value: 'startup' },
  ]

  const experienceFilters = [
    { label: 'Any Level', value: 'any' },
    { label: 'Fresher', value: 'fresher' },
    { label: 'Mid', value: 'mid' },
    { label: 'Senior', value: 'senior' },
  ]

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

        {/* Search bar */}
        <div className="mt-6 max-w-lg mx-auto flex items-center bg-gray-800 rounded-xl px-4 py-3 border border-gray-700 focus-within:border-blue-500 transition">
          <svg className="w-4 h-4 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={handleSearch}
            placeholder="Search projects by title or skill... (press Enter)"
            className="bg-transparent text-white text-sm outline-none w-full placeholder-gray-400"
          />
          {searchInput && (
            <button
              onClick={() => { setSearchInput(''); setSearch('') }}
              className="text-gray-400 hover:text-white ml-2"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3 mb-6">
        {/* Type filters */}
        <div className="flex flex-wrap gap-2">
          {typeFilters.map(filter => (
            <button
              key={filter.value}
              onClick={() => setActiveType(filter.value)}
              className={`px-4 py-1.5 rounded-full text-sm border transition ${
                activeType === filter.value
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'border-gray-700 text-gray-300 hover:border-blue-500 hover:text-blue-400'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Experience and Remote filters */}
        <div className="flex flex-wrap gap-2">
          {experienceFilters.map(filter => (
            <button
              key={filter.value}
              onClick={() => setActiveExperience(filter.value)}
              className={`px-4 py-1.5 rounded-full text-sm border transition ${
                activeExperience === filter.value
                  ? 'bg-purple-600 border-purple-600 text-white'
                  : 'border-gray-700 text-gray-300 hover:border-purple-500 hover:text-purple-400'
              }`}
            >
              {filter.label}
            </button>
          ))}
          <button
            onClick={() => setActiveRemote(activeRemote === 'true' ? '' : 'true')}
            className={`px-4 py-1.5 rounded-full text-sm border transition ${
              activeRemote === 'true'
                ? 'bg-green-600 border-green-600 text-white'
                : 'border-gray-700 text-gray-300 hover:border-green-500 hover:text-green-400'
            }`}
          >
            Remote Only
          </button>
        </div>
      </div>

      {/* Project count */}
      <p className="text-gray-500 text-sm mb-4">
        {loading ? 'Loading...' : `${projects.length} project${projects.length !== 1 ? 's' : ''} found`}
      </p>

      {/* Projects Grid */}
      {loading ? (
        <div className="text-center text-gray-400 py-20">Loading projects...</div>
      ) : error ? (
        <div className="text-center text-red-400 py-20">{error}</div>
      ) : projects.length === 0 ? (
        <div className="text-center text-gray-500 py-20">
          No projects found. Try adjusting your filters!
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
