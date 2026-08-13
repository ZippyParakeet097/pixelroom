import { RESUME } from '@/apps/resume/resumeData'
import './experience.css'

export function Experience() {
  return (
    <section className="mp-section" aria-labelledby="experience-heading">
      <header className="mp-section__head">
        <p className="mp-eyebrow">Where I've worked</p>
        <h2 id="experience-heading">Experience</h2>
      </header>

      <div className="mp-roles">
        {RESUME.roles.map((role) => (
          <article className="mp-role" key={`${role.company}-${role.period}`}>
            <div className="mp-role__head">
              <h3>{role.title}</h3>
              <span className="mp-role__period">{role.period}</span>
            </div>
            <p className="mp-role__sub">
              {role.company} · {role.location}
            </p>

            {role.bullets && (
              <ul className="mp-bullets">
                {role.bullets.map((bullet, index) => (
                  <li key={index}>{bullet}</li>
                ))}
              </ul>
            )}

            {role.engagements?.map((engagement) => (
              <div className="mp-engagement" key={engagement.client}>
                <p className="mp-engagement__head">
                  <span className="mp-engagement__client">{engagement.client}</span>
                  <span className="mp-engagement__context">{engagement.context}</span>
                </p>
                <ul className="mp-bullets">
                  {engagement.bullets.map((bullet, index) => (
                    <li key={index}>{bullet}</li>
                  ))}
                </ul>
              </div>
            ))}
          </article>
        ))}
      </div>
    </section>
  )
}
