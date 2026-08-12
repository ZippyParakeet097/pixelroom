import { Suspense, lazy, useEffect, useState } from 'react'
import { BootScreen } from './ui/BootScreen'
import { DialogueBox } from './ui/dialogue/DialogueBox'
import { RoomChrome } from './ui/RoomChrome'
import { MobileGate } from './ui/MobileGate'
import { useRoomStore } from './state/useRoomStore'
import { playSfx } from './audio/sfx'

/** Below this CSS width the 3D room is replaced by the résumé gate (plan §10). */
const MIN_WIDTH = 1024

/**
 * The 3D scene is lazy so that three.js — by far the largest thing here — is
 * never fetched on a viewport that will only ever see the résumé gate. A
 * static import would put it in the entry chunk and every phone visitor would
 * pay ~190 KB gzip to download a renderer the gate never mounts (plan §9, §10).
 */
const Scene = lazy(() => import('./scene/Scene').then((m) => ({ default: m.Scene })))

const HotspotPanels = lazy(() =>
  import('./ui/panels/HotspotPanels').then((m) => ({ default: m.HotspotPanels })),
)

function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window === 'undefined' || window.innerWidth >= MIN_WIDTH,
  )

  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${MIN_WIDTH}px)`)
    const update = () => setIsDesktop(query.matches)
    update()

    // Both signals on purpose. The media-query `change` event is the precise
    // one — it fires only at the breakpoint — but it can be missed entirely if
    // the viewport changes while the document is hidden or throttled, and this
    // flag decides whether the visitor sees the site at all. `resize` is the
    // coarse backstop; `update` is idempotent so the overlap costs nothing.
    query.addEventListener('change', update)
    window.addEventListener('resize', update)
    return () => {
      query.removeEventListener('change', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return isDesktop
}

/**
 * Global Esc — the single way back out (plan §4).
 *
 * `stepBack` unwinds one level at a time, so from an open bookshelf row the
 * first Esc pushes the book back and the second leaves the shelf. A panel that
 * owns the keyboard (terminal, whiteboard draw mode) sets `inputLocked` and
 * handles Esc itself; `stepBack` respects that and does nothing.
 */
function useEscapeToHome() {
  const focused = useRoomStore((s) => s.focused)
  const inputLocked = useRoomStore((s) => s.inputLocked)
  const stepBack = useRoomStore((s) => s.stepBack)

  useEffect(() => {
    if (focused === null || inputLocked) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      playSfx('back')
      stepBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focused, inputLocked, stepBack])
}

export function App() {
  const isDesktop = useIsDesktop()
  const stage = useRoomStore((s) => s.stage)
  useEscapeToHome()

  if (!isDesktop) return <MobileGate />

  return (
    <>
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
      <BootScreen />
      {stage === 'room' && (
        <>
          <RoomChrome />
          <Suspense fallback={null}>
            <HotspotPanels />
          </Suspense>
          <DialogueBox />
        </>
      )}
    </>
  )
}
