import * as THREE from 'three'
import { PALETTE } from './palette'
import { INK } from './whiteboard'
import { BOARD_SURFACE, boardDoodles } from './whiteboardDoodles'

/**
 * Small, hand-authored, nearest-filtered canvas textures (plan §3.4).
 *
 * These are drawn at true pixel-art resolution — 32–128px — so the texels line
 * up with the screen pixels the pixelation pass produces instead of fighting
 * them. Nothing here is mipmapped: mipmaps would blur the texels at distance,
 * which is exactly the artefact this whole approach exists to avoid.
 *
 * Every texture is cached and built lazily, so a hotspot that is never focused
 * never pays for its texture.
 */

const cache = new Map<string, THREE.CanvasTexture>()

function makeTexture(
  key: string,
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): THREE.CanvasTexture {
  const cached = cache.get(key)
  if (cached) return cached

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  draw(ctx, width, height)

  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true

  cache.set(key, texture)
  return texture
}

/**
 * The one texture family that is loaded rather than drawn: a bitmap authored
 * offline and shipped from `public/assets/textures`.
 *
 * It still obeys the rules above — the PNG is pre-downsampled to the number of
 * texels it actually covers on screen and quantised to an indexed palette, so
 * the GPU is doing a near-1:1 blit rather than minifying a photo through a
 * nearest filter with no mipmaps, which is what would shimmer.
 *
 * Loading is fire-and-forget instead of suspending: the texture is returned
 * immediately backed by a flat `placeholder` fill and repainted in place once
 * the image lands. That keeps `Scene` free of a Suspense boundary — a
 * suspending loader inside the Canvas would blank the whole room on first paint
 * for the sake of one piece of set dressing on a back wall.
 */
export function imageTexture(
  key: string,
  src: string,
  width: number,
  height: number,
  placeholder: string,
): THREE.CanvasTexture {
  const existing = cache.get(key)
  if (existing) return existing

  const texture = makeTexture(key, width, height, (ctx, w, h) => {
    ctx.fillStyle = placeholder
    ctx.fillRect(0, 0, w, h)
  })

  const image = new Image()
  image.onload = () => {
    const canvas = texture.image as HTMLCanvasElement
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    texture.needsUpdate = true
  }
  image.src = src

  return texture
}

/**
 * Deterministic value noise. `Math.random()` would reshuffle the texture on
 * every hot reload, which makes it impossible to art-direct.
 */
function hash(x: number, y: number, seed = 1): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453
  return n - Math.floor(n)
}

/**
 * The DOOM poster over the desk.
 *
 * 48×71 is the resolution this survives, and it was arrived at by measuring
 * rather than by taste. The poster is only ever seen from the home camera — the
 * PC stop fills the frame with the monitor and the poster leaves shot entirely —
 * where it covers about 100 CSS pixels of width, which the divisor-4 pixelation
 * pass renders as roughly 25 blocks. Authored much above that, the nearest
 * filter point-samples the art and the wordmark breaks into unrelated specks;
 * much below it and the wordmark is a smear before it ever reaches the GPU. 48
 * is the smallest width at which "DOOM" is still four legible letters, which is
 * the only detail on the cover that has to survive.
 *
 * The source is the 1993 cover, downsampled offline and quantised to an indexed
 * palette with its blacks lifted. The lift matters: the bottom half of the art
 * is nearly black, and against a wall this dark an unlifted poster loses its own
 * silhouette and reads as a hole rather than as paper.
 */
export function doomPosterTexture(): THREE.CanvasTexture {
  return imageTexture('doom-poster', '/assets/textures/doom-poster.png', 48, 71, '#7a1a12')
}

/**
 * The Halo: Combat Evolved poster above the corkboard.
 *
 * Same offline treatment as the DOOM cover: downsampled to the texel grid it
 * actually covers, quantised to a small indexed palette, and its shadows
 * lifted so Chief's armour doesn't crush to a black blob against a dark wall.
 * 36×48 holds the source's 272×366 aspect closely enough that the plane's
 * existing 0.9×1.2 geometry needs no change, and it's the smallest size at
 * which "HALO" on the banner is still four readable letters.
 */
export function haloPosterTexture(): THREE.CanvasTexture {
  return imageTexture('halo-poster', '/assets/textures/halo-poster.png', 36, 48, '#1a2a4a')
}

