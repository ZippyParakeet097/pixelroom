import { useMemo } from 'react'
import * as THREE from 'three'
import { noRaycast } from '@/hotspots/Hotspot'
import { getContactShadowTexture } from './palette'

type Vec3 = [number, number, number]

/**
 * One box, one plane, scaled per instance.
 *
 * Inline `<boxGeometry args={size}>` mint fresh BufferGeometry per mesh — was
 * 117 boxes, 117 geometries. Scale unit shape instead: one upload, one VAO,
 * renderer reuse it across consecutive draws. Normals stay right under
 * non-uniform scale — three build normal matrix from inverse transpose.
 */
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1)
const UNIT_PLANE = new THREE.PlaneGeometry(1, 1)

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
    <mesh
      position={position}
      rotation={rotation}
      scale={size}
      geometry={UNIT_BOX}
      material={material}
      raycast={noRaycast}
    />
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

/** Same for every proxy, and nothing mutates it. One material, not one per hotspot. */
const PICK_MATERIAL = DEBUG_PICKS
  ? new THREE.MeshBasicMaterial({ color: '#ff00ff', wireframe: true, depthTest: false })
  : new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })

export function PickProxy({ size, position, rotation }: Omit<BlockProps, 'material'>) {
  return (
    <mesh
      position={position}
      rotation={rotation}
      scale={size}
      geometry={UNIT_BOX}
      material={PICK_MATERIAL}
      renderOrder={-1}
    />
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
/** Blobs differ only by opacity. Share per level, not per object. */
const shadowMaterials = new Map<number, THREE.MeshBasicMaterial>()

function getShadowMaterial(opacity: number): THREE.MeshBasicMaterial {
  const cached = shadowMaterials.get(opacity)
  if (cached) return cached

  const material = new THREE.MeshBasicMaterial({
    map: getContactShadowTexture(),
    transparent: true,
    opacity,
    depthWrite: false,
  })
  shadowMaterials.set(opacity, material)
  return material
}

export function ContactShadow({ position, scale, opacity = 1 }: ContactShadowProps) {
  const material = useMemo(() => getShadowMaterial(opacity), [opacity])

  return (
    <mesh
      position={position}
      rotation={[-Math.PI / 2, 0, 0]}
      scale={[scale[0], scale[1], 1]}
      geometry={UNIT_PLANE}
      material={material}
      raycast={noRaycast}
      renderOrder={1}
    />
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
    <mesh
      position={position}
      rotation={rotation}
      scale={[size[0], size[1], 1]}
      geometry={UNIT_PLANE}
      material={material}
      raycast={noRaycast}
    />
  )
}
