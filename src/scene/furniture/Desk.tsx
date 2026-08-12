import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { Hotspot, markSelfLit, noRaycast } from '@/hotspots/Hotspot'
import { useRoomStore } from '@/state/useRoomStore'
import { playSfx } from '@/audio/sfx'
import { PALETTE, makeGlowMaterial, makeMaterial } from '../palette'
import { woodTexture } from '../textures'
import { MONITOR_SCREEN } from '../monitor'
import { prefersReducedMotion } from '../motion'
import { Block, ContactShadow, PickProxy } from '../primitives'

/** Lit-monitor colour. Deliberately not `PALETTE.screen`, which is the tube-off swatch. */
const SCREEN_ON = '#3f7fb8'

/**
 * The power LED, and the one colour in the room that is off-palette on purpose.
 *
 * Every other emissive here is drawn from the cyan/magenta/amber set so the
 * posterisation step has a coherent set of hues to snap to. This is the
 * yellow-green of a real CRT's power lamp, and no palette colour is close
 * enough to stand in — cyan reads as a modern standby light. It survives
 * quantisation because it is four pixels of fully saturated colour against
 * beige, which is exactly the case posterisation handles well.
 */
const POWER_LED_ON = '#8ee62a'
const POWER_LED_OFF = '#2f3a22'

/**
 * Switch face colours, resting to pressed.
 *
 * Colour rather than travel is what sells the press here. The PC camera looks
 * straight down the screen's normal — that is deliberate, it is what keeps the
 * glass an axis-aligned rectangle for the DOM overlay — which means a button
 * that moves along Z moves directly away from the eye and changes nothing on
 * screen. The couple of millimetres of travel below is for the establishing
 * shot, where the desk is seen at an angle; up close this is doing the work.
 */
const BUTTON_REST = new THREE.Color('#3f3f49')
const BUTTON_LIT = new THREE.Color('#7c7c8c')

/**
 * How long the tube takes to die, in seconds, before the camera pulls back.
 *
 * The whole point of routing "step back" through a physical switch is that you
 * get to watch the thing switch off, so the camera has to wait for it. Much
 * longer than this and it stops reading as a snap and starts reading as the
 * button not having worked.
 */
const POWER_DOWN = 0.5

/**
 * Where the power panel sits on the lower bezel.
 *
 * Y is pinned to the strip of beige between the bottom of the dark screen lip
 * (1.27) and the bottom edge of the monitor's face (1.19) — about eight
 * centimetres of real estate, which is all a CRT ever gave you. Z puts the
 * switch a couple of millimetres proud of the face at -4.13.
 */
const POWER_PANEL_X = -1.0
const POWER_PANEL_Y = 1.238
const BUTTON_Z = -4.115

/**
 * Light the tube throws back into the room, and how far in front of the glass
 * it sits.
 *
 * Sitting it right against the screen is the obvious choice and the wrong one:
 * with `decay: 2` the falloff across the bezel is then steep enough that the
 * posterisation step in the pixel pass renders it as concentric rings. Pulling
 * the source forward flattens the gradient across the monitor's face while the
 * inverse-square falloff still keeps the light local to the desk.
 */
const SCREEN_GLOW_INTENSITY = 3
const SCREEN_GLOW_OFFSET = 1.1

/**
 * The tube behind the glass — the reason a CRT needs half a metre of desk.
 *
 * Built as a four-sided frustum rather than a stack of boxes: `cylinderGeometry`
 * with `radialSegments: 4` is a square prism, and giving it different end radii
 * tapers it. One mesh, one draw call, and the silhouette is a clean slope
 * instead of a staircase.
 *
 * The radii are √2 because a 4-segment cylinder puts its vertices *at* the
 * radius, on the axes — so the square it describes has a half-width of r/√2
 * once it is twisted 45° to bring the faces flat. r = √2 therefore gives a unit
 * half-width, which lets the group above it scale straight to real dimensions.
 */
const TUBE = {
  depth: 0.62,
  frontWidth: 1.24,
  frontHeight: 0.84,
  /** Back face as a fraction of the front — how sharply the tube narrows. */
  taper: 0.62,
}

