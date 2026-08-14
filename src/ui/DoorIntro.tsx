import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import { unlockAudio } from '@/audio/engine'
import { playDoorOpen, prefetchDoorOpen } from '@/audio/sfx'
import { doorTimeline } from '@/scene/doorSequence'
import { prefersReducedMotion } from '@/scene/motion'
import { useRoomStore } from '@/state/useRoomStore'
import './door-intro.css'

/** How long the fade takes when the visitor cuts the sequence short. */
const SKIP_MS = 200

/** Keys that are half of something else, so they can't mean "skip this". */
const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'])

type Phase = 'closed' | 'opening' | 'black' | 'revealing' | 'done'

type DoorComponent = ComponentType<{ onOpen: () => void }>

/**
 * The way in.
 *
 * A door, facing the visitor, that opens onto a black frame and leaves them in
 * the room. Three things are load-bearing about how it is put together:
 *
 * 1. The 3D door is fetched at runtime rather than imported. A static import
 *    would drag three.js into the entry chunk, which is exactly what `App`
 *    lazy-loads the scene to avoid — a phone that only ever sees the mobile
 *    portfolio would pay for a renderer it never mounts. It also means this
 *    overlay's own text paints immediately, over black, while the door loads.
 * 2. The click has to flip the stage synchronously. The timers below only
 *    decide *when* each beat lands; if one of them is ever interrupted the
 *    visitor is stuck on a splash screen with no way forward, so nothing that
 *    gates entry is allowed to live inside a `setTimeout`.
 * 3. The beats are a chain of one-shot timers, each scheduling only the next.
 *    That is what makes the sequence interruptible: a skip is a state change,
 *    and the pending timer dies with the effect that owns it.
 */
export function DoorIntro() {
  const stage = useRoomStore((s) => s.stage)
  const openDoor = useRoomStore((s) => s.openDoor)
  const enterRoom = useRoomStore((s) => s.enterRoom)

  const [phase, setPhase] = useState<Phase>('closed')
  const [skipped, setSkipped] = useState(false)
  const [Door, setDoor] = useState<DoorComponent | null>(null)

  const timeline = useMemo(() => doorTimeline(prefersReducedMotion()), [])
  const enterButton = useRef<HTMLButtonElement>(null)
  /**
   * Latched here rather than read back off the store, because the store cannot
   * answer this question in time.
   *
   * A click on the enter button runs `open` twice: once from the button and
   * once from the `.doorway` wrapper the event bubbles up to. Both handlers run
   * inside one React batch, so both closures still see `stage === 'door'` and
   * both get through the guard — which cost nothing while the press was a 50ms
   * synthesised tick, and is a whole second door playing over the first now
   * that it is a recording.
   */
  const opened = useRef(false)

  useEffect(() => {
    let alive = true
    void import('@/scene/IntroDoor').then((module) => {
      // The setter form, or React calls the component as an updater function.
      if (alive) setDoor(() => module.IntroDoor)
    })
    // Alongside the door's own chunk, and for the same reason: both are wanted
    // at the instant of the click and neither is wanted before the visitor has
    // reached this screen. Bytes only — the AudioContext still waits for the
    // gesture that is allowed to create it.
    prefetchDoorOpen()
    return () => {
      alive = false
    }
  }, [])

  const open = useCallback(() => {
    if (opened.current || stage !== 'door') return
    opened.current = true
    setPhase('opening')
    openDoor()

    // Chained onto the unlock rather than fired next to it: this click is the
    // gesture that resumes the AudioContext, and `resume()` has not finished by
    // the time the handler returns — a sound scheduled on the same tick is
    // dropped by every voice in `sfx`, which will not play into a suspended
    // context.
    //
    // One cue, on the press, for the whole door. The recording runs handle →
    // latch → swing and its own beats already sit where the animation's are, so
    // there is nothing here to schedule against them — see `playDoorOpen`. It
    // fires under reduced motion too: nothing is moving, but the visitor still
    // pressed something and should hear the door they opened.
    void unlockAudio().then(playDoorOpen)
  }, [stage, openDoor])

  /**
   * Each beat schedules only the next one, so cutting the sequence short is
   * just a state change — the pending timer is cleared by this effect's own
   * teardown rather than by bookkeeping at the call site.
   */
  useEffect(() => {
    if (phase === 'opening') {
      const id = window.setTimeout(
        () => setPhase('black'),
        skipped ? SKIP_MS : timeline.sequence,
      )
      return () => window.clearTimeout(id)
    }

    if (phase === 'black') {
      const id = window.setTimeout(() => setPhase('revealing'), timeline.hold)
      return () => window.clearTimeout(id)
    }

    if (phase === 'revealing') {
      enterRoom()
      const id = window.setTimeout(() => setPhase('done'), timeline.reveal)
      return () => window.clearTimeout(id)
    }
  }, [phase, skipped, timeline, enterRoom])

  // Nothing to tear down for the sound any more. The door is one cue fired on
  // the press, and a Web Audio one-shot is scheduled rather than held — a skip
  // lets it ride out its tail over the room, which is what happens when you
  // walk through a door faster than it finishes swinging.

  // Focused when it becomes usable rather than on mount: until the door has
  // loaded there is nothing behind the button, and `autoFocus` on a disabled
  // control is silently dropped and never reapplied.
  useEffect(() => {
    if (Door) enterButton.current?.focus()
  }, [Door])

  useEffect(() => {
    if (phase !== 'closed' && phase !== 'opening') return

    const onKey = (event: KeyboardEvent) => {
      if (phase === 'closed') {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        if (Door) open()
        return
      }
      // Mid-sequence, any key is "yes, I've seen it" — including Esc, which is
      // the room's way back out everywhere else and should not be the one key
      // that does nothing here. A shortcut is not an answer, though: somebody
      // reaching for Cmd-Tab has not asked to skip the intro.
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (MODIFIER_KEYS.has(event.key)) return
      setSkipped(true)
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, open, Door])

  if (phase === 'done') return null

  const handleClick = () => {
    if (phase === 'closed') open()
    else if (phase === 'opening') setSkipped(true)
  }

  // The veil is one element through the whole sequence, retimed per beat, so it
  // can be caught mid-fade and redirected without ever cutting to a hard edge.
  const veil =
    phase === 'opening'
      ? {
          opacity: 1,
          transitionDuration: `${skipped ? SKIP_MS : timeline.veil}ms`,
          transitionDelay: skipped ? '0ms' : `${Math.max(0, timeline.sequence - timeline.veil)}ms`,
        }
      : phase === 'revealing'
        ? { opacity: 0, transitionDuration: `${timeline.reveal}ms` }
        : { opacity: phase === 'black' ? 1 : 0, transitionDuration: '0ms' }

  return (
    <div className={`doorway doorway--${phase}`} onClick={handleClick}>
      {phase !== 'black' && phase !== 'revealing' && Door && (
        <div className="doorway__stage">
          <Door onOpen={open} />
        </div>
      )}

      <div className="doorway__chrome">
        <p className="doorway__kicker">harshil prakash · a portfolio, arranged as a room</p>
        {/* The name is on the plate on the door. This is here for the reader who
            is getting the page as a document rather than as a picture. */}
        <h1 className="doorway__title">Pixelroom</h1>
        <button
          ref={enterButton}
          type="button"
          className="doorway__enter"
          onClick={open}
          disabled={!Door}
        >
          {Door ? '▸ open the door' : '· · ·'}
        </button>
      </div>

      <div className="doorway__veil" style={veil} />
    </div>
  )
}
