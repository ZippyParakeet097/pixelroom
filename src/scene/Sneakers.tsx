import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { Block } from './primitives'
import { makeMaterial } from './palette'

type Vec3 = [number, number, number]
/** A knuckle in a lace, in the shoe's own side-profile plane. */
type Pt = [number, number]

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
 * Faded brick. High-tops read red, and warm is the point: the pair sides with
 * the floor rather than against it. The soles are the lightest thing below
 * waist height, which is what stops two small dark lumps from disappearing
 * into it.
 *
 * All scaled x0.8 with the rest of the outside. Not further: tried x0.7 and
 * the sole line went with it, which is exactly the failure the paragraph above
 * is about — pair came back as two brown lumps by the wall.
 */
const SOLE = '#b3aea4'
const RUBBER = '#9e9a8e'
const UPPER = '#9b7370'
const UPPER_DARK = '#6c4745'
const PATCH = '#b3ab9d'
const LACE = '#b8b3a9'

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
  patch: THREE.Material
  lace: THREE.Material
}

/**
 * Fat, so it survives the posterise. A lace at life gauge is sub-pixel and
 * arrives as flicker.
 */
const LACE_GAUGE = 0.018

/**
 * A lace tail, drawn as a chain of boxes between knuckles.
 *
 * Flat run in the shoe's XY, held at one z — a lace only ever reads in
 * profile, and pinning it to a plane means one Z rotation per segment instead
 * of a quaternion per segment. Each box overruns its span by a gauge so the
 * corners stay filled; butted end to end they open a notch at every bend.
 *
 * The bends are the whole point. A straight tail is a wire.
 */
function LaceRun({ path, z, material }: { path: readonly Pt[]; z: number; material: THREE.Material }) {
  return (
    <>
      {path.slice(1).map(([tx, ty], i) => {
        const [fx, fy] = path[i]
        const run = Math.hypot(tx - fx, ty - fy)
        return (
          <Block
            key={`${fx}:${fy}`}
            size={[run + LACE_GAUGE, LACE_GAUGE, LACE_GAUGE]}
            position={[(fx + tx) / 2, (fy + ty) / 2, z]}
            rotation={[0, 0, Math.atan2(ty - fy, tx - fx)]}
            material={material}
          />
        )
      })}
    </>
  )
}

/**
 * The two loose ends, one per tail. Untied is the read — laced up neat and the
 * shoes go back to being a shop display.
 *
 * SPILL is the long one: over the collar rim, down the outside cheek, out onto
 * the floor past the heel. FLOP is the short one: off the top lace bar, down
 * the throat, dead on the toe cap.
 *
 * Every knuckle is sat on something solid. Nothing here hangs in space, which
 * is what lets the same two paths ride the tipped shoe as well as the standing
 * one — see `cheek`.
 */
const SPILL: readonly Pt[] = [
  [-0.045, 0.196],
  [-0.075, 0.15],
  [-0.055, 0.1],
  [-0.095, 0.055],
  [-0.08, 0.014],
  [-0.185, 0.009],
]
const FLOP: readonly Pt[] = [
  [-0.02, 0.168],
  [0.02, 0.118],
  [0.065, 0.112],
  [0.108, 0.092],
  [0.148, 0.089],
]

/**
 * The tipped shoe's loose end, in two runs: down the tread, then out on the
 * floor. Both hang off the yaw group, not the roll group, so they are drawn
 * world-upright — nothing inside the rolled frame can fall straight down.
 *
 * DRAPE turns a quarter about Y to stand in the plane across the shoe, so its
 * x runs at the camera and its y is real height (floor at -`at.y`). It starts
 * partway up the face-up cheek, crosses the top edge, and follows the tread
 * down. The tread is near vertical from here, hence the near-vertical run.
 *
 * POOL lies flat and picks up where DRAPE lands, so its x is along the shoe and
 * its y runs away from the camera — negative to come forward. Its wander is
 * the whole reason it is a separate run: the standing plane cannot move along
 * the shoe, so a lace confined to it would pool in a straight line.
 */
