import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { markSelfLit, noRaycast } from '@/hotspots/Hotspot'
import { PALETTE, makeMaterial } from '../palette'
import { Block } from '../primitives'
import { JUKEBOX_BAY } from '../jukebox'
import { PHASE_MS, useJukeboxStore, type MechPhase } from '@/audio/useJukeboxStore'
import { prefersReducedMotion } from '../motion'

const [BX, BY] = JUKEBOX_BAY.center

/**
 * The magazine is a horizontal carousel: a flat turntable spinning about a
 * vertical axis, with the records standing on edge around its rim. Not a wheel
 * in the plane of the glass — that was the first build's mistake, and it turned
 * the machine into a Ferris wheel.
 *
 * Each record is mounted facing outward along its own radius, so the one at the
 * front of the carousel faces the visitor square-on and the other two stand
 * behind it turned sixty degrees away. That is what makes a horizontal carousel
 * legible from the front: indexing the wheel swings the chosen label round to
 * face you, and the ones waiting are visibly waiting rather than edge-on.
 *
 * `SLOT_R` and `RECORD_R` are capped by the arch, which is only 0.6 across, and
 * by the discs not fouling each other: three on a rim have their centres
 * `2·SLOT_R·sin60°` apart.
 */
const CAROUSEL: [number, number] = [BX - 0.27, BY + 0.045]
const SLOT_R = 0.2
const RECORD_R = 0.082
const SLOT_STEP = (Math.PI * 2) / 3

/**
 * The plane every record is handled in: the front of the carousel, where the
 * turntable also sits.
 *
 * Putting both stations on one plane is what keeps the transfer a straight
 * horizontal move. A record mounted facing outward is already vertical and
 * already facing the visitor when the gripper takes it, so nothing has to be
 * turned over on the way to the platter.
 */
const CAROUSEL_Z = JUKEBOX_BAY.stage - 0.08
const PLANE_Z = CAROUSEL_Z + SLOT_R

/** Heights: where records ride, and the peak of the hop between stations. */
const DISC_Y = BY + 0.15
const CARRY_LIFT = 0.1

/** Where the gripper takes a disc from, and where it puts it. */
const PICK_X = CAROUSEL[0]
const TURNTABLE_X = BX + 0.27
const PLATTER_R = 0.105

/**
 * The gripper rides a rail rather than swinging on a pivot.
 *
 * A pivoted arm long enough to reach both stations sweeps an arc straight
 * through the carousel. Real transfer mechanisms lift clear and traverse, and
 * doing the same here is also the only thing that fits a 0.6-metre bay.
 */
const RAIL_Y = BY + 0.46
const RAIL_SPAN: [number, number] = [BX - 0.33, BX + 0.33]

/** How far above the disc's centre the gripper head sits, so its jaw is on the
    rim rather than across the label. */
const HEAD_OFFSET = 0.1

/**
 * Pickup arm. Lands inside the rim rather than on the very edge, which at this
 * size is the difference between reading as a needle down and reading as a
 * stray bar beside the record.
 */
const TONE_PIVOT: [number, number] = [BX + 0.47, BY + 0.07]
const TONE_DOWN: [number, number] = [TURNTABLE_X - 0.05, DISC_Y + 0.055]

/**
 * The arm is a single link modelled pointing along its own local -X, so a
 * rotation of θ puts the tip at `(-L·cos θ, -L·sin θ)`. Given where the tip has
 * to land, that inverts to one `atan2` — worth doing rather than writing the
 * angle down, because it means the pose follows the turntable if that moves.
 */
function reach(pivot: [number, number], target: [number, number]) {
  const dx = target[0] - pivot[0]
  const dy = target[1] - pivot[1]
  return { length: Math.hypot(dx, dy), angle: Math.atan2(-dy, -dx) }
}

const TONE = reach(TONE_PIVOT, TONE_DOWN)
/** Lifted and swung back clear of the platter. */
const TONE_PARKED = TONE.angle - 0.5

/** How fast the played disc turns, in radians a second. */
const SPIN_SPEED = 3.4

/** Damping rate for the carousel and the pickup — mechanism-slow, not UI-quick. */
const SETTLE = 7

/**
 * One label colour per track, so the carousel says which record is up without
 * anything on it being legible as text. At this size a disc is about sixteen
 * pixel blocks across and its label about six, which is a colour and nothing
 * else — so the colour has to carry it.
 */
const LABELS = [PALETTE.cyan, PALETTE.amber, PALETTE.magenta]

/** A disc is out of the magazine — so the carousel must hold still and one slot
    must show empty. */
