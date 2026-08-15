import { useEffect, useMemo } from 'react'
import { makeMaterial } from './palette'
import { Block, ContactShadow } from './primitives'

type Vec3 = [number, number, number]

interface ArecaPalmProps {
  /** World position of the potted palm. */
  position?: Vec3
  /** Rotation [x, y, z]. */
  rotation?: Vec3
  /**
   * Shifts the frond fan and the shading wobble. Two palms either side of a
   * door are the same plant twice unless something separates them, and a
   * mirrored copy is worse than a repeat — a reflection reads as a graphic.
   */
  seed?: number
}

/**
 * Potted areca palm. Set dressing, nothing clickable.
 *
 * Built the opposite way round from a broadleaf. There is no canopy here: an
 * areca is a clump of bare reed canes with a handful of feather fronds
 * arching off the top of them, and the *gaps* are the plant. You should be
 * able to see the wall through it.
 *
 * So each frond is drawn as a real spine with leaflets along it rather than as
 * a mass — six segments on an arc that lifts a little then falls away, with a
 * pair of blades per segment, longest in the middle and tapering to nothing at
 * the tip. That taper is the whole read: even leaflets down a straight spine
 * come back as a feather duster.
 *
 * Sized for about fifty pixels at the opening framing: hard steps, no curves,
 * three greens.
 */

/** Hinge side. The right-hand copy passes its own position. */
const DEFAULT_SPOT: Vec3 = [-1.35, 0, 0.42]

/**
 * Authored light on purpose — the pixelation pass blits straight out, so what
 * lands on screen is roughly the square of what is written here. A colour
 * picked by eye arrives crushed to black.
 *
 * Warmer than the olive it replaced but not by much. An areca really is
 * yellow-green, and authored at that hue it came back neon — the brightest
 * thing on screen by a mile, pulling the eye clean off the handle. Two plants
 * flanking a door get to be furniture, not the subject.
 *
 * All scaled x0.72 together. Uniform, so three greens keep their spacing and
 * posterise still lands three bands, not two.
 */
const POT = '#675247'
const POT_RIM = '#725c51'
const SOIL = '#3c3129'
const CANE = '#5b6347'
const LEAF_LIGHT = '#6f7b5f'
const LEAF = '#5e6b50'
const LEAF_DARK = '#495641'

/** Pot: squat, so the plant is the object and not the container. */
const POT_TIERS: readonly (readonly [number, number, number])[] = [
  // width, height, y-centre
  [0.185, 0.085, 0.043],
  [0.235, 0.085, 0.128],
]
const RIM = { width: 0.275, height: 0.05, y: 0.195 } as const
const SOIL_TOP = 0.22

/**
 * The canes. Five, clustered and splaying — an areca grows in a clump from the
 * base rather than on one trunk, and the fan of bare stems under the fronds is
 * half of what identifies it.
 *
 * `lean` is where the top of the cane ends up relative to its foot. Stepped in
 * three blocks rather than rotated: a tilted box draws a soft diagonal the
 * posterise step turns to mush.
 */
const CANES: readonly { x: number; z: number; height: number; lean: [number, number] }[] = [
  { x: 0.0, z: 0.0, height: 0.7, lean: [0.03, 0.0] },
  { x: -0.05, z: 0.03, height: 0.58, lean: [-0.07, 0.04] },
  { x: 0.05, z: -0.03, height: 0.64, lean: [0.08, -0.04] },
  { x: -0.02, z: -0.05, height: 0.48, lean: [-0.04, -0.08] },
  { x: 0.03, z: 0.05, height: 0.53, lean: [0.05, 0.07] },
]

/** Blocks per cane, and per frond. Both tuned to the pixel grid, not to taste. */
const CANE_STEPS = 3
const FROND_STEPS = 6

