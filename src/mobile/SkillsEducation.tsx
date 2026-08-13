import { RESUME } from '@/apps/resume/resumeData'
import './skills-education.css'

export function SkillsEducation() {
  return (
    <section className="mp-section" aria-labelledby="skills-heading">
      <header className="mp-section__head">
        <p className="mp-eyebrow">Skills &amp; education</p>
        <h2 id="skills-heading">Skills &amp; Education</h2>
      </header>

      <div className="mp-skills">
        {RESUME.skills.map((group) => (
          <div className="mp-skills__row" key={group.group}>
            <p className="mp-skills__label">{group.group}</p>
            <p className="mp-skills__value">{group.items.join(' · ')}</p>
          </div>
        ))}
      </div>

      <div className="mp-roles mp-roles--education">
        {RESUME.education.map((entry) => (
          <article className="mp-role" key={entry.school}>
            <div className="mp-role__head">
              <h3>{entry.credential}</h3>
              <span className="mp-role__period">{entry.period}</span>
            </div>
            <p className="mp-role__sub">
              {entry.school}
              {entry.location ? ` · ${entry.location}` : ''}
            </p>
            {entry.detail && (
              <ul className="mp-bullets">
                {entry.detail.map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}
