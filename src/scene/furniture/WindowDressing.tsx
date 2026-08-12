import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { noRaycast } from '@/hotspots/Hotspot'
import { useRoomStore } from '@/state/useRoomStore'
import { PALETTE, makeGlowMaterial, makeMaterial } from '../palette'
import { curtainTexture, lightShaftTexture, lightningFlashTexture } from '../textures'
import { prefersReducedMotion } from '../motion'
import { Block } from '../primitives'
import {
  CURTAIN,
  CURTAIN_PANELS,
  LIGHT_SHAFT,
  PANE,
  PANE_Z,
  WINDOW_X,
  WINDOW_Y,
} from './windowLayout'

/**
 * The storm, and the curtains it is behind.
 *
 * Everything here is driven by writing to material and object properties from
 * a single `useFrame`, and nothing is ever mounted or unmounted while it runs.
 * That is not incidental tidiness — it is the whole performance story. Adding
 * or removing a light changes three's shader defines and forces every material
 * in the room to recompile, which on a flash-every-fifteen-seconds schedule
 * would mean a visible hitch every fifteen seconds. The flash light is mounted
 * once, at zero intensity, and only its `intensity` ever changes: a uniform
 * write, free. The same goes for the flash and shaft quads, which live in the
 * scene permanently and are only toggled `visible`.
 */

/**
 * Peak intensity of the flash, in a directional light's units — not a point
 * light's, which is why this reads as 3 rather than the 130 a positioned lamp
 * would need.
 *
 * Directional is the entire point. A point light has a position and an
 * inverse-square falloff, so it always paints a bright core fading in rings
 * around wherever it sits: a lamp someone switched on at the window, which is
 * exactly what lightning is not. A directional light has no position at all —
 * every surface is lit purely by how it faces — so the room brightens without
 * anywhere in it becoming the source. That is what a strike several streets
 * away actually does.
 */
const FLASH_LIGHT_PEAK = 11
/**
 * What is left of that with the curtains drawn. Not zero: no shadow map exists
 * anywhere in this room (plan §9), so the curtains cannot actually occlude the
 * light — the occlusion has to be asserted here instead. The little that
 * remains reads as spill around the edges, and the crack does the real work
 * via the shaft on the floor.
 */
const FLASH_LIGHT_LEAK = 0.14

/**
 * The flash is sampled on twos, and snapped to five brightness levels.
 *
 * A smoothly decaying flash is renderer language — it reads as a dimmer being
 * turned down, however fast you turn it. Hand-animated lightning in a 2D game
 * cuts between a handful of flat palettes at a low frame rate, and that stutter
 * is most of what makes it read as lightning rather than as illumination. It
 * also matches everything else here: the dialogue types in `steps(4)`, the
 * panels animate in `steps(5)`, and the pixelation pass posterises the whole
 * frame to 26 colour levels. A continuous flash was the one thing in the room
 * moving smoothly.
 *
 * Note this quantises the *sampling*, not the timeline — the bolts underneath
 * still advance every frame, so the stutter never drifts against the schedule.
 */
const FLASH_FPS = 12
const FLASH_LEVELS = 5

/**
 * Append `?storm` to the URL to put the lightning on a two-second cycle.
 *
 * Same idea as `?debugPicks` in `primitives`: a strike lasts under half a
 * second and lands once every quarter minute, so without this, checking a
 * change to the flash means sitting and watching a window until it happens.
 */
const STORM_DEBUG =
  typeof location !== 'undefined' && new URLSearchParams(location.search).has('storm')

const BURST_GAP = STORM_DEBUG ? { min: 1.1, max: 2.1 } : { min: 11, max: 26 }
const FIRST_BURST = STORM_DEBUG ? 1 : 6

interface Bolt {
  start: number
  peak: number
  length: number
}

/**
 * One strike is two to four stabs in quick succession, the first the
 * brightest. A single clean fade reads as someone operating a dimmer; real
 * lightning stutters, and the stutter is most of what sells it.
 */