interface FrondDef {
  /** Which cane it grows out of. */
  cane: number
  /** Which way it reaches, radians. */
  yaw: number
  /** How far out it gets. */
  reach: number
  /** Lift off the cane head, and the droop that overtakes it. */
  rise: number
  fall: number
  /** Half-width of the blade where it is widest. */
  span: number
  /**
   * Twist about the frond's own axis.
   *
   * Without it a frond that reaches left or right is seen exactly edge-on —
   * a blade a centimetre thick, so it vanishes and takes a ninth of the plant
   * with it. Real fronds twist anyway; rolled a half radian or so they turn
   * enough of their face to the lens to read from any angle.
   */
  roll: number
}

/**
 * Nine fronds over five canes — the tall canes carry more.
 *
 * Yaws are hand-picked and deliberately uneven, and the rolls alternate sign.
 * Spaced evenly they close into a shuttlecock, and the plant stops having a
 * front.
 */
const FRONDS: readonly FrondDef[] = [
  { cane: 0, yaw: 0.35, reach: 0.36, rise: 0.28, fall: 0.52, span: 0.09, roll: 0.7 },
  { cane: 0, yaw: 3.5, reach: 0.33, rise: 0.25, fall: 0.48, span: 0.085, roll: -0.6 },
  { cane: 0, yaw: 1.9, reach: 0.3, rise: 0.27, fall: 0.46, span: 0.08, roll: 0.45 },
  { cane: 1, yaw: 2.4, reach: 0.34, rise: 0.23, fall: 0.5, span: 0.085, roll: -0.75 },
  { cane: 1, yaw: 5.0, reach: 0.29, rise: 0.26, fall: 0.44, span: 0.075, roll: 0.55 },
  { cane: 2, yaw: 5.5, reach: 0.33, rise: 0.27, fall: 0.48, span: 0.085, roll: -0.5 },
  { cane: 2, yaw: 1.2, reach: 0.3, rise: 0.29, fall: 0.45, span: 0.08, roll: 0.8 },
  { cane: 3, yaw: 4.1, reach: 0.27, rise: 0.21, fall: 0.4, span: 0.07, roll: -0.65 },
  { cane: 4, yaw: 0.9, reach: 0.26, rise: 0.3, fall: 0.38, span: 0.07, roll: 0.6 },
]

/**
 * A repeatable wobble, enough to flip a segment near a shading threshold.
 *
 * Without it the three greens land in clean bands down each frond and the
 * plant reads as printed. Hashed rather than random so a palm is the same palm
 * on every load, and so the two either side of the door stay different from
 * each other.
 */
function jitter(n: number): number {
  const hash = Math.sin(n * 127.1) * 43758.5453
  return (hash - Math.floor(hash) - 0.5) * 0.26
}

