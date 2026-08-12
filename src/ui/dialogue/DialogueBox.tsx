import { useCallback, useEffect, useRef, useState } from 'react'
import { useDialogueStore } from '@/state/useDialogueStore'
import { playSfx } from '@/audio/sfx'
import { isTypingTarget } from '../keyboard'
import './dialogue.css'

const CHARS_PER_SECOND = 42
/** Blip every N characters — per-character is a machine gun (plan §8). */
const BLIP_EVERY = 3
/** How long a transient (hover) line lingers once fully typed. */
const TRANSIENT_HOLD_MS = 1800

/** Punctuation gets extra dwell time; it's what makes the delivery feel dry. */
const PAUSE_AFTER: Record<string, number> = {
  '.': 0.22,
  ',': 0.1,
  '?': 0.24,
  '!': 0.24,
  '…': 0.3,
}

/**
 * The narrator box (plan §8).
 *
 * A persistent bottom-anchored overlay that renders whatever the dialogue
 * store has queued — it knows nothing about hotspots, and hotspots know
 * nothing about it.
 *
 * Typing is driven by an accumulator against real elapsed time rather than a
 * fixed-interval timer, so the reveal rate stays correct if the tab throttles
 * or a frame runs long.
 */
export function DialogueBox() {
  const current = useDialogueStore((s) => s.current)
  const transient = useDialogueStore((s) => s.transient)
  const locked = useDialogueStore((s) => s.locked)
  const complete = useDialogueStore((s) => s.complete)
  const advance = useDialogueStore((s) => s.advance)
  const markComplete = useDialogueStore((s) => s.markComplete)

  const [revealed, setRevealed] = useState(0)
  const frame = useRef<number>(0)

  useEffect(() => {
    setRevealed(0)
    if (!current) return

    let cancelled = false
    let last = performance.now()
    let budget = 0
    let index = 0
    let sinceBlip = 0

    const step = (now: number) => {
      if (cancelled) return
      const delta = (now - last) / 1000
      last = now
      budget += delta * CHARS_PER_SECOND

      while (budget >= 1 && index < current.length) {
        const char = current[index]
        index += 1
        budget -= 1

        // Spaces shouldn't trigger a blip — it makes the rhythm lumpy.
        if (char.trim().length > 0) {
          sinceBlip += 1
          if (sinceBlip >= BLIP_EVERY) {
            sinceBlip = 0
            playSfx('blip')
          }
        }

        const pause = PAUSE_AFTER[char]
        if (pause) budget -= pause * CHARS_PER_SECOND
      }

      setRevealed(index)

      if (index >= current.length) {
        markComplete()
        return
      }
      frame.current = requestAnimationFrame(step)
    }

    frame.current = requestAnimationFrame(step)
    return () => {
      cancelled = true
      cancelAnimationFrame(frame.current)
    }
  }, [current, markComplete])

  // Transient lines clear themselves; they're flavour, not a prompt.
  useEffect(() => {
    if (!complete || !transient) return
    const id = window.setTimeout(() => advance(), TRANSIENT_HOLD_MS)
    return () => window.clearTimeout(id)
  }, [complete, transient, advance])

  const handleAdvance = useCallback(() => {
    if (!current) return
    if (revealed < current.length) {
      // A locked line types at its own pace: it is the one moment the visitor
      // is being shown something rather than driving, so even the fast-forward
      // is withheld until the sentence lands.
      if (locked) return
      // Otherwise the first click completes the line rather than skipping it —
      // skipping text the visitor hasn't read yet is the classic RPG dialogue
      // sin.
      setRevealed(current.length)
      markComplete()
      return
    }
    advance()
  }, [current, revealed, locked, advance, markComplete])

  useEffect(() => {
    if (!current || transient) return
    const onKey = (event: KeyboardEvent) => {
      // Never steal keys from a focused field — Terminal.exe needs Enter and
      // the space bar far more than the narrator does.
      if (isTypingTarget(event)) return
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault()
        handleAdvance()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, transient, handleAdvance])

  if (!current) return null

  const isDone = revealed >= current.length

  return (
    <>
      {locked && !transient && (
        // Sits above every other layer, so during a locked line the room, the
        // chrome and the panels are all unclickable — and once the line has
        // landed, the same element turns the whole viewport into the dismiss
        // target rather than making the visitor aim at the box.
        <div
          className={`dialogue-scrim ${isDone ? 'dialogue-scrim--ready' : ''}`}
          onClick={handleAdvance}
          aria-hidden="true"
        />
      )}
      <div
        className={`dialogue ${transient ? 'dialogue--transient' : ''} ${
          locked ? 'dialogue--locked' : ''
        }`}
      >
        <div
          className="dialogue__box pixel-panel"
          onClick={transient ? undefined : handleAdvance}
          role={transient ? 'status' : 'button'}
          tabIndex={transient ? -1 : 0}
          aria-live="polite"
          onKeyDown={(event) => {
            if (transient) return
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              handleAdvance()
            }
          }}
        >
          <p className="dialogue__text">
            {current.slice(0, revealed)}
            {!isDone && (
              <span className="dialogue__caret" aria-hidden="true">
                ▌
              </span>
            )}
          </p>
          {isDone && !transient && (
            <span className="dialogue__continue" aria-hidden="true">
              ▼
            </span>
          )}
        </div>
      </div>
    </>
  )
}
