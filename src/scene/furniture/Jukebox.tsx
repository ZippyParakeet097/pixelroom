import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { Hotspot, markSelfLit, noRaycast } from '@/hotspots/Hotspot'
import { useRoomStore } from '@/state/useRoomStore'
import { PALETTE, makeGlowMaterial, makeMaterial } from '../palette'
import { Block, ContactShadow, PickProxy } from '../primitives'
import { transportGlyphTexture, type TransportGlyph } from '../textures'
import {
  JUKEBOX_BAY,
  JUKEBOX_CABINET,
  JUKEBOX_DISPLAY,
  JUKEBOX_FACE,
  JUKEBOX_KEYS,
  JUKEBOX_ORIGIN,
} from '../jukebox'
import { JukeboxMechanism } from './JukeboxMechanism'
import { useJukeboxStore } from '@/audio/useJukeboxStore'
import { playSfx } from '@/audio/sfx'

const [X, Z] = JUKEBOX_ORIGIN
const { width: W, depth: D, base: BASE, shoulder: SHOULDER, crown: CROWN } = JUKEBOX_CABINET

/** Stacking order on the fascia, front to back, in metres proud of the face. */
const SURROUND_Z = JUKEBOX_FACE + 0.002
const TRIM_Z = JUKEBOX_FACE + 0.014
const KEY_Z = JUKEBOX_FACE + 0.03

/** The key bank's height on the fascia — below the glass, above the grille. */
const KEY_Y = JUKEBOX_KEYS.y

/**
 * Half-width of the key plate, and how far the outer keys sit from the middle.
 *
 * Narrower than the window above it, which is what makes room for the coin
 * plate and the maker's badge flanking it. Those are the cheapest analogue
 * signal on the whole cabinet: a machine that takes money is a machine, and a
 * machine with nowhere to put money is a cupboard with lights on.
 */
const PLATE_HALF = 0.47
const KEY_SPAN = 0.3

/** Where the flanking chrome plates sit, threaded between the plate and the
    pilasters. */
const FLANK_X = 0.575

/**
 * Key face colours, resting to pressed — the same trick the monitor's power
 * switch uses. The jukebox's stop looks straight down the fascia's normal (it
 * has to, so the selection window projects to an axis-aligned rectangle), which
 * means travel along Z moves a key directly away from the eye and shows almost
 * nothing. Colour is what sells the press up close; the millimetre of travel
 * below is for the establishing shot.
 */
const KEY_REST = new THREE.Color('#8b7d92')
const KEY_LIT = new THREE.Color('#e6d6ec')

/**
 * The window's own light spilling back onto the fascia, and how far in front of
 * the glass the source sits.
 *
 * Without it the key bank is unreadable: the room's fixed lights barely reach
 * this corner, so every key face renders as the same near-black as the cabinet
 * and the glyphs on them disappear entirely. Pulled forward off the glass for
 * the same reason the monitor's is — sitting it against the plane makes the
 * falloff steep enough that the posterisation step renders it as rings.
 */
const FASCIA_GLOW_INTENSITY = 2.6
const FASCIA_GLOW_OFFSET = 0.85

/**
 * The bay's own lamp, sat just inside the frame and pointing back at the
 * mechanism.
 *
 * Same problem as the fascia, one storey up and worse: nothing in the room's
 * lighting rig reaches the crown at all, and unlike the fascia the bay has no
 * lit glass of its own to borrow from. Without this the wheel is a black disc
 * on a black wall. Kept weak because it is close to what it lights — falloff is
 * inverse-square, and the mechanism sits about a quarter-metre away.
 */
const BAY_LAMP_INTENSITY = 0.8

type KeyId = 'previous' | 'toggle' | 'next'

/** Transport keys, left to right across the bank. */
const KEYS: Array<{ id: KeyId; x: number }> = [
  { id: 'previous', x: -KEY_SPAN },
  { id: 'toggle', x: 0 },
  { id: 'next', x: KEY_SPAN },
]

