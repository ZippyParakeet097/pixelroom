import { RESUME_PDF_PATH } from '@/apps/resume/resumeData'
import './mobile-gate.css'

/**
 * Desktop-only gate (plan §10).
 *
 * Deliberately not a scaled-down version of the room: the point is that a
 * recruiter skimming on a phone gets the résumé in one tap without ever
 * loading the 3D scene. The gate renders before <Scene> mounts, so none of the
 * three.js bundle is fetched on a narrow viewport at all.
 */
export function MobileGate() {
  return (
    <div className="gate">
      <div className="gate__inner">
        <p className="gate__kicker">Harshil Prakash · pixelroom</p>
        <h1 className="gate__title">This one&rsquo;s built for a bigger screen.</h1>
        <p className="gate__body">
          There&rsquo;s a whole room in here — a PC you can actually use, a jukebox, a
          whiteboard you can draw on. It needs a mouse and some pixels to breathe.
        </p>
        <p className="gate__body">
          Short version: React and React Native engineer at EPAM in Hyderabad, on
          production banking and enterprise web. The rest is in the PDF.
        </p>
        <a className="gate__cta" href={RESUME_PDF_PATH} download>
          ▸ Download the résumé
        </a>
        <p className="gate__note">
          Or come back on a laptop. It&rsquo;ll still be here.
        </p>
      </div>
    </div>
  )
}
