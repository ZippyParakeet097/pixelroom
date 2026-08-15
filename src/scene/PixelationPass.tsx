import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * Pixel-art post-process (plan §3).
 *
 * The scene renders once into an off-screen target of `rows` block-rows tall,
 * then a single fullscreen quad blits it back up. Because the
 * target's magnification filter is NEAREST, the upscale produces hard pixel
 * edges rather than a blur — that filter choice *is* the effect.
 *
 * Three details matter and are easy to get wrong:
 *
 *  - `samples: 0`. MSAA on the low-res target would anti-alias exactly the
 *    stair-steps we are trying to keep (plan §3.3).
 *  - The target is sized from CSS pixels, not device pixels, so a pixel block
 *    is the same physical size on a retina and a non-retina display.
 *  - The blit itself runs at full device resolution. The scene — the expensive
 *    part — is still only drawn at the low-res size, so this costs one extra
 *    fullscreen quad and buys crisp block edges on hi-dpi screens.
 *
 * Registering a `useFrame` at priority 1 takes over the render loop: R3F stops
 * auto-rendering as soon as any positive-priority callback exists, which is
 * what lets us drive both passes by hand.
 */

export interface PixelationPassProps {
  // fixed block *count*, not block size: camera FOV is vertical, so a fixed
  // size lost detail on short windows (name sign went unreadable).
  rows?: number
  /** Levels per RGB channel. 0 disables quantisation. */
  colorLevels?: number
  /** 0–1. Darkens the frame edges; subtle values only. */
  vignette?: number
}

const blitVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const blitFragmentShader = /* glsl */ `
  uniform sampler2D uScene;
  uniform float uColorLevels;
  uniform float uVignette;
  varying vec2 vUv;

  void main() {
    vec3 color = texture2D(uScene, vUv).rgb;

    // Posterise in sRGB-ish space. Snapping channels to a small number of
    // steps is what makes the result read as a limited palette rather than
    // as a smooth render that merely has large pixels.
    if (uColorLevels > 0.0) {
      color = floor(color * uColorLevels + 0.5) / uColorLevels;
    }

    if (uVignette > 0.0) {
      vec2 d = vUv - 0.5;
      float falloff = 1.0 - dot(d, d) * uVignette;
      color *= clamp(falloff, 0.0, 1.0);
    }

    gl_FragColor = vec4(color, 1.0);
  }
`

// CSS px per block. Floor keeps tiny windows from going soup; ceiling keeps a
// fullscreen 4K from turning into duplo.
const MIN_BLOCK = 2.5
const MAX_BLOCK = 6

export function PixelationPass({
  rows = 190,
  colorLevels = 24,
  vignette = 0.55,
}: PixelationPassProps) {
  const size = useThree((s) => s.size)

  const target = useMemo(() => {
    const rt = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      depthBuffer: true,
      stencilBuffer: false,
      samples: 0,
      colorSpace: THREE.SRGBColorSpace,
    })
    rt.texture.generateMipmaps = false
    return rt
  }, [])

  // The blit lives in its own scene so it can never be picked up by the main
  // scene's render (or by raycasting).
  const blit = useMemo(() => {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uScene: { value: null },
        uColorLevels: { value: 0 },
        uVignette: { value: 0 },
      },
      vertexShader: blitVertexShader,
      fragmentShader: blitFragmentShader,
      depthTest: false,
      depthWrite: false,
    })
    const scene = new THREE.Scene()
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
    mesh.frustumCulled = false
    scene.add(mesh)
    return { scene, camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), material, mesh }
  }, [])

  useEffect(() => {
    blit.material.uniforms.uScene.value = target.texture
    blit.material.uniforms.uColorLevels.value = colorLevels
    blit.material.uniforms.uVignette.value = vignette
  }, [blit, target, colorLevels, vignette])

  useEffect(() => {
    const block = Math.min(MAX_BLOCK, Math.max(MIN_BLOCK, size.height / rows))
    const width = Math.max(1, Math.round(size.width / block))
    const height = Math.max(1, Math.round(size.height / block))
    target.setSize(width, height)
  }, [target, size.width, size.height, rows])

  useEffect(() => {
    return () => {
      target.dispose()
      blit.material.dispose()
      blit.mesh.geometry.dispose()
    }
  }, [target, blit])

  useFrame(({ gl, scene, camera }) => {
    const previousTarget = gl.getRenderTarget()

    gl.setRenderTarget(target)
    gl.clear()
    gl.render(scene, camera)

    gl.setRenderTarget(previousTarget)
    gl.render(blit.scene, blit.camera)
  }, 1)

  return null
}
