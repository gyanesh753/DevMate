import { useState } from 'react'
import { supabase } from '../Supabase'

const SKILLS = ['React', 'Node.js', 'Python', 'PostgreSQL', 'MongoDB', 'TypeScript', 'JavaScript', 'Flutter', 'Swift', 'Figma', 'AWS', 'Docker']

function PostProject({ onClose, onProjectPosted }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'passion',
    skills_needed: [],
    experience_level: 'any',
    industry: '',
    is_remote: true,
    location: '',
    max_members: 3
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const toggleSkill = (skill) => {
    setForm(prev => ({
      ...prev,
      skills_needed: prev.skills_needed.includes(skill)
        ? prev.skills_needed.filter(s => s !== skill)
        : [...prev.skills_needed, skill]
    }))
  }

  const handleSubmit = async () => {
    if (!form.title || !form.description) {
      setError('Title and description are required')
      return
    }

    setLoading(true)
    setError(null)

    const response = await fetch('http://localhost:5000/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        owner_id: null
      })
    })

    const data = await response.json()

    if (!response.ok) {
      setError(data.error || 'Something went wrong')
    } else {
      onProjectPosted(data)
      onClose()
    }

    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white font-semibold text-xl">Post a Project</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">✕</button>
        </div>

        {/* Title */}
        <div className="mb-4">
          <label className="text-gray-400 text-sm mb-1 block">Project Title *</label>
          <input
            type="text"
            value={form.title}
            onChange={e => handleChange('title', e.target.value)}
            placeholder="e.g. AI-powered recipe app"
            className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 text-sm outline-none border border-gray-700 focus:border-blue-500 transition"
          />
        </div>

        {/* Description */}
        <div className="mb-4">
          <label className="text-gray-400 text-sm mb-1 block">Description *</label>
          <textarea
            value={form.description}
            onChange={e => handleChange('description', e.target.value)}
            placeholder="Describe your project, what you're building, and what kind of collaborators you're looking for..."
            rows={4}
            className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 text-sm outline-none border border-gray-700 focus:border-blue-500 transition resize-none"
          />
        </div>

        {/* Type and Experience Level */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-gray-400 text-sm mb-1 block">Project Type</label>
            <select
              value={form.type}
              onChange={e => handleChange('type', e.target.value)}
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 text-sm outline-none border border-gray-700 focus:border-blue-500 transition"
            >
              <option value="passion">Passion</option>
              <option value="paid">Paid</option>
              <option value="open-source">Open Source</option>
              <option value="hackathon">Hackathon</option>
              <option value="startup">Startup</option>
            </select>
          </div>
          <div>
            <label className="text-gray-400 text-sm mb-1 block">Experience Level</label>
            <select
              value={form.experience_level}
              onChange={e => handleChange('experience_level', e.target.value)}
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 text-sm outline-none border border-gray-700 focus:border-blue-500 transition"
            >
              <option value="any">Any</option>
              <option value="fresher">Fresher</option>
              <option value="mid">Mid</option>
              <option value="senior">Senior</option>
            </select>
          </div>
        </div>

        {/* Skills */}
        <div className="mb-4">
          <label className="text-gray-400 text-sm mb-2 block">Skills Needed</label>
          <div className="flex flex-wrap gap-2">
            {SKILLS.map(skill => (
              <button
                key={skill}
                onClick={() => toggleSkill(skill)}
                className={`px-3 py-1 rounded-full text-sm border transition ${
                  form.skills_needed.includes(skill)
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'border-gray-700 text-gray-300 hover:border-blue-500'
                }`}
              >
                {skill}
              </button>
            ))}
          </div>
        </div>

        {/* Industry */}
        <div className="mb-4">
          <label className="text-gray-400 text-sm mb-1 block">Industry</label>
          <input
            type="text"
            value={form.industry}
            onChange={e => handleChange('industry', e.target.value)}
            placeholder="e.g. Healthcare, Fintech, Education"
            className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 text-sm outline-none border border-gray-700 focus:border-blue-500 transition"
          />
        </div>

        {/* Remote and Max Members */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="text-gray-400 text-sm mb-1 block">Location</label>
            <select
              value={form.is_remote}
              onChange={e => handleChange('is_remote', e.target.value === 'true')}
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 text-sm outline-none border border-gray-700 focus:border-blue-500 transition"
            >
              <option value="true">Remote</option>
              <option value="false">In-Person</option>
            </select>
          </div>
          <div>
            <label className="text-gray-400 text-sm mb-1 block">Max Members</label>
            <input
              type="number"
              value={form.max_members}
              onChange={e => handleChange('max_members', parseInt(e.target.value))}
              min={2}
              max={20}
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 text-sm outline-none border border-gray-700 focus:border-blue-500 transition"
            />
          </div>
        </div>

        {/* Error */}
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        {/* Submit */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-700 text-gray-300 hover:text-white py-3 rounded-lg text-sm transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg text-sm font-medium transition disabled:opacity-50"
          >
            {loading ? 'Posting...' : 'Post Project'}
          </button>
        </div>

      </div>
    </div>
  )
}

export default PostProject