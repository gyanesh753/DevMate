import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

function ProjectDetail({ user, onSignInClick }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showApplyForm, setShowApplyForm] = useState(false)
  const [message, setMessage] = useState('')
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)
  const [applyError, setApplyError] = useState(null)

  useEffect(() => {
    fetch(`http://localhost:5000/api/projects/${id}`)
      .then(res => res.json())
      .then(data => {
        setProject(data)
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load project')
        setLoading(false)
      })
  }, [id])

  const handleApply = async () => {
    if (!user) {
      onSignInClick()
      return
    }
    setShowApplyForm(true)
  }

  const submitApplication = async () => {
    setApplying(true)
    setApplyError(null)

    const response = await fetch('http://localhost:5000/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: id,
        applicant_id: null,
        message
      })
    })

    const data = await response.json()

    if (!response.ok) {
      setApplyError(data.error || 'Something went wrong')
    } else {
      setApplied(true)
      setShowApplyForm(false)
    }

    setApplying(false)
  }

  const typeColors = {
    passion: 'bg-purple-900 text-purple-300',
    paid: 'bg-green-900 text-green-300',
    'open-source': 'bg-blue-900 text-blue-300',
    hackathon: 'bg-orange-900 text-orange-300',
    startup: 'bg-red-900 text-red-300',
  }

  if (loading) return (
    <div className="text-center text-gray-400 py-20">Loading project...</div>
  )

  if (error) return (
    <div className="text-center text-red-400 py-20">{error}</div>
  )

  return (
    <div className="max-w-3xl mx-auto">
      
      {/* Back button */}
      <button
        onClick={() => navigate('/')}
        className="text-gray-400 hover:text-white text-sm mb-6 flex items-center gap-2 transition"
      >
        ← Back to Feed
      </button>

      {/* Project Header */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 mb-6">
        <div className="flex items-start justify-between mb-4">
          <h1 className="text-white font-bold text-3xl">{project.title}</h1>
          <span className={`text-sm px-3 py-1 rounded-full font-medium ${typeColors[project.type] || 'bg-gray-800 text-gray-300'}`}>
            {project.type}
          </span>
        </div>

        {/* Meta info */}
        <div className="flex flex-wrap gap-4 text-sm text-gray-400 mb-6">
          <span>📍 {project.is_remote ? 'Remote' : project.location}</span>
          <span>👥 Up to {project.max_members} members</span>
          <span>🎯 {project.experience_level} level</span>
          {project.industry && <span>🏢 {project.industry}</span>}
        </div>

        {/* Description */}
        <div className="mb-6">
          <h2 className="text-white font-semibold mb-2">About this project</h2>
          <p className="text-gray-400 leading-relaxed">{project.description}</p>
        </div>

        {/* Skills */}
        <div className="mb-8">
          <h2 className="text-white font-semibold mb-3">Skills Needed</h2>
          <div className="flex flex-wrap gap-2">
            {project.skills_needed?.map((skill, index) => (
              <span key={index} className="bg-gray-800 text-gray-300 text-sm px-3 py-1.5 rounded-lg">
                {skill}
              </span>
            ))}
          </div>
        </div>

        {/* Apply section */}
        {applied ? (
          <div className="bg-green-900/30 border border-green-700 rounded-xl p-4 text-center">
            <p className="text-green-400 font-medium">✅ Application submitted successfully!</p>
            <p className="text-gray-400 text-sm mt-1">The project owner will review your application.</p>
          </div>
        ) : showApplyForm ? (
          <div className="bg-gray-800 rounded-xl p-4">
            <h3 className="text-white font-medium mb-3">Why do you want to collaborate?</h3>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Tell the project owner about yourself and why you're a good fit..."
              rows={4}
              className="w-full bg-gray-900 text-white rounded-lg px-4 py-3 text-sm outline-none border border-gray-700 focus:border-blue-500 transition resize-none mb-3"
            />
            {applyError && <p className="text-red-400 text-sm mb-3">{applyError}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => setShowApplyForm(false)}
                className="flex-1 border border-gray-700 text-gray-300 py-2 rounded-lg text-sm transition hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={submitApplication}
                disabled={applying}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
              >
                {applying ? 'Submitting...' : 'Submit Application'}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleApply}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-medium transition"
          >
            Apply to Collaborate
          </button>
        )}
      </div>

    </div>
  )
}

export default ProjectDetail