import { useCallback, useEffect, useRef } from 'react'
import { subscribeSurfaceRect } from '@/scene/surfaceProjection'
import { paintWhiteboardFace } from '@/scene/textures'
import { FELT_WIDTH, INK, NIB_WIDTH, boardTool } from '@/scene/whiteboard'
import { boardDoodles } from '@/scene/whiteboardDoodles'
import { playSfx } from '@/audio/sfx'
import { useRoomStore } from '@/state/useRoomStore'
import { restoreInk, saveInk, useWhiteboardStore } from '@/state/useWhiteboardStore'
import './whiteboard-panel.css'

/**
 * The board's ink, drawn straight onto the modelled whiteboard (plan §7).
 *
 * The monitor's and the jukebox's treatment applied to the one object in the
 * room that is not a screen: <SurfaceProjector> publishes where the board's face
 * currently projects to in CSS pixels and this positions itself there, so the
 * strokes land on the board inside its own frame rather than in a panel beside
 * it. There is no modal and no second picture of the board — you draw on the
 * asset.
 *
 * One transparent layer holds everything written on the board, the notes that
 * were already there included, so a marker and the felt reach all of it alike.
 * Under it is the bare surface, which is all that is left when you wipe.
 * Choosing a colour is a click on a real marker in the tray below the board (see
 * <MarkerTray>) — nothing drawn in this rectangle could receive a click anyway,
 * since the rectangle is the drawing surface.
 *
 * The projected rect is applied imperatively rather than through state, for the
 * reason spelled out on <PcPanel>: it is republished from the render loop, and a
 * React render per frame to move a div is not a trade worth making.
 */
export function WhiteboardPanel() {
  const held = useWhiteboardStore((s) => s.held)
  const putDown = useWhiteboardStore((s) => s.putDown)
  const setInputLocked = useRoomStore((s) => s.setInputLocked)

  const surface = useRef<HTMLDivElement>(null)
  const ink = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const lastPoint = useRef<{ x: number; y: number } | null>(null)

  const tool = boardTool(held)

  useEffect(
    () =>
      subscribeSurfaceRect('whiteboard', (rect) => {
        const element = surface.current
        if (!element) return

        // No rectangle means the camera is not at the board. Hide rather than
        // unmount: unmounting the canvas would take the drawing with it.
        if (!rect) {
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

  // Arriving takes the face off the modelled board and puts it here, and the
  // room's copy is left bare so nothing is drawn twice. Leaving hands it back,
  // which is what makes a drawing still be there from across the room.
  //
  // On the very first visit there is nothing saved, so the layer starts as what
  // was already on the board. From then on it is one bitmap that both the old
  // notes and the visitor's strokes live in — which is what lets the felt take
  // either (see `saveInk`).
  useEffect(() => {
    const canvas = ink.current
    if (!canvas) return
    if (!restoreInk(canvas)) canvas.getContext('2d')?.drawImage(boardDoodles(), 0, 0)
    paintWhiteboardFace(null)
    return () => {
      saveInk(canvas)
      paintWhiteboardFace(canvas)
    }
  }, [])

  // While something is in hand the board owns Esc, so the first press puts the
  // marker down rather than sending the camera back across the room.
  useEffect(() => {
    setInputLocked(held !== null)
    return () => setInputLocked(false)
  }, [held, setInputLocked])

  useEffect(() => {
    if (held === null) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      playSfx('back')
      putDown()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [held, putDown])

  const pointFrom = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = ink.current!
    const rect = canvas.getBoundingClientRect()
    // Map CSS pixels to the canvas's own resolution. The board is however many
    // pixels across the projection says it is, and the ink is authored at a
    // fixed low resolution, so these are nowhere near the same space.
    return {
      x: ((event.clientX - rect.left) / rect.width) * INK.width,
      y: ((event.clientY - rect.top) / rect.height) * INK.height,
    }
  }, [])

  const strokeTo = useCallback(
    (point: { x: number; y: number }) => {
      const ctx = ink.current?.getContext('2d')
      if (!ctx || !tool) return

      if (tool.ink === null) {
        // The felt takes whatever is under it — the visitor's strokes and the
        // notes that were already there alike, since both are on this one
        // layer. Erasing exposes the board, not an earlier draft of it.
        ctx.globalCompositeOperation = 'destination-out'
        ctx.lineCap = 'square'
        ctx.lineJoin = 'round'
        ctx.lineWidth = FELT_WIDTH
        ctx.strokeStyle = 'rgba(0,0,0,1)'
      } else {
        ctx.globalCompositeOperation = 'source-over'
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.lineWidth = NIB_WIDTH
        ctx.strokeStyle = tool.ink
      }

      const from = lastPoint.current ?? point
      ctx.beginPath()
      ctx.moveTo(from.x, from.y)
      ctx.lineTo(point.x, point.y)
      ctx.stroke()
      lastPoint.current = point
    },
    [tool],
  )

  const handleDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!tool) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drawing.current = true
    lastPoint.current = null
    strokeTo(pointFrom(event))
  }

  const handleMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!tool || !drawing.current) return
    strokeTo(pointFrom(event))
  }

  const handleUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    event.currentTarget.releasePointerCapture(event.pointerId)
    drawing.current = false
    lastPoint.current = null
  }

  return (
    <div className="board-ink" ref={surface} aria-hidden="true">
      <canvas
        ref={ink}
        width={INK.width}
        height={INK.height}
        className="board-ink__layer"
        style={{
          // Nothing in hand means the board is just a board: the layer has to
          // let the pointer through to the room behind it.
          pointerEvents: tool ? 'auto' : 'none',
          cursor: tool ? (tool.ink === null ? 'cell' : 'crosshair') : 'default',
        }}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
      />
    </div>
  )
}
