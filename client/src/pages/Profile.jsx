import { useState, useEffect } from 'react'
import { supabase } from '../Supabase'
import { useNavigate } from 'react-router-dom'
import { apiUrl, authHeaders } from '../lib/api'

function Profile() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [projects, setProjects] = useState([])
  const [loadError, setLoadError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: '',
    bio: '',
    location: '',
    github_url: '',
    linkedin_url: '',
    skills: [],
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const SKILLS = ['React', 'Node.js', 'Python', 'PostgreSQL', 'MongoDB', 'TypeScript', 'JavaScript', 'Flutter', 'Swift', 'Figma', 'AWS', 'Docker']

  useEffect(() => {
    const loadProfile = async () => {
      setLoadError(null)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/'); return }
      setUser(user)

      const headers = await authHeaders()
      const res = await fetch(apiUrl(`/api/users/${user.id}`), { headers })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setLoadError(data.error || 'Could not load profile')
        setLoading(false)
        return
      }
      setProfile(data)
      setForm({
        name: data.name || '',
        bio: data.bio || '',
        location: data.location || '',
        github_url: data.github_url || '',
        linkedin_url: data.linkedin_url || '',
        skills: data.skills || [],
      })

      const projectsRes = await fetch(
        apiUrl(`/api/projects?owner_id=${encodeURIComponent(user.id)}`)
      )
      const projectsData = await projectsRes.json().catch(() => [])
      if (!projectsRes.ok) {
        setProjects([])
      } else {
        setProjects(Array.isArray(projectsData) ? projectsData : [])
      }

      setLoading(false)
    }
    loadProfile()
  }, [navigate])

  const toggleSkill = (skill) => {
    setForm(prev => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter(s => s !== skill)
        : [...prev.skills, skill]
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    const headers = await authHeaders()
    const res = await fetch(apiUrl(`/api/users/${user.id}`), {
      method: 'PUT',
      headers,
      body: JSON.stringify(form)
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) {
      setLoadError(data.error || 'Could not save profile')
      return
    }
    setLoadError(null)
    setProfile(data)
    setSaved(true)
    setEditing(false)
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) return <div className="text-center text-gray-400 py-20">Loading profile...</div>

  if (loadError && !profile) {
    return (
      <div className="max-w-xl mx-auto text-center py-20">
        <p className="text-red-400 mb-4">{loadError}</p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="text-blue-400 hover:text-blue-300 text-sm"
        >
          Back to home
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      
      {/* Header */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 mb-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-white font-bold text-2xl">{profile?.name}</h1>
            <p className="text-gray-400 text-sm mt-1">{user.email}</p>
          </div>
          <button
            onClick={() => setEditing(!editing)}
            className="border border-gray-700 text-gray-300 hover:text-white px-4 py-2 rounded-lg text-sm transition"
          >
            {editing ? 'Cancel' : 'Edit Profile'}
          </button>
        </div>

        {editing ? (
          <div className="space-y-4">
            <div>
              <label className="text-gray-400 text-sm mb-1 block">Name</label>
              <input
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 text-sm outline-none border border-gray-700 focus:border-blue-500 transition"
              />
            </div>
            <div>
              <label className="text-gray-400 text-sm mb-1 block">Bio</label>
              <textarea
                value={form.bio}
                onChange={e => setForm(p => ({ ...p, bio: e.target.value }))}
                rows={3}
                placeholder="Tell others about yourself..."
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 text-sm outline-none border border-gray-700 focus:border-blue-500 transition resize-none"
              />
            </div>
            <div>
              <label className="text-gray-400 text-sm mb-1 block">Location</label>
              <input
                value={form.location}
                onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
                placeholder="e.g. Raipur, India"
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 text-sm outline-none border border-gray-700 focus:border-blue-500 transition"
              />
            </div>
            <div>
              <label className="text-gray-400 text-sm mb-1 block">GitHub URL</label>
              <input
                value={form.github_url}
                onChange={e => setForm(p => ({ ...p, github_url: e.target.value }))}
                placeholder="https://github.com/username"
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 text-sm outline-none border border-gray-700 focus:border-blue-500 transition"
              />
            </div>
            <div>
              <label className="text-gray-400 text-sm mb-1 block">LinkedIn URL</label>
              <input
                value={form.linkedin_url}
                onChange={e => setForm(p => ({ ...p, linkedin_url: e.target.value }))}
                placeholder="https://linkedin.com/in/username"
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 text-sm outline-none border border-gray-700 focus:border-blue-500 transition"
              />
            </div>
            <div>
              <label className="text-gray-400 text-sm mb-2 block">Your Skills</label>
              <div className="flex flex-wrap gap-2">
                {SKILLS.map(skill => (
                  <button
                    key={skill}
                    onClick={() => toggleSkill(skill)}
                    className={`px-3 py-1 rounded-full text-sm border transition ${
                      form.skills.includes(skill)
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-gray-700 text-gray-300 hover:border-blue-500'
                    }`}
                  >
                    {skill}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg text-sm font-medium transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        ) : (
          <div>
            {loadError && (
              <p className="text-red-400 text-sm mb-3">{loadError}</p>
            )}
            {profile?.bio && <p className="text-gray-300 mb-4">{profile.bio}</p>}
            {profile?.location && <p className="text-gray-400 text-sm mb-3">📍 {profile.location}</p>}
            <div className="flex gap-3 mb-4">
              {profile?.github_url && (
                <a href={profile.github_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 text-sm">GitHub →</a>
              )}
              {profile?.linkedin_url && (
                <a href={profile.linkedin_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 text-sm">LinkedIn →</a>
              )}
            </div>
            {profile?.skills?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((skill, i) => (
                  <span key={i} className="bg-gray-800 text-gray-300 text-xs px-3 py-1.5 rounded-lg">{skill}</span>
                ))}
              </div>
            )}
            {saved && <p className="text-green-400 text-sm mt-3">✅ Profile saved!</p>}
          </div>
        )}
      </div>

      {/* Posted Projects */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-white font-semibold text-lg mb-4">Your Projects ({projects.length})</h2>
        {projects.length === 0 ? (
          <p className="text-gray-500 text-sm">You haven't posted any projects yet.</p>
        ) : (
          <div className="space-y-3">
            {projects.map(project => (
              <div key={project.id} className="bg-gray-800 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-medium">{project.title}</h3>
                  <span className="text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded-full">{project.type}</span>
                </div>
                <p className="text-gray-400 text-sm mt-1 line-clamp-1">{project.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}

export default Profile