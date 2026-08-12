import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { Hotspot, markSelfLit, noRaycast } from '@/hotspots/Hotspot'
import { useRoomStore } from '@/state/useRoomStore'
import { useWhiteboardStore } from '@/state/useWhiteboardStore'
import { playSfx } from '@/audio/sfx'
import { PALETTE, makeGlowMaterial, makeMaterial } from '../palette'
import {
  corkTexture,
  nightSkyTexture,
  rainGlassTexture,
  rainTexture,
  whiteboardBaseTexture,
} from '../textures'
import { prefersReducedMotion } from '../motion'
import { Block, ContactShadow, Panel, PickProxy } from '../primitives'
import { WindowDressing } from './WindowDressing'
import { BACK_Z, PANE, PANE_Z, WINDOW_X, WINDOW_Y } from './windowLayout'
import {
  BOARD_TOOLS,
  TOOL_LIFT,
  TOOL_REST_X,
  TOOL_REST_Y,
  WHITEBOARD_FRAME,
  WHITEBOARD_SURFACE,
  WHITEBOARD_TRAY,
  WHITEBOARD_WALL_X,
  type BoardTool,
  type ToolId,
} from '../whiteboard'

const WALL_X = -5

/**
 * Whiteboard on the left wall (plan §7).
 *
 * The face here shows whatever is currently written on the board. While the
 * camera is parked at it that ink is a DOM canvas pasted onto this exact plane
 * by <SurfaceProjector> (see <WhiteboardPanel>); the rest of the time it is
 * baked back into this texture. So the board you draw on is the board that is
 * modelled — there is no modal, and no second representation of it to keep in
 * sync.
 *
 * Everything the board needs by way of controls is on the tray below it. See
 * <MarkerTray>.
 */
export function Whiteboard() {
  const materials = useMemo(
    () => ({
      frame: makeMaterial(PALETTE.metal),
      surface: makeMaterial('#dfe4e2', { map: whiteboardBaseTexture() }),
      tray: makeMaterial(PALETTE.metalDark),
    }),
    [],
  )

  return (
    <Hotspot id="whiteboard">
      <PickProxy size={[0.3, 1.9, 3.0]} position={[WHITEBOARD_WALL_X + 0.2, 2.6, -0.4]} />

      <Block
        size={WHITEBOARD_FRAME.size}
        position={WHITEBOARD_FRAME.center}
        material={materials.frame}
      />
      <mesh
        position={WHITEBOARD_SURFACE.center}
        rotation={[0, Math.PI / 2, 0]}
        material={materials.surface}
      >
        <planeGeometry args={[WHITEBOARD_SURFACE.width, WHITEBOARD_SURFACE.height]} />
      </mesh>

      <Block
        size={[WHITEBOARD_TRAY.depth, WHITEBOARD_TRAY.height, WHITEBOARD_TRAY.length]}
        position={[WHITEBOARD_TRAY.x, WHITEBOARD_TRAY.y, WHITEBOARD_SURFACE.center[2]]}
        material={materials.tray}
      />

      <MarkerTray />
    </Hotspot>
  )
}

/** How fast a tool travels between the tray and the visitor's hand. */
const TOOL_SPEED = 12

/**
 * Emissive floor for a tool at rest, and what hovering or holding one adds.
 *
 * The tray sits below the board in a room with no light of its own down there.
 * A little self-lighting is the difference between five markers and five dark
 * smudges — and the visitor has to see that there is something to pick up
 * before there is any hover state to give them feedback.
 */
const TOOL_REST_GLOW = 0.22
const TOOL_LIVE_GLOW = 0.5

/**
 * The four markers and the felt eraser lying in the tray — the whiteboard's
 * entire control surface.
 *
 * Modelled objects rather than buttons in a panel, for the reason the jukebox's
 * transport keys are: the interface for this hotspot is pasted over the board's
 * own face, so anything drawn inside that rectangle would sit under the overlay
 * and never receive a click. What is left is the part a tray is good at anyway —
 * choosing a colour by picking one up. Clicking the tool already in hand puts it
 * back.
 *
 * Live only once the camera is at the board. At the establishing shot a marker
 * is two pixels long, and a stray click there should focus the whiteboard, which
 * is what the hotspot's own proxy does when these are absent.
 */
