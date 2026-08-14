import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { Block, ContactShadow } from './primitives'
import { makeMaterial } from './palette'

type Vec3 = [number, number, number]

/**
 * A pair of sneakers kicked off by the door. Set dressing, nothing clickable.
 *
 * Kicked off, not put away — that is the whole brief and it is all in the
 * placement. Two shoes squared up side by side is a shop display; these are
 * a stride apart, at unrelated angles, and one of them is lying on its side
 * where it landed. The pair is the only thing in the shot that says somebody
 * lives on this side of the door.
 *
 * Low in frame and close to the lens, so they sweep past fast on the walk in.
 */

/**
 * Authored light on purpose — the pixelation pass blits straight out, so what
 * lands on screen is roughly the square of what is written here. A colour
 * picked by eye arrives crushed to black.
 *
 * The upper borrows the casing's blue-grey, which makes the pair the second
 * cool thing in a shot of browns rather than a new colour nobody asked for.
 * The soles are the lightest thing below waist height, which is what stops
 * two small dark lumps from disappearing into the floor.
 */
const SOLE = '#e0dacd'
const RUBBER = '#c6c0b1'
const UPPER = '#95a0b8'
const UPPER_DARK = '#6a7288'
const LACE = '#e6e0d3'

/**
 * Roughly a size ten, in metres, and a size up from life. Origin sits under
 * the sole, centred.
 *
 * Oversized on purpose. These sit low and outboard, which is exactly where the
 * pass's vignette is heaviest, so a true-to-scale shoe arrives as a dark lump
 * about eight pixels tall and reads as a brick.
 */
const SHOE = { length: 0.32, width: 0.115 } as const

interface Materials {
  sole: THREE.Material
  rubber: THREE.Material
  upper: THREE.Material
  upperDark: THREE.Material
  lace: THREE.Material
}

/**
 * One shoe, built nose-along-local-+X and standing on local y = 0.
 *
 * The whole read is the profile, and the profile is a ramp: low at the toe,
 * rising through the vamp and the instep, tallest at the heel collar. Built
 * with those four at one height each it came back a slab — every block topped
 * out within a centimetre of every other, so the outline was a rectangle and
 * the shoe was a brick. The steps have to be big enough to survive the
 * posterise, which means exaggerating them well past life.
 */
function Shoe({ materials }: { materials: Materials }) {
  const { length: len, width: wid } = SHOE
  return (
    <>
      {/* Outsole, running the full footprint and proud of the upper all round. */}
      <Block size={[len, 0.026, wid]} position={[0, 0.013, 0]} material={materials.sole} />
      {/* Wedge under the heel — a sneaker is thicker at the back, and that
          lifted line along the bottom is half of what says shoe. */}
      <Block
        size={[len * 0.3, 0.022, wid]}
        position={[-len * 0.35, 0.037, 0]}
        material={materials.sole}
      />
      {/* Toe cap, the lowest thing above the sole. */}
      <Block
        size={[len * 0.26, 0.038, wid * 0.94]}
        position={[len * 0.37, 0.045, 0]}
        material={materials.rubber}
      />
      {/* Vamp, then the instep a step above it. */}
      <Block
        size={[len * 0.42, 0.055, wid * 0.94]}
        position={[len * 0.06, 0.054, 0]}
        material={materials.upper}
      />
      <Block
        size={[len * 0.3, 0.055, wid * 0.94]}
        position={[-len * 0.18, 0.075, 0]}
        material={materials.upper}
      />
      {/* Heel counter, the tallest part — the step up at the back is what
          gives the shoe a direction from across the room. */}
      <Block
        size={[len * 0.24, 0.085, wid * 0.92]}
        position={[-len * 0.38, 0.09, 0]}
        material={materials.upper}
      />
      {/* The mouth of the shoe, dark and sunk between heel and tongue. */}
      <Block
        size={[len * 0.26, 0.02, wid * 0.72]}
        position={[-len * 0.26, 0.125, 0]}
        material={materials.upperDark}
      />
      {/* Tongue, standing proud of it. */}
      <Block
        size={[len * 0.15, 0.03, wid * 0.62]}
        position={[-len * 0.06, 0.1, 0]}
        material={materials.lace}
      />
      {/* Side flash, standing a hair outside the upper on both cheeks so it
          reads whichever side of the shoe is facing. */}
      <Block
        size={[len * 0.4, 0.022, wid * 1.02]}
        position={[-0.02, 0.055, 0]}
        material={materials.lace}
      />
      {/* Tread, hung under the outsole.
          Invisible on a shoe that is the right way up — it sits at or below
          the floor plane — and the whole reason the tipped one reads. On its
          side you are looking at the bottom of a shoe, and a bare pale
          rectangle there is a block of soap. Four bars across it and it is a
          sole. */}
      {[-0.3, -0.1, 0.1, 0.3].map((along) => (
        <Block
          key={along}
          // Sunk into the outsole rather than hung off it. Standing clear they
          // read as a comb with daylight between the teeth; overlapped, the
          // sole stays solid and the bars are grooves in it.
          size={[len * 0.075, 0.008, wid * 0.88]}
          position={[len * along, -0.001, 0]}
          material={materials.upperDark}
        />
      ))}
    </>
  )
}

/**
 * Where the two landed.
 *
 * `roll` tips a shoe about its own long axis, so the second one is lying on
 * its cheek rather than standing. `y` lifts it just enough to sit on the floor
 * once it has — a tipped shoe pivots about its middle, not its sole.
 *
 * The roll is negative, which matters: rolled the other way the shoe presents
 * its outer cheek, and a cheek is a rectangle. Rolled this way it shows the
 * camera its sole and its tread, which is unmistakably a shoe and is the
 * reason to have tipped one over at all.
 *
 * Both yaws are kept well away from square-to-camera. A shoe pointing at the
 * lens is a lump; the profile is the only angle it reads from.
 */
const THROWN: readonly { at: Vec3; yaw: number; roll: number; shadow: [number, number] }[] = [
  // Nearer the wall, standing, turned off square to it.
  { at: [0.98, 0, 0.42], yaw: 0.4, roll: 0.08, shadow: [0.44, 0.44] },
  // A stride out and over, lying on its cheek where it stopped.
  { at: [1.36, 0.055, 0.74], yaw: -0.5, roll: -1.25, shadow: [0.46, 0.36] },
]

export function Sneakers() {
  const materials = useMemo(
    () => ({
      sole: makeMaterial(SOLE),
      rubber: makeMaterial(RUBBER),
      upper: makeMaterial(UPPER),
      upperDark: makeMaterial(UPPER_DARK),
      lace: makeMaterial(LACE),
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
    <group>
      {THROWN.map(({ at, yaw, roll, shadow }) => (
        // Nested rather than one Euler: yaw outside, roll inside, so the roll
        // happens about the shoe's own length however it is pointing. Flat
        // XYZ order would roll it about the world axis and lay it on its nose.
        <group key={at[0]} position={at} rotation={[0, yaw, 0]}>
          <group rotation={[roll, 0, 0]}>
            <Shoe materials={materials} />
          </group>
          {/* Pinned to the floor rather than to the shoe, so the tipped one
              does not carry its own shadow up into the air with it. */}
          <ContactShadow position={[0, 0.008 - at[1], 0]} scale={shadow} opacity={0.75} />
        </group>
      ))}
    </group>
  )
}
