import { CONTACT_BLURB, CONTACT_LINKS } from '@/content/contact'
import './contact.css'

export function Contact() {
  return (
    <section className="mp-section" aria-labelledby="contact-heading">
      <header className="mp-section__head">
        <p className="mp-eyebrow">Get in touch</p>
        <h2 id="contact-heading">Contact</h2>
      </header>

      <p className="mp-contact__blurb">{CONTACT_BLURB}</p>

      <ul className="mp-contact__list">
        {CONTACT_LINKS.map((link) => (
          <li key={link.id}>
            <a
              className="mp-contact__link"
              href={link.href}
              target={link.href.startsWith('mailto:') ? undefined : '_blank'}
              rel="noreferrer noopener"
            >
              <span className="mp-contact__mark" aria-hidden="true">
                {link.mark.kind === 'brand' ? <img src={link.mark.src} alt="" /> : link.mark.char}
              </span>
              <span className="mp-contact__text">
                <span className="mp-contact__label">{link.label}</span>
                <span className="mp-contact__value">{link.value}</span>
              </span>
              <span className="mp-contact__arrow" aria-hidden="true">
                ↗
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
