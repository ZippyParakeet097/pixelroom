import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { HOTSPOTS } from './hotspots'
import type { HotspotId } from './types'
import { useRoomStore } from '@/state/useRoomStore'
import { playSfx } from '@/audio/sfx'

/**
 * `raycast` override that makes an object invisible to the pointer layer.
 *
 * R3F raycasts the whole scene graph by default. Assigning this to every
 * static prop means the per-frame pointer test only ever visits the handful of
 * meshes wrapped in a <Hotspot>, which is the "small, explicit list" the plan
 * calls for (§4) without hand-rolling a second raycaster.
 */
export const noRaycast: THREE.Object3D['raycast'] = () => {}

const SELF_LIT = 'selfLit'

/**
 * Excludes a material from the whole-hotspot hover highlight below.
 *
 * A hotspot normally lights every material under it as one object, which is
 * right when the object *is* one thing. The bookshelf isn't: its rows light
 * independently, one per project, and two `useFrame` callbacks writing the
 * same `emissive` would fight for it frame by frame. Tagging the row materials
 * hands ownership to exactly one of them.
 */
export function markSelfLit<T extends THREE.Material>(material: T): T {
  material.userData[SELF_LIT] = true
  return material
}

interface HotspotProps {
  id: HotspotId
  children: ReactNode
}

const HIGHLIGHT_SPEED = 9

export function Hotspot({ id, children }: HotspotProps) {
  const def = HOTSPOTS[id]
  const group = useRef<THREE.Group>(null)

  const hovered = useRoomStore((s) => s.hovered === id)
  const anyFocused = useRoomStore((s) => s.focused !== null)
  const inputLocked = useRoomStore((s) => s.inputLocked)
  const setHovered = useRoomStore((s) => s.setHovered)
  const focusHotspot = useRoomStore((s) => s.focusHotspot)

  const interactive = !anyFocused && !inputLocked

  const highlightColor = useMemo(() => new THREE.Color(def.highlight), [def.highlight])
  const intensity = useRef(0)

  // Collect this hotspot's materials once. Furniture components each build
  // their own material instances, so writing `emissive` here can't bleed into
  // another hotspot's meshes.
  const materials = useRef<THREE.MeshLambertMaterial[]>([])
  useEffect(() => {
    const found: THREE.MeshLambertMaterial[] = []
    group.current?.traverse((object) => {
      const mesh = object as THREE.Mesh
      if (!mesh.isMesh) return
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const material of list) {
        if (!(material as THREE.MeshLambertMaterial).isMeshLambertMaterial) continue
        if (material.userData[SELF_LIT]) continue
        found.push(material as THREE.MeshLambertMaterial)
      }
    })
    materials.current = found
  }, [children])

  useFrame((_, delta) => {
    const goal = hovered && interactive ? 1 : 0
    if (Math.abs(intensity.current - goal) < 0.001) return

    intensity.current = THREE.MathUtils.damp(intensity.current, goal, HIGHLIGHT_SPEED, delta)
    for (const material of materials.current) {
      material.emissive.copy(highlightColor).multiplyScalar(intensity.current * 0.42)
    }
  })

  useEffect(() => {
    if (!interactive) return
    document.body.style.cursor = hovered ? 'pointer' : 'auto'
    return () => {
      document.body.style.cursor = 'auto'
    }
  }, [hovered, interactive])

  const handleOver = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!interactive) return
      event.stopPropagation()
      setHovered(id)
      playSfx('hover')
    },
    [interactive, setHovered, id],
  )

  const handleOut = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!interactive) return
      event.stopPropagation()
      setHovered(null)
    },
    [interactive, setHovered],
  )

  const handleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      if (!interactive) return
      event.stopPropagation()
      playSfx('select')
      focusHotspot(id)
    },
    [interactive, focusHotspot, id],
  )

  return (
    <group
      ref={group}
      name={`hotspot-${id}`}
      onPointerOver={handleOver}
      onPointerOut={handleOut}
      onClick={handleClick}
    >
      {children}
    </group>
  )
}
