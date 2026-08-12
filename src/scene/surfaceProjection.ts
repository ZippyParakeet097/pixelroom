/**
 * Where a modelled screen currently is, in CSS pixels.
 *
 * Three objects in the room carry their UI on their own face rather than in a
 * panel beside them — the monitor's tube, the jukebox's selection window and
 * the whiteboard, which takes the visitor's ink — so this is keyed rather than
 * singular.
 *
 * It is deliberately a plain emitter rather than a zustand store. The values
 * are republished from inside the render loop, and every consumer of one wants
 * to write `style.transform` — not to re-render. A store would make each
 * update a React render of the entire faux desktop (five lazy apps, a window
 * manager, xp.css) for a rectangle that moves by a fraction of a pixel.
 *
 * `null` means "that glass is not being looked at" — consumers should hide.
 */
export interface ScreenRect {
  left: number
  top: number
  width: number
  height: number
}

/** One entry per object whose interface lives on its own modelled surface. */
export type SurfaceId = 'monitor' | 'jukebox' | 'whiteboard'

type Listener = (rect: ScreenRect | null) => void

/** Sub-pixel churn isn't worth a style write; the browser can't show it. */
const EPSILON = 0.25

const current = new Map<SurfaceId, ScreenRect | null>()
const listeners = new Map<SurfaceId, Set<Listener>>()

function unchanged(a: ScreenRect | null, b: ScreenRect | null): boolean {
  if (a == null || b == null) return (a ?? null) === (b ?? null)
  return (
    Math.abs(a.left - b.left) < EPSILON &&
    Math.abs(a.top - b.top) < EPSILON &&
    Math.abs(a.width - b.width) < EPSILON &&
    Math.abs(a.height - b.height) < EPSILON
  )
}

export function publishSurfaceRect(id: SurfaceId, next: ScreenRect | null): void {
  if (unchanged(current.get(id) ?? null, next)) return
  current.set(id, next)
  const set = listeners.get(id)
  if (!set) return
  for (const listener of set) listener(next)
}

/**
 * Subscribes to one surface's rectangle. The listener fires immediately with
 * the current value so a component that mounts after the camera has already
 * settled — which is the normal case, since panels wait for the dolly — is
 * positioned on its first frame rather than flashing at the top-left corner.
 */
export function subscribeSurfaceRect(id: SurfaceId, listener: Listener): () => void {
  let set = listeners.get(id)
  if (!set) {
    set = new Set()
    listeners.set(id, set)
  }
  set.add(listener)
  listener(current.get(id) ?? null)
  return () => {
    set.delete(listener)
  }
}
