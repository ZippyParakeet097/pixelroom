import { Suspense, useCallback, useEffect, useRef } from 'react'
import { APPS } from './apps'
import { useWindowStore, type WindowInstance } from './windowStore'
import { playSfx } from '@/audio/sfx'

interface XpWindowProps {
  instance: WindowInstance
  /** Desktop bounds, used to clamp dragging. */
  bounds: { width: number; height: number }
}

const TITLE_BAR_HEIGHT = 26

/**
 * One draggable xp.css window.
 *
 * Dragging is handled with pointer capture and written straight to the store
 * on move. React state per mousemove is normally a smell, but a desktop holds
 * a handful of windows at most and this keeps position in one place rather
 * than splitting it between a transform and the store.
 */
export function XpWindow({ instance, bounds }: XpWindowProps) {
  const definition = APPS[instance.appId]
  const focusedId = useWindowStore((s) => s.focusedId)
  const focus = useWindowStore((s) => s.focus)
  const close = useWindowStore((s) => s.close)
  const minimize = useWindowStore((s) => s.minimize)
  const toggleMaximize = useWindowStore((s) => s.toggleMaximize)
  const move = useWindowStore((s) => s.move)

  const isFocused = focusedId === instance.id
  const drag = useRef<{ offsetX: number; offsetY: number } | null>(null)

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (instance.maximized) return
      // Ignore drags that start on the control buttons.
      if ((event.target as HTMLElement).closest('button')) return

      focus(instance.id)
      drag.current = { offsetX: event.clientX - instance.x, offsetY: event.clientY - instance.y }
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [focus, instance.id, instance.maximized, instance.x, instance.y],
  )

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!drag.current) return
      // Clamp so a window can never be dragged fully out of reach; the title
      // bar always stays grabbable.
      const x = Math.min(
        Math.max(event.clientX - drag.current.offsetX, -instance.width + 90),
        bounds.width - 90,
      )
      const y = Math.min(Math.max(event.clientY - drag.current.offsetY, 0), bounds.height - TITLE_BAR_HEIGHT)
      move(instance.id, x, y)
    },
    [bounds.height, bounds.width, instance.id, instance.width, move],
  )

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    drag.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
  }, [])

  useEffect(() => {
    if (isFocused) playSfx('hover')
  }, [isFocused])

  if (instance.minimized) return null

  // Never let a window exceed the desktop it lives in. The desktop is itself
  // inside a panel whose size depends on the viewport, so on a short screen an
  // app's default size can be taller than the space available — and a window
  // whose title bar is reachable but whose body runs off the bottom is worse
  // than a slightly squashed one.
  const width = Math.min(instance.width, Math.max(220, bounds.width - 12))
  const height = Math.min(instance.height, Math.max(140, bounds.height - 12))

  const style: React.CSSProperties = instance.maximized
    ? { left: 0, top: 0, width: '100%', height: '100%', zIndex: instance.z }
    : {
        left: Math.min(instance.x, Math.max(0, bounds.width - width)),
        top: Math.min(instance.y, Math.max(0, bounds.height - height)),
        width,
        height,
        zIndex: instance.z,
      }

  const AppComponent = definition.component

  return (
    <div
      className={`window xp-window ${isFocused ? '' : 'xp-window--blurred'}`}
      style={style}
      onPointerDown={() => focus(instance.id)}
      role="dialog"
      aria-label={definition.title}
    >
      <div
        className="title-bar"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={() => toggleMaximize(instance.id)}
        style={{ cursor: instance.maximized ? 'default' : 'move' }}
      >
        <div className="title-bar-text">{definition.title}</div>
        <div className="title-bar-controls">
          <button aria-label="Minimize" onClick={() => minimize(instance.id)} />
          <button
            aria-label={instance.maximized ? 'Restore' : 'Maximize'}
            onClick={() => toggleMaximize(instance.id)}
          />
          <button
            aria-label="Close"
            onClick={() => {
              playSfx('back')
              close(instance.id)
            }}
          />
        </div>
      </div>

      <div className="window-body xp-window__body">
        <Suspense fallback={<p className="xp-window__loading">Loading…</p>}>
          <AppComponent />
        </Suspense>
      </div>
    </div>
  )
}