function MarkerTray() {
  const live = useRoomStore((s) => s.focused === 'whiteboard')
  const held = useWhiteboardStore((s) => s.held)
  const hovered = useWhiteboardStore((s) => s.hovered)
  const take = useWhiteboardStore((s) => s.take)
  const putDown = useWhiteboardStore((s) => s.putDown)
  const setHovered = useWhiteboardStore((s) => s.setHovered)

  const tools = useMemo(() => BOARD_TOOLS.map(buildTool), [])
  const groups = useRef<Array<THREE.Group | null>>([])
  /** Per-tool travel out of the tray, and per-tool glow, both damped. */
  const raise = useRef(tools.map(() => 0))
  const glow = useRef(tools.map(() => 0))

  useFrame((_, delta) => {
    tools.forEach((tool, index) => {
      const isHeld = held === tool.id
      const raiseGoal = isHeld ? 1 : hovered === tool.id ? 0.14 : 0
      const glowGoal = isHeld || hovered === tool.id ? 1 : 0

      if (Math.abs(raise.current[index] - raiseGoal) > 0.001) {
        const value = THREE.MathUtils.damp(raise.current[index], raiseGoal, TOOL_SPEED, delta)
        raise.current[index] = value
        const group = groups.current[index]
        if (group) {
          group.position.x = TOOL_REST_X + value * TOOL_LIFT[0]
          group.position.y = TOOL_REST_Y + value * TOOL_LIFT[1]
        }
      }

      if (Math.abs(glow.current[index] - glowGoal) > 0.001) {
        const value = THREE.MathUtils.damp(glow.current[index], glowGoal, TOOL_SPEED, delta)
        glow.current[index] = value
        tool.main.emissive.copy(tool.glow).multiplyScalar(TOOL_REST_GLOW + value * TOOL_LIVE_GLOW)
      }
    })
  })

  // R3F fires no pointerout for a proxy that unmounts under the cursor, so
  // stepping back would otherwise leave a tool stuck lit — and a marker stuck
  // in a hand that has left the room.
  useEffect(() => {
    if (live) return
    setHovered(null)
    putDown()
  }, [live, setHovered, putDown])

  // The hotspot only manages the cursor while nothing is focused, so at the
  // board — which is exactly when these are live — nothing else will.
  useEffect(() => {
    if (hovered === null) return
    document.body.style.cursor = 'pointer'
    return () => {
      document.body.style.cursor = 'auto'
    }
  }, [hovered])

  const pick = useCallback(
    (event: ThreeEvent<MouseEvent>, id: ToolId) => {
      event.stopPropagation()
      // Putting one back is the same gesture as taking it, so the sound has to
      // carry which of the two just happened.
      playSfx(useWhiteboardStore.getState().held === id ? 'back' : 'pickup')
      take(id)
    },
    [take],
  )

  return (
    <group name="whiteboard-tray">
      {tools.map((tool, index) => (
        <group
          key={tool.id}
          ref={(node) => {
            groups.current[index] = node
          }}
          position={[TOOL_REST_X, TOOL_REST_Y, WHITEBOARD_SURFACE.center[2] + tool.offset]}
          onPointerOver={
            live
              ? (event) => {
                  event.stopPropagation()
                  setHovered(tool.id)
                  playSfx('tick')
                }
              : undefined
          }
          onPointerOut={
            live
              ? (event) => {
                  event.stopPropagation()
                  setHovered(null)
                }
              : undefined
          }
          onClick={live ? (event) => pick(event, tool.id) : undefined}
        >
          {tool.ink ? (
            <>
              <mesh material={tool.main} raycast={noRaycast}>
                <boxGeometry args={[0.05, 0.05, 0.1] } />
              </mesh>
              {/* Pale cap, so a marker lying in a dim tray still reads as a
                  marker rather than as a coloured smudge. */}
              <mesh position={[0, 0, -0.064]} material={tool.accent} raycast={noRaycast}>
                <boxGeometry args={[0.042, 0.042, 0.028]} />
              </mesh>
            </>
          ) : (
            <>
              {/* Felt block with a dark grip on top, in that order: the stop
                  looks slightly down on the tray, so whatever is on top is what
                  identifies the object. A block that was plastic up there and
                  felt underneath would be a black void in a dark room. */}
              <mesh material={tool.main} raycast={noRaycast}>
                <boxGeometry args={[0.09, 0.045, 0.16]} />
              </mesh>
              <mesh position={[0, 0.032, 0]} material={tool.accent} raycast={noRaycast}>
                <boxGeometry args={[0.07, 0.022, 0.13]} />
              </mesh>
            </>
          )}

          {/* Deep in X and biased toward the room: the hotspot's own proxy
              reaches out to x −4.65, and a target buried behind it would be
              shadowed by the very volume that got the visitor here. */}
          {live && (
            <PickProxy size={[0.28, 0.14, tool.ink ? 0.14 : 0.18]} position={[0.14, 0, 0]} />
          )}
        </group>
      ))}
    </group>
  )
}

