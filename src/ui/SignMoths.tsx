import { useEffect, useMemo, useRef } from 'react'
import { MOTH, mothSpriteUrl } from './mothSprite'

interface SignMothsProps {
  /** Through the swing — the fade to black takes sign and moth together. */
  active: boolean
}

/** One moth round the neon. In the DOM because the sign is — in world space it
 *  would need reprojecting onto a screen-positioned sign, and drifts off it. */

/** Path in em against the title's font size, so it widens with the lettering
 *  while the sprite stays fixed px. Array of one: add an entry for a second. */
const MOTHS = [
  {
    // rx * max pull must stay under ~1.9em or it drifts out over blank wall.
    rx: 1.75,
    ry: 0.52,
    pull: 0.3,
    pullRate: 0.71,
    rate: -1.18,
    // Not `rate`: one angle for both axes draws a closed ellipse the eye learns.
    riseRate: 0.79,
    phase: 2.3,
    // Keeps the path clear of the top of the viewport.
    drop: 0.18,
    buzz: 1.27,
  },
] as const

/**
 * Steps the flight at this rate rather than the display's.
 *
 * Same call as `FLASH_FPS` in `scene/lightning.ts`, and for the same reason: a
 * sprite gliding at 60fps over a posterised scene is renderer language. The
 * moth is drawn in whole pixels, so it should move in whole beats too.
 */
const STEP_FPS = 4

/** Two sines, off-octave — a straight curve reads as animated, not as flown.
 *  Both must stay under STEP_FPS/2 or the jitter aliases into a slow drift. */
function flutter(t: number, seed: number, buzz: number): number {
  return Math.sin(t * 4.7 * buzz + seed) * 0.045 + Math.sin(t * 2.9 * buzz + seed * 2.1) * 0.022
}

export function SignMoths({ active }: SignMothsProps) {
  const sprite = useMemo(() => mothSpriteUrl(), [])
  const wings = useRef<(HTMLSpanElement | null)[]>([])

  useEffect(() => {
    if (!active) return
    let frame = 0

    const fly = () => {
      // Held between beats. Still polled every frame — the loop is cheap and
      // rounding here rather than throttling the callback keeps the step on
      // the clock instead of on whatever the display happened to do.
      const t = Math.floor((performance.now() / 1000) * STEP_FPS) / STEP_FPS
      MOTHS.forEach((moth, i) => {
        const node = wings.current[i]
        if (!node) return
        const reach = 1 + Math.sin(t * moth.pullRate + moth.phase) * moth.pull
        const x =
          Math.cos(t * moth.rate + moth.phase) * moth.rx * reach + flutter(t, moth.phase, moth.buzz)
        const y =
          Math.sin(t * moth.riseRate + moth.phase) * moth.ry * reach +
          moth.drop +
          flutter(t, moth.phase + 4.1, moth.buzz) * 0.5
        node.style.transform = `translate(-50%, -50%) translate(${x}em, ${y}em)`
      })
      frame = requestAnimationFrame(fly)
    }

    frame = requestAnimationFrame(fly)
    return () => cancelAnimationFrame(frame)
  }, [active])

  return (
    <span className="doorway__moths" aria-hidden="true">
      {MOTHS.map((moth, i) => (
        <span
          key={moth.phase}
          ref={(node) => {
            wings.current[i] = node
          }}
          className="doorway__moth"
          style={
            {
              backgroundImage: `url(${sprite})`,
              width: MOTH.width * MOTH.scale,
              height: MOTH.height * MOTH.scale,
              backgroundSize: `${MOTH.width * MOTH.frames * MOTH.scale}px ${MOTH.height * MOTH.scale}px`,
              // Frame step for the flap keyframes. Here so MOTH.scale stays the
              // one size knob — hardcoded in CSS it silently assumed scale 2.
              '--moth-frame': `${MOTH.width * MOTH.scale}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  )
}
