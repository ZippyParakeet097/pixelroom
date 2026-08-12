import * as THREE from 'three'

/**
 * The room's colour world. Everything in the 3D scene pulls from here so the
 * posterisation step in the pixelation pass has a coherent set of hues to snap
 * to — a wide, unmanaged palette quantises into mud.
 *
 * These mirror the CSS custom properties in `styles/global.css`.
 */
export const PALETTE = {
  black: '#14101a',
  ink: '#1d1826',
  wallDark: '#2b2338',
  wall: '#3a3048',
  wallLit: '#4a3c5c',
  floor: '#634d38',
  floorAlt: '#54412f',
  wood: '#8a6647',
  woodDark: '#5d442f',
  metal: '#5a5f70',
  metalDark: '#3d4150',
  plastic: '#2a2a33',
  /* Beige box plastic. Period-correct for a CRT, and — more usefully — the
     only light-toned material near the desk: it is what makes the monitor
     read as a body around the screen once the camera is close enough for the
     faux desktop to take over the glass. */
  plasticBeige: '#b0a892',
  screen: '#0d1b2a',
  cyan: '#4fd6c8',
  magenta: '#d64f9a',
  amber: '#f0a848',
  paper: '#e8e0d0',
  cork: '#b8834a',
  rug: '#7a4a5e',
  rugAlt: '#633c4d',
  night: '#1b2a4a',
} as const

export type PaletteKey = keyof typeof PALETTE

/**
 * Flat-shaded Lambert is the right base for this look: it gives readable
 * light falloff between faces without specular highlights, which posterise
 * into ugly banded blobs.
 *
 * No material here casts or receives shadow maps — lighting is faked with
 * static lights plus painted contact shadows (plan §3.5, §9).
 */
export function makeMaterial(
  color: string,
  options: Partial<THREE.MeshLambertMaterialParameters> = {},
): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({
    color: new THREE.Color(color),
    emissive: new THREE.Color('#000000'),
    ...options,
  })
}

/** For anything that should ignore lighting entirely — screens, lamp glow. */
export function makeGlowMaterial(
  color: string,
  options: Partial<THREE.MeshBasicMaterialParameters> = {},
): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(color), ...options })
}

/**
 * A soft radial blob used as a painted contact shadow under furniture. This is
 * the cheap stand-in for baked AO: one transparent quad per object, no shadow
 * map, no extra lights.
 */
let contactShadowTexture: THREE.Texture | null = null

export function getContactShadowTexture(): THREE.Texture {
  if (contactShadowTexture) return contactShadowTexture

  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(0,0,0,0.55)')
  gradient.addColorStop(0.55, 'rgba(0,0,0,0.25)')
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  contactShadowTexture = texture
  return texture
}
