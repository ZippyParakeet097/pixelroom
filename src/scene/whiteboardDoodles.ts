import { BOARD_TOOLS, INK, NIB_WIDTH, type ToolId } from './whiteboard'

/**
 * What was already on the whiteboard when the visitor walked in (plan §7).
 *
 * Authored in exactly the space the visitor draws in — the same canvas
 * resolution, the same four marker colours, the same nib — so there is no seam
 * between "the picture of a whiteboard" and "the whiteboard". A stroke added
 * today sits next to these at the same weight on the same pixel grid, on the
 * same layer, and the felt takes either without knowing the difference.
 *
 * Nothing here is drawn with rectangles any more. Every line is bowed, every
 * box overshoots its corners, every line of writing is off-level by a degree or
 * two, because a straight edge on a whiteboard reads as a diagram someone
 * printed and stuck up rather than something a person wrote by hand.
 */

/** The board itself, under everything. */
export const BOARD_SURFACE = '#dfe4e2'

/** Ink, by marker — the visitor's own set (see BOARD_TOOLS). */
const INKS = Object.fromEntries(
  BOARD_TOOLS.filter((tool) => tool.ink).map((tool) => [tool.id, tool.ink as string]),
) as Record<Exclude<ToolId, 'eraser'>, string>

/**
 * Handwriting, from system stacks only.
 *
 * The site downloads no webfonts (see docs/CREDITS.md), so this falls through
 * the marker-ish faces each desktop platform ships — Bradley Hand and Chalkboard
 * on macOS, Segoe Print and Ink Free on Windows — and ends at the room's own
 * monospace. A machine with none of them gets a board written in Courier, which
 * reads as a different hand rather than as a missing font.
 */
const HAND =
  "'Bradley Hand', 'Chalkboard SE', 'Marker Felt', 'Segoe Print', 'Ink Free', " +
  "'Comic Sans MS', cursive, 'Courier New', monospace"

/**
 * Deterministic jitter. Every wobble below comes from here, so the board is
 * hand-drawn but identical on every visit — a whiteboard that re-scrawled itself
 * on reload would be a different board, not the same one seen twice.
 */
let seed = 0
function rand(): number {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

/** Signed jitter of at most `amount`. */
function wobble(amount: number): number {
  return (rand() - 0.5) * 2 * amount
}

function nib(
  ctx: CanvasRenderingContext2D,
  color: string,
  width = NIB_WIDTH,
  /** Under 1 for a marker that is running dry. */
  alpha = 1,
): void {
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = alpha
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
}

/** A line with a slight bow in it, the way an unsupported hand draws one. */
function line(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  bow = 0.03,
): void {
  const dx = x2 - x1
  const dy = y2 - y1
  const length = Math.hypot(dx, dy) || 1
  const off = wobble(length * bow)
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.quadraticCurveTo(
    (x1 + x2) / 2 - (dy / length) * off,
    (y1 + y2) / 2 + (dx / length) * off,
    x2,
    y2,
  )
  ctx.stroke()
}

/** Four bowed lines that overshoot their corners, rather than a strokeRect. */
function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const over = 1.4
  line(ctx, x - wobble(over), y + wobble(over), x + w + wobble(over), y + wobble(over))
  line(ctx, x + w + wobble(over), y - wobble(over), x + w + wobble(over), y + h + wobble(over))
  line(ctx, x + w + wobble(over), y + h + wobble(over), x - wobble(over), y + h + wobble(over))
  line(ctx, x + wobble(over), y + h + wobble(over), x + wobble(over), y - wobble(over))
}

function arrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): void {
  line(ctx, x1, y1, x2, y2)
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const head = 5.5
  for (const sweep of [2.6, -2.6]) {
    line(
      ctx,
      x2,
      y2,
      x2 + Math.cos(angle + sweep) * head,
      y2 + Math.sin(angle + sweep) * head,
      0.01,
    )
  }
}

interface WriteOptions {
  size?: number
  /** Radians. Handwriting almost never sits level on a wall-mounted board. */
  tilt?: number
  /** Under 1 for a marker that is running dry. */
  alpha?: number
  align?: CanvasTextAlign
}

