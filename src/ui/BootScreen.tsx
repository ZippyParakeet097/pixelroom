import { useCallback, useEffect, useState } from 'react'
import { unlockAudio } from '@/audio/engine'
import { useRoomStore } from '@/state/useRoomStore'
import './boot.css'

const FADE_MS = 420

/**
 * The gate before the room.
 *
 * This exists for a concrete technical reason as well as an atmospheric one:
 * browsers keep an AudioContext suspended until a genuine user gesture, so
 * without a click-to-enter step the intro narration would type out in silence
 * (plan §8 depends on the blips landing on the first line).
 *
 * The click flips `stage` synchronously and the timer only controls when this
 * overlay unmounts. Putting the state change *inside* the timer instead leaves
 * a window where the overlay is already transparent and click-through but the
 * app still thinks it's booting — if that timer is ever interrupted, the site
 * is stuck on an invisible splash screen with no way forward.
 */
export function BootScreen() {
  const stage = useRoomStore((s) => s.stage)
  const enterRoom = useRoomStore((s) => s.enterRoom)
  const [faded, setFaded] = useState(false)

  const handleEnter = useCallback(() => {
    if (stage !== 'boot') return
    unlockAudio()
    enterRoom()
  }, [stage, enterRoom])

  // Keyed off `stage` in both directions: if anything ever puts the app back
  // into 'boot', the overlay comes back rather than leaving the visitor on a
  // room they can't interact with.
  useEffect(() => {
    if (stage !== 'room') {
      setFaded(false)
      return
    }
    const id = window.setTimeout(() => setFaded(true), FADE_MS)
    return () => window.clearTimeout(id)
  }, [stage])

  useEffect(() => {
    if (stage !== 'boot') return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        handleEnter()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stage, handleEnter])

  if (stage === 'room' && faded) return null

  return (
    <div className={`boot ${stage === 'room' ? 'boot--leaving' : ''}`}>
      <div className="boot__inner">
        <p className="boot__kicker">harshil prakash · a portfolio, arranged as a room</p>
        <h1 className="boot__title">MAN CAVE</h1>
        <button type="button" className="boot__enter" onClick={handleEnter} autoFocus>
          ▸ open the door
        </button>
        <p className="boot__hint">
          headphones recommended · click objects to look closer · <kbd>Esc</kbd> to step back
        </p>
      </div>
    </div>
  )
}
