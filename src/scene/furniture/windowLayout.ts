/**
 * The window's geometry, shared between the fixture and its dressing.
 *
 * Split out for the same reason as `shelfLayout`: two components need to agree
 * on these numbers exactly. The curtains have to hang clear of the sill, the
 * flash has to sit between the sky and the rain, and the light shaft on the
 * floor has to line up with the gap the curtains leave.
 */

export const BACK_Z = -5

export const WINDOW_X = 1.9
export const WINDOW_Y = 3.0

/** The glazed opening, shared by the sky, the haze, the flash and the rain. */
export const PANE: [number, number] = [2.1, 1.7]

/**
 * Depth stack inside the window, back to front from the wall.
 *
 * The order is doing real work. The flash goes directly on the sky so the rain
 * falls *in front of* the lightning rather than being washed out by it; the
 * night haze then tints both; and the rain curtains sit in front of the haze,
 * which would otherwise grey out the one bright thing in the frame.
 *
 * All of it stays behind the mullions, which are 0.08 deep and therefore span
 * this whole range — so the frame occludes the weather exactly as glazing bars
 * should.
 */
export const PANE_Z = {
  sky: BACK_Z + 0.018,
  flash: BACK_Z + 0.021,
  haze: BACK_Z + 0.024,
  rainFar: BACK_Z + 0.027,
  rainNear: BACK_Z + 0.03,
  glass: BACK_Z + 0.034,
} as const

/**
 * Curtains, standing well off the wall.
 *
 * `z` clears the sill, which jogs out to BACK_Z + 0.34 — a curtain hanging in
 * the sill's plane intersects it and reads as a modelling bug on every frame.
 * Rods stand proud of a wall in reality anyway.
 */
export const CURTAIN = {
  z: BACK_Z + 0.38,
  rodY: 4.06,
  top: 4.0,
  bottom: 1.78,
  /** Outer edge of each panel. The pair is symmetric about `WINDOW_X`. */
  outer: 3.24,
  /** Half the width of the crack left between the panels when closed. */
  halfGap: 0.07,
  /** Horizontal scale when fully drawn back — the fabric gathers, not shrinks. */
  bunched: 0.42,
  thickness: 0.06,
} as const

const PANEL_WIDTH = CURTAIN.outer - (WINDOW_X + CURTAIN.halfGap)

export interface CurtainPanel {
  /** -1 for the left panel, +1 for the right. */
  side: -1 | 1
  width: number
  height: number
  centerY: number
  /** X of the panel's centre when drawn across the window. */
  closedX: number
  /** X of the panel's centre when gathered at its own side. */
  openX: number
}

export const CURTAIN_PANELS: CurtainPanel[] = ([-1, 1] as const).map((side) => ({
  side,
  width: PANEL_WIDTH,
  height: CURTAIN.top - CURTAIN.bottom,
  centerY: (CURTAIN.top + CURTAIN.bottom) / 2,
  closedX: WINDOW_X + side * (CURTAIN.halfGap + PANEL_WIDTH / 2),
  // Gathered against its outer edge, which is where the rod's bracket is.
  openX: WINDOW_X + side * (CURTAIN.outer - WINDOW_X - (PANEL_WIDTH * CURTAIN.bunched) / 2),
}))

/**
 * The stripe of floor the crack between the curtains throws light onto.
 *
 * Not a real projection — the room allocates no shadow map at all (plan §9),
 * so there is nothing to project *with*. It is a painted quad, the same trick
 * the contact shadows use, sized by eye to where a slit at the window would
 * land.
 */
export const LIGHT_SHAFT = {
  width: 0.55,
  length: 2.3,
  /** Above the rug (0.012) and the contact shadows (0.008). */
  y: 0.02,
  nearZ: BACK_Z + 0.3,
} as const