interface TrayTool extends BoardTool {
  /** The mass that identifies the tool: a marker's barrel, an eraser's felt. */
  main: THREE.MeshLambertMaterial
  /** The marker's cap, or the eraser's grip. */
  accent: THREE.MeshLambertMaterial
  glow: THREE.Color
}

/**
 * Materials are per-tool and `markSelfLit`, so the hotspot's whole-object hover
 * highlight leaves them alone — two `useFrame` callbacks writing the same
 * `emissive` would fight for it frame by frame.
 */
function buildTool(tool: BoardTool): TrayTool {
  // The barrel is not the pigment. Ink is chosen to read on a white board and
  // the tray is one of the darkest corners of the room, so a barrel painted the
  // exact ink colour would leave the black marker as a black bar on a black
  // tray. Lifting each toward the paper tone keeps the tray legible while the
  // strokes stay the colours the board's own doodles were drawn in.
  const barrel = new THREE.Color(tool.ink ?? PALETTE.paper)
  if (tool.ink) barrel.lerp(new THREE.Color(PALETTE.paper), 0.22)

  const main = markSelfLit(makeMaterial(`#${barrel.getHexString()}`))
  main.emissive.copy(barrel).multiplyScalar(TOOL_REST_GLOW)

  return {
    ...tool,
    main,
    accent: markSelfLit(makeMaterial(tool.ink ? PALETTE.paper : PALETTE.plastic)),
    glow: barrel,
  }
}

/** Corkboard on the left wall — about-me notes (plan §5). */
export function Corkboard() {
  const materials = useMemo(
    () => ({
      frame: makeMaterial(PALETTE.wood),
      cork: makeMaterial(PALETTE.cork, { map: corkTexture() }),
      note: makeMaterial(PALETTE.paper),
      noteAlt: makeMaterial('#f4d98c'),
      pin: makeMaterial(PALETTE.magenta),
    }),
    [],
  )

  const z = 2.8
  const y = 2.45

  // Hand-placed so the arrangement looks pinned rather than gridded.
  const notes: Array<{ dz: number; dy: number; w: number; h: number; alt: boolean }> = [
    { dz: -0.62, dy: 0.34, w: 0.44, h: 0.34, alt: false },
    { dz: -0.05, dy: 0.28, w: 0.38, h: 0.46, alt: true },
    { dz: 0.55, dy: 0.36, w: 0.42, h: 0.3, alt: false },
    { dz: -0.48, dy: -0.28, w: 0.36, h: 0.38, alt: true },
    { dz: 0.12, dy: -0.32, w: 0.5, h: 0.3, alt: false },
    { dz: 0.66, dy: -0.24, w: 0.34, h: 0.34, alt: true },
  ]

  return (
    <Hotspot id="corkboard">
      <PickProxy size={[0.3, 1.6, 2.2]} position={[WALL_X + 0.18, y, z]} />

      <Block size={[0.07, 1.42, 2.06]} position={[WALL_X + 0.1, y, z]} material={materials.frame} />
      <mesh
        position={[WALL_X + 0.14, y, z]}
        rotation={[0, Math.PI / 2, 0]}
        material={materials.cork}
      >
        <planeGeometry args={[1.92, 1.28]} />
      </mesh>

      {notes.map((note, index) => (
        <group key={index}>
          <mesh
            position={[WALL_X + 0.152, y + note.dy, z + note.dz]}
            rotation={[0, Math.PI / 2, (index % 2 === 0 ? 1 : -1) * 0.04]}
            material={index % 2 === 0 ? materials.note : materials.noteAlt}
          >
            <planeGeometry args={[note.w, note.h]} />
          </mesh>
          <Block
            size={[0.03, 0.04, 0.04]}
            position={[WALL_X + 0.17, y + note.dy + note.h / 2 - 0.04, z + note.dz]}
            material={materials.pin}
          />
        </group>
      ))}
    </Hotspot>
  )
}