export function woodTexture(): THREE.CanvasTexture {
  return makeTexture('wood', 64, 64, (ctx, w, h) => {
    ctx.fillStyle = PALETTE.wood
    ctx.fillRect(0, 0, w, h)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const grain = hash(Math.floor(x / 3), y, 3)
        if (grain > 0.82) {
          ctx.fillStyle = PALETTE.woodDark
          ctx.fillRect(x, y, 1, 1)
        } else if (grain < 0.08) {
          ctx.fillStyle = '#7d5e43'
          ctx.fillRect(x, y, 1, 1)
        }
      }
    }
  })
}

/**
 * A 5×7 alphabet, drawn by hand, one string of bits per row.
 *
 * Hand-drawn rather than set in a font for the same reason the jukebox's
 * transport glyphs are: at this size a font engine hands back a column of greys
 * where the stem should be, and those greys are what the posterisation step
 * turns into a smear. Placed one texel at a time there is nothing left for it
 * to ruin.
 *
 * 5×7 rather than the 3×5 this started as. Three texels is the width at which a
 * letter has one texel of stem, one of counter and one of stem, so *any*
 * sampling phase that drops a column drops a stroke — the first pass at this
 * had a plate reading PIXCLRNN, and even when every column survived the result
 * read as lettering typed into a paint program rather than engraved. Five gives
 * X a real crossing, M a real middle and O a real hole, and it survives losing
 * a column. See `DOOR_GRID` for the other half of the fix.
 *
 * Only the letters the door needs exist. It is not a font.
 */
const PLATE_GLYPHS: Record<string, string[]> = {
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  M: ['10001', '11011', '10101', '10001', '10001', '10001', '10001'],
}

const PLATE_WORD = 'PIXELROOM'
const PLATE_GLYPH = { width: 5, height: 7 } as const
/** Five texels of glyph and one of air, the usual pitch for a 5-wide face. */
const PLATE_PITCH = PLATE_GLYPH.width + 1

/**
 * The slab's own texel grid, and the reason the intro's pixelation pass runs at
 * a divisor of 2 where the room runs at 4.
 *
 * Two constraints, pulling opposite ways.
 *
 * The door is a close-up — it fills a third of the frame where the room is a
 * diorama seen from across itself — so at the room's divisor the leaf gets ~64
 * render pixels across, the name has four to a letter, and the result is the
 * paint-program look this started as. Halving the divisor for this one shot
 * doubles that, and lands the door at about the same block *size* the room's
 * furniture has: the same look, not a crisper one.
 *
 * Then the sheet has to be *coarser* than the render, not equal to it. The first
 * pass at this matched them one to one, which sounds ideal and is the one ratio
 * that cannot survive a rounding error: the leaf stands 11° ajar, so its far
 * edge is ~3% smaller than its near one, the ratio crosses below 1 somewhere
 * across the plate, and a texture row simply stops being sampled — the name
 * rendered as PIXEL with a shorter ROOM after it, four letters missing their
 * bottom row. Under-resolving instead means every texel lands on one render
 * pixel or two. Stems come out a little uneven; nothing goes missing.
 */
export const DOOR_GRID = { width: 96, height: 192 } as const

/**
 * Where the lettering lands on the slab's grid, so that the plate it is
 * engraved into can be cut to fit it.
 *
 * The name is authored on *this* grid rather than on a little sheet of its own
 * sized to the plate, so that both agree with the slab about where a texel is.
 */
export const NAME_RECT = {
  /* On the top rail, which is where a door carries a name and the only part of
     this leaf that is flat all the way across: the plate is wider than a panel
     and would otherwise have to bridge the mouldings around one. */
  x: Math.round(
    (DOOR_GRID.width - (PLATE_WORD.length * PLATE_PITCH - (PLATE_PITCH - PLATE_GLYPH.width))) / 2,
  ),
  /** Centres the plate on the top rail. See `RAILS` for where that rail is. */
  y: 20,
  width: PLATE_WORD.length * PLATE_PITCH - (PLATE_PITCH - PLATE_GLYPH.width),
  height: PLATE_GLYPH.height,
} as const

/**
 * Plate around the lettering. Wide enough at the sides to clear the rule drawn
 * inside the plate's border with a texel of air to spare — see `PLATE_INSET`.
 */
const PLATE_MARGIN = { x: 5, y: 7 } as const

