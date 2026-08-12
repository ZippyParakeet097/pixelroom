/**
 * The monitor's glass, in world units.
 *
 * Three separate things have to agree on this rectangle or the desktop slides
 * off the tube: the screen mesh in <Desk>, the PC camera preset, and the
 * projector that maps the plane into CSS pixels for the DOM overlay. They all
 * read it from here so there is only ever one rectangle to move.
 */
export const MONITOR_SCREEN = {
  center: [-1.4, 1.66, -4.12] as [number, number, number],
  width: 1.12,
  height: 0.7,
}

/**
 * How much of the viewport's height the glass fills once the camera has
 * arrived at the desk.
 *
 * This is the whole framing decision for the PC. Too low and the faux desktop
 * is a postage stamp nobody can read; at 1 the bezel leaves the frame and the
 * illusion collapses back into a fullscreen modal — the exact thing the
 * in-monitor treatment exists to avoid. Around 0.62 the monitor body still
 * reads as an object sitting in a dark room.
 */
export const SCREEN_FILL = 0.6

/**
 * How far below the centre of the glass the eye sits.
 *
 * The monitor is not symmetric about its own screen — the bezel ends higher
 * above the glass than it does below, because the neck of the stand starts
 * there. A hair of drop centres the *body* in the frame rather than the
 * screen, so the visitor sees a whole object with a desktop on it instead of a
 * rectangle with a border.
 *
 * The eye still looks straight down -Z; only its height changes. Tilting to
 * look at the screen centre would keystone the glass and take the axis-aligned
 * projection with it (see PC_CAMERA).
 */
export const SCREEN_EYE_DROP = 0.03

/**
 * How far back the eye has to sit for the glass to fill `fill` of the frame.
 *
 * Visible height at distance d for a vertical FOV is 2·d·tan(fov/2), so the
 * distance that makes the screen occupy a given fraction of it falls straight
 * out of the same relation the other camera presets were hand-derived from
 * (see CAMERA_FOV). Deriving it means the framing survives an FOV change.
 */
export function screenViewDistance(fovDegrees: number, fill: number = SCREEN_FILL): number {
  const visibleHeight = MONITOR_SCREEN.height / fill
  return visibleHeight / (2 * Math.tan((fovDegrees * Math.PI) / 360))
}
