/**
 * The room's one motion-preference check.
 *
 * Shared rather than duplicated because two very different things consult it —
 * the camera rig, which skips its tween, and the rain, which stops scrolling —
 * and a visitor who has asked for less motion should not get it from one of
 * them and not the other.
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}
