import { RESUME, RESUME_PDF_PATH } from './resumeData'
import { playSfx } from '@/audio/sfx'
import './resume.css'

/**
 * Résumé viewer (plan §6).
 *
 * Renders styled HTML rather than embedding a PDF: it stays readable at window
 * size, it's selectable and screen-reader accessible, and it doesn't pull a
 * PDF into the page just to display it. The download button hands over the
 * real file for anyone who wants it.
 */
export function ResumeViewer() {
  return (
    <div className="resume">
      <div className="resume__toolbar">
        <a
          className="resume__download"
          href={RESUME_PDF_PATH}
          download
          onClick={() => playSfx('pickup')}
        >
          ▤ Download PDF
        </a>
      </div>

      <div className="resume__page">
        <header className="resume__header">
          <h1>{RESUME.name}</h1>
          <p className="resume__headline">{RESUME.headline}</p>
          <p className="resume__contact">
            {RESUME.location} · {RESUME.email}
          </p>
          <p className="resume__contact">
            {RESUME.links.map((link, index) => (
              <span key={link.href}>
                {index > 0 && ' · '}
                <a href={link.href} target="_blank" rel="noreferrer noopener">
                  {link.label}
                </a>
              </span>
            ))}
          </p>
        </header>

        <p className="resume__summary">{RESUME.summary}</p>

        <section>
          <h2>Experience</h2>
          {RESUME.roles.map((role) => (
            <article key={`${role.company}-${role.period}`} className="resume__role">
              <div className="resume__role-head">
                <strong>{role.title}</strong>
                <span>{role.period}</span>
              </div>
              <div className="resume__role-sub">
                {role.company} · {role.location}
              </div>

              {role.bullets && (
                <ul>
                  {role.bullets.map((bullet, index) => (
                    <li key={index}>{bullet}</li>
                  ))}
                </ul>
              )}

              {role.engagements?.map((engagement) => (
                <div key={engagement.client} className="resume__engagement">
                  <div className="resume__engagement-head">
                    {engagement.client} <span>— {engagement.context}</span>
                  </div>
                  <ul>
                    {engagement.bullets.map((bullet, index) => (
                      <li key={index}>{bullet}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </article>
          ))}
        </section>

        <section>
          <h2>Skills</h2>
          <dl className="resume__skills">
            {RESUME.skills.map((group) => (
              <div key={group.group}>
                <dt>{group.group}</dt>
                <dd>{group.items.join(' · ')}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section>
          <h2>Education</h2>
          {RESUME.education.map((entry) => (
            <article key={entry.school} className="resume__role">
              <div className="resume__role-head">
                <strong>{entry.credential}</strong>
                <span>{entry.period}</span>
              </div>
              <div className="resume__role-sub">
                {entry.school}
                {entry.location ? ` · ${entry.location}` : ''}
              </div>
              {entry.detail && (
                <ul>
                  {entry.detail.map((line, index) => (
                    <li key={index}>{line}</li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </section>
      </div>
    </div>
  )
}
