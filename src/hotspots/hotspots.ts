import { MONITOR_SCREEN, SCREEN_EYE_DROP, screenViewDistance } from '@/scene/monitor'
import { JUKEBOX_DISPLAY, displayEyeHeight, displayViewDistance } from '@/scene/jukebox'
import { WHITEBOARD_SURFACE, boardEyeHeight, boardViewDistance } from '@/scene/whiteboard'
import { SHELF_X, SHELF_Z, shelfRowFor, type ShelfRow } from '@/scene/furniture/shelfLayout'
import type { CameraState, HotspotDef, HotspotId } from './types'

/**
 * The single "home" camera state — the isometric establishing shot.
 *
 * The scene camera is perspective with a deliberately narrow FOV rather than
 * orthographic. A true ortho camera cannot dolly in any visible way (moving it
 * along its axis changes nothing on screen; you'd have to animate `zoom`), and
 * the plan's core interaction is a physical dolly. A narrow FOV flattens
 * perspective enough to read as isometric while still giving real parallax
 * when the camera moves.
 */
export const HOME_CAMERA: CameraState = {
  position: [12.4, 8.8, 12.3],
  target: [-0.3, 2.2, -0.8],
}

/**
 * 32° is a compromise. Narrower reads as more isometric for the home shot, but
 * every focused preset then has to sit so far back that the close-ups feel
 * like surveillance footage rather than leaning in. At 32° the establishing
 * shot still flattens convincingly while the dolly-ins frame their subject
 * from a believable arm's length.
 *
 * Focused camera distances below are derived from it: visible height at
 * distance d is 2·d·tan(16°) ≈ 0.574·d, and each preset sits where its
 * subject fills roughly 60% of that.
 */
export const CAMERA_FOV = 32

/**
 * The PC preset is the one camera stop that is calculated rather than dialled
 * in by eye, because the DOM desktop is pasted onto the glass afterwards.
 *
 * It looks straight down the screen's normal — same X, same Y, no tilt. That
 * is not just a framing preference: with the view direction perpendicular to
 * the plane and the camera's up axis parallel to it, the glass projects to an
 * exactly axis-aligned rectangle. Any tilt keystones it, and a keystoned
 * rectangle can only be matched with a CSS homography — which would make every
 * pointer coordinate inside the desktop (window dragging, the terminal's
 * caret, Contra's controls) a non-linear function of the mouse position.
 * Sliding the eye *down* the plane's face costs nothing: it moves the screen
 * up the frame without rotating anything, so the rectangle stays a rectangle.
 */
const PC_EYE: [number, number, number] = [
  MONITOR_SCREEN.center[0],
  MONITOR_SCREEN.center[1] - SCREEN_EYE_DROP,
  MONITOR_SCREEN.center[2] + screenViewDistance(CAMERA_FOV),
]

const PC_CAMERA: CameraState = {
  position: PC_EYE,
  target: [PC_EYE[0], PC_EYE[1], MONITOR_SCREEN.center[2]],
}

/**
 * The jukebox is the second calculated stop, for the same reason as the PC: its
 * selection window carries a DOM track list pasted onto the modelled glass, so
 * the view has to be perpendicular to the fascia or the rectangle keystones.
 *
 * The height and the distance both come out of FRAMED_BAND — the slice of the
 * cabinet the stop has to hold — rather than being dialled in, because two
 * things at opposite ends of the object have to survive the framing: the domed
 * crown at the top and the transport keys at the bottom. See `jukebox.ts`.
 */
const JUKEBOX_EYE: [number, number, number] = [
  JUKEBOX_DISPLAY.center[0],
  displayEyeHeight,
  JUKEBOX_DISPLAY.center[2] + displayViewDistance(CAMERA_FOV),
]

const JUKEBOX_CAMERA: CameraState = {
  position: JUKEBOX_EYE,
  target: [JUKEBOX_EYE[0], JUKEBOX_EYE[1], JUKEBOX_DISPLAY.center[2]],
}

/**
 * The whiteboard is the third calculated stop, and the first that is not a
 * screen: its face carries the visitor's ink as a DOM layer, so the view has to
 * be perpendicular to the board for the same reason the other two are — a
 * keystoned rectangle would make every point of a freehand stroke a non-linear
 * function of the pointer.
 *
 * It hangs on the left wall rather than the back one, so "perpendicular" means
 * the eye sits out along +X at the board's Z, looking straight down -X with no
 * tilt. Height and distance both come out of FRAMED_BAND, which has to hold the
 * board *and* the marker tray under it — the tray is this hotspot's only
 * toolbar. See `whiteboard.ts`.
 */
const BOARD_EYE: [number, number, number] = [
  WHITEBOARD_SURFACE.center[0] + boardViewDistance(CAMERA_FOV),
  boardEyeHeight,
  WHITEBOARD_SURFACE.center[2],
]

const WHITEBOARD_CAMERA: CameraState = {
  position: BOARD_EYE,
  target: [WHITEBOARD_SURFACE.center[0], BOARD_EYE[1], BOARD_EYE[2]],
}

