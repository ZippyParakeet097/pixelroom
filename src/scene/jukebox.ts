/**
 * The jukebox's cabinet, in world units.
 *
 * Same arrangement as `monitor.ts`, and for the same reason: the selection
 * window is a DOM layer pasted onto modelled glass, so the mesh, the camera
 * preset and the projector all have to agree on one rectangle or the track
 * list slides off the cabinet.
 */

/**
 * Where the cabinet stands. Boxed in tighter than it looks: the curtain's outer
 * edge reaches x 3.24 and the floor stops at x 5, which leaves 1.76 metres for
 * a cabinet that must not interpenetrate either.
 */
export const JUKEBOX_ORIGIN: [number, number] = [4.05, -4.2]

export const JUKEBOX_CABINET = {
  width: 1.5,
  depth: 0.9,
  /** Plinth top — where the cabinet body starts. */
  base: 0.12,
  /** Cabinet body top, and the axis the domed crown sits on. */
  shoulder: 2.06,
  /** Crown radius. Equal to the half-width, so the dome is flush with the sides. */
  crown: 0.75,
} as const

/** Front face of the cabinet, in Z. Everything on the fascia stacks forward of this. */
export const JUKEBOX_FACE = JUKEBOX_ORIGIN[1] + JUKEBOX_CABINET.depth / 2

/** Crown of the dome — the top of the object. */
export const JUKEBOX_TOP = JUKEBOX_CABINET.shoulder + JUKEBOX_CABINET.crown

/**
 * The lit selection window — the jukebox's equivalent of the monitor's glass.
 * Deliberately large: it is the only surface on the cabinet that can hold a
 * readable track list once the camera is parked.
 */
export const JUKEBOX_DISPLAY = {
  /* Z has to clear the recess block the window sits in, not just the cabinet's
     face — the surround is 20mm deep and glass buried inside it is occluded by
     its own frame. */
  center: [JUKEBOX_ORIGIN[0], 1.52, JUKEBOX_FACE + 0.018] as [number, number, number],
  width: 1.16,
  height: 0.84,
}

/** The key bank on the fascia, which the stop has to keep clear of the narrator. */
export const JUKEBOX_KEYS = { y: 0.87, height: 0.18 }

/**
 * The mechanism bay — the glazed arch in the crown, and the one window on this
 * cabinet that looks into the object rather than onto the DOM.
 *
 * It exists because the selection window cannot show anything: the track list
 * is a DOM layer pasted over that rectangle, so whatever is modelled behind the
 * glass is covered the moment the camera arrives. The record mechanism is the
 * part worth watching, so it gets its own opening, above the overlay and clear
 * of it.
 *
 * Concentric with the crown, which buys two things. The frame left around it is
 * an even band, so the lit arch trim sits in that band without being fitted
 * separately. And the opening being a plain semicircle means the frame is a
 * `ringGeometry` rather than a shape with a hole cut in it.
 */
export const JUKEBOX_BAY = {
  /** Opening radius. What is left against the crown is the frame. */
  radius: JUKEBOX_CABINET.crown - 0.15,
  /** Centre of the arc, in world X/Y. The arc springs from the shoulder, whose
      top face is already closed and serves as the bay floor. */
  center: [JUKEBOX_ORIGIN[0], JUKEBOX_CABINET.shoulder] as [number, number],
  /** Back wall. Shallower than the cabinet, so the rest of the crown stays a
      sealed void rather than a view through to the wall. */
  back: JUKEBOX_ORIGIN[1] - 0.25,
  /** The plane the wheel and both arms are staged on — far enough behind the
      glass to read as depth, near enough to catch the bay lamp. */
  stage: JUKEBOX_ORIGIN[1] + 0.13,
}

/**
 * The slice of the cabinet the focused stop frames, in world Y.
 *
 * Stated as a band rather than as a "how much of the frame does the window
 * fill" fraction — the way the monitor's is — because the jukebox is framed by
 * two hard limits at once and a fill fraction hides both of them:
 *
 *  - the top is the domed crown, plus a little air. It is the part of the
 *    silhouette that says "jukebox" rather than "cupboard", so it stays in shot.
 *  - the bottom is set below the key bank, which is the transport. The narrator
 *    box is a fixed ~140px off the bottom of the viewport, and a stop that let
 *    the keys sit behind it would hide the play button behind a line of flavour
 *    text.
 *
 * What gets given up between them is grille, which is the one part of the
 * cabinet that carries no information. On a viewport 784px tall this puts the
 * crown 12px below the top edge and the keys about 10px above the narrator; at
 * 719px, the shortest realistic desktop viewport, they just touch.
 */
export const FRAMED_BAND = {
  /* Tuned, not derived: it is set against the narrator box, whose height is a
     DOM constant this module has no business reaching for. If the narrator ever
     gets taller, this is the number that moves. */
  bottom: 0.3,
  top: JUKEBOX_TOP + 0.04,
}

const BAND_HEIGHT = FRAMED_BAND.top - FRAMED_BAND.bottom

/** Eye height for the stop — the middle of the framed band. */
export const displayEyeHeight = (FRAMED_BAND.top + FRAMED_BAND.bottom) / 2

/**
 * How far back the eye has to sit for the band to fill the frame.
 *
 * Visible height at distance d for a vertical FOV is 2·d·tan(fov/2), so this
 * falls straight out of the same relation the other camera presets were
 * hand-derived from. Deriving it means the framing survives an FOV change.
 */
export function displayViewDistance(fovDegrees: number): number {
  return BAND_HEIGHT / (2 * Math.tan((fovDegrees * Math.PI) / 360))
}
