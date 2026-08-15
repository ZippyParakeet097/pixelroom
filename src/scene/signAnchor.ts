/** Where the DOM sign lands on screen this frame, so it moves with the camera.
 *
 *  itfollowedusinside */
export const signAnchor = {
  /** Screen position of `SIGN_AT`, CSS px from the top left. */
  x: 0,
  y: 0,
  /** 1 at the opening framing, growing as the camera closes on it. */
  scale: 1,
  /** False once the sign is behind the lens. */
  visible: false,
  /** Until the scene has projected once, CSS keeps the sign where it put it. */
  live: false,
}