/**
 * The plate itself, on the same grid — derived from where the letters actually
 * land rather than measured against them, so it cannot drift off its own
 * lettering. The door reads this to size the block it hangs on the leaf.
 */
export const PLATE_RECT = {
  x: NAME_RECT.x - PLATE_MARGIN.x,
  y: NAME_RECT.y - PLATE_MARGIN.y,
  width: NAME_RECT.width + PLATE_MARGIN.x * 2,
  height: NAME_RECT.height + PLATE_MARGIN.y * 2,
} as const

/**
 * The name, and nothing else on the door.
 *
 * Cut with `alphaTest` rather than blended: the sheet is hard-edged pixel art
 * with nothing part-way in between, so cutting the empty texels at draw time
 * avoids blending, sorting and the depth-write games that come with a
 * transparent quad lying a few millimetres in front of a solid one.
 */
export function namePlateTexture(): THREE.CanvasTexture {
  return makeTexture('door-name', DOOR_GRID.width, DOOR_GRID.height, (ctx) => {
    /* Near-black and neutral, for maximum separation from the plate under it.
       The old lettering was a warm brown left over from a warm brown plate. */
    ctx.fillStyle = '#22252c'
    let x = NAME_RECT.x
    for (const letter of PLATE_WORD) {
      const glyph = PLATE_GLYPHS[letter]
      for (let row = 0; row < glyph.length; row++) {
        for (let column = 0; column < PLATE_GLYPH.width; column++) {
          if (glyph[row][column] === '1') ctx.fillRect(x + column, NAME_RECT.y + row, 1, 1)
        }
      }
      x += PLATE_PITCH
    }
  })
}

/**
 * The plate's face: flat field, hard outline, one rule inside it.
 *
 * A pass at this with a brushed finish — a value ramp down the plate, per-row
 * grain, a lit bevel on two edges — was worse in both directions at once. The
 * ramp read as gloss rather than as steel, and the grain put a stop of noise
 * across letters that are five texels wide, which is the one thing the lettering
 * cannot spare. A sign at this size is drawn, not shaded: three flat tones on
 * the grid, and the plate's own geometry standing proud of the leaf to do the
 * lighting that the texture is not allowed to fake.
 */
const PLATE_FACE = '#c6d5e5'
const PLATE_RULE = '#8b98ac'
const PLATE_EDGE = '#2a2632'
/** Where the rule sits, in from the edge. Clear of the lettering — see `PLATE_MARGIN`. */
const PLATE_INSET = 3

/**
 * The plate, drawn at exactly the size it occupies on the door's grid so its
 * texels land on the same pitch as the lettering over it.
 */
export function namePlateFaceTexture(): THREE.CanvasTexture {
  return makeTexture('door-plate', PLATE_RECT.width, PLATE_RECT.height, (ctx, w, h) => {
    ctx.fillStyle = PLATE_FACE
    ctx.fillRect(0, 0, w, h)

    ctx.fillStyle = PLATE_RULE
    ctx.fillRect(PLATE_INSET, PLATE_INSET, w - PLATE_INSET * 2, h - PLATE_INSET * 2)
    ctx.fillStyle = PLATE_FACE
    ctx.fillRect(PLATE_INSET + 1, PLATE_INSET + 1, w - PLATE_INSET * 2 - 2, h - PLATE_INSET * 2 - 2)

    ctx.fillStyle = PLATE_EDGE
    ctx.fillRect(0, 0, w, 1)
    ctx.fillRect(0, h - 1, w, 1)
    ctx.fillRect(0, 0, 1, h)
    ctx.fillRect(w - 1, 0, 1, h)
  })
}

export function carpetTexture(): THREE.CanvasTexture {
  return makeTexture('carpet', 32, 32, (ctx, w, h) => {
    ctx.fillStyle = PALETTE.rug
    ctx.fillRect(0, 0, w, h)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (hash(x, y, 7) > 0.72) {
          ctx.fillStyle = PALETTE.rugAlt
          ctx.fillRect(x, y, 1, 1)
        }
      }
    }
    // Border stripe, so the rug reads as an object rather than a stain.
    ctx.strokeStyle = PALETTE.amber
    ctx.lineWidth = 1
    ctx.strokeRect(2.5, 2.5, w - 5, h - 5)
  })
}

