import { useEffect, useRef, useState } from 'react'
import { APPS, DESKTOP_ICON_ORDER } from './apps'
import { useWindowStore } from './windowStore'
import { XpWindow } from './XpWindow'
import { Taskbar } from './Taskbar'
import { playSfx } from '@/audio/sfx'
import 'xp.css/dist/XP.css'
import './xp-desktop.css'

/**
 * The faux desktop inside the monitor (plan §6).
 *
 * `xp.css` supplies the window chrome, buttons and title bars; everything
 * around it — z-order, dragging, minimise/restore, the taskbar and the Start
 * menu — is the small window-manager layer the plan asks for on top.
 *
 * The stylesheet is imported here rather than globally so it lands in the PC's
 * lazy chunk: it is ~250 KB with its fonts inlined, and a visitor who never
 * sits down at the desk should never download it (plan §9).
 */
export function XpDesktop() {
  const windows = useWindowStore((s) => s.windows)
  const open = useWindowStore((s) => s.open)
  const [selected, setSelected] = useState<string | null>(null)
  const desktopRef = useRef<HTMLDivElement>(null)
  const [bounds, setBounds] = useState({ width: 800, height: 500 })

  useEffect(() => {
    const element = desktopRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      setBounds({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="xp">
      <div
        className="xp__desktop"
        ref={desktopRef}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) setSelected(null)
        }}
      >
        <ul className="xp__icons">
          {DESKTOP_ICON_ORDER.map((appId) => {
            const app = APPS[appId]
            return (
              <li key={appId}>
                <button
                  type="button"
                  className={`xp__icon ${selected === appId ? 'is-selected' : ''}`}
                  onClick={() => {
                    setSelected(appId)
                    playSfx('hover')
                  }}
                  onDoubleClick={() => {
                    playSfx('select')
                    open(appId)
                  }}
                >
                  <span className="xp__icon-glyph" style={{ color: app.accent }}>
                    {app.glyph}
                  </span>
                  <span className="xp__icon-label">{app.title}</span>
                </button>
              </li>
            )
          })}
        </ul>

        {windows.map((instance) => (
          <XpWindow key={instance.id} instance={instance} bounds={bounds} />
        ))}

        <p className="xp__hint">double-click an icon</p>
      </div>

      <Taskbar />
    </div>
  )
}
