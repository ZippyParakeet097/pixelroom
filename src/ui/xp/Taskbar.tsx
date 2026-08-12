import { useEffect, useState } from 'react'
import { APPS, DESKTOP_ICON_ORDER } from './apps'
import { useWindowStore } from './windowStore'
import { playSfx } from '@/audio/sfx'

/**
 * Taskbar with a working Start menu and one button per open window.
 *
 * The clock is deliberately the real system time — it's the single detail that
 * makes a fake desktop feel like it's actually running.
 */
export function Taskbar() {
  const windows = useWindowStore((s) => s.windows)
  const focusedId = useWindowStore((s) => s.focusedId)
  const focus = useWindowStore((s) => s.focus)
  const minimize = useWindowStore((s) => s.minimize)
  const open = useWindowStore((s) => s.open)

  const [startOpen, setStartOpen] = useState(false)
  const [clock, setClock] = useState(() => formatTime())

  useEffect(() => {
    const id = window.setInterval(() => setClock(formatTime()), 15_000)
    return () => window.clearInterval(id)
  }, [])

  // Any click outside the menu dismisses it, matching real Start behaviour.
  useEffect(() => {
    if (!startOpen) return
    const onDown = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest('.xp-start, .xp-start-button')) {
        setStartOpen(false)
      }
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [startOpen])

  return (
    <>
      {startOpen && (
        <div className="xp-start">
          <div className="xp-start__banner">pixelroom</div>
          <ul className="xp-start__list">
            {DESKTOP_ICON_ORDER.map((appId) => (
              <li key={appId}>
                <button
                  type="button"
                  onClick={() => {
                    playSfx('select')
                    open(appId)
                    setStartOpen(false)
                  }}
                >
                  <span className="xp-start__glyph" style={{ color: APPS[appId].accent }}>
                    {APPS[appId].glyph}
                  </span>
                  {APPS[appId].title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="xp-taskbar">
        <button
          type="button"
          className={`xp-start-button ${startOpen ? 'is-open' : ''}`}
          onClick={() => {
            playSfx('select')
            setStartOpen((value) => !value)
          }}
        >
          start
        </button>

        <div className="xp-taskbar__items">
          {windows.map((instance) => (
            <button
              key={instance.id}
              type="button"
              className={`xp-taskbar__item ${
                focusedId === instance.id && !instance.minimized ? 'is-active' : ''
              }`}
              onClick={() => {
                // Clicking the active window's button minimises it, as on XP.
                if (focusedId === instance.id && !instance.minimized) minimize(instance.id)
                else focus(instance.id)
              }}
            >
              <span style={{ color: APPS[instance.appId].accent }}>
                {APPS[instance.appId].glyph}
              </span>
              {APPS[instance.appId].title}
            </button>
          ))}
        </div>

        <div className="xp-taskbar__tray">{clock}</div>
      </div>
    </>
  )
}

function formatTime(): string {
  return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}
