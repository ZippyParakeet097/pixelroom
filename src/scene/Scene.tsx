import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useRoomStore } from '@/state/useRoomStore'
import { CAMERA_FOV, HOME_CAMERA } from '@/hotspots/hotspots'
import { CameraRig } from './CameraRig'
import { SurfaceProjector } from './SurfaceProjector'
import { MONITOR_SCREEN } from './monitor'
import { JUKEBOX_DISPLAY } from './jukebox'
import { WHITEBOARD_SURFACE } from './whiteboard'
import { PixelationPass } from './PixelationPass'
import { Lighting, Room } from './Room'
import { Desk } from './furniture/Desk'
import { Chair } from './furniture/Chair'
import { Bookshelf } from './furniture/Bookshelf'
import { Jukebox } from './furniture/Jukebox'
import { Corkboard, LavaLamp, Whiteboard, WindowFixture } from './furniture/WallFixtures'
import { StaticProps } from './furniture/StaticProps'
import { HotspotMarkers } from '@/hotspots/HotspotMarkers'
import { PALETTE } from './palette'

/**
 * Canvas configuration worth noting:
 *
 *  - `antialias: false` — MSAA would soften exactly the stair-steps the pixel
 *    look depends on, and the scene is rendered to a low-res target anyway
 *    (plan §3.3).
 *  - `dpr` up to 2 — the scene still renders at 1/divisor of the CSS size; the
 *    higher device ratio only sharpens the final nearest-neighbour blit, so
 *    pixel blocks land on exact device pixels instead of being resampled.
 *  - `flat` — no tone mapping. ACES filmic would desaturate the palette and
 *    fight the posterisation step.
 */
/**
 * Tells the store when there is actually a room on screen.
 *
 * `onCreated` is too early — it fires when the renderer exists, with every
 * material in the room still uncompiled — and the intro uses this to decide
 * when it is safe to lift the black. `useFrame` runs *before* the frame it
 * belongs to is drawn, so the room is on the glass from the second pass on.
 *
 * letmeshowyoutheirfaces
 */
function PaintSignal() {
  const markScenePainted = useRoomStore((s) => s.markScenePainted)
  const frames = useRef(0)

  useFrame(() => {
    frames.current += 1
    if (frames.current === 2) markScenePainted()
  })

  return null
}

export function Scene() {
  return (
    <Canvas
      flat
      dpr={[1, 2]}
      gl={{
        antialias: false,
        powerPreference: 'high-performance',
        stencil: false,
      }}
      camera={{
        fov: CAMERA_FOV,
        near: 0.1,
        far: 60,
        position: HOME_CAMERA.position,
      }}
      onCreated={(state) => {
        state.gl.setClearColor(PALETTE.black, 1)
        // No shadow map is ever allocated (plan §9).
        state.gl.shadowMap.enabled = false

        // Derive pointer coordinates from the canvas's live bounding rect
        // rather than from R3F's measured `size`.
        //
        // The default `compute` divides `event.offsetX` by `size.width`, which
        // is maintained by a ResizeObserver. Whenever that measurement lags the
        // real layout — first paint, an embedded/reused tab, a container that
        // resizes without the observer firing — the pointer NDC is scaled by
        // the wrong denominator and every hit lands somewhere other than where
        // the visitor clicked, while the render still looks correct. Reading
        // the rect at event time cannot go stale.
        state.setEvents({
          compute: (event, rootState) => {
            const rect = rootState.gl.domElement.getBoundingClientRect()
            rootState.pointer.set(
              ((event.clientX - rect.left) / rect.width) * 2 - 1,
              -((event.clientY - rect.top) / rect.height) * 2 + 1,
            )
            rootState.raycaster.setFromCamera(rootState.pointer, rootState.camera)
          },
        })
      }}
    >
      <Lighting />
      <Room />

      <Desk />
      <Chair />
      <Bookshelf />
      <Jukebox />
      <Whiteboard />
      <Corkboard />
      <WindowFixture />
      <LavaLamp />

      <StaticProps />
      <HotspotMarkers />

      <CameraRig />
      {/* After the rig, so these project this frame's camera, not last
          frame's. Three objects carry their UI on their own modelled face: the
          monitor's tube, the jukebox's selection window, and the whiteboard,
          whose face takes the visitor's ink. */}
      <SurfaceProjector id="monitor" activeFor="pc" plane={MONITOR_SCREEN} />
      <SurfaceProjector id="jukebox" activeFor="jukebox" plane={JUKEBOX_DISPLAY} />
      <SurfaceProjector id="whiteboard" activeFor="whiteboard" plane={WHITEBOARD_SURFACE} />
      <PixelationPass divisor={4} colorLevels={26} vignette={0.32} />
      {/* Last, so it counts frames the pass has already been through. */}
      <PaintSignal />
    </Canvas>
  )
}
