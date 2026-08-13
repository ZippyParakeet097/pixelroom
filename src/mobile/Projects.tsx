import { useState } from 'react'
import { PROJECTS, type Project } from '@/content/projects'
import './projects.css'

export function Projects() {
  return (
    <section className="mp-section" aria-labelledby="projects-heading">
      <header className="mp-section__head">
        <p className="mp-eyebrow">Selected work</p>
        <h2 id="projects-heading">Projects</h2>
      </header>

      <ul className="mp-cards">
        {PROJECTS.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </ul>
    </section>
  )
}

function ProjectCard({ project }: { project: Project }) {
  const [expanded, setExpanded] = useState(false)
  const detailsId = `${project.id}-details`

  return (
    <li className="mp-card">
      <div className="mp-card__head">
        <h3>{project.title}</h3>
        <span className="mp-card__year">{project.year}</span>
      </div>
      <p className="mp-card__role">{project.role}</p>

      <ul className="mp-chips">
        {project.stack.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <p className="mp-card__summary">{project.summary}</p>

      <button
        type="button"
        className="mp-card__toggle"
        aria-expanded={expanded}
        aria-controls={detailsId}
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? '– Close case study' : '+ Full case study'}
      </button>

      <div className="mp-card__collapsible" data-expanded={expanded}>
        <div className="mp-card__collapsible-inner" id={detailsId} inert={!expanded}>
          {project.sections.map((section) => (
            <div className="mp-card__detail" key={section.heading}>
              <h4>{section.heading}</h4>
              <p>{section.body}</p>
            </div>
          ))}

          {project.links && project.links.length > 0 && (
            <ul className="mp-card__links">
              {project.links.map((link) => (
                <li key={link.href}>
                  <a href={link.href} target="_blank" rel="noreferrer noopener">
                    {link.label} ↗
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </li>
  )
}
