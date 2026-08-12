import { useEffect, useRef } from 'react'
import { subscribeSurfaceRect } from '@/scene/surfaceProjection'
import { useRoomStore } from '@/state/useRoomStore'
import { XpDesktop } from '../xp/XpDesktop'
import { useWindowStore } from '../xp/windowStore'
import './panels.css'

/**
 * The PC hotspot's interior: a faux XP desktop living on the monitor's glass.
 *
 * Like the jukebox and unlike every other hotspot, this is not a panel beside
 * the object — it is pasted onto the object. <SurfaceProjector> publishes where
 * the screen mesh currently projects to in CSS pixels and this positions itself
 * there, so the desktop is framed by the modelled bezel instead of floating
 * over the room in its own window.
 *
 * The rectangle is applied imperatively rather than through state. It is
 * republished from the render loop, and re-rendering a window manager plus
 * five lazy apps at 60 Hz to move a div is not a trade worth making — React
 * owns what is *in* the desktop, the projector owns where it sits.
 */
export function PcPanel() {
  const closeAll = useWindowStore((s) => s.closeAll)
  const monitorOn = useRoomStore((s) => s.monitorOn)
  const glass = useRef<HTMLDivElement>(null)

  // Leaving the desk closes every window. Walking away and coming back to the
  // exact same arrangement of open apps would be a nice touch, but it also
  // means a visitor can never get a clean desktop back — resetting is the
  // friendlier default.
  useEffect(() => () => closeAll(), [closeAll])

  // The tube going out has to take the desktop with it. <Desk> collapses the
  // 3D screen and then walks the camera away; leaving a crisp DOM desktop
  // hanging over a dead monitor for that half second would undo the whole
  // effect. Kept as a ref read inside the projector subscription rather than a
  // second effect, so power state and geometry are applied in one place.
  const powered = useRef(monitorOn)
  powered.current = monitorOn
  useEffect(() => {
    const element = glass.current
    if (element) element.style.visibility = monitorOn ? 'visible' : 'hidden'
  }, [monitorOn])

  useEffect(
    () =>
      subscribeSurfaceRect('monitor', (rect) => {
        const element = glass.current
        if (!element) return

        // No rectangle means the camera is not at the desk. Hide rather than
        // unmount: unmounting would tear down every open app and the window
        // manager along with it.
        if (!rect || !powered.current) {
          element.style.visibility = 'hidden'
          return
        }

        element.style.visibility = 'visible'
        element.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0)`
        element.style.width = `${rect.width}px`
        element.style.height = `${rect.height}px`
      }),
    [],
  )

  return (
    <div className="crt" ref={glass} role="dialog" aria-label="Desktop">
      <XpDesktop />
      {/* Scanlines, tube shading and the power-on flash. Purely decorative, so
          it must never intercept a click meant for the desktop beneath it. */}
      <div className="crt__glass" aria-hidden="true" />
      <div className="crt__flash" aria-hidden="true" />
    </div>
  )
}
