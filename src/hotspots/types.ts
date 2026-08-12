import type * as THREE from 'three'

export type HotspotId =
  | 'pc'
  | 'jukebox'
  | 'bookshelf'
  | 'corkboard'
  | 'window'
  | 'whiteboard'
  | 'lavalamp'

/** A named camera stop. Exactly one 'home' plus one per hotspot (plan §4). */
export interface CameraState {
  position: [number, number, number]
  target: [number, number, number]
}

export interface HotspotDef {
  id: HotspotId
  /** Shown in the hover affordance. */
  label: string
  /** Where the camera dollies to when this hotspot is focused. */
  camera: CameraState
  /** Anchor for the floating hover marker, in world space. */
  markerAnchor: [number, number, number]
  narrator: {
    /** Played the first time the pointer enters this hotspot. */
    hover?: string
    /** Played on focus. Multiple entries queue as successive dialogue beats. */
    focus: string[]
    /** Replaces `focus` on repeat visits, when present. */
    focusRepeat?: string[]
  }
  /** Which overlay panel renders while this hotspot is focused. */
  panel: PanelKind
  /** Emissive tint applied to the hotspot's meshes on hover. */
  highlight: string
}

export type PanelKind =
  | 'pc'
  | 'jukebox'
  | 'bookshelf'
  | 'corkboard'
  | 'contact'
  | 'whiteboard'
  | 'none'

/**
 * Runtime registry entry. Hotspot meshes register themselves on mount so the
 * pointer layer works against a small explicit list rather than the whole
 * scene graph (plan §4).
 */
export interface HotspotRegistration {
  id: HotspotId
  object: THREE.Object3D
}