/**
 * A line of handwriting, returned as its width so callers can strike it through
 * or underline it without measuring twice.
 *
 * Filled only. An earlier pass also stroked each glyph to fatten it toward the
 * nib the rest of the board is drawn with, on the theory that one marker wrote
 * all of it — but a face this small has counters a couple of pixels across, and
 * thickening the strokes closed them up: SCENE came out as a black lozenge. The
 * board is more convincing with writing that is legible and a shade finer than
 * its own diagrams, which is also true of anybody's actual handwriting.
 */
function write(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  { size = 9, tilt = wobble(0.02), alpha = 1, align = 'left' }: WriteOptions = {},
): number {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(tilt)
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = alpha
  ctx.font = `${size}px ${HAND}`
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = align
  ctx.fillStyle = color
  ctx.fillText(text, 0, 0)
  const width = ctx.measureText(text).width
  ctx.restore()
  return width
}

/**
 * A pass of the felt that did not quite take.
 *
 * The narrator calls this board half-erased, and a board that has been used is
 * never clean: the felt lifts most of a stroke and leaves a ghost of it behind.
 * This is the visitor's own eraser, at partial strength — the same
 * `destination-out` on the same kind of transparent layer.
 */
function ghost(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  lifted = 0.82,
): void {
  ctx.save()
  ctx.globalCompositeOperation = 'destination-out'
  ctx.globalAlpha = lifted
  ctx.fillStyle = '#000'
  ctx.fillRect(x, y, w, h)
  ctx.restore()
}

/**
 * The pre-authored ink, on a transparent layer.
 *
 * Built once and used as the board's starting state: the room paints it onto
 * the board's texture, and the first visit to the board seeds the live ink
 * layer from it. From then on the live layer is the board — these strokes are
 * in it, erasable like any other, and this bitmap is only the memory of how it
 * looked before anyone touched it.
 */
let doodles: HTMLCanvasElement | null = null

export function boardDoodles(): HTMLCanvasElement {
  if (doodles) return doodles
  doodles = document.createElement('canvas')
  doodles.width = INK.width
  doodles.height = INK.height
  const ctx = doodles.getContext('2d')
  if (ctx) drawBoardDoodles(ctx)
  return doodles
}

/**
 * The board as it was left. Drawn in reading order: the list someone was
 * working through, the thing they were working on, the diagram they gave up on,
 * and what is left of whatever was there before all three.
 */
