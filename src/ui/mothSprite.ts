/** Moth, hand-drawn at the resolution it is seen — seven blocks across, top-down,
 *  head up. Art authored large and scaled down loses the silhouette at this size. */

/** `.` clear, `w` wing, `W` wing edge, `b` body. */
const INK: Record<string, string> = {
  w: '#624a32',
  W: '#423020',
  b: '#291e15',
}

/** Wings out, half up, up. Cycled 0-1-2-1 so three frames give a four-beat. */
const FRAMES: readonly (readonly string[])[] = [
  [
    '..WbW..',
    '.wwbww.',
    'wwwbwww',
    '.wwbww.',
    '...b...',
  ],
  [
    '..WbW..',
    '..wbw..',
    '.wwbww.',
    '..wbw..',
    '...b...',
  ],
  [
    '..WbW..',
    '..wbw..',
    '..wbw..',
    '..wbw..',
    '...b...',
  ],
]

export const MOTH = {
  width: FRAMES[0][0].length,
  height: FRAMES[0].length,
  frames: FRAMES.length,
  /** Sprite px to CSS px. Only size knob — CSS reads its frame step off this.
   *  Whole numbers only: a fractional scale lands blocks on 1 or 2 px unevenly. */
  scale: 2,
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