export function corkTexture(): THREE.CanvasTexture {
  return makeTexture('cork', 64, 48, (ctx, w, h) => {
    ctx.fillStyle = PALETTE.cork
    ctx.fillRect(0, 0, w, h)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const n = hash(x, y, 11)
        if (n > 0.8) {
          ctx.fillStyle = '#a8743e'
          ctx.fillRect(x, y, 1, 1)
        } else if (n < 0.12) {
          ctx.fillStyle = '#c89358'
          ctx.fillRect(x, y, 1, 1)
        }
      }
    }
  })
}

/**
 * The whiteboard's face (plan §7): the surface, whatever was already written on
 * it, and whatever the visitor has added.
 *
 * The one texture in this module that is not authored here, and the one that
 * breaks the 32–128px rule above: it is sized to the visitor's ink layer, and
 * its content is that layer's twin — same resolution, same marker routines — so
 * that old notes and new strokes cannot be told apart. See
 * `whiteboardDoodles.ts`.
 */
export function whiteboardBaseTexture(): THREE.CanvasTexture {
  return makeTexture('whiteboard', INK.width, INK.height, (ctx, w, h) => {
    ctx.fillStyle = BOARD_SURFACE
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(boardDoodles(), 0, 0)
  })
}

/**
 * Repaints that face: the surface, plus whatever ink layer is passed.
 *
 * The layer is a transparent bitmap that exists independently of this texture
 * and is authored at the texture's own resolution, so this is only ever a 1:1
 * blit — nothing here can resample anything.
 *
 * `null` hands the face over to the DOM layer at the board's stop. The room
 * draws at a quarter resolution and posterises what it draws, which turns
 * handwriting into porridge; while the camera is parked at the board the overlay
 * shows the ink at the visitor's own resolution instead, and the modelled board
 * underneath is left bare so nothing is drawn twice.
 */
export function paintWhiteboardFace(ink: HTMLCanvasElement | null): void {
  const texture = whiteboardBaseTexture()
  const canvas = texture.image as HTMLCanvasElement
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.imageSmoothingEnabled = false
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
  ctx.fillStyle = BOARD_SURFACE
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  if (ink) ctx.drawImage(ink, 0, 0)
  texture.needsUpdate = true
}

/**
 * Night sky seen through the window: overcast, lit from below.
 *
 * Deliberately not a star field. It rains outside this window (see
 * `rainTexture`), and rain falling out of a clear starry sky reads as a bug
 * rather than as weather. The stars are replaced by a low cloud base and the
 * orange bounce of the city's own lights off it, which does more for the mood
 * anyway — the room is dark, so the window is the one warm thing in frame.
 */
export function nightSkyTexture(): THREE.CanvasTexture {
  return makeTexture('nightsky', 64, 48, (ctx, w, h) => {
    // Brighter toward the horizon, and warm at the bottom. An overcast sky
    // over a city is lit from underneath, so it reads *lighter* than the clear
    // night it replaced, not darker — the cloud base is a lid catching every
    // street light below it.
    const sky = ctx.createLinearGradient(0, 0, 0, h)
    sky.addColorStop(0, '#182046')
    sky.addColorStop(0.45, '#2e3a6b')
    sky.addColorStop(0.8, '#6a5478')
    sky.addColorStop(1, '#9a6660')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, w, h)

    // Cloud base. Sampled in wide, flat cells (6 across, 3 down) so the noise
    // comes out as layered banks rather than the even static a per-pixel hash
    // would give.
    for (let y = 0; y < h * 0.86; y++) {
      for (let x = 0; x < w; x++) {
        const band = hash(Math.floor(x / 6), Math.floor(y / 3), 19)
        if (band > 0.78) {
          ctx.fillStyle = 'rgba(255, 236, 214, 0.10)'
          ctx.fillRect(x, y, 1, 1)
        } else if (band < 0.16) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.16)'
          ctx.fillRect(x, y, 1, 1)
        }
      }
    }

    // A handful of stars, high up only, where the cloud breaks.
    for (let y = 0; y < h * 0.28; y++) {
      for (let x = 0; x < w; x++) {
        if (hash(x, y, 23) > 0.993) {
          ctx.fillStyle = '#bcd4ff'
          ctx.fillRect(x, y, 1, 1)
        }
      }
    }

    // A far-off skyline with a few lit windows.
    ctx.fillStyle = '#0a0f24'
    let x = 0
    while (x < w) {
      const bw = 4 + Math.floor(hash(x, 1, 31) * 6)
      const bh = 6 + Math.floor(hash(x, 2, 37) * 14)
      ctx.fillRect(x, h - bh, bw, bh)
      for (let wy = h - bh + 2; wy < h - 2; wy += 3) {
        for (let wx = x + 1; wx < x + bw - 1; wx += 2) {
          if (hash(wx, wy, 41) > 0.65) {
            ctx.fillStyle = PALETTE.amber
            ctx.fillRect(wx, wy, 1, 1)
            ctx.fillStyle = '#0a0f24'
          }
        }
      }
      x += bw
    }
  })
}