export const HOTSPOTS: Record<HotspotId, HotspotDef> = {
  pc: {
    id: 'pc',
    label: 'PC',
    camera: PC_CAMERA,
    markerAnchor: [-1.4, 2.28, -4.2],
    narrator: {
      hover: 'A desktop PC hums patiently.',
      focus: ['You sit down. The monitor flickers to life.'],
      focusRepeat: ['The chair is still warm.'],
    },
    panel: 'pc',
    highlight: '#4fd6c8',
  },

  jukebox: {
    id: 'jukebox',
    label: 'Jukebox',
    camera: JUKEBOX_CAMERA,
    markerAnchor: [4.05, 2.95, -4.05],
    narrator: {
      hover: 'A jukebox waits for someone with excellent taste.',
      focus: ['It has been waiting a while. Pick something.'],
      focusRepeat: ['Back at the jukebox.'],
    },
    panel: 'jukebox',
    highlight: '#d64f9a',
  },

  bookshelf: {
    id: 'bookshelf',
    label: 'Bookshelf',
    // Framed to hold the whole carcass — all four tags have to be readable at
    // once, because the rows *are* the menu. Aimed below the shelf's middle so
    // it rides high in frame: the bottom row's tag sits an inch off the floor
    // and would otherwise land behind the narrator box.
    camera: {
      position: [1.75, 1.95, -2.35],
      target: [-4.68, 1.05, -3.2],
    },
    markerAnchor: [-4.4, 2.85, -3.2],
    narrator: {
      hover: 'Shelves. Mostly spines you recognise.',
      focus: [
        'Not books, exactly. Every row is something you shipped.',
        'The tags on the shelf lips say which is which. Pull one out.',
      ],
      focusRepeat: ['Back at the shelf. Pick a row.'],
    },
    panel: 'bookshelf',
    highlight: '#f0a848',
  },

  whiteboard: {
    id: 'whiteboard',
    label: 'Whiteboard',
    camera: WHITEBOARD_CAMERA,
    markerAnchor: [-4.7, 3.55, -0.4],
    narrator: {
      hover: 'Half-erased. Someone was mid-thought.',
      focus: [
        'There are markers on the tray. They still have ink.',
        'Take one. You can draw straight on the board — the felt block wipes it off again.',
      ],
      focusRepeat: ['The board again. Nothing you drew has gone anywhere.'],
    },
    panel: 'whiteboard',
    highlight: '#4fd6c8',
  },

  corkboard: {
    id: 'corkboard',
    label: 'Corkboard',
    camera: {
      position: [-1.3, 2.5, 2.8],
      target: [-4.86, 2.45, 2.8],
    },
    markerAnchor: [-4.7, 3.4, 2.8],
    narrator: {
      hover: 'Pinned notes. Some of them are jokes.',
      focus: ['A collection of facts nobody asked for.'],
    },
    panel: 'corkboard',
    highlight: '#f0a848',
  },

  window: {
    id: 'window',
    label: 'Window',
    camera: {
      position: [1.9, 2.92, -0.2],
      target: [1.9, 3.0, -4.94],
    },
    markerAnchor: [1.9, 4.15, -4.8],
    narrator: {
      // The hover line plays exactly once, on the same beat the curtains
      // latch open — so it gets to narrate the reveal rather than describe a
      // window the visitor is already looking through.
      hover: 'The curtains fall open. Oh — it is really coming down out there.',
      focus: [
        'No sign of it letting up.',
        'This is where you shout at people. Politely.',
      ],
      focusRepeat: ['Still raining.'],
    },
    panel: 'contact',
    highlight: '#4fd6c8',
  },

  lavalamp: {
    id: 'lavalamp',
    label: 'Lava lamp',
    camera: {
      position: [2.2, 1.42, 3.0],
      target: [3.4, 1.05, 1.6],
    },
    markerAnchor: [3.4, 1.75, 1.6],
    narrator: {
      hover: 'A lava lamp. Load-bearing, ambience-wise.',
      focus: ['You watch a blob detach from the bottom. Time passes.'],
      focusRepeat: ['Still going. Good for it.'],
    },
    panel: 'none',
    highlight: '#d64f9a',
  },
}

export const HOTSPOT_IDS = Object.keys(HOTSPOTS) as HotspotId[]

/* Bookshelf rows ------------------------------------------------------------ */

/**
 * Eye-to-shelf-face distance for a row stop.
 *
 * Tuned against two limits pulling opposite ways. Closer than this and the row
 * fills the frame with no shelf around it, which loses the thing that made the
 * row mean something. Further and the paper tag — a 168px texture — is
 * downsampled by a nearest filter with no mipmaps, and its text starts
 * dropping pixel rows. At 3.0 the tag lands near 1:1 against the pixelation
 * pass's output and about three bays are in frame.
 */
const ROW_DISTANCE = 3.5
/** How far along the shelf (+Z, toward the open side of the room) the eye
    sits. Off-normal enough to show the shelf's depth rather than reading as a
    flat elevation drawing. */
const ROW_LATERAL = 0.6
/**
 * Pushes the row left of frame centre by aiming past it.
 *
 * The camera always centres its target, so the only way to compose a subject
 * off-centre is to look slightly to one side of it. It has to go left because
 * the case study panel is anchored to the right edge — without this the panel
 * covers the row it is describing.
 */
const ROW_AIM_SHIFT = 0.45

export function shelfRowCamera(row: ShelfRow): CameraState {
  return {
    position: [SHELF_X + ROW_DISTANCE, row.booksY + 0.22, SHELF_Z + ROW_LATERAL],
    target: [SHELF_X + 0.05, row.booksY, SHELF_Z - ROW_AIM_SHIFT],
  }
}

/**
 * The camera's destination for a given interaction state — the one place that
 * turns "what is focused" into "where the camera goes" (plan §4).
 */
export function cameraFor(focused: HotspotId | null, shelfProject: string | null): CameraState {
  if (focused === null) return HOME_CAMERA
  if (focused === 'bookshelf') {
    const row = shelfRowFor(shelfProject)
    if (row) return shelfRowCamera(row)
  }
  return HOTSPOTS[focused].camera
}

export const INTRO_LINES = [
  "Where am I? ...huh. Everything's a little... chunky. Low-poly. Like I'm rendered at half resolution.",
  'Nothing here moves unless you touch it. Go ahead.',
]
