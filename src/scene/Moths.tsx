import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { makeMaterial } from './palette'
import { Block } from './primitives'

type Vec3 = [number, number, number]

interface MothsProps {
  /** What they are circling. The sign's own light position. */
  anchor: Vec3
  /**
   * 1 while the sign is lit, 0 once it has gone. Shared with the light in
   * `IntroDoor` so the two can never disagree about whether there is a sign.
   */
  level: React.RefObject<number>
}

/**
 * Two moths batting around the neon. Set dressing, nothing clickable.
 *
 * Built in the scene rather than in the DOM next to the sign, even though the
 * sign itself is a DOM layer. Drawn as HTML they would miss the pixelation
 * pass and the sign's own light, and arrive as two smooth sprites gliding over
 * a posterised render — the exact tell the light was added to kill. In here
 * they take the cyan off the tube like everything else near it.
 *
 * They pass behind the sign, never in front, because the sign is drawn over
 * the canvas. That is the right way round anyway: the tube is the bright thing
 * and the moths are what the dark around it is doing.
 */

/**
 * Authored light on purpose — the pixelation pass blits straight out, so what
 * lands on screen is roughly the square of what is written here.
 *
 * Dusty and warm, which the cyan then cools. A moth authored cool goes the
 * same colour as the tube and stops being a separate object.
 *
 * The emissive is doing real work, not sweetening. A wing is a flat plate and
 * these fly at roughly the tube's own height, so the light they are circling
 * arrives edge-on and N·L sits near zero for most of the beat — authored
 * without it the pair came back as two dark specks under the lettering, lit by
 * the warm key from across the hall and not by the sign at all. A dim teal
 * floor puts the tube back on them whatever the wing is doing.
 */
const WING = '#ded7c4'
const BODY = '#8a7d6a'
const GLOW = '#35595c'

/** Wingspan, near enough. Everything else is cut from this. */
const SPAN = 0.062

/**
 * Two, and they fly differently.
 *
 * A moth at a light does not orbit it — it commits to a pass, overshoots,
 * loses it, comes back on a different line. So the radius is on its own slow
 * cycle rather than fixed, and the three axes run at frequencies that do not
 * divide into each other. Given a shared period the pair fall into step within
 * a couple of seconds and read as two beads on a wire.
 *
 * `flap` is deliberately far faster than anything else here. At this size a
 * moth is three or four pixels, so the wings are not legible as wings — what
 * the flap actually buys is a silhouette that changes width every other frame,
 * which is the whole difference between an insect and a dot.
 *
 * `bob` is kept tight for a reason that is not about the flight. These are
 * world-space objects circling a sign drawn in screen space, so the top of the
 * bob is measured against the top of the viewport rather than against the
 * lettering: at 0.09 the first moth reached eleven pixels off the frame edge
 * and clipped, which reads as a glitch and not as an insect.
 */
const MOTHS: readonly {
  radius: number
  /** How far in and out of that radius it swings, and how fast. */
  pull: number
  pullRate: number
  /** Height off the anchor, and its own bob. */
  lift: number
  bob: number
  bobRate: number
  /** Around the anchor. */
  rate: number
  phase: number
  /** Squashes the circle front to back — a pass reads better than a ring. */
  depth: number
  flap: number
  scale: number
}[] = [
  {
    radius: 0.34,
    pull: 0.16,
    pullRate: 0.41,
    lift: 0,
    bob: 0.07,
    bobRate: 0.73,
    rate: 0.62,
    phase: 0,
    depth: 0.55,
    flap: 19,
    scale: 1,
  },
  {
    radius: 0.47,
    pull: 0.21,
    pullRate: 0.29,
    lift: -0.05,
    bob: 0.1,
    bobRate: 0.53,
    rate: -0.44,
    phase: 2.3,
    depth: 0.7,
    flap: 23,
    scale: 0.82,
  },
]

/**
 * The flutter on top of the path.
 *
 * Two sines an octave and a bit apart, which is enough to stop the underlying
 * curve reading as a curve. A moth's line is never smooth, and a smooth one at
 * this size looks like a bug being animated rather than one flying.
 */
function flutter(t: number, seed: number): number {
  return Math.sin(t * 6.7 + seed) * 0.011 + Math.sin(t * 11.3 + seed * 2.1) * 0.006
}

export function Moths({ anchor, level }: MothsProps) {
  const materials = useMemo(
    () => ({
      wing: makeMaterial(WING, { transparent: true, emissive: new THREE.Color(GLOW) }),
      body: makeMaterial(BODY, { transparent: true, emissive: new THREE.Color(GLOW) }),
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

  const bodies = useRef<(THREE.Group | null)[]>([])
  const wings = useRef<(THREE.Group | null)[]>([])

  useFrame(() => {
    const t = performance.now() / 1000
    const lit = level.current

    materials.wing.opacity = lit
    materials.body.opacity = lit
    // Nothing to move once they are invisible, and `visible` skips the draw
    // rather than submitting two transparent boxes at zero alpha.
    const showing = lit > 0.01
    for (const group of bodies.current) if (group) group.visible = showing
    if (!showing) return

    MOTHS.forEach((moth, i) => {
      const group = bodies.current[i]
      if (!group) return

      const angle = t * moth.rate + moth.phase
      const reach = moth.radius + Math.sin(t * moth.pullRate + moth.phase) * moth.pull

      group.position.set(
        anchor[0] + Math.cos(angle) * reach + flutter(t, moth.phase),
        anchor[1] +
          moth.lift +
          Math.sin(t * moth.bobRate + moth.phase) * moth.bob +
          flutter(t, moth.phase + 4.1),
        anchor[2] + Math.sin(angle) * reach * moth.depth + flutter(t, moth.phase + 8.3),
      )
      // Nose into the turn, so the body is a line across the flight path
      // rather than a fleck sitting at a fixed angle to it.
      group.rotation.y = -angle + Math.PI / 2

      const wing = wings.current[i]
      // Not a full fold. Closed to nothing the moth vanishes for a frame, and a
      // gap in something this small reads as a dropped frame.
      if (wing) wing.rotation.x = Math.sin(t * moth.flap + moth.phase) * 0.85
    })
  })

  return (
    <group>
      {MOTHS.map((moth, i) => (
        <group
          key={moth.phase}
          ref={(node) => {
            bodies.current[i] = node
          }}
        >
          <Block
            size={[SPAN * 0.42 * moth.scale, SPAN * 0.2 * moth.scale, SPAN * 0.2 * moth.scale]}
            position={[0, 0, 0]}
            material={materials.body}
          />
          {/* Both wings on one hinge. They beat together on a real moth, and
              two hinges is two more objects to keep in step for no pixels. */}
          <group
            ref={(node) => {
              wings.current[i] = node
            }}
          >
            {[-1, 1].map((side) => (
              <Block
                key={side}
                size={[SPAN * 0.34 * moth.scale, SPAN * 0.06, SPAN * 0.46 * moth.scale]}
                position={[0, SPAN * 0.06, ((side * SPAN) / 2) * 0.62 * moth.scale]}
                material={materials.wing}
              />
            ))}
          </group>
        </group>
      ))}
    </group>
  )
}
