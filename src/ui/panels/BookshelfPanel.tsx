import { useEffect, useRef } from 'react'
import { PROJECTS } from '@/content/projects'
import { useRoomStore } from '@/state/useRoomStore'
import { playSfx } from '@/audio/sfx'
import { PanelFrame } from './PanelFrame'
import './bookshelf-panel.css'

/**
 * The bookshelf's UI is the bookshelf (plan §5).
 *
 * There is deliberately no list of projects here. Each row of the shelf *is* a
 * project — you pick one by clicking the row in the room, and this component
 * only ever renders the case study for whichever row is currently pulled out.
 * With nothing pulled out it renders no visible chrome at all, which is the
 * whole point: the room does the talking.
 *
 * What it does still render in that state is a hidden list of shelf rows. A
 * 3D object is unreachable by keyboard and invisible to a screen reader, so
 * without this the projects would be mouse-only. Focusing an entry moves the
 * in-world highlight to that row, so tabbing through the shelf looks exactly
 * like running the pointer down it.
 */
export function BookshelfPanel() {
  const shelfProject = useRoomStore((s) => s.shelfProject)
  const selectProject = useRoomStore((s) => s.selectProject)

  const open = PROJECTS.find((p) => p.id === shelfProject) ?? null

  return open ? <CaseStudy project={open} onBack={() => selectProject(null)} /> : <ShelfNav />
}

function CaseStudy({
  project,
  onBack,
}: {
  project: (typeof PROJECTS)[number]
  onBack: () => void
}) {
  const back = useRef<HTMLButtonElement>(null)

  // The nav list unmounts when a row opens, so focus would otherwise fall back
  // to <body> and strand a keyboard visitor mid-shelf.
  useEffect(() => {
    back.current?.focus()
  }, [])

  return (
    <PanelFrame
      title={project.title}
      subtitle={`${project.year} · ${project.role}`}
      size="tall"
      onClose={onBack}
    >
      <button
        ref={back}
        type="button"
        className="pixel-button case__back"
        onClick={() => {
          playSfx('back')
          onBack()
        }}
      >
        ◂ push it back
      </button>

      <p className="case__summary">{project.summary}</p>

      <ul className="case__stack">
        {project.stack.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      {project.sections.map((section) => (
        <section key={section.heading} className="case__section">
          <h3>{section.heading}</h3>
          <p>{section.body}</p>
        </section>
      ))}

      {project.links && project.links.length > 0 && (
        <div className="case__links">
          {project.links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="pixel-button"
              target="_blank"
              rel="noreferrer noopener"
            >
              {link.label} ↗
            </a>
          ))}
        </div>
      )}
    </PanelFrame>
  )
}

function ShelfNav() {
  const cursor = useRoomStore((s) => s.shelfCursor)
  const setShelfCursor = useRoomStore((s) => s.setShelfCursor)
  const selectProject = useRoomStore((s) => s.selectProject)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])

  // Coming back out of a case study, put focus back on the row you just closed
  // rather than at the top of the shelf. On first arrival `cursor` is null, so
  // nothing is stolen from the visitor who is using a mouse.
  useEffect(() => {
    if (cursor === null) return
    buttons.current[cursor]?.focus()
    // Mount only: after this, focus follows the visitor, not the cursor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const move = (from: number, delta: number) => {
    const next = (from + delta + PROJECTS.length) % PROJECTS.length
    buttons.current[next]?.focus()
  }

  return (
    <div className="shelf-nav">
      <ul
        className="shelf-nav__rows"
        aria-label="Bookshelf rows — one project per shelf"
        onKeyDown={(event) => {
          const index = buttons.current.indexOf(event.target as HTMLButtonElement)
          if (index < 0) return
          if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
            event.preventDefault()
            move(index, 1)
          } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
            event.preventDefault()
            move(index, -1)
          }
        }}
      >
        {PROJECTS.map((project, index) => (
          <li key={project.id}>
            <button
              type="button"
              ref={(node) => {
                buttons.current[index] = node
              }}
              onFocus={() => setShelfCursor(index)}
              onBlur={() => setShelfCursor(null)}
              onClick={() => {
                playSfx('select')
                selectProject(project.id)
              }}
            >
              {project.title} — {project.year}, {project.role}
            </button>
          </li>
        ))}
      </ul>

      <p className="shelf-nav__hint">
        <span className="shelf-nav__key">click</span> a shelf to pull it out
      </p>
    </div>
  )
}