export function ArecaPalm({
  position = DEFAULT_SPOT,
  rotation = [0, 0.35, 0],
  seed = 0,
}: ArecaPalmProps) {
  const materials = useMemo(
    () => ({
      pot: makeMaterial(POT),
      rim: makeMaterial(POT_RIM),
      soil: makeMaterial(SOIL),
      cane: makeMaterial(CANE),
      leaf: makeMaterial(LEAF),
      leafLight: makeMaterial(LEAF_LIGHT),
      leafDark: makeMaterial(LEAF_DARK),
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

  /** Cane blocks, and where each cane's head ends up for its fronds to hang off. */
  const canes = useMemo(
    () =>
      CANES.map(({ x, z, height, lean }) => {
        const blocks = []
        for (let k = 0; k < CANE_STEPS; k += 1) {
          const t = (k + 0.5) / CANE_STEPS
          blocks.push({
            at: [x + lean[0] * t, SOIL_TOP + height * t, z + lean[1] * t] as Vec3,
            // Tapers with height, the way a reed does. Slim: five thick ones
            // bundle up and read as bamboo.
            width: 0.024 - 0.007 * t,
            height: height / CANE_STEPS + 0.01,
          })
        }
        return {
          blocks,
          head: [x + lean[0], SOIL_TOP + height, z + lean[1]] as Vec3,
        }
      }),
    [],
  )

  return (
    <group position={position} rotation={rotation}>
      {POT_TIERS.map(([width, height, y]) => (
        <Block
          key={y}
          size={[width, height, width]}
          position={[0, y, 0]}
          material={materials.pot}
        />
      ))}
      <Block
        size={[RIM.width, RIM.height, RIM.width]}
        position={[0, RIM.y, 0]}
        material={materials.rim}
      />
      {/* Soil sunk inside the rim, so the lip stands proud of it. */}
      <Block
        size={[0.24, 0.03, 0.24]}
        position={[0, SOIL_TOP - 0.02, 0]}
        material={materials.soil}
      />

      {canes.map(({ blocks }, i) =>
        blocks.map(({ at, width, height }) => (
          <Block
            key={`${i}-${at[1]}`}
            size={[width, height, width]}
            position={at}
            material={materials.cane}
          />
        )),
      )}

      {FRONDS.map((frond, f) => {
        const head = canes[frond.cane].head
        // Which way this frond points in the plant's own space, used below to
        // decide how much of the key it is facing.
        const yaw = frond.yaw + seed * 0.7
        const facing = Math.cos(yaw)
        const step = frond.reach / FROND_STEPS

        const segments = []
        for (let j = 0; j < FROND_STEPS; j += 1) {
          const t = (j + 0.5) / FROND_STEPS
          const x = frond.reach * t
          // Lifts, then the droop overtakes it. One parabola is the whole
          // arch — an areca frond leaves the cane going up and finishes below
          // where it started.
          const y = frond.rise * t - frond.fall * t * t
          // Narrow where it leaves the cane, widest about two fifths out, and
          // closed to nothing at the tip. Skewed toward the base by the
          // exponent on t — a symmetric taper reads as a leaf, not a frond.
          const span = frond.span * Math.sin(Math.PI * Math.pow(t, 0.75)) ** 0.5

          // Lit from above and from the right, across the whole plant rather
          // than per frond — shading each frond on its own makes seven
          // separate objects instead of one clump.
          const shade =
            0.5 + facing * 0.3 + (y / 0.3) * 0.4 + jitter(f * 13 + j + seed * 31)
          const material =
            shade > 0.62
              ? materials.leafLight
              : shade > 0.34
                ? materials.leaf
                : materials.leafDark

          segments.push({ j, x, y, span, material })
        }

        return (
          <group key={f} position={head} rotation={[0, yaw, 0]}>
            {segments.map(({ j, x, y, span, material }) => (
              /* One blade across the whole width, not a leaflet each side.
                 Individual leaflets were tried and are the wrong tool at this
                 pitch: each one lands as a two-pixel plate with air round it,
                 so a frond arrives as confetti blowing off the plant. Drawn
                 solid and stepped, the same silhouette reads as pinnate
                 anyway — the steps in the outline do the work the gaps were
                 supposed to.
                 Rolled about the frond's axis so the face turns toward the
                 lens; see `roll`. */
              <group key={j} position={[x, y, 0]} rotation={[frond.roll, 0, 0]}>
                <Block size={[step * 1.45, 0.016, span * 2]} position={[0, 0, 0]} material={material} />
                {/* Midrib, standing a hair proud of the blade and carrying the
                    cane's colour — the line down the middle is most of what
                    says frond rather than leaf. */}
                <Block
                  size={[step * 1.45, 0.02, 0.022]}
                  position={[0, 0.004, 0]}
                  material={materials.cane}
                />
              </group>
            ))}
            {/* The tip, past the last pair of blades. */}
            <Block
              size={[step * 0.9, 0.014, 0.014]}
              position={[frond.reach, frond.rise - frond.fall, 0]}
              material={materials.leafDark}
            />
          </group>
        )
      })}

      <ContactShadow position={[0, 0.008, 0]} scale={[0.85, 0.85]} opacity={0.7} />
    </group>
  )
}