const DRAPE: readonly Pt[] = [
  [-0.05, 0.08],
  [-0.015, 0.075],
  [0.019, 0.066],
  [0.032, 0.025],
  [0.028, -0.025],
  [0.01, -0.053],
]
const POOL: readonly Pt[] = [
  [0.02, -0.01],
  [0.055, -0.055],
  [0.02, -0.1],
  [0.06, -0.15],
  [0.045, -0.205],
]
/** Where along the shoe the drape falls. Mid-tread, clear of both ends. */
const DRAPE_X = 0.02

/**
 * One shoe, built nose-along-local-+X and standing on local y = 0.
 *
 * Basketball high-top, Chuck family. Sells on height alone — the collar tops
 * out at about two thirds of the shoe's length, so it is the tall thing in a
 * shot of low ones before any detail resolves.
 *
 * The sole stays flat. No heel wedge: a vulcanised shoe has a level bottom
 * line, and the level line is what keeps this from reading as a runner with a
 * big back. All the climb is above it — vamp, three throat steps, then shaft.
 * The steps have to be big enough to survive the posterise, which means
 * exaggerating them well past life.
 */
function Shoe({ materials, cheek }: { materials: Materials; cheek: number }) {
  const { length: len, width: wid } = SHOE
  return (
    <>
      {/* Flat sole. */}
      <Block size={[len, 0.024, wid]} position={[0, 0.012, 0]} material={materials.sole} />
      {/* Foxing tape — rubber band round the whole perimeter, proud all round.
          Half the read: it draws a bright line under everything. */}
      <Block
        size={[len * 0.99, 0.03, wid * 1.07]}
        position={[0, 0.039, 0]}
        material={materials.rubber}
      />
      {/* Toe cap. Fat and blunt, the lowest thing above the sole. */}
      <Block
        size={[len * 0.24, 0.042, wid * 1.04]}
        position={[len * 0.375, 0.06, 0]}
        material={materials.rubber}
      />
      {/* Vamp, low and long. */}
      <Block
        size={[len * 0.4, 0.05, wid * 0.94]}
        position={[len * 0.11, 0.08, 0]}
        material={materials.upper}
      />
      {/* Throat, three steps climbing back. Staircase, not a slope — a slope
          posterises into one flat block. */}
      {[
        [len * 0.04, 0.1, len * 0.18],
        [-len * 0.04, 0.128, len * 0.16],
        [-len * 0.11, 0.15, len * 0.14],
      ].map(([x, top, run]) => (
        <Block
          key={x}
          size={[run, top - 0.055, wid * 0.9]}
          position={[x, (top + 0.055) / 2, 0]}
          material={materials.upper}
        />
      ))}
      {/* Shaft. The reason it is a high-top. Tops out 0.045 above the last
          throat step, so there is a collar rather than one continuous ramp —
          run flush they meet as a wedge and the shoe reads as a boot. */}
      <Block
        size={[len * 0.4, 0.14, wid * 0.94]}
        position={[-len * 0.3, 0.125, 0]}
        material={materials.upper}
      />
      {/* Collar wrap, one shade up, so the top edge does not vanish into the
          wall behind it. */}
      <Block
        size={[len * 0.42, 0.022, wid * 0.99]}
        position={[-len * 0.29, 0.184, 0]}
        material={materials.lace}
      />
      {/* Collar mouth, dark, ringed by the wrap. */}
      <Block
        size={[len * 0.3, 0.018, wid * 0.7]}
        position={[-len * 0.24, 0.188, 0]}
        material={materials.upperDark}
      />
      {/* Ankle patch, standing a hair outside the shaft on both cheeks so it
          reads whichever side is facing. Only ornament that survives here. */}
      <Block
        size={[len * 0.13, 0.05, wid * 1.03]}
        position={[-len * 0.32, 0.125, 0]}
        material={materials.patch}
      />
      {/* Lace bars up the throat steps, sitting just proud of each tread. */}
      {[
        [len * 0.12, 0.103],
        [len * 0.03, 0.131],
        [-len * 0.05, 0.153],
      ].map(([x, y]) => (
        <Block
          key={x}
          size={[len * 0.05, 0.014, wid * 0.66]}
          position={[x, y, 0]}
          material={materials.lace}
        />
      ))}
      {/* Loose ends. The long one is held a hair outside the shaft so it hangs
          against the cheek rather than through it; the short one rides just
          inboard of that, off centre, so at this size the two do not merge
          into one thick lace. */}
      <LaceRun path={SPILL} z={cheek * wid * 0.55} material={materials.lace} />
      <LaceRun path={FLOP} z={cheek * wid * 0.22} material={materials.lace} />
      {/* Tread, hung under the sole.
          Invisible on a shoe that is the right way up — it sits at or below
          the floor plane — and the whole reason the tipped one reads. On its
          side you are looking at the bottom of a shoe, and a bare pale
          rectangle there is a block of soap. Four bars across it and it is a
          sole. */}
      {[-0.3, -0.1, 0.1, 0.3].map((along) => (
        <Block
          key={along}
          // Sunk into the sole rather than hung off it. Standing clear they
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
 * once it has — a tipped shoe pivots about its middle, not its sole, and this
 * one is tall, so it comes to rest further over and higher off the ground than
 * a low shoe would.
 *
 * The roll is negative, which matters: rolled the other way the shoe presents
 * its outer cheek, and a cheek is a rectangle. Rolled this way it shows the
 * camera its sole and its tread, which is unmistakably a shoe and is the
 * reason to have tipped one over at all.
 *
 * Both yaws are kept well away from square-to-camera. A shoe pointing at the
 * lens is a lump; the profile is the only angle it reads from.
 */
const THROWN: readonly {
  at: Vec3
  yaw: number
  roll: number
  /** Which cheek the laces sit on: +1 is local +z. */
  cheek: number
  /** Spill a loose end over the tread and out onto the floor. */
  drape?: boolean
}[] = [
  // Nearer the wall, standing, turned off square to it. Camera-side cheek.
  { at: [0.98, 0, 0.42], yaw: 0.4, roll: 0.08, cheek: 1 },
  // A stride out and over, lying on its cheek where it stopped. Same +z cheek,
  // which the roll swings face up — laces lie across the top, not underneath.
  // Nothing up there can reach the floor on its own, hence the drape.
  { at: [1.36, 0.062, 0.74], yaw: -0.5, roll: -1.4, cheek: 1, drape: true },
]

export function Sneakers() {
  const materials = useMemo(
    () => ({
      sole: makeMaterial(SOLE),
      rubber: makeMaterial(RUBBER),
      upper: makeMaterial(UPPER),
      upperDark: makeMaterial(UPPER_DARK),
      patch: makeMaterial(PATCH),
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
      {THROWN.map(({ at, yaw, roll, cheek, drape }) => (
        // Nested rather than one Euler: yaw outside, roll inside, so the roll
        // happens about the shoe's own length however it is pointing. Flat
        // XYZ order would roll it about the world axis and lay it on its nose.
        <group key={at[0]} position={at} rotation={[0, yaw, 0]}>
          <group rotation={[roll, 0, 0]}>
            <Shoe materials={materials} cheek={cheek} />
          </group>
          {/* Outside the roll group — see DRAPE. */}
          {drape && (
            <>
              <group rotation={[0, -Math.PI / 2, 0]}>
                <LaceRun path={DRAPE} z={-DRAPE_X} material={materials.lace} />
              </group>
              <group rotation={[-Math.PI / 2, 0, 0]}>
                <LaceRun path={POOL} z={LACE_GAUGE / 2 - at[1]} material={materials.lace} />
              </group>
            </>
          )}
        </group>
      ))}
    </group>
  )
}
