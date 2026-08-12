import { useMemo } from 'react'
import { PALETTE, makeGlowMaterial, makeMaterial } from '../palette'
import { doomPosterTexture, haloPosterTexture } from '../textures'
import { Block, ContactShadow } from '../primitives'
import { noRaycast } from '@/hotspots/Hotspot'

/**
 * Non-interactive set dressing. None of it is raycast and none of it is
 * registered as a hotspot — it exists to make the room feel lived in and to
 * give the interactive objects something to sit among.
 */
export function StaticProps() {
  const materials = useMemo(
    () => ({
      metal: makeMaterial(PALETTE.metalDark),
      shade: makeMaterial(PALETTE.metal),
      bulb: makeGlowMaterial('#ffd9a0'),
      plant: makeMaterial('#3f6b4a'),
      pot: makeMaterial('#8a5a3c'),
      crate: makeMaterial(PALETTE.wood),
    }),
    [],
  )

  // The DOOM poster is built separately because it needs an emissive lift the
  // flat-colour props do not. Nothing in the lighting rig points at this stretch
  // of back wall — the ceiling lamp is over the rug and both accent lights are
  // on the window side — so a purely Lambert poster lands at roughly a third
  // brightness, which is survivable for a solid colour and not survivable for
  // artwork: the logo goes to mud and the whole thing reads as a stain. Lighting
  // the wall properly instead would mean adding a light for one prop and
  // re-balancing the room around it. Self-illuminating the paper is the cheaper
  // lie, and the palette absorbs it: a lit poster in a dark room is exactly what
  // the reference frame looks like.
  const posterMaterial = useMemo(() => {
    const map = doomPosterTexture()
    return makeMaterial('#ffffff', {
      map,
      emissive: '#ffffff',
      emissiveMap: map,
      emissiveIntensity: 0.5,
    })
  }, [])

  // Same self-illumination trick as the DOOM poster, and for the same reason:
  // this stretch of wall sits past both the ceiling lamp and the window-side
  // accents, so a Lambert-lit photo would sink into the wall instead of
  // reading as Chief.
  const haloPosterMaterial = useMemo(() => {
    const map = haloPosterTexture()
    return makeMaterial('#ffffff', {
      map,
      emissive: '#ffffff',
      emissiveMap: map,
      emissiveIntensity: 0.5,
    })
  }, [])

  return (
    <group name="static-props">
      {/* Ceiling lamp, hung over the rug */}
      <group>
        <Block size={[0.04, 0.55, 0.04]} position={[0.5, 4.72, 0.5]} material={materials.metal} />
        <mesh position={[0.5, 4.4, 0.5]} material={materials.shade} raycast={noRaycast}>
          <cylinderGeometry args={[0.34, 0.16, 0.26, 10, 1, true]} />
        </mesh>
        <mesh position={[0.5, 4.32, 0.5]} material={materials.bulb} raycast={noRaycast}>
          <sphereGeometry args={[0.09, 8, 6]} />
        </mesh>
      </group>

      {/* Plant in the open corner */}
      <group>
        <mesh position={[-4.3, 0.24, 4.2]} material={materials.pot} raycast={noRaycast}>
          <cylinderGeometry args={[0.24, 0.18, 0.48, 8]} />
        </mesh>
        <Block size={[0.1, 0.7, 0.1]} position={[-4.3, 0.8, 4.2]} material={materials.plant} />
        <Block size={[0.62, 0.12, 0.16]} position={[-4.3, 1.06, 4.2]} material={materials.plant} />
        <Block size={[0.16, 0.12, 0.58]} position={[-4.3, 1.22, 4.2]} material={materials.plant} />
        <Block size={[0.46, 0.12, 0.14]} position={[-4.3, 1.36, 4.2]} material={materials.plant} />
        <ContactShadow position={[-4.3, 0.008, 4.2]} scale={[1.3, 1.3]} opacity={0.7} />
      </group>

      {/* Halo: Combat Evolved, above the corkboard. Same treatment as the DOOM
          poster below, at half the world size, so it keeps the existing
          0.9 × 1.2 plane — that ratio already holds the box art's 272×366
          aspect closely enough that the texels stay square. */}
      <mesh
        position={[-4.93, 3.5, 3.9]}
        rotation={[0, Math.PI / 2, 0]}
        material={haloPosterMaterial}
        raycast={noRaycast}
      >
        <planeGeometry args={[0.9, 1.2]} />
      </mesh>
      {/* DOOM, over the desk.
          Portrait rather than the landscape rectangle the flat colour used —
          this is box art, and box art in landscape reads as a banner — and much
          larger than that rectangle was. The size is forced by legibility, not
          by taste: the home camera is the only one that ever sees this wall, and
          at the old 0.86 width the poster came out about twelve pixel blocks
          across, which is fewer blocks than "DOOM" has letters. 1.78 puts it
          near twenty-five, which is the point where the wordmark resolves. It
          fills the dead span between the bookshelf and the curtains, and its
          bottom edge stops just above the monitor. 1.78 × 2.63 holds the
          source's 256×380 aspect, so the texels stay square and the logo's
          chrome bevel does not skew. */}
      <mesh
        position={[-1.42, 3.32, -4.93]}
        material={posterMaterial}
        raycast={noRaycast}
      >
        <planeGeometry args={[1.78, 2.63]} />
      </mesh>

      {/* Stacked crates under the window. Kept west of x ≈ 2.8: the jukebox's
          plinth reaches x 3.12, and the two were interpenetrating — which the
          establishing shot hid and the jukebox's own stop did not. */}
      <Block size={[0.62, 0.6, 0.6]} position={[2.45, 0.3, -4.5]} material={materials.crate} />
      <Block size={[0.5, 0.48, 0.5]} position={[2.4, 0.84, -4.45]} material={materials.crate} />
      <ContactShadow position={[2.45, 0.008, -4.5]} scale={[1.5, 1.5]} opacity={0.7} />
    </group>
  )
}
