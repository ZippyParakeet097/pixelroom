import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { HOTSPOTS, HOTSPOT_IDS } from './hotspots'
import { noRaycast } from './Hotspot'
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

/**
 * One geometry, one useFrame, for all seven.
 *
 * Was a <Marker> component each: seven subscriptions, seven identical
 * PlaneGeometry, seven materials rebuilt on every remount. Same argument the
 * lava lamp already makes (WallFixtures) — separate subs for one animation is
 * pure overhead.
 *
 * Module scope, not useMemo: derived from static HOTSPOTS, and these mount and
 * unmount every time the camera focuses something. Rebuilding per mount leaked
 * a material set each pass.
 */
const DIAMOND = new THREE.PlaneGeometry(0.11, 0.11)

const MARKERS = HOTSPOT_IDS.map((id) => {
  const def = HOTSPOTS[id]
  return {
    id,
    anchor: def.markerAnchor,
    // Offset each marker's bob by its position so they don't pulse in lockstep,
    // which would read as a UI animation rather than as part of the room.
    phase: def.markerAnchor[0] * 1.7 + def.markerAnchor[2] * 0.9,
    material: new THREE.MeshBasicMaterial({
      color: new THREE.Color(def.highlight),
      transparent: true,
      opacity: 0.75,
      depthTest: false,
    }),
  }
})

export function HotspotMarkers() {
  const focused = useRoomStore((s) => s.focused)
  if (focused !== null) return null

  return <Markers />
}

/** Split out so the early return above stays ahead of every other hook. */
function Markers() {
  const hovered = useRoomStore((s) => s.hovered)

  const billboards = useRef<Array<THREE.Group | null>>([])
  const groups = useRef<Array<THREE.Group | null>>([])
  const scales = useRef(MARKERS.map(() => 1))

  useFrame(({ clock, camera }, delta) => {
    const elapsed = clock.elapsedTime

    for (let i = 0; i < MARKERS.length; i += 1) {
      const billboard = billboards.current[i]
      const group = groups.current[i]
      if (!billboard || !group) continue

      const marker = MARKERS[i]
      const isHovered = hovered === marker.id

      // Screen-aligned billboard: copying the camera's rotation makes the quad
      // parallel to the near plane, so the diamond always faces the viewer.
      // This is the whole of what drei's <Billboard> does for this case, so the
      // dependency is dropped rather than kept for one helper.
      billboard.quaternion.copy(camera.quaternion)

      scales.current[i] = THREE.MathUtils.damp(scales.current[i], isHovered ? 1.9 : 1, 10, delta)
      group.scale.setScalar(scales.current[i])

      // Bob on the outer group so it happens along world up. Applying it to the
      // inner group would move the marker along the *camera's* up axis, since
      // that group inherits the billboard rotation.
      const wave = Math.sin(elapsed * 1.8 + marker.phase)
      billboard.position.y = marker.anchor[1] + wave * 0.06 + (isHovered ? 0.12 : 0)
      marker.material.opacity = isHovered ? 1 : 0.45 + wave * 0.12
    }
  })

  return (
    <group name="hotspot-markers">
      {MARKERS.map((marker, index) => (
        <group
          key={marker.id}
          ref={(node) => {
            billboards.current[index] = node
          }}
          position={marker.anchor}
        >
          <group
            ref={(node) => {
              groups.current[index] = node
            }}
          >
            {/* A diamond — a rotated plane with two triangles reads cleanly at
                four screen pixels across, where a ring or icon turns to mush. */}
            <mesh
              geometry={DIAMOND}
              material={marker.material}
              rotation={[0, 0, Math.PI / 4]}
              raycast={noRaycast}
              renderOrder={10}
            />
          </group>
        </group>
      ))}
    </group>
  )
}
