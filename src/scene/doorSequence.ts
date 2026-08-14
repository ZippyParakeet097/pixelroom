/**
 * The shape of the opening sequence, in milliseconds.
 *
 * This lives on its own — with no three.js import — because two very different
 * layers have to agree on it exactly: the 3D door, which swings and dollies on
 * a render clock, and the DOM overlay, which schedules the fade to black and
 * the creak on `setTimeout`. When those two drift the seam shows immediately:
 * the screen goes black while the door is still moving, or the leaf reaches its
 * stop and then sits there for a beat before anything happens.
 *
 * Everything is measured from the moment the visitor opens the door.
 */
export interface DoorTimeline {
  /** The handle turning, before the leaf has moved at all. */
  latch: number
  /** Start and end of the swing. */
  swing: [number, number]
  /** Start and end of the camera's walk through the doorway. */
  push: [number, number]
  /** False holds the door shut and the camera still — see `REDUCED_TIMELINE`. */
  animate: boolean
  /** Total length of the 3D beat — the moment the screen is fully black. */
  sequence: number
  /** How long the fade to black takes. It *ends* at `sequence`. */
  veil: number
  /** Black hold, after the door scene is gone and before the room appears. */
  hold: number
  /** How long the black takes to lift off the room. */
  reveal: number
}

/**
 * Two beats, smoothly connected: the door swings open, revealing the dark
 * void behind it, followed by the camera zooming forward straight into the
 * doorway void before fading cleanly to black.
 */
export const FULL_TIMELINE: DoorTimeline = {
  latch: 200,
  swing: [230, 1150],
  push: [480, 1850],
  animate: true,
  sequence: 1850,
  veil: 450,
  // Short. This is the only beat of the sequence with nothing in it, and black
  // held past the point of reading as a cut starts reading as a load.
  hold: 340,
  reveal: 650,
}

/**
 * With reduced motion the door is still the door — nothing in the scene moves.
 * The visitor sees the closed door, opens it, and the frame cuts to black and
 * comes up in the room, which is how a film would have done it anyway.
 *
 * Nothing moves at all, rather than moving quickly: a leaf that snaps from shut
 * to open in a single frame is not motion, but it reads as a glitch, and the
 * cut carries the same meaning without asking anyone to interpret it.
 */
export const REDUCED_TIMELINE: DoorTimeline = {
  latch: 0,
  swing: [0, 1],
  push: [0, 1],
  animate: false,
  sequence: 300,
  veil: 300,
  hold: 180,
  reveal: 360,
}

export function doorTimeline(reduced: boolean): DoorTimeline {
  return reduced ? REDUCED_TIMELINE : FULL_TIMELINE
}

/** A little past square, so the open leaf clears the frame it swings into. */
export const MAX_SWING = (105 * Math.PI) / 180

/**
 * How far the door is already open before anyone touches it.
 *
 * The door is on the latch but not shut, which is what makes the storm behind
 * it visible: every flash comes through this gap. It is also the invitation —
 * a door standing open a crack asks to be pushed in a way a closed one does
 * not, and it means the first frame of the swing continues a movement rather
 * than starting one.
 */
export const AJAR = (11 * Math.PI) / 180

/** 0 before the window, 1 after it, eased by the caller. */
export function progressOver(ms: number, [from, to]: [number, number]): number {
  if (ms <= from) return 0
  if (ms >= to) return 1
  return (ms - from) / (to - from)
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

/**
 * How far the lever goes over before the bolt clears its keep.
 *
 * A lever's throw, not a knob's quarter turn — the free end drops about a third
 * of a right angle and stops dead against the mechanism. Far enough to be
 * unmistakable at this pixel size, short enough that it still reads as a latch
 * being worked rather than as a part swinging loose.
 */
export const LATCH_THROW = (34 * Math.PI) / 180

/**
 * The lever's angle, in radians, positive taking its free end down.
 *
 * This is the whole of the door's response to the click, and it has to carry
 * that on its own: nothing else moves until `swing` opens, so if the throw is
 * slow the page reads as having missed the press. Eased out rather than in — a
 * hand already resting on a lever pushes it away hard and the stop takes the
 * speed off, so the fast part belongs at the start.
 *
 * It never comes back up. You do not let go of a handle half way through
 * shouldering a door open, and by the time you would the leaf is edge-on to the
 * only light in the shot and the lever is not on screen to spring anywhere.
 */
export function latchAngle(ms: number, timeline: DoorTimeline): number {
  if (!timeline.animate) return 0
  return LATCH_THROW * easeOutCubic(progressOver(ms, [0, timeline.latch]))
}

/**
 * The leaf's angle, in radians.
 *
 * The overshoot at the tail is not decoration. A door pushed open swings past
 * where it comes to rest and settles back into it; without that the leaf glides
 * to a mathematically perfect halt and reads as a hinge in a vacuum. It decays
 * on `(1 - t)²` so it is guaranteed to be exactly zero at the end of the swing
 * rather than leaving the door parked a fraction off its stop.
 */
export function swingAngle(ms: number, timeline: DoorTimeline): number {
  if (!timeline.animate) return AJAR
  const t = progressOver(ms, timeline.swing)
  const settle = t > 0.72 ? Math.sin((t - 0.72) * 21) * Math.pow(1 - t, 2) * 0.45 : 0
  return AJAR + (MAX_SWING - AJAR) * (easeInOutCubic(t) + settle)
}

/**
 * How far through the doorway the camera is, 0–1.
 *
 * Accelerates smoothly into the void as the doorway swings open, giving a cinematic
 * rushing zoom sensation through the doorframe into the black void.
 */
export function pushProgress(ms: number, timeline: DoorTimeline): number {
  if (!timeline.animate) return 0
  const t = progressOver(ms, timeline.push)
  return t * t * (t * 0.4 + 0.6)
}