/** Desk, monitor, tower and keyboard — the PC hotspot (plan §5, §6). */
export function Desk() {
  const materials = useMemo(() => {
    const wood = woodTexture()
    wood.wrapS = wood.wrapT = THREE.RepeatWrapping
    wood.repeat.set(3, 1)
    return {
      top: makeMaterial(PALETTE.wood, { map: wood }),
      leg: makeMaterial(PALETTE.woodDark),
      plastic: makeMaterial(PALETTE.plastic),
      beige: makeMaterial(PALETTE.plasticBeige),
      metal: makeMaterial(PALETTE.metalDark),
      screen: makeGlowMaterial(SCREEN_ON),
      led: makeGlowMaterial(PALETTE.cyan),
      // Self-lit: the power lamp and switch drive their own colour below, and
      // the hotspot's whole-object hover highlight would fight them for it.
      powerLed: markSelfLit(makeGlowMaterial(POWER_LED_ON)),
      powerPlate: markSelfLit(makeMaterial('#15151a')),
      powerButton: markSelfLit(makeMaterial(BUTTON_REST.getStyle())),
    }
  }, [])

  const atDesk = useRoomStore((s) => s.focused === 'pc')
  const monitorOn = useRoomStore((s) => s.monitorOn)
  const setMonitorOn = useRoomStore((s) => s.setMonitorOn)
  const stepBack = useRoomStore((s) => s.stepBack)

  const screen = useRef<THREE.Mesh>(null)
  const glow = useRef<THREE.PointLight>(null)
  const button = useRef<THREE.Mesh>(null)
  const [buttonHovered, setButtonHovered] = useState(false)

  /** 0 while the tube is lit, ramping to 1 as it collapses. */
  const dying = useRef(0)
  const walkedAway = useRef(false)
  const press = useRef(0)
  const calm = useMemo(prefersReducedMotion, [])

  useFrame(({ clock }, delta) => {
    const mesh = screen.current
    if (!mesh) return
    const material = mesh.material as THREE.MeshBasicMaterial

    // The switch: pressed in while the pointer is on it, and held in once the
    // tube is going out.
    const pressGoal = buttonHovered || !monitorOn ? 1 : 0
    if (Math.abs(press.current - pressGoal) > 0.001) {
      press.current = THREE.MathUtils.damp(press.current, pressGoal, 18, delta)
      materials.powerButton.color.lerpColors(BUTTON_REST, BUTTON_LIT, press.current)
      if (button.current) button.current.position.z = BUTTON_Z - press.current * 0.012
    }

    if (!monitorOn) {
      dying.current = calm ? 1 : Math.min(1, dying.current + delta / POWER_DOWN)
      const t = dying.current

      // The way a CRT actually goes out: the picture collapses to a hot
      // horizontal line, that line shrinks to a point, and the point fades.
      // Three beats rather than one fade, because the collapse is the part
      // everyone remembers.
      const line = Math.min(1, t / 0.45)
      const dot = Math.max(0, Math.min(1, (t - 0.45) / 0.3))
      const out = Math.max(0, Math.min(1, (t - 0.75) / 0.25))

      mesh.scale.y = Math.max(0.018, 1 - line * 0.982)
      mesh.scale.x = Math.max(0.02, 1 - dot * 0.98)
      // Brighter as it collapses — the same energy into fewer pixels.
      material.color.set('#dff2ff').multiplyScalar((0.35 + line * 0.65) * (1 - out))
      if (glow.current) glow.current.intensity = SCREEN_GLOW_INTENSITY * 0.7 * (1 - t)

      materials.powerLed.color.set(POWER_LED_OFF)

      if (t >= 1 && !walkedAway.current) {
        walkedAway.current = true
        stepBack()
      }
      return
    }

    // Powered: reset anything the power-down left behind, then idle.
    if (dying.current !== 0) {
      dying.current = 0
      walkedAway.current = false
      mesh.scale.set(1, 1, 1)
    }
    materials.powerLed.color.set(POWER_LED_ON)

    // A very slow brightness wobble so the monitor reads as powered on. Kept
    // subtle: strong motion under a 1/4-res pixel pass produces crawling edges.
    const t = clock.elapsedTime
    const flicker = 0.92 + Math.sin(t * 2.1) * 0.05 + Math.sin(t * 7.3) * 0.03
    // Pushed well above the base swatch so the monitor reads as powered on
    // rather than as a dark panel.
    material.color.set(SCREEN_ON).multiplyScalar(flicker)
    // The spill flickers with the tube. Once the camera is at the desk the
    // glass itself is covered by the DOM desktop, so this light is the only
    // thing left telling the visitor the screen is on — it is what keeps the
    // bezel, keyboard and desk visible around the overlay instead of letting
    // the monitor dissolve into an unlit silhouette.
    if (glow.current) glow.current.intensity = SCREEN_GLOW_INTENSITY * flicker
  })

  /** The switch is only live at the desk, and only while there is a picture. */
  const switchLive = atDesk && monitorOn

  // R3F fires no pointerout for a proxy that unmounts under the cursor, so
  // pressing the switch — which unmounts it — would otherwise leave the button
  // stuck lit and the cursor stuck as a pointer over an empty room.
  useEffect(() => {
    if (!switchLive) setButtonHovered(false)
  }, [switchLive])

  // The hotspot only manages the cursor while nothing is focused, so at the
  // desk — which is exactly when this switch is live — nothing else will.
  useEffect(() => {
    if (!buttonHovered) return
    document.body.style.cursor = 'pointer'
    return () => {
      document.body.style.cursor = 'auto'
    }
  }, [buttonHovered])

  const pressPower = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation()
      if (!monitorOn) return
      playSfx('back')
      setMonitorOn(false)
    },
    [monitorOn, setMonitorOn],
  )

  return (
    <Hotspot id="pc">
      {/* Two boxes rather than one, and the split matters.

          A single box tall enough to reach the monitor also had to be deep
          enough for the desk, which put its front face 0.4 in front of the
          screen — so it was always the nearest hit anywhere near the monitor,
          and the power switch modelled on the bezel could never be the thing
          the pointer found first. Bounding the head separately lets the switch
          sit proud of its own hotspot, the way the bookshelf's rows do. */}
      <PickProxy size={[2.95, 1.15, 1.25]} position={[-1.4, 0.575, -4.33]} />
      <PickProxy size={[1.45, 1.15, 0.85]} position={[-1.4, 1.7, -4.52]} />

      {/* Desk. Deep enough to hold a tube monitor with a keyboard in front of
          it, which is most of why it is 1.22 rather than the 0.82 a flat panel
          would have needed. */}
      <Block size={[2.8, 0.08, 1.22]} position={[-1.4, 1.02, -4.33]} material={materials.top} />
      <Block size={[0.1, 1.02, 1.1]} position={[-2.72, 0.51, -4.33]} material={materials.leg} />
      <Block size={[0.1, 1.02, 1.1]} position={[-0.08, 0.51, -4.33]} material={materials.leg} />
      <Block size={[2.6, 0.06, 0.06]} position={[-1.4, 0.28, -4.86]} material={materials.leg} />

      {/* Monitor — a CRT, so the shape is mostly what is *behind* the glass.
          Front to back: swivel base, chunky face, tapered tube, back cap. The
          whole thing is 0.8 deep against a 0.94 face, which is roughly the
          proportion of the real machines and the entire point of the shape. */}
      <Block size={[1.06, 0.06, 0.72]} position={[-1.4, 1.09, -4.45]} material={materials.beige} />
      <Block size={[0.62, 0.07, 0.48]} position={[-1.4, 1.155, -4.45]} material={materials.beige} />

      {/* The face. Deliberately chunky: it is the frame the faux desktop sits
          inside once the camera arrives, and a thin one reads as a floating
          rectangle rather than as a monitor. */}
      <Block size={[1.36, 0.94, 0.12]} position={[-1.4, 1.66, -4.19]} material={materials.beige} />

      {/* The tube. See TUBE — the twist is inside the scale so the square
          cross-section is stretched into a rectangle rather than sheared into
          a rhombus. */}
      <group position={[-1.4, 1.66, -4.56]} rotation={[Math.PI / 2, 0, 0]}>
        <group scale={[TUBE.frontWidth / 2, 1, TUBE.frontHeight / 2]}>
          <mesh material={materials.beige} rotation={[0, Math.PI / 4, 0]} raycast={noRaycast}>
            <cylinderGeometry
              args={[Math.SQRT2, Math.SQRT2 * TUBE.taper, TUBE.depth, 4, 1]}
            />
          </mesh>
        </group>
      </group>
      <Block size={[0.74, 0.5, 0.05]} position={[-1.4, 1.66, -4.895]} material={materials.beige} />

      {/* A dark lip between beige and glass, so the tube reads as recessed into
          the box rather than painted onto its front. */}
      <Block size={[1.2, 0.78, 0.012]} position={[-1.4, 1.66, -4.129]} material={materials.plastic} />
      {/* Geometry comes from MONITOR_SCREEN because the DOM desktop is pasted
          onto this exact rectangle once the PC is focused (plan §6). */}
      <mesh ref={screen} position={MONITOR_SCREEN.center} material={materials.screen}>
        <planeGeometry args={[MONITOR_SCREEN.width, MONITOR_SCREEN.height]} />
      </mesh>

      {/* Power panel on the lower bezel: a recessed dark plate carrying the
          lamp and the switch, laid out the way the real machines were — lamp
          on the left, switch on the right, both proud of the plate.

          It sits below the glass on purpose. The DOM desktop covers the screen
          rectangle exactly once the camera arrives, so anything modelled
          *inside* that rectangle becomes unclickable; down here the canvas
          still gets the pointer. */}
      <Block
        size={[0.3, 0.058, 0.008]}
        position={[POWER_PANEL_X, POWER_PANEL_Y, -4.126]}
        material={materials.powerPlate}
      />
      <Block
        size={[0.026, 0.022, 0.012]}
        position={[POWER_PANEL_X - 0.085, POWER_PANEL_Y, -4.118]}
        material={materials.powerLed}
      />
      <mesh
        ref={button}
        position={[POWER_PANEL_X + 0.035, POWER_PANEL_Y, BUTTON_Z]}
        material={materials.powerButton}
        raycast={noRaycast}
      >
        <boxGeometry args={[0.075, 0.042, 0.024]} />
      </mesh>

      {/* Pickable only from the desk. At the establishing shot the switch is
          three pixels across, and a stray click there should focus the PC —
          which is what the hotspot's own proxy does when this is absent. */}
      {switchLive && (
        <group
          onPointerOver={(event) => {
            event.stopPropagation()
            setButtonHovered(true)
            playSfx('hover')
          }}
          onPointerOut={(event) => {
            event.stopPropagation()
            setButtonHovered(false)
          }}
          onClick={pressPower}
        >
          <PickProxy size={[0.14, 0.08, 0.06]} position={[POWER_PANEL_X + 0.035, POWER_PANEL_Y, -4.1]} />
        </group>
      )}

      <pointLight
        ref={glow}
        position={[
          MONITOR_SCREEN.center[0],
          MONITOR_SCREEN.center[1] - 0.1,
          MONITOR_SCREEN.center[2] + SCREEN_GLOW_OFFSET,
        ]}
        intensity={SCREEN_GLOW_INTENSITY}
        decay={2}
        color="#8fc4f0"
      />

      {/* Keyboard and mouse, in the same beige as the monitor — they sit at the
          bottom of the focused frame and catch the screen's spill. */}
      <Block size={[0.86, 0.04, 0.28]} position={[-1.42, 1.08, -3.9]} material={materials.beige} />
      <Block size={[0.14, 0.05, 0.2]} position={[-0.62, 1.09, -3.9]} material={materials.beige} />

      {/* Tower, tucked under the desk */}
      <Block size={[0.42, 0.9, 0.78]} position={[-0.42, 0.45, -4.35]} material={materials.metal} />
      <Block size={[0.05, 0.05, 0.02]} position={[-0.42, 0.76, -3.955]} material={materials.led} />

      {/* Grounds the monitor on the desk; without it a CRT this heavy looks
          like it is hovering a centimetre above the wood. */}
      <ContactShadow position={[-1.4, 1.065, -4.45]} scale={[1.7, 1.15]} opacity={0.8} />
      <ContactShadow position={[-1.4, 0.008, -4.33]} scale={[3.6, 2.0]} />
    </Hotspot>
  )
}
