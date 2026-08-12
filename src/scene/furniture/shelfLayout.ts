import { PROJECTS, type Project } from '@/content/projects'

/**
 * Where the bookshelf is and how its rows divide up.
 *
 * This lives apart from <Bookshelf> because two other places need the same
 * numbers: the camera presets in `hotspots/hotspots.ts` (each row has its own
 * lean-in stop) and the row picking volumes. Deriving both from one table is
 * what keeps a camera stop pointed at the row it claims to be pointed at.
 *
 * One row per project, always — the carcass is a fixed height and the bays
 * divide it evenly, so a fifth project re-spaces the shelf rather than
 * spilling off the end of it (the contract `content/projects.ts` promises).
 */

export const SHELF_X = -4.68
export const SHELF_Z = -3.2

/** Outer carcass. Width runs along Z, depth along X. */
export const CARCASS = {
  depth: 0.6,
  height: 2.7,
  width: 1.84,
  /** Usable interior, floor-relative: top of the base plinth to the underside
      of the top panel. */
  interiorBottom: 0.1,
  interiorTop: 2.66,
} as const

/** The plane the carcass sides present to the room. */
export const SHELF_FACE_X = SHELF_X + CARCASS.depth / 2

/** Paper tag on each shelf lip. Aspect matches its 168×24 texture. */
export const LABEL_SIZE: [number, number] = [1.05, 0.15]
/**
 * The tag straddles the shelf lip rather than hanging clear below it — that
 * keeps the bottom row's tag off the floor, and a tag whose top edge covers
 * the very bottom of the books is what a real shelf label does anyway.
 */
export const LABEL_Y_OFFSET = -0.03

export interface ShelfRow {
  index: number
  project: Project
  /** Y of the board this row's books rest on. */
  boardY: number
  /** Centre Y of the block of books. */
  booksY: number
  /** Height of the books, sized to the bay. */
  bookHeight: number
  /** Depth (along Z) this row's books occupy — varied so rows aren't clones. */
  bookSpan: number
  /** Z centre of the books, nudged with `bookSpan` so the gaps alternate ends. */
  booksZ: number
  /** Centre Y and height of the row's pick volume: tag lip to top of books. */
  pickY: number
  pickHeight: number
}

const BAY = (CARCASS.interiorTop - CARCASS.interiorBottom) / PROJECTS.length
const BOARD_THICKNESS = 0.05
/** Headroom above the books, so a row never punches through the board above. */
const BOOK_HEADROOM = 0.14

export const SHELF_ROWS: ShelfRow[] = PROJECTS.map((project, index) => {
  // Top shelf first. `PROJECTS` is in the order the visitor should read them,
  // and on a bookshelf that means top to bottom — it also keeps the tab order
  // of the hidden row list matching what the eye sees.
  const bay = PROJECTS.length - 1 - index

  // Board at the foot of its bay, books standing on it. Centring the boards in
  // their bays instead would push the top row's books through the carcass lid.
  const boardY = CARCASS.interiorBottom + BAY * bay + BOARD_THICKNESS / 2
  const bookHeight = BAY - BOOK_HEADROOM
  const booksY = boardY + BOARD_THICKNESS / 2 + bookHeight / 2

  // Alternate which end of the shelf the gap falls on. A row that stops short
  // at a different end each time is the cheapest thing that stops four
  // identical bays reading as one texture repeated four times.
  const short = index % 2 === 1
  const bookSpan = CARCASS.width * (short ? 0.73 : 0.88)
  const booksZ = SHELF_Z + (short ? 0.12 : 0)

  const pickTop = booksY + bookHeight / 2
  const pickBottom = boardY + LABEL_Y_OFFSET - LABEL_SIZE[1] / 2

  return {
    index,
    project,
    boardY,
    booksY,
    bookHeight,
    bookSpan,
    booksZ,
    pickY: (pickTop + pickBottom) / 2,
    pickHeight: pickTop - pickBottom,
  }
})

export function shelfRowFor(projectId: string | null): ShelfRow | undefined {
  if (projectId === null) return undefined
  return SHELF_ROWS.find((row) => row.project.id === projectId)
}
