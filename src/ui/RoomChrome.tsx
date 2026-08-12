import { useEffect, useState } from 'react'
import { HOTSPOTS } from '@/hotspots/hotspots'
import { PROJECTS } from '@/content/projects'
import { boardTool } from '@/scene/whiteboard'
import { useRoomStore } from '@/state/useRoomStore'
import { useWhiteboardStore } from '@/state/useWhiteboardStore'
import { isMuted, setMuted } from '@/audio/engine'
import { playSfx } from '@/audio/sfx'
import { isTypingTarget } from './keyboard'
import './room-chrome.css'

/**
 * Persistent room UI: the hovered object's name, the way back out, and a mute
 * toggle. Deliberately sparse — the room is supposed to be the interface.
 */
export function RoomChrome() {
  const hovered = useRoomStore((s) => s.hovered)
  const focused = useRoomStore((s) => s.focused)
  const inputLocked = useRoomStore((s) => s.inputLocked)
  const shelfProject = useRoomStore((s) => s.shelfProject)
  const shelfCursor = useRoomStore((s) => s.shelfCursor)
  const stepBack = useRoomStore((s) => s.stepBack)

  // From the shelf-wide stop the whole carcass has to fit the frame, which
  // leaves each paper tag about thirty pixels wide once the pixelation pass
  // has had it — enough to see a label is there, not enough to read it. The
  // row name goes here instead, so pointing at a row always names it.
  const shelfRowName =
    focused === 'bookshelf' && shelfProject === null && shelfCursor !== null
      ? (PROJECTS[shelfCursor]?.title ?? null)
      : null

  // Same treatment as a shelf row, for the same reason: at the board's stop a
  // marker is a coloured stub in a tray, and which colour it is matters before
  // you pick it up rather than after.
  const heldTool = useWhiteboardStore((s) => s.held)
  const hoveredTool = useWhiteboardStore((s) => s.hovered)
  const putDownTool = useWhiteboardStore((s) => s.putDown)
  const toolName =
    focused === 'whiteboard' ? (boardTool(hoveredTool ?? heldTool)?.label ?? null) : null

  const [muted, setMutedState] = useState(isMuted)

  const toggleMute = () => {
    const next = !muted
    setMuted(next)
    setMutedState(next)
    if (!next) playSfx('select')
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Ignore the shortcut while typing into the terminal or any other field.
      if (isTypingTarget(event)) return
      if (event.key.toLowerCase() === 'm') toggleMute()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muted])

  return (
    <>
      {focused === null && hovered !== null && (
        <div className="chrome__label" aria-live="polite">
          {HOTSPOTS[hovered].label}
        </div>
      )}

      {shelfRowName && (
        <div className="chrome__label" aria-live="polite">
          {shelfRowName}
        </div>
      )}

      {toolName && (
        <div className="chrome__label" aria-live="polite">
          {toolName}
          {heldTool !== null && hoveredTool === null && ' · in hand'}
        </div>
      )}

      {/* Holding a marker locks input, which takes the step-back button with
          it. The way out of draw mode replaces it rather than sitting beside
          it — one button in one place, whatever it currently means. */}
      {heldTool !== null && (
        <button
          type="button"
          className="chrome__back pixel-button"
          onClick={() => {
            playSfx('back')
            putDownTool()
          }}
        >
          ▾ put it back <span className="chrome__key">esc</span>
        </button>
      )}

      {focused !== null && !inputLocked && (
        <button
          type="button"
          className="chrome__back pixel-button"
          onClick={() => {
            playSfx('back')
            stepBack()
          }}
        >
          {/* One level at a time: an open shelf row goes back to the shelf
              before the shelf goes back to the room. */}
          ◂ {shelfProject ? 'back to the shelf' : 'step back'}{' '}
          <span className="chrome__key">esc</span>
        </button>
      )}

      <button
        type="button"
        className="chrome__mute pixel-button"
        onClick={toggleMute}
        aria-pressed={muted}
        title="Mute (M)"
      >
        {muted ? '🔇' : '🔊'}
      </button>
    </>
  )
}
