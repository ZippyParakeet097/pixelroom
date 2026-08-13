import { CONTACT_LINKS } from '@/content/contact'
import { RESUME, RESUME_PDF_PATH } from '@/apps/resume/resumeData'
import { Experience } from './Experience'
import { Projects } from './Projects'
import { SkillsEducation } from './SkillsEducation'
import { Contact } from './Contact'
import './mobile-portfolio.css'

/**
 * The plain portfolio for phones and other narrow viewports (README: "a
 * plain, actual portfolio site for phones instead of trying to squeeze the
 * gamified one down"). Renders before <Scene> ever gets a chance to mount,
 * so nothing from the 3D room — or its bundle — is fetched here. See
 * src/App.tsx for the viewport gate.
 */
export function MobilePortfolio() {
  const email = CONTACT_LINKS.find((link) => link.id === 'email')

  return (
    <div className="mobile-portfolio">
      <header className="mp-hero">
        <div className="mp-hero__block">
          <p className="mp-eyebrow">{RESUME.headline}</p>
          <h1 className="mp-hero__name">{RESUME.name}</h1>
          <p className="mp-hero__summary">{RESUME.summary}</p>
          <p className="mp-hero__meta">{RESUME.location}</p>
          <div className="mp-hero__actions">
            <a className="mp-btn mp-btn--primary" href={RESUME_PDF_PATH} download>
              Download résumé
            </a>
            {email && (
              <a className="mp-btn mp-btn--ghost" href={email.href}>
                Email
              </a>
            )}
          </div>
        </div>
      </header>

      <main>
        <Experience />
        <Projects />
        <SkillsEducation />
        <Contact />
      </main>

      <footer className="mp-footer">
        <p>There's a whole 3D version of this on a bigger screen, if you're ever at a laptop.</p>
        <a className="mp-btn mp-btn--primary" href={RESUME_PDF_PATH} download>
          Download résumé
        </a>
      </footer>
    </div>
  )
}
