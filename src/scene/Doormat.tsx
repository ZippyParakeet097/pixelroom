import { useEffect, useMemo } from 'react'
import { makeMaterial } from './palette'
import { Block } from './primitives'

/**
 * The mat outside the door. Set dressing, nothing clickable.
 *
 * Does one job the shoes and the palm cannot: it puts a mark on the floor.
 * Everything else in the shot stands up off it, so the ground under the
 * doorway was an unbroken dark field with a wedge of light occasionally
 * crossing it, and the camera walked over nothing. A mat gives the last stride
 * of the dolly something to pass over.
 *
 * Seen at a shallow angle from four metres back, so it is almost all width and
 * hardly any depth on screen. Everything that has to read — the border, the
 * ribs — runs the long way for that reason: detail laid across the mat
 * compresses into two rows of pixels and disappears.
 */

/**
 * Authored light on purpose — the pixelation pass blits straight out, so what
 * lands on screen is roughly the square of what is written here.
 *
 * Coir, and warmer than the floor it lies on rather than darker. A dark mat on
 * a dark floor is a hole; this has to read as a thing placed there.
 */
const BORDER = '#6d5b43'
const FIELD = '#9a8464'
const RIB = '#82704f'

/**
 * Wider than a real mat for the opening it serves, and that is a framing call
 * rather than a modelling one: the call-to-action button sits over the middle
 * of the floor at the near end of the shot, so the only parts of the mat
 * anybody sees are the two ends sticking out past it.
 */
const MAT = { width: 1.1, depth: 0.5, thickness: 0.016 } as const
/** How much of the border shows round the field. */
const EDGE = 0.06

/** Top of the field, which the ribs sit on. */
const FIELD_TOP = MAT.thickness + 0.006

/**
 * Sat just clear of the wall, and turned a couple of degrees off square.
 *
 * Square to the threshold it reads as installed. Nudged, it reads as
 * something people have been walking over — which is the same note the shoes
 * are playing.
 */
const AT: [number, number, number] = [0, 0, 0.52]
const SKEW = 0.06

export function Doormat() {
  const materials = useMemo(
    () => ({
      border: makeMaterial(BORDER),
      field: makeMaterial(FIELD),
      rib: makeMaterial(RIB),
    }),
    [],
  )

  // Intro really unmounts, unlike room furniture. Drop the materials with it.
  useEffect(() => {
    const owned = Object.values(materials)
    return () => {
      for (const material of owned) material.dispose()
    }
  }, [materials])

  return (
    <group position={AT} rotation={[0, SKEW, 0]}>
      {/* The slab, which is also the border — the field sits on top of it and
          inside it, so the rim needs no separate geometry. */}
      <Block
        size={[MAT.width, MAT.thickness, MAT.depth]}
        position={[0, MAT.thickness / 2, 0]}
        material={materials.border}
      />
      <Block
        size={[MAT.width - EDGE * 2, 0.006, MAT.depth - EDGE * 2]}
        position={[0, MAT.thickness + 0.003, 0]}
        material={materials.field}
      />
      {/* Ribs, running front to back. Across the mat they would be a couple of
          pixel rows at this angle and gone; the long way they stay separate.
          Nine narrow ones rather than five fat ones — spaced wide, the pale
          gaps between them read as boards and the mat turns into a pallet. */}
      {[-0.42, -0.315, -0.21, -0.105, 0, 0.105, 0.21, 0.315, 0.42].map((x) => (
        <Block
          key={x}
          size={[0.02, 0.005, MAT.depth - EDGE * 2 - 0.04]}
          position={[x, FIELD_TOP + 0.0015, 0]}
          material={materials.rib}
        />
      ))}
    </group>
  )
}
