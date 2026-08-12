import { useMemo } from 'react'
import * as THREE from 'three'
import { PALETTE, makeMaterial } from './palette'
import { carpetTexture, woodTexture } from './textures'
import { Block, Panel } from './primitives'
import { noRaycast } from '@/hotspots/Hotspot'

export const ROOM = {
  half: 5,
  height: 5,
  wallThickness: 0.25,
} as const

/**
 * The room shell: floor, two walls, trim, and a rug.
 *
 * Only two walls are built. This is the standard cutaway-diorama trick — the
 * camera never orbits past the open corner (plan §4: no free-roam), so the
 * missing walls are never visible and would only cost draw calls.
 */
export function Room() {
  const materials = useMemo(() => {
    const wood = woodTexture()
    wood.wrapS = wood.wrapT = THREE.RepeatWrapping
    wood.repeat.set(8, 8)

    // Repeat 1:1. The texture draws its own border stripe, so tiling it would
    // stamp that border across the middle of the rug like a seam.
    const carpet = carpetTexture()
    carpet.wrapS = carpet.wrapT = THREE.ClampToEdgeWrapping

    return {
      floor: makeMaterial(PALETTE.floor, { map: wood }),
      wall: makeMaterial(PALETTE.wall),
      wallLit: makeMaterial(PALETTE.wallLit),
      trim: makeMaterial(PALETTE.woodDark),
      rug: makeMaterial(PALETTE.rug, { map: carpet }),
      ceiling: makeMaterial(PALETTE.wallDark),
    }
  }, [])

  const { half, height, wallThickness: t } = ROOM

  return (
    <group name="room-shell">
      {/* Floor */}
      <Panel
        size={[half * 2, half * 2]}
        position={[0, 0, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={materials.floor}
      />

      {/* Back wall (-Z) and left wall (-X) */}
      <Block
        size={[half * 2, height, t]}
        position={[0, height / 2, -half - t / 2]}
        material={materials.wall}
      />
      <Block
        size={[t, height, half * 2]}
        position={[-half - t / 2, height / 2, 0]}
        material={materials.wallLit}
      />

      {/* Baseboards — a dark line where wall meets floor reads as depth even
          after the palette gets posterised down. */}
      <Block size={[half * 2, 0.22, 0.08]} position={[0, 0.11, -half + 0.04]} material={materials.trim} />
      <Block size={[0.08, 0.22, half * 2]} position={[-half + 0.04, 0.11, 0]} material={materials.trim} />

      {/* Ceiling, kept dark so it frames the shot rather than drawing the eye. */}
      <Panel
        size={[half * 2, half * 2]}
        position={[0, height, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        material={materials.ceiling}
      />

      {/* Rug */}
      <mesh
        position={[0.2, 0.012, 0.4]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={materials.rug}
        raycast={noRaycast}
      >
        <planeGeometry args={[5.4, 4.2]} />
      </mesh>
    </group>
  )
}

/**
 * Static lighting (plan §3.5, §9).
 *
 * No light casts shadows and no shadow map is allocated anywhere in the app.
 * The sense of depth comes from face-angle falloff plus the painted contact
 * shadows under each object, which is both cheaper and a better match for the
 * flat diorama look than real-time shadows would be.
 */
export function Lighting() {
  return (
    <>
      {/* Ambient carries most of the readability. Three's lights are physical
          units since r155, so a room this size needs values an order of
          magnitude above the old pre-r155 intuition to avoid rendering black. */}
      <ambientLight intensity={1.5} color={PALETTE.wallLit} />
      <hemisphereLight args={[PALETTE.paper, PALETTE.floor, 1.1]} />
      {/* `distance` is left at 0 (unbounded) on purpose. A finite distance
          clips the falloff at a hard sphere boundary, which paints visible
          circular edges across flat walls. Decay alone falls off smoothly. */}
      <pointLight position={[0.5, 4.4, 0.5]} intensity={70} decay={2} color="#ffd9a0" />
      {/* Cool bounce from the window side so the two walls read differently. */}
      <pointLight position={[3.2, 3.2, -3.4]} intensity={26} decay={2} color={PALETTE.cyan} />
      {/* Warm fill from the jukebox corner. Kept weak and pulled back off the
          cabinet: sitting it close with a high intensity blows out to white
          once the camera dollies in, and the jukebox's own emissive panels
          already carry the glow in the wide shot. */}
      <pointLight position={[3.7, 2.5, -2.9]} intensity={7} decay={2} color={PALETTE.magenta} />
      {/* Fills the open (wall-less) side of the diorama, which otherwise falls
          into shadow because every other light is behind the geometry. */}
      <directionalLight position={[6, 7, 8]} intensity={1.1} color={PALETTE.paper} />
    </>
  )
}
