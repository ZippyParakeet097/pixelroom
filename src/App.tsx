import { Suspense, lazy, useEffect, useState } from 'react'
import { DoorIntro } from './ui/DoorIntro'
import { DialogueBox } from './ui/dialogue/DialogueBox'
import { RoomChrome } from './ui/RoomChrome'
import { MobilePortfolio } from './mobile/MobilePortfolio'
import { useRoomStore } from './state/useRoomStore'
import { playSfx } from './audio/sfx'

/** Below this CSS width the 3D room is replaced by the mobile portfolio page (plan §10). */
const MIN_WIDTH = 1024

/**
 * The 3D scene is lazy so that three.js — by far the largest thing here — is
 * never fetched on a viewport that will only ever see the mobile portfolio
 * page. A static import would put it in the entry chunk and every phone
 * visitor would pay ~190 KB gzip to download a renderer the page never mounts
 * (plan §9, §10).
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

/**
 * Pulls the room's chunk down during the opening sequence.
 *
 * The room is not mounted until the door starts moving, but waiting until then
 * to start fetching it would put a network round-trip inside the swing.
 * Fetching on load means the chunk is already in hand when the click lands.
 */
function usePrefetchScene(active: boolean) {
  useEffect(() => {
    if (!active) return
    void import('./scene/Scene')
  }, [active])
}

export function App() {
  const isDesktop = useIsDesktop()
  const stage = useRoomStore((s) => s.stage)
  useEscapeToHome()
  usePrefetchScene(isDesktop)

  if (!isDesktop) return <MobilePortfolio />

  return (
    <>
      {/* Mounted the moment the door starts moving rather than when the black
          lands, so the room's first frame — the expensive one, where every
          material in it compiles — happens behind an opaque overlay with two
          seconds of slack, instead of inside a 460ms black hold that it can
          overrun. It costs a second canvas for the length of the swing, which
          is less work than the boot screen used to sit in front of. */}
      {stage !== 'door' && (
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      )}
      <DoorIntro />
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
