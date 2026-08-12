import { useMemo } from 'react'
import * as THREE from 'three'
import { noRaycast } from '@/hotspots/Hotspot'
import { getContactShadowTexture } from './palette'

type Vec3 = [number, number, number]

interface BlockProps {
  size: Vec3
  position: Vec3
  rotation?: Vec3
  material: THREE.Material
}

/**
 * A static box. Opted out of raycasting by default — only <PickProxy> meshes
 * are visible to the pointer layer (plan §4).
 */
export function Block({ size, position, rotation, material }: BlockProps) {
  return (
    <mesh position={position} rotation={rotation} material={material} raycast={noRaycast}>
      <boxGeometry args={size} />
    </mesh>
  )
}

/**
 * The one pickable mesh per hotspot: a simple box roughly matching the
 * object's volume. Detail meshes stay out of the raycast entirely, so the
 * pointer test walks seven boxes instead of a few hundred triangelised props.
 *
 * `colorWrite: false` rather than `visible={false}` — three's raycaster skips
 * invisible objects outright, so the proxy has to stay "visible" while
 * drawing nothing.
 */
/**
 * Append `?debugPicks` to the URL to draw the pick volumes as wireframes.
 * Proxies are invisible by definition, so a mis-sized one is otherwise only
 * detectable as "this object mysteriously isn't clickable".
 */
const DEBUG_PICKS =
  typeof location !== 'undefined' && new URLSearchParams(location.search).has('debugPicks')

export function PickProxy({ size, position, rotation }: Omit<BlockProps, 'material'>) {
  const material = useMemo(
    () =>
      DEBUG_PICKS
        ? new THREE.MeshBasicMaterial({ color: '#ff00ff', wireframe: true, depthTest: false })
        : new THREE.MeshBasicMaterial({
            colorWrite: false,
            depthWrite: false,
          }),
    [],
  )

  return (
    <mesh position={position} rotation={rotation} material={material} renderOrder={-1}>
      <boxGeometry args={size} />
    </mesh>
  )
}

interface ContactShadowProps {
  position: Vec3
  /** Width and depth of the painted blob. */
  scale: [number, number]
  opacity?: number
}

/**
 * Painted contact shadow — the cheap stand-in for baked AO (plan §3.5).
 * One transparent quad, no shadow map, no extra light.
 */
export function ContactShadow({ position, scale, opacity = 1 }: ContactShadowProps) {
  const material = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      map: getContactShadowTexture(),
      transparent: true,
      opacity,
      depthWrite: false,
    })
  }, [opacity])

  return (
    <mesh
      position={position}
      rotation={[-Math.PI / 2, 0, 0]}
      material={material}
      raycast={noRaycast}
      renderOrder={1}
    >
      <planeGeometry args={scale} />
    </mesh>
  )
}

interface PlaneProps {
  size: [number, number]
  position: Vec3
  rotation?: Vec3
  material: THREE.Material
}

export function Panel({ size, position, rotation, material }: PlaneProps) {
  return (
    <mesh position={position} rotation={rotation} material={material} raycast={noRaycast}>
      <planeGeometry args={size} />
    </mesh>
  )
}
