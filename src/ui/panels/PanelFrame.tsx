import type { ReactNode } from 'react'
import { useRoomStore } from '@/state/useRoomStore'
import { playSfx } from '@/audio/sfx'
import './panels.css'

interface PanelFrameProps {
  title: string
  subtitle?: string
  children: ReactNode
  /** 'wide' is for the PC desktop; everything else uses the default column. */
  size?: 'default' | 'wide' | 'tall'
  /**
   * Overrides what the ✕ does. Defaults to leaving the hotspot entirely, which
   * is right for a panel that is the whole of its hotspot. The bookshelf's case
   * study is one level deeper than that — closing it should put you back at the
   * shelf, not back in the middle of the room.
   */
  onClose?: () => void
}

/**
 * Shared chrome for every hotspot panel.
 *
 * Panels are deliberately anchored to one side rather than centred: the camera
 * has just dollied to frame a physical object, and covering that object with a
 * modal throws away the whole point of the move.
 */
export function PanelFrame({
  title,
  subtitle,
  children,
  size = 'default',
  onClose,
}: PanelFrameProps) {
  const returnHome = useRoomStore((s) => s.returnHome)
  const close = onClose ?? returnHome

  return (
    <div className={`panel panel--${size}`} role="dialog" aria-label={title}>
      <header className="panel__bar">
        <div>
          <h2 className="panel__title">{title}</h2>
          {subtitle && <p className="panel__subtitle">{subtitle}</p>}
        </div>
        <button
          type="button"
          className="panel__close"
          onClick={() => {
            playSfx('back')
            close()
          }}
          aria-label="Close and step back"
        >
          ✕
        </button>
      </header>
      <div className="panel__body">{children}</div>
    </div>
  )
}