/**
 * Jukebox (plan §5).
 *
 * The plan flagged this as the one hotspot unlikely to exist as a ready-made
 * asset. Built here from primitives in the order a late-forties cabinet stacks
 * them, top to bottom: a domed crown with a lit arch, a glazed mechanism bay
 * under it, a selection window, a bank of transport keys flanked by the coin
 * plate, and a slatted grille at the bottom.
 *
 * Like the PC, this object carries its interface on itself rather than in a
 * panel beside it. The selection window is modelled glass that <JukeboxPanel>
 * is pasted onto, and the keys below it are real meshes with their own pick
 * proxies — so picking a track and starting it are both things you do to the
 * cabinet rather than to a floating dialog. Anything modelled *inside* the
 * window rectangle would be unclickable once the overlay covers it, which is
 * why the bank sits below the glass and why the record mechanism gets its own
 * opening in the crown rather than sharing the selection window.
 *
 * The arch and the pilasters pulse for as long as the mechanism is running —
 * which starts when a selection is accepted, not when the first note sounds —
 * so the object doubles as an at-a-glance state indicator from across the room.
 */
export function Jukebox() {
  const materials = useMemo(() => {
    /* Glyphs ride on their own plane in front of each key rather than as a map
       on the key's face: an alpha map on the box would punch the transparent
       part of the texture through all six of its sides. */
    const glyph = (kind: TransportGlyph) =>
      makeGlowMaterial('#ffffff', { map: transportGlyphTexture(kind), alphaTest: 0.5 })
    /* One material per key — the press animation writes `color`, so a shared
       instance would light all three whenever any one of them is hovered. */
    const key = () => markSelfLit(makeMaterial(KEY_REST.getStyle()))

    return {
      body: makeMaterial(PALETTE.woodDark),
      /* The crown is two nested shells rather than one double-sided one. Its
         outside is the cabinet's wood and its inside is the bay's ceiling, and
         those want opposite colours — a brown ceiling above the mechanism reads
         as a shed, not as a machine. */
      crownInner: makeMaterial('#191521', { side: THREE.BackSide }),
      plinth: makeMaterial(PALETTE.wood),
      trim: makeMaterial(PALETTE.metal),
      surround: makeMaterial(PALETTE.plastic),
      /* Warm and dim, not a bright screen. This is a card rack lit from behind
         by a bulb, and the magenta it used to be was the single thing making
         the cabinet read as a monitor in a cupboard from across the room. */
      glass: makeGlowMaterial('#7a4526'),
      strip: makeGlowMaterial('#cfc3a8'),
      stripRule: makeGlowMaterial(PALETTE.amber),
      /* Barely there. Enough to catch the arch light and say "there is glass in
         front of this", not enough to grey out what is behind it. */
      bayGlass: makeGlowMaterial('#cfe4f2', {
        transparent: true,
        opacity: 0.09,
        depthWrite: false,
      }),
      arch: makeGlowMaterial(PALETTE.amber),
      badge: makeGlowMaterial(PALETTE.amber),
      tube: makeGlowMaterial(PALETTE.amber),
      grille: makeMaterial(PALETTE.plastic),
      slat: makeMaterial(PALETTE.metalDark),
      keyPlate: markSelfLit(makeMaterial('#15151a')),
      coinSlot: markSelfLit(makeMaterial('#0f0d14')),
      previous: key(),
      toggle: key(),
      next: key(),
      prevGlyph: glyph('prev'),
      nextGlyph: glyph('next'),
      playGlyph: glyph('play'),
      pauseGlyph: glyph('pause'),
    }
  }, [])

  const arch = useRef<THREE.Mesh>(null)
  const keyGroups = useRef<Array<THREE.Group | null>>([null, null, null])

  /* The cabinet lights up for the whole cycle, not just for audio. A machine
     that has accepted your selection and is fetching the record is doing
     something, and going dark until the first note would read as a dropped
     press. */
  const active = useJukeboxStore((s) => s.phase !== 'idle')
  const toggle = useJukeboxStore((s) => s.toggle)
  const next = useJukeboxStore((s) => s.next)
  const previous = useJukeboxStore((s) => s.previous)

  /**
   * The bank is only live once the camera is at the cabinet. At the
   * establishing shot a key is three pixels across, and a stray click there
   * should focus the jukebox — which is what the hotspot's own proxy does when
   * these are absent.
   */
  const keysLive = useRoomStore((s) => s.focused === 'jukebox')
  const [hoveredKey, setHoveredKey] = useState<number | null>(null)

  /** Per-key press amount, damped toward hover. */
  const press = useRef([0, 0, 0])

  useFrame(({ clock }, delta) => {
    // Idle is 0.6 rather than off. The arch used to sit against a bare wall,
    // where a quarter-brightness amber still read; against the dome it is amber
    // on brown wood and simply disappears. The pulse is the playback tell — the
    // arch being lit at all is not.
    const pulse = active ? 0.6 + Math.sin(clock.elapsedTime * 3.4) * 0.4 : 0.6
    if (arch.current) {
      const material = arch.current.material as THREE.MeshBasicMaterial
      material.color.set(PALETTE.amber).multiplyScalar(pulse)
    }
    materials.tube.color.set(PALETTE.amber).multiplyScalar(active ? 0.55 + pulse * 0.45 : 0.5)

    KEYS.forEach((entry, index) => {
      const goal = hoveredKey === index ? 1 : 0
      const at = press.current[index]
      if (Math.abs(at - goal) < 0.001) return
      const value = THREE.MathUtils.damp(at, goal, 18, delta)
      press.current[index] = value
      materials[entry.id].color.lerpColors(KEY_REST, KEY_LIT, value)
      const group = keyGroups.current[index]
      if (group) group.position.z = KEY_Z - value * 0.01
    })
  })

  // R3F fires no pointerout for a proxy that unmounts under the cursor, so
  // stepping back would otherwise leave a key stuck lit and the cursor stuck
  // as a pointer over an empty room.
  useEffect(() => {
    if (!keysLive) setHoveredKey(null)
  }, [keysLive])

  // The hotspot only manages the cursor while nothing is focused, so at the
  // cabinet — which is exactly when these are live — nothing else will.
  useEffect(() => {
    if (hoveredKey === null) return
    document.body.style.cursor = 'pointer'
    return () => {
      document.body.style.cursor = 'auto'
    }
  }, [hoveredKey])

  const pressKey = useCallback(
    (event: ThreeEvent<MouseEvent>, id: KeyId) => {
      event.stopPropagation()
      // A cabinet key is a switch with a spring behind it, not a UI element.
      playSfx('clack')
      if (id === 'previous') previous()
      else if (id === 'next') next()
      else toggle()
    },
    [previous, next, toggle],
  )

  return (
    <Hotspot id="jukebox">
      {/* Height covers the domed crown (y 2.81), not just the cabinet. */}
      <PickProxy size={[W + 0.1, 2.85, D + 0.12]} position={[X, 1.41, Z - 0.02]} />

      {/* Plinth, kick rail and body */}
      <Block size={[W + 0.06, BASE, D + 0.04]} position={[X, BASE / 2, Z]} material={materials.plinth} />
      <Block size={[W + 0.08, 0.045, D + 0.06]} position={[X, 0.1, Z]} material={materials.trim} />
      <Block
        size={[W, SHOULDER - BASE, D]}
        position={[X, (SHOULDER + BASE) / 2, Z]}
        material={materials.body}
      />

      {/* Domed crown: a half-cylinder lying on its side, axis along Z.
          `thetaStart` matters as much as the rotation. The default half runs
          along +X, which the X rotation cannot move — it leaves a flat wall
          down the middle of the cabinet with the left half of the dome simply
          missing. Starting at π/2 selects the half that the +90° rotation
          stands upright. Its open underside is covered exactly by the body's
          top face, since the radius equals the cabinet's half-width.

          Open-ended, unlike a solid crown: the flat cap it would otherwise have
          is exactly where the mechanism bay's opening goes, so the front face
          is built below as a ring instead. */}
      <mesh
        position={[X, SHOULDER, Z]}
        rotation={[Math.PI / 2, 0, 0]}
        material={materials.body}
        raycast={noRaycast}
      >
        <cylinderGeometry args={[CROWN, CROWN, D, 16, 1, true, Math.PI / 2, Math.PI]} />
      </mesh>
      {/* Inside face of the crown — the bay's ceiling. Only needs to span from
          the opening back to the bay's rear wall; behind that is sealed. */}
      <mesh
        position={[X, SHOULDER, (JUKEBOX_FACE + JUKEBOX_BAY.back) / 2]}
        rotation={[Math.PI / 2, 0, 0]}
        material={materials.crownInner}
        raycast={noRaycast}
      >
        <cylinderGeometry
          args={[
            CROWN - 0.01,
            CROWN - 0.01,
            JUKEBOX_FACE - JUKEBOX_BAY.back,
            16,
            1,
            true,
            Math.PI / 2,
            Math.PI,
          ]}
        />
      </mesh>

      {/* Front face of the crown: a ring, so the semicircle it leaves in the
          middle is the mechanism bay's opening. */}
      <mesh position={[X, SHOULDER, JUKEBOX_FACE]} material={materials.body} raycast={noRaycast}>
        <ringGeometry args={[JUKEBOX_BAY.radius, CROWN, 24, 1, 0, Math.PI]} />
      </mesh>

      {/* The lit arch, sat in the frame band the ring leaves */}
      <mesh ref={arch} position={[X, SHOULDER, TRIM_Z]} material={materials.arch} raycast={noRaycast}>
        <ringGeometry args={[JUKEBOX_BAY.radius + 0.025, CROWN - 0.02, 24, 1, 0, Math.PI]} />
      </mesh>

      <JukeboxMechanism />

      {/* Bay glazing, in front of the mechanism */}
      <mesh
        position={[X, SHOULDER, JUKEBOX_FACE + 0.006]}
        material={materials.bayGlass}
        raycast={noRaycast}
      >
        <circleGeometry args={[JUKEBOX_BAY.radius, 24, 0, Math.PI]} />
      </mesh>

      <pointLight
        position={[X, SHOULDER + 0.34, JUKEBOX_BAY.stage + 0.22]}
        intensity={BAY_LAMP_INTENSITY}
        decay={2}
        color="#ffd9a0"
      />

      {/* Chrome rail capping the body, under the arch */}
      <Block size={[W - 0.12, 0.05, 0.03]} position={[X, SHOULDER - 0.04, TRIM_Z]} material={materials.trim} />

      {/* Selection window: a dark recess, then the glass the DOM track list is
          pasted onto. Geometry comes from JUKEBOX_DISPLAY because the overlay
          has to land on this exact rectangle (plan §6). */}
      <Block
        size={[JUKEBOX_DISPLAY.width + 0.1, JUKEBOX_DISPLAY.height + 0.1, 0.02]}
        position={[X, JUKEBOX_DISPLAY.center[1], SURROUND_Z]}
        material={materials.surround}
      />
      <mesh position={JUKEBOX_DISPLAY.center} material={materials.glass} raycast={noRaycast}>
        <planeGeometry args={[JUKEBOX_DISPLAY.width, JUKEBOX_DISPLAY.height]} />
      </mesh>
      {/* Title strips, modelled. Only ever seen at the establishing shot — the
          DOM panel covers this rectangle the moment the camera arrives — but
          without them the unfocused cabinet is a blank lit panel, and the two
          views should agree about what is behind the glass. */}
      <Block
        size={[0.98, 0.012, 0.004]}
        position={[X, 1.79, JUKEBOX_DISPLAY.center[2] + 0.002]}
        material={materials.stripRule}
      />
      {[1.62, 1.48, 1.34].map((y) => (
        <Block
          key={y}
          size={[0.98, 0.075, 0.004]}
          position={[X, y, JUKEBOX_DISPLAY.center[2] + 0.002]}
          material={materials.strip}
        />
      ))}

      {/* Chrome band under the window, separating it from the keys */}
      <Block size={[W - 0.16, 0.05, 0.03]} position={[X, 1.0, TRIM_Z]} material={materials.trim} />

      {/* Pilasters — the pair of lit vertical mouldings every arched cabinet
          has, and the only thing keeping the flanks from reading as bare plank
          once the camera is close. Threaded between the window's surround
          (which reaches x ±0.63) and the cabinet's edge (±0.75), with chrome
          collars at each end so they read as fitted rather than glued on. */}
      {[-1, 1].map((side) => (
        <group key={side} position={[X + side * 0.7, 0, JUKEBOX_FACE - 0.02]}>
          <mesh position={[0, 1.05, 0]} material={materials.tube} raycast={noRaycast}>
            <cylinderGeometry args={[0.04, 0.04, 1.72, 8]} />
          </mesh>
          {[0.19, 1.91].map((y) => (
            <mesh key={y} position={[0, y, 0]} material={materials.trim} raycast={noRaycast}>
              <cylinderGeometry args={[0.055, 0.055, 0.05, 8]} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Coin plate on the right, maker's badge on the left. */}
      <Block size={[0.14, 0.3, 0.02]} position={[X + FLANK_X, KEY_Y, SURROUND_Z]} material={materials.trim} />
      <Block
        size={[0.018, 0.075, 0.03]}
        position={[X + FLANK_X, KEY_Y + 0.09, TRIM_Z]}
        material={materials.coinSlot}
      />
      <mesh
        position={[X + FLANK_X, KEY_Y - 0.08, TRIM_Z]}
        rotation={[Math.PI / 2, 0, 0]}
        material={materials.coinSlot}
        raycast={noRaycast}
      >
        <cylinderGeometry args={[0.035, 0.035, 0.03, 10]} />
      </mesh>
      <Block size={[0.14, 0.3, 0.02]} position={[X - FLANK_X, KEY_Y, SURROUND_Z]} material={materials.trim} />
      {/* Price plate. A dark inset with one lit sliver under it — a fully lit
          plate at this size is just an orange rectangle on the cabinet, which
          is what the first pass looked like. */}
      <Block
        size={[0.09, 0.22, 0.03]}
        position={[X - FLANK_X, KEY_Y + 0.02, TRIM_Z]}
        material={materials.coinSlot}
      />
      <Block
        size={[0.09, 0.035, 0.035]}
        position={[X - FLANK_X, KEY_Y - 0.11, TRIM_Z]}
        material={materials.badge}
      />

      {/* Key bank. Rendered as plain meshes here; the pick proxies that make
          them clickable are mounted separately below, only at the cabinet. */}
      <Block
        size={[PLATE_HALF * 2, JUKEBOX_KEYS.height, 0.02]}
        position={[X, KEY_Y, SURROUND_Z]}
        material={materials.keyPlate}
      />
      {KEYS.map((entry, index) => (
        <group
          key={entry.id}
          ref={(node) => {
            keyGroups.current[index] = node
          }}
          position={[X + entry.x, KEY_Y, KEY_Z]}
        >
          <mesh material={materials[entry.id]} raycast={noRaycast}>
            <boxGeometry args={[0.24, 0.12, 0.035]} />
          </mesh>
          {/* 0.21 wide is not arbitrary: it is what puts the 16×8 glyph
              texture at one texel per pixelation block. See the note on
              transportGlyphTexture. */}
          <mesh
            position={[0, 0, 0.019]}
            raycast={noRaycast}
            material={
              entry.id === 'previous'
                ? materials.prevGlyph
                : entry.id === 'next'
                  ? materials.nextGlyph
                  : active
                    ? materials.pauseGlyph
                    : materials.playGlyph
            }
          >
            <planeGeometry args={[0.21, 0.105]} />
          </mesh>
        </group>
      ))}

      {keysLive &&
        KEYS.map((entry, index) => (
          <group
            key={entry.id}
            onPointerOver={(event) => {
              event.stopPropagation()
              setHoveredKey(index)
              playSfx('tick')
            }}
            onPointerOut={(event) => {
              event.stopPropagation()
              setHoveredKey(null)
            }}
            onClick={(event) => pressKey(event, entry.id)}
          >
            <PickProxy size={[0.28, 0.16, 0.06]} position={[X + entry.x, KEY_Y, KEY_Z + 0.02]} />
          </group>
        ))}

      {/* Speaker grille. Only its top slat survives the jukebox's own stop —
          the rest is there for the establishing shot. */}
      <Block size={[1.22, 0.44, 0.02]} position={[X, 0.5, SURROUND_Z]} material={materials.grille} />
      {[0.32, 0.41, 0.5, 0.59, 0.68].map((y) => (
        <Block key={y} size={[1.14, 0.035, 0.03]} position={[X, y, TRIM_Z]} material={materials.slat} />
      ))}
      {[-0.3, 0.3].map((x) => (
        <Block
          key={x}
          size={[0.035, 0.46, 0.04]}
          position={[X + x, 0.5, TRIM_Z + 0.008]}
          material={materials.trim}
        />
      ))}

      <pointLight
        position={[X, JUKEBOX_DISPLAY.center[1] - 0.1, JUKEBOX_FACE + FASCIA_GLOW_OFFSET]}
        intensity={FASCIA_GLOW_INTENSITY}
        decay={2}
        color="#f0c896"
      />

      <ContactShadow position={[X, 0.008, Z]} scale={[2.4, 1.9]} />
    </Hotspot>
  )
}
