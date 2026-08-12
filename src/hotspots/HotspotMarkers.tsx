import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { HOTSPOTS, HOTSPOT_IDS } from './hotspots'
import { noRaycast } from './Hotspot'
import type { HotspotId } from './types'
import { useRoomStore } from '@/state/useRoomStore'

/**
 * Floating affordance above each hotspot.
 *
 * Without these the room is a pretty picture with no signal about what is
 * clickable — the emissive hover highlight only helps once the pointer is
 * already on the right object. A small always-on diamond advertises the
 * hotspot; hovering scales it up and lifts it.
 *
 * These are drawn in 3D rather than as DOM overlays specifically so they pass
 * through the pixelation shader with everything else. A crisp DOM label
 * floating over a chunky low-res render reads as a bug.
 */
export function HotspotMarkers() {
  const focused = useRoomStore((s) => s.focused)
  if (focused !== null) return null

  return (
    <group name="hotspot-markers">
      {HOTSPOT_IDS.map((id) => (
        <Marker key={id} id={id} />
      ))}
    </group>
  )
}

function Marker({ id }: { id: HotspotId }) {
  const def = HOTSPOTS[id]
  const hovered = useRoomStore((s) => s.hovered === id)

  const billboard = useRef<THREE.Group>(null)
  const group = useRef<THREE.Group>(null)
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(def.highlight),
        transparent: true,
        opacity: 0.75,
        depthTest: false,
      }),
    [def.highlight],
  )

  // Offset each marker's bob by its position so they don't pulse in lockstep,
  // which would read as a UI animation rather than as part of the room.
  const phase = useMemo(() => def.markerAnchor[0] * 1.7 + def.markerAnchor[2] * 0.9, [def.markerAnchor])
  const scale = useRef(1)

  useFrame(({ clock, camera }, delta) => {
    if (!group.current || !billboard.current) return
    const elapsed = clock.elapsedTime

    // Screen-aligned billboard: copying the camera's rotation makes the quad
    // parallel to the near plane, so the diamond always faces the viewer.
    // This is the whole of what drei's <Billboard> does for this case, so the
    // dependency is dropped rather than kept for one helper. (Measured: drei
    // tree-shook to ~2 KB here, so this is dependency hygiene, not a
    // meaningful payload win.)
    billboard.current.quaternion.copy(camera.quaternion)

    const goal = hovered ? 1.9 : 1
    scale.current = THREE.MathUtils.damp(scale.current, goal, 10, delta)
    group.current.scale.setScalar(scale.current)

    // Bob on the outer group so it happens along world up. Applying it to the
    // inner group would move the marker along the *camera's* up axis, since
    // that group inherits the billboard rotation.
    const bob = Math.sin(elapsed * 1.8 + phase) * 0.06
    billboard.current.position.y = def.markerAnchor[1] + bob + (hovered ? 0.12 : 0)

    material.opacity = hovered ? 1 : 0.45 + Math.sin(elapsed * 1.8 + phase) * 0.12
  })

  return (
    <group ref={billboard} position={def.markerAnchor}>
      <group ref={group}>
        {/* A diamond — a rotated plane with two triangles reads cleanly at
            four screen pixels across, where a ring or icon turns to mush. */}
        <mesh material={material} rotation={[0, 0, Math.PI / 4]} raycast={noRaycast} renderOrder={10}>
          <planeGeometry args={[0.11, 0.11]} />
        </mesh>
      </group>
    </group>
  )
}