function scheduleBurst(): { bolts: Bolt[]; end: number } {
  const bolts: Bolt[] = []
  const count = 2 + Math.floor(Math.random() * 3)
  let at = 0
  let end = 0
  for (let i = 0; i < count; i++) {
    const bolt = {
      start: at,
      peak: i === 0 ? 1 : 0.3 + Math.random() * 0.55,
      length: 0.07 + Math.random() * 0.15,
    }
    bolts.push(bolt)
    end = Math.max(end, bolt.start + bolt.length)
    at += 0.05 + Math.random() * 0.17
  }
  return { bolts, end }
}

/** Envelope of a single stab: instant attack, squared decay. */
function boltLevel(bolt: Bolt, elapsed: number): number {
  const t = (elapsed - bolt.start) / bolt.length
  if (t < 0 || t >= 1) return 0
  const decay = 1 - t
  return bolt.peak * decay * decay
}

function nextGap(): number {
  return BURST_GAP.min + Math.random() * (BURST_GAP.max - BURST_GAP.min)
}

export function WindowDressing() {
  const curtainsOpen = useRoomStore((s) => s.curtainsOpen)

  const materials = useMemo(
    () => ({
      rod: makeMaterial(PALETTE.metalDark),
      curtain: makeMaterial('#5e3a4a', { map: curtainTexture() }),
      flash: makeGlowMaterial('#ffffff', {
        map: lightningFlashTexture(),
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      shaft: makeGlowMaterial('#ffffff', {
        map: lightShaftTexture(),
        transparent: true,
        opacity: 0,
        // Additive, because this is light arriving on the floor. Normal
        // blending would let a bright shaft darken the boards it falls on.
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    }),
    [],
  )

  const panels = useRef<Array<THREE.Mesh | null>>([])
  const flashMesh = useRef<THREE.Mesh>(null)
  const shaftMesh = useRef<THREE.Mesh>(null)
  const light = useRef<THREE.DirectionalLight>(null)

  const open = useRef(0)
  const storm = useRef({
    untilNext: FIRST_BURST,
    elapsed: 0,
    end: 0,
    bolts: [] as Bolt[],
    /** Time owed to the next low-rate sample. */
    sinceTick: 0,
    /** Held between samples — this is what everything actually reads. */
    level: 0,
  })

  // Read once. A flash is a hard brightness spike, which is exactly what a
  // visitor asking for reduced motion is asking not to be given, so under that
  // preference the storm stays quiet and the curtains snap open without the
  // slide.
  const calm = useMemo(prefersReducedMotion, [])

  useFrame((_, delta) => {
    // Curtains ---------------------------------------------------------------
    const goal = curtainsOpen ? 1 : 0
    if (Math.abs(open.current - goal) > 0.0005) {
      open.current = calm ? goal : THREE.MathUtils.damp(open.current, goal, 2.6, delta)
      for (let i = 0; i < CURTAIN_PANELS.length; i++) {
        const mesh = panels.current[i]
        if (!mesh) continue
        const panel = CURTAIN_PANELS[i]
        mesh.position.x = THREE.MathUtils.lerp(panel.closedX, panel.openX, open.current)
        mesh.scale.x = THREE.MathUtils.lerp(1, CURTAIN.bunched, open.current)
      }
    }

    // Lightning --------------------------------------------------------------
    // The schedule runs at full rate; only the brightness read off it is held
    // to FLASH_FPS, so the stutter never drifts against the bolts underneath.
    const state = storm.current

    if (calm) {
      state.level = 0
    } else if (state.bolts.length === 0) {
      state.untilNext -= delta
      if (state.untilNext <= 0) {
        const burst = scheduleBurst()
        state.bolts = burst.bolts
        state.end = burst.end
        state.elapsed = 0
        state.untilNext = nextGap()
      }
    } else {
      state.elapsed += delta
      state.sinceTick += delta

      if (state.sinceTick >= 1 / FLASH_FPS) {
        state.sinceTick %= 1 / FLASH_FPS
        let raw = 0
        for (const bolt of state.bolts) raw = Math.max(raw, boltLevel(bolt, state.elapsed))
        // Snap to flat plateaus. Rounding rather than flooring keeps the first
        // sample of a strike at full brightness — a strike that opened one step
        // down would lose its snap.
        state.level = Math.round(raw * (FLASH_LEVELS - 1)) / (FLASH_LEVELS - 1)
      }

      if (state.elapsed > state.end) {
        state.bolts = []
        state.level = 0
        state.sinceTick = 0
      }
    }

    // Drive ------------------------------------------------------------------
    const level = state.level
    const lit = level > 0.002
    const shaftLevel = level * (1 - open.current)

    materials.flash.opacity = level * 0.9
    materials.shaft.opacity = shaftLevel * 0.85
    if (flashMesh.current) flashMesh.current.visible = lit
    if (shaftMesh.current) shaftMesh.current.visible = shaftLevel > 0.002
    if (light.current) {
      light.current.intensity =
        level * FLASH_LIGHT_PEAK * (FLASH_LIGHT_LEAK + (1 - FLASH_LIGHT_LEAK) * open.current)
    }
  })

  return (
    <group name="window-dressing">
      {/* Sheet lightning on the sky. Sits under the rain so the drops fall in
          front of it rather than being washed out by it. */}
      <mesh
        ref={flashMesh}
        position={[WINDOW_X, WINDOW_Y, PANE_Z.flash]}
        material={materials.flash}
        raycast={noRaycast}
        visible={false}
      >
        <planeGeometry args={PANE} />
      </mesh>

      {/* Rod and brackets */}
      <Block
        size={[2 * (CURTAIN.outer - WINDOW_X) + 0.24, 0.05, 0.05]}
        position={[WINDOW_X, CURTAIN.rodY, CURTAIN.z]}
        material={materials.rod}
      />
      {CURTAIN_PANELS.map((panel) => (
        <Block
          key={`finial-${panel.side}`}
          size={[0.08, 0.1, 0.1]}
          position={[
            WINDOW_X + panel.side * (CURTAIN.outer - WINDOW_X + 0.14),
            CURTAIN.rodY,
            CURTAIN.z,
          ]}
          material={materials.rod}
        />
      ))}

      {/* The panels. Scaled on X to gather rather than resized, so the pleats
          in the fabric texture compress with them. */}
      {CURTAIN_PANELS.map((panel, index) => (
        <mesh
          key={`curtain-${panel.side}`}
          ref={(node) => {
            panels.current[index] = node
          }}
          position={[panel.closedX, panel.centerY, CURTAIN.z]}
          material={materials.curtain}
          raycast={noRaycast}
        >
          <boxGeometry args={[panel.width, panel.height, CURTAIN.thickness]} />
        </mesh>
      ))}

      {/* Light through the crack, landing on the boards. Hidden the moment the
          curtains are open — with nothing left to cast it, a stripe on the
          floor would just be a glowing rectangle. */}
      <mesh
        ref={shaftMesh}
        position={[WINDOW_X, LIGHT_SHAFT.y, LIGHT_SHAFT.nearZ + LIGHT_SHAFT.length / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={materials.shaft}
        raycast={noRaycast}
        renderOrder={2}
        visible={false}
      >
        <planeGeometry args={[LIGHT_SHAFT.width, LIGHT_SHAFT.length]} />
      </mesh>

      {/* Mounted permanently at zero intensity — see the note at the top of
          this file on why it is never unmounted.

          Positioned well outside the room, and only to set a *direction*: a
          directional light ignores distance entirely, so this is an angle, not
          a place. Aimed down and across so it rakes the floor and the left
          wall — the surfaces the camera can actually see — rather than the
          back wall, which is the one the window is set into and so is the one
          wall a strike outside it would leave dark. */}
      <directionalLight ref={light} position={[4.5, 7, -9]} intensity={0} color="#cfe0ff" />
    </group>
  )
}