/**
 * A tile of falling rain, for scrolling across the window (plan §5).
 *
 * The rain is texture offset, not particles. One quad per layer with its
 * `offset.y` advanced each frame gives an unlimited, non-repeating-looking
 * downpour for three floats of work per frame, and — more to the point — it
 * survives the pixelation pass, which is where a particle system would fall
 * apart: individual sub-pixel sprites resampled to quarter resolution flicker
 * on and off instead of falling.
 *
 * Streaks wrap around the bottom edge back to the top so the vertical scroll
 * has no seam. Drawn 1 texel wide, sized by the caller's `repeat` to land near
 * one screen pixel after the pixelation divisor — the width a raindrop wants.
 */
export function rainTexture(
  key: string,
  drops: number,
  minLength: number,
  maxLength: number,
  alpha: number,
  seed: number,
): THREE.CanvasTexture {
  return makeTexture(`rain-${key}`, 32, 64, (ctx, w, h) => {
    for (let i = 0; i < drops; i++) {
      const x = Math.floor(hash(i, 0, seed) * w)
      const y = Math.floor(hash(i, 1, seed) * h)
      const length = minLength + Math.floor(hash(i, 2, seed) * (maxLength - minLength + 1))
      const a = alpha * (0.5 + hash(i, 3, seed) * 0.5)

      ctx.fillStyle = `rgba(186, 214, 250, ${a.toFixed(3)})`
      for (let d = 0; d < length; d++) ctx.fillRect(x, (y + d) % h, 1, 1)

      // A brighter head. Without it a streak reads as a static scratch on the
      // glass; with it the eye picks a direction of travel.
      ctx.fillStyle = `rgba(226, 240, 255, ${Math.min(1, a * 1.5).toFixed(3)})`
      ctx.fillRect(x, (y + length) % h, 1, 1)
    }
  })
}

/**
 * Water on the near face of the glass: fat beads dragging wandering trails.
 *
 * Scrolled far slower than the falling rain — that speed difference is the
 * whole trick. It puts one layer of water on the pane you are looking through
 * and the rest of it out in the air beyond, which is what tells you there is
 * a window here at all rather than a hole in the wall.
 */
export function rainGlassTexture(): THREE.CanvasTexture {
  return makeTexture('rain-glass', 32, 64, (ctx, w, h) => {
    for (let i = 0; i < 7; i++) {
      const x = Math.floor(hash(i, 0, 61) * w)
      const y = Math.floor(hash(i, 1, 61) * h)
      const length = 4 + Math.floor(hash(i, 2, 61) * 11)

      let tx = x
      ctx.fillStyle = 'rgba(190, 214, 245, 0.19)'
      for (let d = 0; d < length; d++) {
        // Beads don't run straight down a pane; they wander and stall.
        if (hash(i, d + 4, 67) > 0.76) tx += hash(i, d + 5, 71) > 0.5 ? 1 : -1
        ctx.fillRect((tx + w) % w, (y + d) % h, 1, 1)
      }

      ctx.fillStyle = 'rgba(226, 240, 255, 0.4)'
      ctx.fillRect((tx + w) % w, (y + length) % h, 1, 1)
      ctx.fillRect((tx + 1 + w) % w, (y + length) % h, 1, 1)
      ctx.fillRect((tx + w) % w, (y + length + 1) % h, 1, 1)
    }
  })
}

/**
 * Heavy curtain fabric — vertical pleats of varying width.
 *
 * The pleats are the reason the curtains gather rather than shrink when they
 * open: the panels are scaled horizontally, which squeezes this pattern
 * tighter, and tighter pleats is exactly what bunched fabric looks like.
 */
