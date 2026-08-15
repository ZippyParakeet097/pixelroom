/**
 * Moth, authored at the size it is seen — about eleven pixels across.
 *
 * Drawn by hand rather than modelled or downloaded. A moth over the sign is
 * ~11px on screen; art authored at 80–160px and scaled down to that loses the
 * silhouette, because the shape was decided at the artist's resolution and not
 * at this one. Same reason the door plate types its own letters — see
 * `PLATE_GLYPHS` in `scene/textures.ts`.
 *
 * Top-down: head up, body down the middle, wings out either side.
 */

/** `.` clear, `w` wing, `W` wing edge, `b` body. */
const INK: Record<string, string> = {
  w: '#624a32',
  W: '#423020',
  b: '#291e15',
}

/** Wings out, half up, up. Cycled 0-1-2-1 so three frames give a four-beat. */
const FRAMES: readonly (readonly string[])[] = [
  [
    '...W.b.W...',
    '..wwwbwww..',
    '.WwwwbwwwW.',
    'WwwwwbwwwwW',
    '.WwwwbwwwW.',
    '..WwwbwwW..',
    '....WbW....',
  ],
  [
    '...W.b.W...',
    '...wwbww...',
    '..wwwbwww..',
    '.WwwwbwwwW.',
    '..wwwbwww..',
    '...WwbwW...',
    '....WbW....',
  ],
  [
    '...W.b.W...',
    '....wbw....',
    '...wwbww...',
    '..wwwbwww..',
    '...wwbww...',
    '....wbw....',
    '....WbW....',
  ],
]

export const MOTH = {
  width: FRAMES[0][0].length,
  height: FRAMES[0].length,
  frames: FRAMES.length,
  /** Sprite px to CSS px. Only size knob — CSS reads its frame step off this. */
  scale: 1.11,
} as const

let sheet: string | null = null

/** One row of frames, as a data URL. Built once. */
export function mothSpriteUrl(): string {
  if (sheet) return sheet

  const canvas = document.createElement('canvas')
  canvas.width = MOTH.width * MOTH.frames
  canvas.height = MOTH.height
  const ctx = canvas.getContext('2d')!

  FRAMES.forEach((frame, f) => {
    const left = f * MOTH.width
    frame.forEach((row, y) => {
      for (let x = 0; x < row.length; x += 1) {
        const ink = INK[row[x]]
        if (!ink) continue
        ctx.fillStyle = ink
        ctx.fillRect(left + x, y, 1, 1)
      }
    })
  })

  sheet = canvas.toDataURL()
  return sheet
}
