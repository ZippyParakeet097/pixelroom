/**
 * The whiteboard on the left wall, in world units.
 *
 * Same arrangement as `monitor.ts` and `jukebox.ts`, and for the same reason:
 * the board's face carries a DOM layer pasted onto the modelled plane — here the
 * visitor's own ink — so the mesh, the camera preset and the projector all have
 * to agree on one rectangle or the strokes land beside the board they were drawn
 * on.
 *
 * The one difference from the other two is orientation. Both screens face +Z;
 * this hangs on the left wall and faces +X, so its width runs along Z. That is
 * what `axis` tells <SurfaceProjector>.
 */

/** The wall the board hangs on. */
export const WHITEBOARD_WALL_X = -5

/** How far along the wall (in Z) the board sits. */
const BOARD_Z = -0.4

/** Centre height of the board's face. */
const BOARD_Y = 2.6

/** Frame carcass — the aluminium surround the face is set into. */
export const WHITEBOARD_FRAME = {
  center: [WHITEBOARD_WALL_X + 0.1, BOARD_Y, BOARD_Z] as [number, number, number],
  size: [0.08, 1.72, 2.82] as [number, number, number],
}

/**
 * The drawable face. `width` runs along Z, `height` along Y — the plane is
 * rotated a quarter turn about Y to face the room.
 */
export const WHITEBOARD_SURFACE = {
  center: [WHITEBOARD_WALL_X + 0.145, BOARD_Y, BOARD_Z] as [number, number, number],
  width: 2.68,
  height: 1.58,
  axis: 'x' as const,
}

/**
 * The marker tray, which is the board's entire toolbar.
 *
 * There is no DOM control surface for the whiteboard — picking a colour, taking
 * the eraser and putting a marker back are all clicks on modelled objects, the
 * same treatment the jukebox's transport keys get. Anything drawn inside the
 * face's rectangle would sit under the ink overlay and never receive a click
 * anyway, so the tools have to live outside it, and the tray is where a marker
 * lives on a real board.
 */
export const WHITEBOARD_TRAY = {
  x: WHITEBOARD_WALL_X + 0.15,
  y: BOARD_Y - 0.92,
  depth: 0.14,
  height: 0.05,
  length: 0.9,
}

/** Where a tool rests, before it is picked up. */
export const TOOL_REST_X = WHITEBOARD_TRAY.x + 0.03
export const TOOL_REST_Y = WHITEBOARD_TRAY.y + WHITEBOARD_TRAY.height / 2 + 0.025

/**
 * How far a tool travels when it is picked up: out of the tray, toward the
 * visitor, and up. Far enough to read as "in hand" from the board's stop
 * without covering the face it is about to draw on.
 */
export const TOOL_LIFT: [number, number] = [0.26, 0.13]

export type ToolId = 'black' | 'red' | 'blue' | 'green' | 'eraser'

export interface BoardTool {
  id: ToolId
  label: string
  /** Marker ink, or null for the felt eraser. */
  ink: string | null
  /** Position along the tray, relative to the board's Z. */
  offset: number
}

/**
 * Ink colours match the pre-authored doodles baked into the board's texture
 * (see `whiteboardBaseTexture`), so a visitor's additions read as the same set
 * of markers whoever was here last was using.
 */
export const BOARD_TOOLS: BoardTool[] = [
  { id: 'black', label: 'Black marker', ink: '#2f2f2f', offset: -0.34 },
  { id: 'red', label: 'Red marker', ink: '#c0392b', offset: -0.19 },
  { id: 'blue', label: 'Blue marker', ink: '#3a6ea5', offset: -0.04 },
  { id: 'green', label: 'Green marker', ink: '#4a7c59', offset: 0.11 },
  { id: 'eraser', label: 'Felt eraser', ink: null, offset: 0.31 },
]

export function boardTool(id: ToolId | null): BoardTool | null {
  if (id === null) return null
  return BOARD_TOOLS.find((tool) => tool.id === id) ?? null
}

/**
 * The ink layer's resolution, in pixels across the face — one per centimetre of
 * real board.
 *
 * Deliberately tiny, and upscaled with `image-rendering: pixelated`. The room is
 * rendered at a quarter resolution and blitted back with a nearest filter, so a
 * crisp DOM stroke drawn at the visitor's device resolution would be the one
 * sharp thing in a pixelated room — the opposite of the monitor and the jukebox,
 * where crispness is the point because those surfaces are lit screens. At this
 * density a stroke lands on blocks about the size of the render's own, and the
 * new ink sits on the board next to the baked doodles rather than on top of the
 * picture of one.
 */
export const INK = {
  width: 268,
  height: Math.round((268 * WHITEBOARD_SURFACE.height) / WHITEBOARD_SURFACE.width),
}

/**
 * Nib and felt widths, in ink pixels — i.e. centimetres of board.
 *
 * A chisel marker lays down about two centimetres across the flat, and at this
 * board's size that is also about the finest line the pixel grid can hold
 * without breaking up. Wider reads as a paint roller once the camera is parked;
 * the felt is sized off a real eraser, which is most of a hand wide.
 */
export const NIB_WIDTH = 2
export const FELT_WIDTH = 14

/**
 * The slice of wall the focused stop frames, in world Y.
 *
 * Stated as a band rather than as a "how much of the frame does the face fill"
 * fraction — the way the monitor's is — because two things have to survive the
 * framing and only one of them is the board:
 *
 *  - the top is the frame's carcass plus a little air. The surround is what says
 *    "whiteboard" rather than "bright rectangle", so it stays in shot.
 *  - the bottom is set so the marker tray clears the narrator box, which is a
 *    fixed ~170px off the bottom of the viewport. The tray is the only toolbar
 *    this hotspot has; a stop that let it sit behind a line of flavour text
 *    would hide every marker behind the sentence telling you to pick one up.
 *
 * What is given up between them is blank wall, which costs nothing. The tray
 * lands about a quarter of the way up the frame — some 200px clear of the
 * bottom edge on an 800px-tall viewport, and still clear of the narrator at
 * 719px, the shortest realistic desktop one.
 */
export const FRAMED_BAND = {
  top: BOARD_Y + WHITEBOARD_FRAME.size[1] / 2 + 0.05,
  /* Tuned against the narrator box, whose height is a DOM constant this module
     has no business reaching for. If the narrator ever gets taller, this is the
     number that moves. */
  bottom: 1.1,
}

const BAND_HEIGHT = FRAMED_BAND.top - FRAMED_BAND.bottom

/** Eye height for the stop — the middle of the framed band. */
export const boardEyeHeight = (FRAMED_BAND.top + FRAMED_BAND.bottom) / 2

/**
 * How far back the eye has to sit for the band to fill the frame.
 *
 * Visible height at distance d for a vertical FOV is 2·d·tan(fov/2), so this
 * falls straight out of the same relation the other camera presets were
 * hand-derived from. Deriving it means the framing survives an FOV change.
 */
export function boardViewDistance(fovDegrees: number): number {
  return BAND_HEIGHT / (2 * Math.tan((fovDegrees * Math.PI) / 360))
}
