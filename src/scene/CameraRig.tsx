import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { HOME_CAMERA, cameraFor } from '@/hotspots/hotspots'
import { useRoomStore } from '@/state/useRoomStore'
import { prefersReducedMotion } from './motion'

const EASE_DURATION = 1.15
const MIN_DURATION = 0.55

/** Standard ease-in-out cubic — slow departure, slow arrival. */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/**
 * Tweens the camera between named states (plan §4).
 *
 * There is no free orbit and no user-controlled camera: `focused` in the room
 * store fully determines the destination, so the camera can only ever be at
 * home, at a hotspot, or interpolating between two of those.
 *
 * The rig owns a `target` vector because `camera.lookAt` is not stateful —
 * interpolating position alone would swing the view wildly mid-tween.
 */
export function CameraRig() {
  const camera = useThree((s) => s.camera)
  const focused = useRoomStore((s) => s.focused)
  const shelfProject = useRoomStore((s) => s.shelfProject)
  const setCameraSettled = useRoomStore((s) => s.setCameraSettled)

  const fromPosition = useRef(new THREE.Vector3())
  const fromTarget = useRef(new THREE.Vector3())
  const toPosition = useRef(new THREE.Vector3())
  const toTarget = useRef(new THREE.Vector3())
  const currentTarget = useRef(new THREE.Vector3(...HOME_CAMERA.target))
  const progress = useRef(1)
  const duration = useRef(EASE_DURATION)

  // Place the camera at home on first mount without animating into it.
  useEffect(() => {
    camera.position.set(...HOME_CAMERA.position)
    currentTarget.current.set(...HOME_CAMERA.target)
    camera.lookAt(currentTarget.current)
  }, [camera])

  useEffect(() => {
    const next = cameraFor(focused, shelfProject)

    fromPosition.current.copy(camera.position)
    fromTarget.current.copy(currentTarget.current)
    toPosition.current.set(...next.position)
    toTarget.current.set(...next.target)

    if (prefersReducedMotion()) {
      camera.position.copy(toPosition.current)
      currentTarget.current.copy(toTarget.current)
      camera.lookAt(currentTarget.current)
      progress.current = 1
      setCameraSettled(true)
      return
    }

    // Scale duration with travel distance so a short hop between two adjacent
    // hotspots doesn't take as long as the full pull-back to the home shot.
    const distance = fromPosition.current.distanceTo(toPosition.current)
    duration.current = Math.max(MIN_DURATION, Math.min(EASE_DURATION, distance * 0.09))
    progress.current = 0
  }, [focused, shelfProject, camera, setCameraSettled])

  useFrame((_, delta) => {
    if (progress.current >= 1) return

    progress.current = Math.min(1, progress.current + delta / duration.current)
    const eased = easeInOutCubic(progress.current)

    camera.position.lerpVectors(fromPosition.current, toPosition.current, eased)
    currentTarget.current.lerpVectors(fromTarget.current, toTarget.current, eased)
    camera.lookAt(currentTarget.current)

    if (progress.current >= 1) setCameraSettled(true)
  })

  return null
}
