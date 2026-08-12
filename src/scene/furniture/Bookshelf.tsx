import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { Hotspot, markSelfLit } from '@/hotspots/Hotspot'
import { useRoomStore } from '@/state/useRoomStore'
import { playSfx } from '@/audio/sfx'
import { PALETTE, makeGlowMaterial, makeMaterial } from '../palette'
import { projectSpineTexture, shelfLabelTexture } from '../textures'
import { Block, ContactShadow, Panel, PickProxy } from '../primitives'
import {
  CARCASS,
  LABEL_SIZE,
  LABEL_Y_OFFSET,
  SHELF_FACE_X,
  SHELF_ROWS,
  SHELF_X,
  SHELF_Z,
  type ShelfRow,
} from './shelfLayout'

/**
 * The bookshelf: one row per project (plan §5).
 *
 * The rows are the interface. There is no list of projects anywhere — each
 * shelf carries that project's spines in its colour, a paper tag on the lip
 * naming it, and one book standing proud of the row that slides further out
 * under the pointer. Clicking a row leans the camera into it and opens the
 * case study; the row stays pulled out while you read, so the room itself
 * shows which project is open.
 */

/** How far the proud book travels when its row is opened. */
const PULL_DISTANCE = 0.2
const DAMP_SPEED = 9

/** Tint applied to the unlit shelf tags: dim at rest, full paper on hover. */
const LABEL_REST_HEX = '#c9c1b0'
const LABEL_REST = new THREE.Color(LABEL_REST_HEX)
const LABEL_LIT = new THREE.Color('#ffffff')

export function Bookshelf() {
  const focused = useRoomStore((s) => s.focused === 'bookshelf')
  const cursor = useRoomStore((s) => s.shelfCursor)

  const materials = useMemo(
    () => ({
      frame: makeMaterial(PALETTE.woodDark),
      shelf: makeMaterial(PALETTE.wood),
    }),
    [],
  )

  // Owned here rather than per row: four rows each writing `body.style.cursor`
  // would race, and only one of them can be under the pointer anyway.
  useEffect(() => {
    if (!focused) return
    document.body.style.cursor = cursor !== null ? 'pointer' : 'auto'
    return () => {
      document.body.style.cursor = 'auto'
    }
  }, [focused, cursor])

  return (
    <Hotspot id="bookshelf">
      <PickProxy size={[0.75, 2.75, 2.0]} position={[SHELF_X, 1.37, SHELF_Z]} />

      {/* Carcass: sides, back, top and bottom */}
      <Block size={[0.6, 2.7, 0.08]} position={[SHELF_X, 1.35, SHELF_Z - 0.92]} material={materials.frame} />
      <Block size={[0.6, 2.7, 0.08]} position={[SHELF_X, 1.35, SHELF_Z + 0.92]} material={materials.frame} />
      <Block size={[0.06, 2.7, 1.84]} position={[SHELF_X - 0.3, 1.35, SHELF_Z]} material={materials.frame} />
      <Block size={[0.6, 0.08, 1.84]} position={[SHELF_X, 2.7, SHELF_Z]} material={materials.frame} />
      <Block size={[0.6, 0.1, 1.84]} position={[SHELF_X, 0.05, SHELF_Z]} material={materials.frame} />

      {SHELF_ROWS.map((row) => (
        <Block
          key={`board-${row.index}`}
          size={[0.58, 0.05, 1.8]}
          position={[SHELF_X, row.boardY, SHELF_Z]}
          material={materials.shelf}
        />
      ))}

      {SHELF_ROWS.map((row) => (
        <ProjectRow key={row.project.id} row={row} />
      ))}

      <ContactShadow position={[SHELF_X, 0.008, SHELF_Z]} scale={[1.7, 2.9]} />
    </Hotspot>
  )
}