function drawBoardDoodles(ctx: CanvasRenderingContext2D): void {
  seed = 20260812

  /* --- the list, top left ------------------------------------------------ */

  const heading = write(ctx, 'TODO', 15, 20, INKS.black, { size: 12, tilt: -0.015 })
  nib(ctx, INKS.black)
  line(ctx, 14, 23.5, 15 + heading, 24.5)

  const items: Array<[string, boolean]> = [
    ['camera dolly', true],
    ['jukebox sfx', true],
    ['this board', false],
  ]
  items.forEach(([label, done], index) => {
    const y = 38 + index * 13
    nib(ctx, INKS.black, 1.5)
    box(ctx, 15, y - 6.5, 7.5, 7.5)
    const width = write(ctx, label, 28, y, INKS.black, { size: 9.5 })
    if (done) {
      // The tick runs outside its box, because nobody aims one, and the strike
      // is a quick swipe rather than a ruled line — through the middle of the
      // x-height, which is where a hand crossing something out actually lands.
      nib(ctx, INKS.red, 1.5)
      line(ctx, 16.5, y - 3, 18.5, y - 0.5, 0.02)
      line(ctx, 18.5, y - 0.5, 23.5, y - 9, 0.02)
      nib(ctx, INKS.red, 1.3)
      line(ctx, 26, y - 2 + wobble(0.4), 31 + width, y - 2.6 + wobble(0.4), 0.015)
    }
  })

  // Someone came back later, in another marker, and pointed at the open one.
  nib(ctx, INKS.green, 1.6)
  arrow(ctx, 116, 82, 98, 70)
  write(ctx, 'you are here', 92, 92, INKS.green, { size: 8, tilt: 0.03 })

  /* --- a number worth arguing about, and the code it went into ----------- */

  // Circled, the way anyone circles the one constant everything else is
  // sensitive to.
  const fov = write(ctx, 'fov = 32', 22, 84, INKS.black, { size: 8.5, tilt: 0.015 })
  nib(ctx, INKS.red, 1.4)
  ctx.beginPath()
  ctx.ellipse(22 + fov / 2, 80.5, fov / 2 + 5, 8, wobble(0.06), 0, Math.PI * 2)
  ctx.stroke()

  // Spelled out rather than written `!focused`: the bang is a single upright
  // in this hand and comes out as an I, which turns a condition into a word.
  write(ctx, 'if (focused == null) {', 16, 116, INKS.blue, { size: 9, tilt: -0.008 })
  write(ctx, 'return home', 27, 128, INKS.blue, { size: 9, tilt: 0.012, alpha: 0.94 })
  write(ctx, '}', 16, 140, INKS.blue, { size: 9 })
  // A note added afterwards, in the marker that was already in hand.
  write(ctx, '← always does', 62, 140, INKS.green, { size: 7.5, tilt: 0.02, alpha: 0.9 })

  const note = write(ctx, "don't ship on fridays", 138, 152, INKS.green, {
    size: 9,
    tilt: -0.01,
  })
  nib(ctx, INKS.green, 1.6)
  line(ctx, 137, 155, 138 + note, 155.5)

  /* --- the diagram that stops halfway, right ----------------------------- */

  // Title case, not caps. Caps in this hand put an E a pixel away from a 6 at
  // this size, and "SC6N6" is not a diagram anybody drew.
  nib(ctx, INKS.black, 1.8)
  box(ctx, 158, 14, 52, 20)
  write(ctx, 'Scene', 184, 28, INKS.black, { size: 10, tilt: 0.01, align: 'center' })

  nib(ctx, INKS.black, 1.8)
  arrow(ctx, 184, 35, 184, 52)

  nib(ctx, INKS.black, 1.8)
  box(ctx, 158, 53, 52, 20)
  write(ctx, 'Hotspot', 184, 67, INKS.black, { size: 10, tilt: -0.012, align: 'center' })

  // Circled in red at some point, which is where the thought ran out.
  nib(ctx, INKS.red, 1.6)
  ctx.beginPath()
  ctx.ellipse(184, 63, 32, 16, wobble(0.05), 0, Math.PI * 2)
  ctx.stroke()
  write(ctx, '?', 224, 72, INKS.red, { size: 20, tilt: 0.06 })

  nib(ctx, INKS.black, 1.5)
  arrow(ctx, 211, 24, 236, 24)
  write(ctx, 'camera', 214, 19, INKS.black, { size: 7, tilt: -0.04 })

  /* --- and a face, because someone always draws one ---------------------- */

  nib(ctx, INKS.black, 1.6)
  ctx.beginPath()
  ctx.ellipse(133, 30, 8, 7.5, wobble(0.08), 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(130.4, 28, 0.7, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(135.6, 27.7, 0.7, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(133, 30, 4.4, 0.4, Math.PI - 0.4)
  ctx.stroke()

  /* --- what was there before, mostly gone -------------------------------- */

  write(ctx, 'OLD PLAN', 152, 106, INKS.blue, { size: 11, tilt: -0.03 })
  nib(ctx, INKS.blue, 1.6)
  line(ctx, 152, 111, 240, 109)
  write(ctx, 'four rooms? too many', 152, 124, INKS.black, { size: 8.5, tilt: 0.02 })
  write(ctx, 'one room, more stuff in it', 152, 136, INKS.black, { size: 8.5, tilt: -0.015 })
  nib(ctx, INKS.red, 1.6)
  line(ctx, 148, 130, 254, 118, 0.05)
  ghost(ctx, 144, 94, 118, 48)

  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
}
