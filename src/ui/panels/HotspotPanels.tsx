import { Suspense, lazy } from 'react'
import { HOTSPOTS } from '@/hotspots/hotspots'
import { useRoomStore } from '@/state/useRoomStore'

/**
 * Routes the focused hotspot to its panel (plan §4: each hotspot references
 * whatever component renders its interior UI).
 *
 * Every panel is a separate lazy chunk. The PC in particular pulls in xp.css
 * plus a window manager, and none of that should touch the network for a
 * visitor who only ever looks at the bookshelf (plan §9).
 */
const PcPanel = lazy(() => import('./PcPanel').then((m) => ({ default: m.PcPanel })))
const JukeboxPanel = lazy(() => import('./JukeboxPanel').then((m) => ({ default: m.JukeboxPanel })))
const BookshelfPanel = lazy(() =>
  import('./BookshelfPanel').then((m) => ({ default: m.BookshelfPanel })),
)
const CorkboardPanel = lazy(() =>
  import('./CorkboardPanel').then((m) => ({ default: m.CorkboardPanel })),
)
const ContactPanel = lazy(() => import('./ContactPanel').then((m) => ({ default: m.ContactPanel })))
const WhiteboardPanel = lazy(() =>
  import('./WhiteboardPanel').then((m) => ({ default: m.WhiteboardPanel })),
)

export function HotspotPanels() {
  const focused = useRoomStore((s) => s.focused)
  const cameraSettled = useRoomStore((s) => s.cameraSettled)

  // Panels wait for the dolly to finish. Fading UI in over a moving camera
  // makes the move feel like a loading screen rather than a camera move.
  if (focused === null || !cameraSettled) return null

  const kind = HOTSPOTS[focused].panel
  if (kind === 'none') return null

  return (
    <Suspense fallback={<PanelLoading />}>
      {kind === 'pc' && <PcPanel />}
      {kind === 'jukebox' && <JukeboxPanel />}
      {kind === 'bookshelf' && <BookshelfPanel />}
      {kind === 'corkboard' && <CorkboardPanel />}
      {kind === 'contact' && <ContactPanel />}
      {kind === 'whiteboard' && <WhiteboardPanel />}
    </Suspense>
  )
}

function PanelLoading() {
  return (
    <div className="panel panel--default" aria-busy="true">
      <div className="panel__body panel__loading">loading…</div>
    </div>
  )
}