function ProjectRow({ row }: { row: ShelfRow }) {
  const { project, bookHeight, bookSpan, booksY, booksZ, boardY } = row

  const active = useRoomStore((s) => s.focused === 'bookshelf')
  const shelfHovered = useRoomStore((s) => s.hovered === 'bookshelf')
  const highlighted = useRoomStore((s) => s.shelfCursor === row.index)
  const selected = useRoomStore((s) => s.shelfProject === project.id)
  const setShelfCursor = useRoomStore((s) => s.setShelfCursor)
  const selectProject = useRoomStore((s) => s.selectProject)

  const materials = useMemo(() => {
    const spines = projectSpineTexture(project.id, project.color, row.index)
    spines.wrapS = THREE.RepeatWrapping
    // Repeat proportional to the row's length, so a short row and a long row
    // get books of the same physical width rather than the same book count.
    spines.repeat.set(bookSpan, 1)

    const label = shelfLabelTexture(project.id, project.color, project.spine, project.year)

    // Tagged self-lit: these light per row, driven below, so the hotspot's
    // whole-object highlight has to keep its hands off them.
    return {
      books: markSelfLit(makeMaterial(PALETTE.paper, { map: spines })),
      proud: markSelfLit(makeMaterial(project.color)),
      band: markSelfLit(makeMaterial(PALETTE.paper)),
      label: makeGlowMaterial(LABEL_REST_HEX, { map: label }),
    }
  }, [project, bookSpan, row.index])

  const highlight = useMemo(() => new THREE.Color(project.color), [project.color])
  const proud = useRef<THREE.Group>(null)
  const glow = useRef(0)
  const pull = useRef(0)

  const rowLit = selected || (active && highlighted)
  const glowGoal = rowLit ? 1 : !active && shelfHovered ? 0.7 : 0
  const pullGoal = selected ? 1 : active && highlighted ? 0.5 : 0

  useFrame((_, delta) => {
    const restingGlow = Math.abs(glow.current - glowGoal) < 0.002
    const restingPull = Math.abs(pull.current - pullGoal) < 0.002
    if (restingGlow && restingPull) return

    glow.current = THREE.MathUtils.damp(glow.current, glowGoal, DAMP_SPEED, delta)
    pull.current = THREE.MathUtils.damp(pull.current, pullGoal, DAMP_SPEED, delta)

    materials.books.emissive.copy(highlight).multiplyScalar(glow.current * 0.34)
    materials.proud.emissive.copy(highlight).multiplyScalar(glow.current * 0.5)
    materials.band.emissive.copy(highlight).multiplyScalar(glow.current * 0.5)
    materials.label.color.lerpColors(LABEL_REST, LABEL_LIT, glow.current)

    if (proud.current) proud.current.position.x = pull.current * PULL_DISTANCE
  })

  const handleOver = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation()
      setShelfCursor(row.index)
      playSfx('hover')
    },
    [setShelfCursor, row.index],
  )

  const handleOut = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation()
      setShelfCursor(null)
    },
    [setShelfCursor],
  )

  const handleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation()
      // Clicking the open row pushes it back in — the same gesture both ways.
      playSfx(selected ? 'back' : 'select')
      selectProject(selected ? null : project.id)
    },
    [selectProject, selected, project.id],
  )

  return (
    <group name={`shelf-row-${project.id}`}>
      {/* The row of spines. One textured box rather than a mesh per book —
          same silhouette at this resolution, a fraction of the draw calls
          (plan §9). */}
      <Block
        size={[0.4, bookHeight, bookSpan]}
        position={[SHELF_X + 0.04, booksY, booksZ]}
        material={materials.books}
      />

      {/* The one book standing proud of the row: the "pull me out" affordance,
          and the only thing in the room that shows which project is open. Sat
          toward +Z, which is screen-left at this row's camera stop and so is
          never behind the case study panel. */}
      <group ref={proud} position={[0, 0, 0]}>
        <Block
          size={[0.46, bookHeight * 0.9, 0.11]}
          position={[SHELF_X + 0.05, booksY - bookHeight * 0.05, booksZ + bookSpan * 0.28]}
          material={materials.proud}
        />
        <Block
          size={[0.464, 0.045, 0.114]}
          position={[SHELF_X + 0.05, booksY + bookHeight * 0.2, booksZ + bookSpan * 0.28]}
          material={materials.band}
        />
      </group>

      {/* Paper tag on the shelf lip — the thing that actually says which
          project this row is. Unlit on purpose: it is printed matter in a
          deliberately dim room, and a Lambert tag at this size posterises into
          an unreadable smudge. Brightness carries the hover instead.

          Rotated to face +X, which is the only side of the shelf the camera
          ever sees. Sat clear of the carcass face so the bottom row's tag
          isn't swallowed by the plinth. */}
      <Panel
        size={LABEL_SIZE}
        position={[SHELF_FACE_X + 0.015, boardY + LABEL_Y_OFFSET, SHELF_Z]}
        rotation={[0, Math.PI / 2, 0]}
        material={materials.label}
      />

      {/* Rows only become pickable once the camera is at the shelf. From the
          establishing shot a row is a few pixels tall, so up close the shelf
          is one target and up close it is four. */}
      {active && (
        <group onPointerOver={handleOver} onPointerOut={handleOut} onClick={handleClick}>
          <PickProxy
            size={[0.78, row.pickHeight, CARCASS.width * 0.96]}
            position={[SHELF_X + 0.16, row.pickY, SHELF_Z]}
          />
        </group>
      )}
    </group>
  )
}
