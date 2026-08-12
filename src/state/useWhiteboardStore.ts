import { create } from 'zustand'
import { INK, type ToolId } from '@/scene/whiteboard'

interface WhiteboardState {
  /** The tool currently in hand, or null when everything is in the tray. */
  held: ToolId | null
  /** The tray tool under the pointer, so the chrome can name it. */
  hovered: ToolId | null

  /** Picks a tool up, or puts it back if it is already the one in hand. */
  take: (id: ToolId) => void
  putDown: () => void
  setHovered: (id: ToolId | null) => void
}

/**
 * What the visitor is holding at the whiteboard (plan §7).
 *
 * A store rather than component state because the two halves of this hotspot
 * live on opposite sides of the renderer: the tray is modelled geometry inside
 * the <Canvas>, and the ink is a DOM layer pasted onto the board's face. Both
 * need to agree on which marker is in hand.
 */
export const useWhiteboardStore = create<WhiteboardState>((set, get) => ({
  held: null,
  hovered: null,

  take: (id) => set({ held: get().held === id ? null : id }),
  putDown: () => {
    if (get().held === null) return
    set({ held: null })
  },
  setHovered: (id) => {
    if (get().hovered === id) return
    set({ hovered: id })
  },
}))

/**
 * The board's ink, kept outside React so it survives walking away.
 *
 * Everything written on the board lives on one layer — the notes that were
 * already there and whatever the visitor adds — because the felt has to be able
 * to take either. (Plan §7 has the eraser restore the pre-authored notes rather
 * than remove them; a board where two thirds of the ink shrugs off the eraser
 * is the odder thing to explain, so this goes the other way.)
 *
 * The layer unmounts when the camera leaves the board — every hotspot's DOM
 * does — and a canvas that came back blank would mean the room quietly wiped a
 * board nobody asked it to wipe. The bitmap is restored on the way in and saved
 * on the way out.
 *
 * Session-scoped and nothing more: no localStorage, no backend, no shared
 * board. It all resets on reload, which is the explicit decision in plan §7 and
 * a non-goal in §14.
 */
let saved: HTMLCanvasElement | null = null

/** False when there is nothing saved yet, so the caller can seed the layer. */
export function restoreInk(target: HTMLCanvasElement): boolean {
  if (!saved) return false
  target.getContext('2d')?.drawImage(saved, 0, 0)
  return true
}

export function saveInk(source: HTMLCanvasElement): void {
  if (!saved) {
    saved = document.createElement('canvas')
    saved.width = INK.width
    saved.height = INK.height
  }
  const ctx = saved.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, INK.width, INK.height)
  ctx.drawImage(source, 0, 0)
}
