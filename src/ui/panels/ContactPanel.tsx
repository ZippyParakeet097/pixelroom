import { CONTACT_BLURB, CONTACT_LINKS } from '@/content/contact'
import { RESUME_PDF_PATH } from '@/apps/resume/resumeData'
import { playSfx } from '@/audio/sfx'
import { useDialogueStore } from '@/state/useDialogueStore'
import { PanelFrame } from './PanelFrame'
import './contact-panel.css'

export function ContactPanel() {
  const say = useDialogueStore((s) => s.say)

  return (
    <PanelFrame title="Window" subtitle="ways to reach the outside">
      <p className="contact__blurb">{CONTACT_BLURB}</p>

      <ul className="contact__list">
        {CONTACT_LINKS.map((link) => (
          <li key={link.id}>
            <a
              className="contact__link"
              href={link.href}
              target={link.href.startsWith('mailto:') ? undefined : '_blank'}
              rel="noreferrer noopener"
              onClick={() => playSfx('select')}
            >
              <span className="contact__mark" aria-hidden="true">
                {link.mark.kind === 'brand' ? (
                  <img
                    className={`contact__brand contact__brand--${link.id}`}
                    src={link.mark.src}
                    alt=""
                  />
                ) : (
                  link.mark.char
                )}
              </span>
              <span className="contact__text">
                <span className="contact__label">{link.label}</span>
                <span className="contact__value">{link.value}</span>
              </span>
              <span className="contact__arrow" aria-hidden="true">
                ↗
              </span>
            </a>
          </li>
        ))}
      </ul>

      <a
        className="pixel-button contact__resume"
        href={RESUME_PDF_PATH}
        download
        onClick={() => {
          playSfx('pickup')
          say(['Obtained: résumé.pdf'], { interrupt: true, transient: true })
        }}
      >
        ▸ download résumé.pdf
      </a>
    </PanelFrame>
  )
}