export function curtainTexture(): THREE.CanvasTexture {
  return makeTexture('curtain', 32, 48, (ctx, w, h) => {
    ctx.fillStyle = '#5e3a4a'
    ctx.fillRect(0, 0, w, h)

    let x = 0
    let i = 0
    while (x < w) {
      const width = 2 + Math.floor(hash(i, 0, 83) * 4)
      // Each pleat is a lit face and a shadowed fold beside it.
      ctx.fillStyle = hash(i, 1, 89) > 0.55 ? '#79495d' : '#4a2d3b'
      ctx.fillRect(x, 0, width, h)
      ctx.fillStyle = 'rgba(0,0,0,0.32)'
      ctx.fillRect(x + width - 1, 0, 1, h)
      x += width
      i++
    }

    // Weight at the hem: fabric is darker where it bunches on itself.
    for (let y = 0; y < h; y++) {
      const t = y / (h - 1)
      if (t < 0.72) continue
      ctx.fillStyle = `rgba(0,0,0,${(((t - 0.72) / 0.28) * 0.3).toFixed(3)})`
      ctx.fillRect(0, y, w, 1)
    }
  })
}

/**
 * The shape lightning takes on the sky — a soft blot, brighter high up.
 *
 * A flat wash over the pane would read as the brightness being turned up
 * rather than as something happening behind the cloud. The gradient puts the
 * source up in the cloud base where it belongs.
 */
export function lightningFlashTexture(): THREE.CanvasTexture {
  return makeTexture('lightning', 32, 24, (ctx, w, h) => {
    const cx = w * 0.46
    const cy = h * 0.3
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = (x - cx) / (w * 0.62)
        const dy = (y - cy) / (h * 0.85)
        const fall = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy))
        // Squared falloff, plus a little noise so the cloud edge is ragged
        // rather than a clean airbrushed ellipse.
        const a = fall * fall * (0.78 + hash(x, y, 97) * 0.22)
        if (a < 0.02) continue
        ctx.fillStyle = `rgba(226, 238, 255, ${a.toFixed(3)})`
        ctx.fillRect(x, y, 1, 1)
      }
    }
  })
}

/**
 * The stripe of light a gap in the curtains throws across the floor.
 *
 * Narrow and bright at the wall, spreading and fading into the room. Drawn
 * with v = 1 at the near end, because the quad is laid flat with a -90° X
 * rotation, which maps its local +Y onto world -Z — toward the wall.
 */
export function lightShaftTexture(): THREE.CanvasTexture {
  return makeTexture('lightshaft', 32, 64, (ctx, w, h) => {
    for (let y = 0; y < h; y++) {
      const t = y / (h - 1)
      const halfWidth = 2.2 + t * 5.6
      const fade = Math.pow(1 - t, 1.4)
      for (let x = 0; x < w; x++) {
        const d = Math.abs(x + 0.5 - w / 2) / halfWidth
        if (d >= 1) continue
        const a = fade * (1 - d * d)
        if (a < 0.02) continue
        ctx.fillStyle = `rgba(206, 226, 255, ${a.toFixed(3)})`
        ctx.fillRect(x, y, 1, 1)
      }
    }
  })
}

/**
 * Shifts a hex colour's lightness, staying in the palette's neighbourhood.
 * Used to build a family of spines around one project colour rather than
 * reaching for six unrelated hues.
 */
function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const mix = (channel: number) =>
    Math.round(amount > 0 ? channel + (255 - channel) * amount : channel * (1 + amount))
  const r = mix((n >> 16) & 255)
  const g = mix((n >> 8) & 255)
  const b = mix(n & 255)
  return `rgb(${r},${g},${b})`
}

/**
 * One row of book spines, tinted to a single project (plan §5: one row per
 * project). The strip tiles along the row, so the row reads as many books
 * while still being one box.
 *
 * `seed` varies the spine widths per row — with a shared seed all four rows
 * get an identical rhythm of thick and thin books, which is immediately
 * legible as one texture repeated four times.
 */
