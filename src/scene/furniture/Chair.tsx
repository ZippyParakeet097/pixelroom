import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PALETTE, makeMaterial } from '../palette'
import { Block, ContactShadow } from '../primitives'
import { useRoomStore } from '@/state/useRoomStore'
import { prefersReducedMotion } from '../motion'

/**
 * Where the chair stands. Every part is modelled relative to this so the whole
 * thing can swivel about the post rather than orbit some arbitrary origin.
 */
const CHAIR_PIVOT: [number, number, number] = [-1.4, 0, -3.35]

/**
 * Parked with its back to the desk, which is how an empty chair is left, and
 * turned in to face the monitor. The monitor is at -Z of the chair, so facing
 * it is half a turn from rest.
 */
const PARKED = 0
const AT_DESK = Math.PI

/**
 * Short enough to land well inside the dolly to the desk — that move runs about
 * 1.15s from the home shot, and a chair still turning once the camera has
 * arrived reads as a loading animation rather than as someone sitting down.
 */
const SPIN_DURATION = 0.5

/**
 * Ease-out with a small overshoot: a castor chair carries momentum past its
 * stop and settles back. 0.9 puts the overshoot near 6% of the travel — about
 * ten degrees on a half turn, which is a nudge rather than a bounce.
 */
function easeOutBack(t: number): number {
  const c1 = 0.9
  const c3 = c1 + 1
  const p = t - 1
  return 1 + c3 * p * p * p + c1 * p * p
}

/**
 * The desk chair.
 *
 * The one piece of furniture that is neither a hotspot nor pure set dressing:
 * it never takes a click, but it answers one. Focusing the PC swivels it round
 * to face the monitor while the camera is still flying in, so sitting down
 * looks like something happening in the room rather than a cut. Leaving turns
 * it back out, which is what restores the establishing shot to the state the
 * visitor first saw it in.
 */
export function Chair() {
  const atDesk = useRoomStore((s) => s.focused === 'pc')

  const materials = useMemo(
    () => ({
      seat: makeMaterial('#3a3550'),
      metal: makeMaterial(PALETTE.metalDark),
    }),
    [],
  )

  const pivot = useRef<THREE.Group>(null)
  const from = useRef(PARKED)
  const to = useRef(PARKED)
  const progress = useRef(1)

  const calm = useMemo(prefersReducedMotion, [])

  useEffect(() => {
    const goal = atDesk ? AT_DESK : PARKED
    if (to.current === goal) return

    from.current = pivot.current?.rotation.y ?? to.current
    to.current = goal

    if (calm) {
      if (pivot.current) pivot.current.rotation.y = goal
      progress.current = 1
      return
    }

    progress.current = 0
  }, [atDesk, calm])

  useFrame((_, delta) => {
    if (progress.current >= 1 || !pivot.current) return
    progress.current = Math.min(1, progress.current + delta / SPIN_DURATION)
    pivot.current.rotation.y = THREE.MathUtils.lerp(
      from.current,
      to.current,
      easeOutBack(progress.current),
    )
  })

  return (
    <group name="desk-chair">
      <group ref={pivot} position={CHAIR_PIVOT}>
        <Block size={[0.56, 0.08, 0.54]} position={[0, 0.5, 0]} material={materials.seat} />
        <Block size={[0.54, 0.62, 0.08]} position={[0, 0.84, -0.27]} material={materials.seat} />
        <Block size={[0.09, 0.46, 0.09]} position={[0, 0.25, 0]} material={materials.metal} />
        <Block size={[0.5, 0.06, 0.06]} position={[0, 0.06, 0]} material={materials.metal} />
        <Block size={[0.06, 0.06, 0.5]} position={[0, 0.06, 0]} material={materials.metal} />
      </group>
      {/* Outside the pivot: the painted shadow is a soft round blob, so turning
          it with the chair would cost a matrix update every frame to change
          nothing on screen. */}
      <ContactShadow position={[-1.4, 0.008, -3.35]} scale={[1.4, 1.4]} opacity={0.7} />
    </group>
  )
}