/** Window on the back wall — the contact/socials hotspot (plan §5). */
export function WindowFixture() {
  const materials = useMemo(
    () => ({
      frame: makeMaterial(PALETTE.woodDark),
      sky: makeGlowMaterial('#ffffff', { map: nightSkyTexture() }),
      sill: makeMaterial(PALETTE.wood),
      // Light wash. This used to carry the night tint at 0.28, back when the
      // sky behind it was a clear star field that needed cooling down. The
      // overcast sky bakes its own colour now, and at the old strength this
      // just greyed out the one bright thing in a dark room.
      glow: makeGlowMaterial(PALETTE.night, { transparent: true, opacity: 0.12 }),
    }),
    [],
  )

  const x = WINDOW_X
  const y = WINDOW_Y

  return (
    <Hotspot id="window">
      {/* Deep enough to reach past the curtains, which hang 0.38 off the wall.
          A proxy that stopped at the glass would be unreachable while they are
          drawn — and the curtains only open because the window was hovered. */}
      <PickProxy size={[2.7, 2.4, 0.62]} position={[x, y, BACK_Z + 0.26]} />

      {/* Sky sits slightly behind the wall plane so the frame occludes it. */}
      <Panel size={PANE} position={[x, y, PANE_Z.sky]} material={materials.sky} />
      <Panel size={PANE} position={[x, y, PANE_Z.haze]} material={materials.glow} />

      <Rain x={x} y={y} />
      <WindowDressing />

      {/* Frame and mullions */}
      <Block size={[2.36, 0.14, 0.12]} position={[x, y + 0.92, BACK_Z + 0.06]} material={materials.frame} />
      <Block size={[2.36, 0.14, 0.12]} position={[x, y - 0.92, BACK_Z + 0.06]} material={materials.frame} />
      <Block size={[0.14, 1.98, 0.12]} position={[x - 1.11, y, BACK_Z + 0.06]} material={materials.frame} />
      <Block size={[0.14, 1.98, 0.12]} position={[x + 1.11, y, BACK_Z + 0.06]} material={materials.frame} />
      <Block size={[0.08, 1.7, 0.08]} position={[x, y, BACK_Z + 0.05]} material={materials.frame} />
      <Block size={[2.1, 0.08, 0.08]} position={[x, y, BACK_Z + 0.05]} material={materials.frame} />

      {/* Sill */}
      <Block size={[2.6, 0.1, 0.32]} position={[x, y - 1.02, BACK_Z + 0.18]} material={materials.sill} />
    </Hotspot>
  )
}

/**
 * Rain layers, from the far air to the glass you are standing behind.
 *
 * `repeat` sets how fat a drop is. Every value here keeps one texel at or
 * above the four-CSS-pixel block the pixelation pass quantises to — finer than
 * that and the streaks alias into shimmering noise instead of falling. The
 * three layers step upward in texel size, so the drops genuinely coarsen as
 * they approach the glass, and the coarsest of them sits just under the sky
 * texture's own texel size rather than looking sharper than the city behind
 * it.
 *
 * Drop counts are the other half of it, and the easy thing to get wrong: each
 * layer covers only a few percent of its tile. Rain that covers a third of the
 * pane stops reading as weather and starts reading as television static.
 *
 * `speed` is in tiles per second. The near curtain crosses the pane in under
 * half a second; the beads on the glass take a quarter of a minute.
 */
const RAIN_LAYERS = [
  {
    key: 'far',
    z: PANE_Z.rainFar,
    repeat: [7, 2.5] as const,
    speed: 2.4,
    texture: () => rainTexture('far', 17, 3, 6, 0.24, 53),
  },
  {
    key: 'near',
    z: PANE_Z.rainNear,
    repeat: [5, 1.8] as const,
    speed: 4.0,
    texture: () => rainTexture('near', 9, 5, 10, 0.42, 59),
  },
  {
    key: 'glass',
    z: PANE_Z.glass,
    repeat: [3.5, 1.5] as const,
    speed: 0.11,
    texture: rainGlassTexture,
  },
]

function Rain({ x, y }: { x: number; y: number }) {
  const layers = useMemo(
    () =>
      RAIN_LAYERS.map((layer) => {
        const map = layer.texture()
        map.wrapS = map.wrapT = THREE.RepeatWrapping
        map.repeat.set(layer.repeat[0], layer.repeat[1])
        return {
          ...layer,
          material: makeGlowMaterial('#ffffff', {
            map,
            transparent: true,
            // Layers have to blend through each other, and they are the last
            // thing in the window: writing depth here would have the nearest
            // curtain punch a hole in the two behind it.
            depthWrite: false,
          }),
        }
      }),
    [],
  )

  // Read once. This drives whether the rain moves at all, and re-querying it
  // every frame would be a media-query lookup 60 times a second for an answer
  // that effectively never changes.
  const still = useMemo(prefersReducedMotion, [])

  useFrame((_, delta) => {
    if (still) return
    for (const layer of layers) {
      const map = layer.material.map
      if (!map) continue
      // Wrapped to a single tile. The offset is unbounded as far as
      // RepeatWrapping cares, but left to climb it loses float precision over
      // a long session and the rain starts to judder.
      map.offset.y = (map.offset.y + layer.speed * delta) % 1
    }
  })

  return (
    <group name="window-rain">
      {layers.map((layer) => (
        <Panel key={layer.key} size={PANE} position={[x, y, layer.z]} material={layer.material} />
      ))}
    </group>
  )
}

