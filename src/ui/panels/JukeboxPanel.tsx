import { useEffect, useRef } from 'react'
import { subscribeSurfaceRect } from '@/scene/surfaceProjection'
import { TRACKS } from '@/audio/chiptune'
import { useJukeboxStore } from '@/audio/useJukeboxStore'
import { playSfx } from '@/audio/sfx'
import './jukebox-panel.css'

/**
 * The height this display is laid out for, in CSS pixels.
 *
 * The glass is however big the projection says it is, which depends on the
 * visitor's viewport — so every size inside is expressed against `--u`, one
 * two-hundred-and-fifty-eighth of the current height. A display whose type grew
 * and shrank independently of its frame would stop reading as printed on the
 * glass the moment anyone resized the window.
 */
const LAYOUT_HEIGHT = 258

/** What the pilot lamp says the machine is doing. */
const PHASE_LABEL: Record<string, string> = {
  idle: 'make selection',
  indexing: 'selecting',
  lifting: 'loading',
  cueing: 'cueing',
  playing: 'now playing',
  returning: 'clearing',
}

/**
 * The jukebox's selection window — the track list, printed on the cabinet's own
 * glass rather than shown in a panel beside it.
 *
 * This is the monitor's treatment applied to the second object that has a
 * screen (plan §6): <SurfaceProjector> publishes where the display mesh
 * currently projects to in CSS pixels and this positions itself there, so the
 * list is framed by the modelled surround and the arch above it.
 *
 * Built as a rack of printed title strips rather than as a display, which is
 * what the object in front of the visitor actually is. The monitor next door
 * already owns "lit screen" and does it properly, scanlines and all; a second
 * one on a wooden cabinet made the jukebox read as a kiosk. So: cream cards in
 * a chrome rack, a stamped code plate per strip, and one pilot lamp — the only
 * lit element, because on a real machine it is the only lit element.
 *
 * Transport lives on the cabinet, not in here. The three keys under the glass
 * are real meshes with their own pick proxies (see <Jukebox>) — anything drawn
 * inside this rectangle would sit under the overlay and never receive a click,
 * which is the same constraint that put the monitor's power switch on the lower
 * bezel. What is left for the DOM is the part a physical key bank is bad at:
 * naming what is on the record.
 *
 * The rectangle is applied imperatively rather than through state, for the
 * reason spelled out on <PcPanel> — it is republished from the render loop, and
 * a React render per frame to move a div is not a trade worth making.
 */
export function JukeboxPanel() {
  const trackIndex = useJukeboxStore((s) => s.trackIndex)
  const queued = useJukeboxStore((s) => s.queued)
  const phase = useJukeboxStore((s) => s.phase)
  const request = useJukeboxStore((s) => s.request)
  const glass = useRef<HTMLDivElement>(null)

  /* The strip a press lit up, which during a changeover is not yet the one the
     magazine is indexed to. Showing the mechanism's answer instead would leave
     the row you just pressed dark for the better part of a second. */
  const marked = queued ?? trackIndex
  const busy = phase !== 'idle'

  useEffect(
    () =>
      subscribeSurfaceRect('jukebox', (rect) => {
        const element = glass.current
        if (!element) return

        // No rectangle means the camera is not at the cabinet. Hide rather than
        // unmount: the list is cheap, and unmounting would drop focus off
        // whichever row the keyboard was on mid-dolly.
        if (!rect) {
          element.style.visibility = 'hidden'
          return
        }

        element.style.visibility = 'visible'
        element.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0)`
        element.style.width = `${rect.width}px`
        element.style.height = `${rect.height}px`
        element.style.setProperty('--u', `${rect.height / LAYOUT_HEIGHT}px`)
      }),
    [],
  )

  return (
    <div className="jukebox-card" ref={glass} role="dialog" aria-label="Jukebox selections">
      <div className="jukebox-card__head">
        <span className="jukebox-card__maker">Wurlitone</span>
        <span className={`jukebox-card__pilot ${busy ? 'is-lit' : ''}`}>
          <span className="jukebox-card__lamp" aria-hidden="true" />
          {PHASE_LABEL[phase]}
        </span>
      </div>

      <ol className="jukebox-card__rack">
        {TRACKS.map((entry, index) => (
          <li key={entry.id}>
            <button
              type="button"
              className={`jukebox-card__strip ${index === marked ? 'is-marked' : ''}`}
              /* Pointer-enter rather than mouse-over: the latter re-fires as
                 the pointer crosses the code plate and the card inside the same
                 button, which turns one tick into two. */
              onPointerEnter={() => playSfx('tick')}
              onFocus={() => playSfx('tick')}
              onClick={() => {
                playSfx('clack')
                request(index)
              }}
            >
              {/* Letter-number the way a real selection card is coded, which is
                  also what the row is: a label for something you press. */}
              <span className="jukebox-card__code">
                <span>A</span>
                <span>{index + 1}</span>
              </span>
              <span className="jukebox-card__text">
                <span className="jukebox-card__title">{entry.title}</span>
                <span className="jukebox-card__artist">{entry.artist}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>

      <p className="jukebox-card__foot">original loops · keys below the glass</p>

      {/* Glass in front of paper: one soft reflection and a darkened surround.
          Decorative, so it must never intercept a click meant for a strip
          underneath it. */}
      <div className="jukebox-card__glass" aria-hidden="true" />
    </div>
  )
}
