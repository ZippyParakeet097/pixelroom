import { FACTS } from '@/content/facts'
import { PanelFrame } from './PanelFrame'
import './corkboard-panel.css'

export function CorkboardPanel() {
  return (
    <PanelFrame title="Corkboard" subtitle="things that did not fit on the résumé" size="tall">
      <div className="cork">
        {FACTS.map((fact) => (
          <article
            key={fact.id}
            className={`cork__note cork__note--${fact.tone}`}
            style={{ '--tilt': `${fact.tilt}deg` } as React.CSSProperties}
          >
            <span className="cork__pin" aria-hidden="true" />
            <h3>{fact.title}</h3>
            <p>{fact.body}</p>
          </article>
        ))}
      </div>
    </PanelFrame>
  )
}