/**
 * Lava lamp on a side table — the pure-personality easter-egg object (plan §5).
 * No panel; focusing it just holds on the blobs and plays a narrator line.
 */
export function LavaLamp() {
  const materials = useMemo(
    () => ({
      table: makeMaterial(PALETTE.woodDark),
      base: makeMaterial(PALETTE.metal),
      glass: makeGlowMaterial(PALETTE.magenta, { transparent: true, opacity: 0.45 }),
      blob: makeGlowMaterial(PALETTE.amber),
    }),
    [],
  )

  const x = 3.4
  const z = 1.6

  return (
    <Hotspot id="lavalamp">
      <PickProxy size={[0.9, 1.7, 0.9]} position={[x, 0.85, z]} />

      {/* Side table */}
      <Block size={[0.7, 0.06, 0.7]} position={[x, 0.62, z]} material={materials.table} />
      <Block size={[0.08, 0.62, 0.08]} position={[x - 0.28, 0.31, z - 0.28]} material={materials.table} />
      <Block size={[0.08, 0.62, 0.08]} position={[x + 0.28, 0.31, z - 0.28]} material={materials.table} />
      <Block size={[0.08, 0.62, 0.08]} position={[x - 0.28, 0.31, z + 0.28]} material={materials.table} />
      <Block size={[0.08, 0.62, 0.08]} position={[x + 0.28, 0.31, z + 0.28]} material={materials.table} />

      {/* Lamp: cone base, glass body, cap */}
      <mesh position={[x, 0.73, z]} material={materials.base}>
        <cylinderGeometry args={[0.1, 0.19, 0.16, 10]} />
      </mesh>
      <mesh position={[x, 1.05, z]} material={materials.glass}>
        <cylinderGeometry args={[0.09, 0.14, 0.5, 10]} />
      </mesh>
      <mesh position={[x, 1.33, z]} material={materials.base}>
        <cylinderGeometry args={[0.07, 0.1, 0.08, 10]} />
      </mesh>

      <LavaBlobs x={x} z={z} material={materials.blob} />
      <ContactShadow position={[x, 0.008, z]} scale={[1.5, 1.5]} opacity={0.8} />
    </Hotspot>
  )
}

const BLOBS = [
  { phase: 0, speed: 0.42, scale: 1.0 },
  { phase: 2.1, speed: 0.33, scale: 0.75 },
  { phase: 4.2, speed: 0.51, scale: 0.6 },
]

/**
 * Three blobs on offset sine cycles inside the lamp body. Cheaper and more
 * legible at this resolution than any real metaball simulation would be.
 *
 * All three share one geometry and one material and are animated from a single
 * `useFrame` — three separate subscriptions for three spheres is pure overhead.
 */
function LavaBlobs({ x, z, material }: { x: number; z: number; material: THREE.Material }) {
  const geometry = useMemo(() => new THREE.SphereGeometry(0.05, 6, 5), [])
  const refs = useRef<Array<THREE.Mesh | null>>([])

  useFrame(({ clock }) => {
    const elapsed = clock.elapsedTime
    for (let i = 0; i < BLOBS.length; i++) {
      const mesh = refs.current[i]
      if (!mesh) continue
      const { phase, speed, scale } = BLOBS[i]
      const cycle = (Math.sin(elapsed * speed + phase) + 1) / 2
      mesh.position.y = 0.85 + cycle * 0.36
      // Blobs stretch as they rise and squash at the ends of the travel.
      const stretch = 1 + Math.sin(elapsed * speed * 2 + phase) * 0.25
      mesh.scale.set(scale / stretch, scale * stretch, scale / stretch)
    }
  })

  return (
    <group>
      {BLOBS.map((_, index) => (
        <mesh
          key={index}
          ref={(node) => {
            refs.current[index] = node
          }}
          position={[x, 1.0, z]}
          geometry={geometry}
          material={material}
          raycast={noRaycast}
        />
      ))}
    </group>
  )
}
