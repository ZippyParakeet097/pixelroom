import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useRoomStore } from '@/state/useRoomStore'
import type { HotspotId } from '@/hotspots/types'
import { publishSurfaceRect, type SurfaceId } from './surfaceProjection'

/**
 * A few CSS pixels of overhang, so the DOM layer's edge covers the render's.
 *
 * The room is drawn at a quarter resolution and blitted back with a NEAREST
 * filter, so a lit screen quad's edge lands on a 4px block that is either fully
 * lit or not at all. Matching the DOM overlay to the mathematically exact
 * projection therefore leaves a flickering hairline around it; overhanging by
 * one block hides that inside the bezel.
 */
const BLEED = 4

/** A screen-shaped plane in world units. */
export interface ProjectedPlane {
  center: [number, number, number]
  width: number
  height: number
  /**
   * Which world axis the plane's normal runs along. Both screens face the room
   * down +Z, which is the default; the whiteboard hangs on the left wall and
   * faces +X, so its width runs along Z instead of X.
   */
  axis?: 'z' | 'x'
}

interface SurfaceProjectorProps {
  id: SurfaceId
  plane: ProjectedPlane
  /** Only projects while this hotspot is the focused one. */
  activeFor: HotspotId
}

/**
 * Projects a modelled screen into CSS pixels every frame so a DOM layer can be
 * pasted exactly onto it (plan §6).
 *
 * Mounted after <CameraRig> on purpose: `useFrame` callbacks at the same
 * priority run in mount order, so projecting here guarantees the rig has
 * already moved the camera this frame. Reversed, the overlay would trail the
 * room by a frame — invisible while parked, obvious during a dolly.
 */
export function SurfaceProjector({ id, plane, activeFor }: SurfaceProjectorProps) {
  const focused = useRoomStore((s) => s.focused)

  // The four corners of the glass, in world space. Allocated once: this runs
  // every frame and per-frame Vector3s are the classic three.js GC leak.
  const corners = useMemo(() => {
    const [cx, cy, cz] = plane.center
    const hw = plane.width / 2
    const hh = plane.height / 2
    // Which way "along the surface" runs depends on where the object hangs.
    // The order the corners come out in doesn't matter — they are reduced to a
    // bounding box below, not walked as a polygon.
    return ([
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ] as const).map(([u, v]) =>
      plane.axis === 'x'
        ? new THREE.Vector3(cx, cy + v * hh, cz + u * hw)
        : new THREE.Vector3(cx + u * hw, cy + v * hh, cz),
    )
  }, [plane])
  const ndc = useMemo(() => new THREE.Vector3(), [])

  /**
   * Canvas rect, cached until something could have moved it.
   *
   * getBoundingClientRect force layout. Doing that every frame — while a DOM
   * overlay animate over the same canvas — is the classic thrash. Rect only
   * change on resize or scroll, so measure then, not per frame. Still never a
   * stale *measured size*: this read the real box, just not 60 times a second.
   */
  const size = useThree((s) => s.size)
  const rect = useRef<DOMRect | null>(null)
  const stale = useRef(true)

  useEffect(() => {
    stale.current = true
  }, [size])

  useEffect(() => {
    const invalidate = () => {
      stale.current = true
    }
    window.addEventListener('resize', invalidate)
    // Capture: a scrolling ancestor move the canvas without bubbling.
    window.addEventListener('scroll', invalidate, true)
    return () => {
      window.removeEventListener('resize', invalidate)
      window.removeEventListener('scroll', invalidate, true)
    }
  }, [])

  useFrame(({ camera, gl }) => {
    if (focused !== activeFor) {
      publishSurfaceRect(id, null)
      // Re-measure on the way back in — layout may have moved while away.
      stale.current = true
      return
    }

    if (stale.current || !rect.current) {
      rect.current = gl.domElement.getBoundingClientRect()
      stale.current = false
    }
    const canvas = rect.current

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    for (const corner of corners) {
      ndc.copy(corner).project(camera)
      const x = canvas.left + (ndc.x * 0.5 + 0.5) * canvas.width
      const y = canvas.top + (-ndc.y * 0.5 + 0.5) * canvas.height
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }

    // A bounding box rather than the corners themselves: every preset that uses
    // this looks dead-on at its plane, so the projection *is* an axis-aligned
    // rectangle and the box is exact. Mid-dolly it is a close approximation,
    // which is all the entrance needs.
    publishSurfaceRect(id, {
      left: minX - BLEED,
      top: minY - BLEED,
      width: maxX - minX + BLEED * 2,
      height: maxY - minY + BLEED * 2,
    })
  })

  // Leaving must clear the rectangle, or a consumer that outlives this
  // component keeps drawing an interface over an empty room.
  useEffect(() => () => publishSurfaceRect(id, null), [id])

  return null
}
