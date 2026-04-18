function ProjectCard({ project }) {
    const typeColors = {
      passion: 'bg-purple-900 text-purple-300',
      paid: 'bg-green-900 text-green-300',
      'open-source': 'bg-blue-900 text-blue-300',
      hackathon: 'bg-orange-900 text-orange-300',
      startup: 'bg-red-900 text-red-300',
    }
  
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-blue-600 transition cursor-pointer">
        
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <h2 className="text-white font-semibold text-lg">{project.title}</h2>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${typeColors[project.type] || 'bg-gray-800 text-gray-300'}`}>
            {project.type}
          </span>
        </div>
  
        {/* Description */}
        <p className="text-gray-400 text-sm mb-4 line-clamp-2">{project.description}</p>
  
        {/* Skills */}
        <div className="flex flex-wrap gap-2 mb-4">
          {project.skills_needed?.map((skill, index) => (
            <span key={index} className="bg-gray-800 text-gray-300 text-xs px-2 py-1 rounded-md">
              {skill}
            </span>
          ))}
        </div>
  
        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-3">
            <span>📍 {project.is_remote ? 'Remote' : project.location}</span>
            <span>👥 {project.max_members} members</span>
            <span>🎯 {project.experience_level}</span>
          </div>
          <button className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded-lg transition">
            Apply
          </button>
        </div>
  
      </div>
    )
  }
  
  export default ProjectCard