export function projectSpineTexture(id: string, color: string, seed: number): THREE.CanvasTexture {
  return makeTexture(`spines-${id}`, 64, 32, (ctx, w, h) => {
    const colors = [color, shade(color, -0.42), shade(color, 0.22), shade(color, -0.22)]
    let x = 0
    let i = 0
    while (x < w) {
      const bw = 3 + Math.floor(hash(i, 0, 13 + seed) * 4)
      // Taller and shorter books along the row, so the top edge isn't a ruler.
      const top = 1 + Math.floor(hash(i, 1, 17 + seed) * 3)
      ctx.fillStyle = colors[i % colors.length]
      ctx.fillRect(x, top, bw, h - top - 2)
      // Shading down the right edge of each spine reads as the gap between two
      // books once this is four pixels wide on screen.
      ctx.fillStyle = 'rgba(0,0,0,0.4)'
      ctx.fillRect(x + bw - 1, top, 1, h - top - 2)
      ctx.fillStyle = PALETTE.paper
      ctx.fillRect(x + 1, top + 6, Math.max(1, bw - 3), 1)
      ctx.fillRect(x + 1, top + 10, Math.max(1, bw - 3), 1)
      x += bw
      i++
    }
  })
}

/**
 * The paper tag taped to the front lip of a shelf, naming the project on that
 * row (plan §5).
 *
 * This is where the "each row is a project" idea has to actually land: the
 * spines carry colour, but only a label carries a name. Drawn at 168×24 —
 * close to the number of screen pixels it covers once the camera is at that
 * row's stop and the pixelation pass has divided by four — so the text lands
 * on texel boundaries instead of shimmering between them.
 */
export function shelfLabelTexture(
  id: string,
  color: string,
  title: string,
  year: string,
): THREE.CanvasTexture {
  return makeTexture(`shelf-label-${id}`, 168, 24, (ctx, w, h) => {
    ctx.fillStyle = '#efe7d6'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(0,0,0,0.22)'
    ctx.fillRect(0, h - 2, w, 2)
    ctx.fillRect(0, 0, w, 1)

    // Colour chip on the left, matching the spines behind it.
    ctx.fillStyle = color
    ctx.fillRect(3, 3, 7, h - 7)
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    ctx.fillRect(9, 3, 1, h - 7)

    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#23303a'
    ctx.font = 'bold 13px "Courier New", monospace'
    ctx.fillText(title.toUpperCase(), 15, h / 2)

    // Bold, like the title: at this size the pixelation pass eats a light
    // weight entirely and the year comes back as four grey smudges.
    ctx.textAlign = 'right'
    ctx.fillStyle = '#6d6558'
    ctx.font = 'bold 12px "Courier New", monospace'
    ctx.fillText(year, w - 8, h / 2)
    ctx.textAlign = 'left'
  })
}

/**
 * Transport glyphs for the jukebox's modelled key bank.
 *
 * 16×8, which is not a stylistic choice — it is the resolution these survive.
 * The keys are about 0.21 world units wide at the jukebox's stop, which is 64
 * CSS pixels, which the pixelation pass renders as 16 blocks. A glyph authored
 * any larger is downsampled by a nearest filter with no mipmaps on the way to
 * those 16 blocks, and the first thing that costs you is the stair-step on a
 * triangle's hypotenuse — which is the only thing that makes it read as a
 * triangle rather than a bar. Drawn 1:1 instead, it lands intact.
 *
 * All four are centred on x 7.5 and span the same width, so the three keys read
 * as a matched set rather than three unrelated marks.
 */
export type TransportGlyph = 'prev' | 'play' | 'pause' | 'next'

export function transportGlyphTexture(glyph: TransportGlyph): THREE.CanvasTexture {
  return makeTexture(`transport-${glyph}`, 16, 8, (ctx) => {
    ctx.fillStyle = '#14111c'

    /** One pixel-art triangle: `dir` 1 points right, -1 points left. */
    const triangle = (x: number, y: number, size: number, dir: 1 | -1) => {
      const half = Math.ceil(size / 2)
      for (let i = 0; i < half; i++) {
        const column = dir > 0 ? x + i : x + half - 1 - i
        ctx.fillRect(column, y + i, 1, size - i * 2)
      }
    }

    if (glyph === 'play') {
      triangle(6, 0, 8, 1)
      return
    }
    if (glyph === 'pause') {
      ctx.fillRect(5, 1, 2, 6)
      ctx.fillRect(9, 1, 2, 6)
      return
    }
    // The bar on the outer edge is what stops "skip" reading as "fast forward".
    if (glyph === 'next') {
      triangle(3, 1, 6, 1)
      triangle(7, 1, 6, 1)
      ctx.fillRect(11, 1, 2, 6)
      return
    }
    ctx.fillRect(3, 1, 2, 6)
    triangle(6, 1, 6, -1)
    triangle(10, 1, 6, -1)
  })
}
