import { Link } from 'react-router-dom'
import { Status } from './UI'
export default function ProjectCard({ project, user }) {
  const owned = user?.id === project.owner_id
  const unavailable = project.status !== 'open' || project.member_count >= project.max_members
  return (
    <article className="card project-card">
      <div className="actions spread">
        <span className="eyebrow">{project.type}</span>
        <Status value={project.status} />
      </div>
      <h2>
        <Link to={`/projects/${project.id}`}>{project.title}</Link>
      </h2>
      <p className="excerpt muted">{project.description}</p>
      <div className="skills">
        {project.skills.map((s) => (
          <span className="badge" key={s.id}>
            {s.name}
          </span>
        ))}
      </div>
      <p className="meta">
        {project.is_remote ? 'Remote' : project.location} · {project.member_count}/
        {project.max_members} members · {project.experience_level}
      </p>
      <div className="actions spread">
        <span className="muted">By {project.owner_name}</span>
        <Link
          className="button primary"
          to={`/projects/${project.id}${!owned && !unavailable && !project.my_application ? '?apply=1' : ''}`}
        >
          {owned
            ? 'Manage'
            : project.my_application
              ? `Application ${project.my_application.status}`
              : unavailable
                ? 'View project'
                : 'Apply'}
        </Link>
      </div>
    </article>
  )
}