function discIsOut(phase: MechPhase): boolean {
  return phase !== 'idle' && phase !== 'indexing'
}

function smoothstep(t: number): number {
  const p = Math.min(1, Math.max(0, t))
  return p * p * (3 - 2 * p)
}

/**
 * The record mechanism behind the crown's glass.
 *
 * Built to the order a carousel machine actually works in, because that order
 * is the reason the object is worth watching: the carousel indexes to the
 * chosen record first and only then does the gripper run; the gripper lifts the
 * disc clear of the rim, traverses, and sets it on the turntable; the pickup
 * drops last. The jukebox store owns that sequence and its timings — this reads
 * `phase` and tweens against the same `PHASE_MS` the store schedules on, so the
 * move and the sound it makes cannot drift apart.
 */
export function JukeboxMechanism() {
  const trackIndex = useJukeboxStore((s) => s.trackIndex)
  const phase = useJukeboxStore((s) => s.phase)

  const calm = useMemo(prefersReducedMotion, [])

  const materials = useMemo(
    () => ({
      cavity: makeMaterial('#191521'),
      chrome: makeMaterial(PALETTE.metal),
      chromeDark: makeMaterial(PALETTE.metalDark),
      /* The pickup is the one part that spends its working life lying *on* a
         record, and chrome against vinyl is two dark purples that posterise to
         the same block — the arm simply vanished at the moment it mattered.
         Bright enough to read over a disc, which is the only place it has to. */
      pickup: makeMaterial('#9aa0b4'),
      /* Vinyl, lifted well off black. Records are black and the cavity behind
         them is black, and at this palette depth that is simply one shape: an
         early pass rendered as three coloured labels floating in a void with no
         discs under them. The lift is what makes a disc a disc. */
      vinyl: makeMaterial('#332c40'),
      rim: makeMaterial('#514a63'),
      /* The carousel platter is horizontal and the visitor is ten degrees below
         it, so the only face of it ever on screen is the underside — which
         points away from the bay lamp and renders black. Lit from within
         instead, because the alternative is a second lamp under the deck
         pointing up at one prop. */
      platter: markSelfLit(makeMaterial('#463f55', { emissive: '#231f2e' })),
      /* Emissive is baked in here rather than left to the bay lamp, so the
         labels stay readable at the establishing shot where the lamp's falloff
         has nothing left to give. That means they must be marked self-lit: the
         hotspot's hover highlight writes `emissive` on every Lambert material
         under it and would otherwise overwrite this every frame. */
      labels: LABELS.map((color) =>
        markSelfLit(makeMaterial(color, { emissive: color, emissiveIntensity: 0.3 })),
      ),
      /* The one bright fleck on each disc. A circle spinning about its own
         centre is indistinguishable from a circle standing still, so the
         rotation needs something off-axis to show it. */
      fleck: markSelfLit(makeMaterial('#6d6478', { emissive: '#6d6478', emissiveIntensity: 0.5 })),
    }),
    [],
  )

  const carousel = useRef<THREE.Group>(null)
  const carriage = useRef<THREE.Group>(null)
  const column = useRef<THREE.Mesh>(null)
  const loaded = useRef<THREE.Group>(null)
  const spin = useRef<THREE.Group>(null)
  const tonearm = useRef<THREE.Group>(null)
  const slots = useRef<Array<THREE.Group | null>>([null, null, null])

  /** Seconds into the current phase, for tweens that must land exactly when the
      store's timer fires. */
  const elapsed = useRef(0)
  useEffect(() => {
    elapsed.current = 0
  }, [phase])

  useFrame((_, delta) => {
    elapsed.current += delta

    const duration = phase === 'idle' || phase === 'playing' ? 1 : PHASE_MS[phase] / 1000
    const progress = calm ? 1 : smoothstep(elapsed.current / duration)
    const out = discIsOut(phase)

    // Carousel. Never reduced modulo a turn: stepping from the third record
    // back to the first takes it the long way round, which is what a magazine
    // that only indexes one way actually does.
    if (carousel.current) {
      const goal = -trackIndex * SLOT_STEP
      carousel.current.rotation.y = calm
        ? goal
        : THREE.MathUtils.damp(carousel.current.rotation.y, goal, SETTLE, delta)
    }

    // Whichever slot the loaded disc came from shows empty until it is back.
    slots.current.forEach((group, index) => {
      if (group) group.visible = !(out && index === trackIndex)
    })

    // Gripper. Traverses during the two transfer phases and parks over a
    // station otherwise; the disc hops rather than sliding, so it passes over
    // the carousel's rim instead of through it.
    let carriageX = PICK_X
    let discY = DISC_Y
    let hop = 0

    if (phase === 'lifting' || phase === 'returning') {
      const forward = phase === 'lifting'
      carriageX = THREE.MathUtils.lerp(
        forward ? PICK_X : TURNTABLE_X,
        forward ? TURNTABLE_X : PICK_X,
        progress,
      )
      hop = Math.sin(Math.PI * progress) * CARRY_LIFT
    } else if (phase === 'cueing' || phase === 'playing') {
      carriageX = TURNTABLE_X
    }

    const headY = discY + hop + HEAD_OFFSET
    if (carriage.current) carriage.current.position.set(carriageX, headY, PLANE_Z + 0.045)
    if (loaded.current) {
      loaded.current.visible = out
      loaded.current.position.set(carriageX, discY + hop, PLANE_Z)
    }
    // The lift column is a unit box stretched between the rail and the head,
    // which is cheaper than rebuilding geometry and reads the same.
    if (column.current) {
      column.current.scale.y = Math.max(0.001, RAIL_Y - headY)
      column.current.position.set(carriageX, (RAIL_Y + headY) / 2, PLANE_Z + 0.045)
    }

    if (tonearm.current) {
      const goal = phase === 'cueing' || phase === 'playing' ? TONE.angle : TONE_PARKED
      tonearm.current.rotation.z = calm
        ? goal
        : THREE.MathUtils.damp(tonearm.current.rotation.z, goal, SETTLE, delta)
    }

    if (!calm && spin.current && (phase === 'playing' || phase === 'cueing')) {
      spin.current.rotation.z -= delta * SPIN_SPEED
    }

    materials.labels.forEach((material, index) => {
      material.emissiveIntensity = index === trackIndex ? 0.85 : 0.25
    })
  })

  /**
   * A disc: vinyl, a rim highlight to give it an edge the head-on lighting
   * cannot, a label, and one off-centre fleck so its rotation shows.
   *
   * Labelled on both faces. A 45 has an A side and a B side, so this is what a
   * record looks like anyway — but the reason it is here is that a horizontal
   * carousel turns two of its three records away from the visitor at all times,
   * and a single-sided disc left those two as blank dark slabs.
   */
  const disc = (label: THREE.Material) => (
    <>
      <mesh rotation={[Math.PI / 2, 0, 0]} material={materials.vinyl} raycast={noRaycast}>
        <cylinderGeometry args={[RECORD_R, RECORD_R, 0.008, 20]} />
      </mesh>
      {[0, Math.PI].map((face) => (
        <group key={face} rotation={[0, face, 0]}>
          <mesh position={[0, 0, 0.005]} material={materials.rim} raycast={noRaycast}>
            <ringGeometry args={[RECORD_R * 0.86, RECORD_R, 20]} />
          </mesh>
          <mesh position={[0, 0, 0.006]} material={label} raycast={noRaycast}>
            <circleGeometry args={[RECORD_R * 0.4, 14]} />
          </mesh>
          <Block
            size={[0.04, 0.011, 0.002]}
            position={[RECORD_R * 0.68, 0, 0.006]}
            material={materials.fleck}
          />
        </group>
      ))}
    </>
  )

  return (
    <group name="jukebox-mechanism">
      {/* Bay shell: a back wall and a deck. The curved ceiling is the crown's
          own inside face, which the cabinet renders as a separate shell. */}
      <mesh position={[BX, BY, JUKEBOX_BAY.back]} material={materials.cavity} raycast={noRaycast}>
        {/* Wider than the opening: on-axis the opening covers it exactly, and
            the overshoot is what stops an off-centre sightline finding the gap
            between this and the crown's inner face. */}
        <circleGeometry args={[JUKEBOX_BAY.radius + 0.12, 24, 0, Math.PI]} />
      </mesh>
      <Block
        size={[JUKEBOX_BAY.radius * 2, 0.02, 0.62]}
        position={[BX, BY + 0.01, JUKEBOX_BAY.stage - 0.03]}
        material={materials.chromeDark}
      />

      {/* Traverse rail */}
      <Block
        size={[RAIL_SPAN[1] - RAIL_SPAN[0], 0.022, 0.03]}
        position={[(RAIL_SPAN[0] + RAIL_SPAN[1]) / 2, RAIL_Y, PLANE_Z + 0.045]}
        material={materials.chrome}
      />

      {/* Carousel: a flat platter turning about a vertical axis. Seen from ten
          degrees below, it reads as a shallow ellipse — which is the whole
          point, and the thing that says this is a horizontal wheel. */}
      <mesh
        position={[CAROUSEL[0], CAROUSEL[1], CAROUSEL_Z]}
        material={materials.platter}
        raycast={noRaycast}
      >
        <cylinderGeometry args={[SLOT_R + 0.05, SLOT_R + 0.05, 0.05, 24]} />
      </mesh>
      {/* Chrome band round the platter's edge. Vertical, unlike every other
          surface on the platter, so it is the one part that catches the bay
          lamp and gives the wheel an outline. */}
      <mesh
        position={[CAROUSEL[0], CAROUSEL[1] + 0.018, CAROUSEL_Z]}
        material={materials.chrome}
        raycast={noRaycast}
      >
        <cylinderGeometry args={[SLOT_R + 0.054, SLOT_R + 0.054, 0.016, 24, 1, true]} />
      </mesh>
      <group ref={carousel} position={[CAROUSEL[0], CAROUSEL[1], CAROUSEL_Z]}>
        <mesh position={[0, 0.1, 0]} material={materials.chrome} raycast={noRaycast}>
          <cylinderGeometry args={[0.028, 0.028, 0.26, 10]} />
        </mesh>
        {[0, 1, 2].map((slot) => {
          const angle = slot * SLOT_STEP
          return (
            <group
              key={slot}
              ref={(node) => {
                slots.current[slot] = node
              }}
              position={[Math.sin(angle) * SLOT_R, DISC_Y - CAROUSEL[1], Math.cos(angle) * SLOT_R]}
              rotation={[0, angle, 0]}
            >
              {disc(materials.labels[slot])}
              {/* The cradle the disc stands in. */}
              <Block
                size={[0.085, 0.018, 0.05]}
                position={[0, -RECORD_R - 0.012, 0]}
                material={materials.chrome}
              />
            </group>
          )
        })}
      </group>

      {/* Turntable. Vertical, because a record mounted facing outward on the
          carousel arrives already standing up and facing the visitor. */}
      <mesh
        position={[TURNTABLE_X, DISC_Y, PLANE_Z - 0.03]}
        rotation={[Math.PI / 2, 0, 0]}
        material={materials.cavity}
        raycast={noRaycast}
      >
        <cylinderGeometry args={[PLATTER_R, PLATTER_R, 0.03, 20]} />
      </mesh>
      {/* Rim and spindle only. A filled platter is a grey blob whenever no
          record is on it, and a rim reads as a place a record goes. */}
      <mesh
        position={[TURNTABLE_X, DISC_Y, PLANE_Z - 0.012]}
        material={materials.chrome}
        raycast={noRaycast}
      >
        <ringGeometry args={[PLATTER_R * 0.88, PLATTER_R, 20]} />
      </mesh>
      <mesh
        position={[TURNTABLE_X, DISC_Y, PLANE_Z - 0.008]}
        material={materials.chrome}
        raycast={noRaycast}
      >
        <circleGeometry args={[0.016, 10]} />
      </mesh>

      {/* The disc under the gripper. One mesh moved between stations rather
          than a fourth record: there are only ever three, and whichever slot
          this came out of is hidden while it is away. */}
      <group ref={loaded} visible={false}>
        <group ref={spin}>{disc(materials.labels[trackIndex])}</group>
      </group>

      {/* Lift column and gripper head */}
      <mesh ref={column} material={materials.chromeDark} raycast={noRaycast}>
        <boxGeometry args={[0.026, 1, 0.026]} />
      </mesh>
      <group ref={carriage}>
        <Block size={[0.075, 0.05, 0.05]} position={[0, 0, 0]} material={materials.chrome} />
        <Block size={[0.03, 0.045, 0.045]} position={[0, -0.04, 0]} material={materials.chrome} />
      </group>

      {/* Pickup arm */}
      <group ref={tonearm} position={[TONE_PIVOT[0], TONE_PIVOT[1], PLANE_Z + 0.075]}>
        <Block
          size={[TONE.length, 0.026, 0.024]}
          position={[-TONE.length / 2, 0, 0]}
          material={materials.pickup}
        />
        <Block
          size={[0.042, 0.036, 0.03]}
          position={[-TONE.length, 0, -0.006]}
          material={materials.pickup}
        />
      </group>
      <mesh
        position={[TONE_PIVOT[0], TONE_PIVOT[1], PLANE_Z + 0.075]}
        rotation={[Math.PI / 2, 0, 0]}
        material={materials.chromeDark}
        raycast={noRaycast}
      >
        <cylinderGeometry args={[0.038, 0.038, 0.05, 10]} />
      </mesh>
    </group>
  )
}
