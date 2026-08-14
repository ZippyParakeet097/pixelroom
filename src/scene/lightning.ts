/**
 * The burst-timing engine shared by every strike in the game: the window's
 * storm and the door's.
 *
 * One strike is two to four stabs in quick succession, the first the
 * brightest. A single clean fade reads as someone operating a dimmer; real
 * lightning stutters, and the stutter is most of what sells it. Sampling is
 * quantised to a low frame rate and a handful of flat levels for the same
 * reason the dialogue types in `steps(4)` and the pixelation pass posterises
 * the frame: a continuous flash is renderer language, not game language.
 *
 * What is *not* shared is how the brightness lands on screen — the window
 * drives a flash quad and a light shaft, the door drives a colour lerp and a
 * pair of lights — because those scenes have nothing in common past "how
 * bright is this frame".
 */

const FLASH_FPS = 12
const FLASH_LEVELS = 5

export interface Bolt {
  start: number
  peak: number
  length: number
}

export interface StormState {
  /** Seconds until the next burst, counted down while no bolts are live. */
  untilNext: number
  /** Seconds into the current burst. */
  elapsed: number
  /** When the current burst's last bolt finishes. */
  end: number
  bolts: Bolt[]
  /** Time owed to the next low-rate sample. */
  sinceTick: number
  /** Held between samples — this is what everything actually reads. */
  level: number
}

export function createStorm(untilFirst: number): StormState {
  return { untilNext: untilFirst, elapsed: 0, end: 0, bolts: [], sinceTick: 0, level: 0 }
}

function scheduleBurst(): { bolts: Bolt[]; end: number } {
  const bolts: Bolt[] = []
  const count = 2 + Math.floor(Math.random() * 3)
  let at = 0
  let end = 0
  for (let i = 0; i < count; i++) {
    const bolt = {
      start: at,
      peak: i === 0 ? 1 : 0.3 + Math.random() * 0.55,
      length: 0.07 + Math.random() * 0.15,
    }
    bolts.push(bolt)
    end = Math.max(end, bolt.start + bolt.length)
    at += 0.05 + Math.random() * 0.17
  }
  return { bolts, end }
}

/** Envelope of a single stab: instant attack, squared decay. */
function boltLevel(bolt: Bolt, elapsed: number): number {
  const t = (elapsed - bolt.start) / bolt.length
  if (t < 0 || t >= 1) return 0
  const decay = 1 - t
  return bolt.peak * decay * decay
}

/**
 * Advances a storm by one frame and returns this frame's brightness.
 *
 * `gap` is how long the storm waits between bursts, in seconds — sparse for a
 * background event, tight for a `?storm`-style debug cycle. The schedule
 * itself runs at full rate; only the brightness read off it is held to
 * `FLASH_FPS`, so the stutter never drifts against the bolts underneath.
 */
export function advanceStorm(
  storm: StormState,
  delta: number,
  gap: { min: number; max: number },
): number {
  if (storm.bolts.length === 0) {
    storm.untilNext -= delta
    if (storm.untilNext <= 0) {
      const burst = scheduleBurst()
      storm.bolts = burst.bolts
      storm.end = burst.end
      storm.elapsed = 0
      storm.untilNext = gap.min + Math.random() * (gap.max - gap.min)
    }
    return storm.level
  }

  storm.elapsed += delta
  storm.sinceTick += delta

  if (storm.sinceTick >= 1 / FLASH_FPS) {
    storm.sinceTick %= 1 / FLASH_FPS
    let raw = 0
    for (const bolt of storm.bolts) raw = Math.max(raw, boltLevel(bolt, storm.elapsed))
    // Snap to flat plateaus. Rounding rather than flooring keeps the first
    // sample of a strike at full brightness — a strike that opened one step
    // down would lose its snap.
    storm.level = Math.round(raw * (FLASH_LEVELS - 1)) / (FLASH_LEVELS - 1)
  }

  if (storm.elapsed > storm.end) {
    storm.bolts = []
    storm.level = 0
    storm.sinceTick = 0
  }

  return storm.level
}
