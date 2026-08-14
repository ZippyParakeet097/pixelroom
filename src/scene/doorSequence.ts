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
  /**
   * False plants the camera and switches the storm off — see
   * `REDUCED_TIMELINE`. The leaf still swings either way.
   */
  travel: boolean
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
  // Overlaps the swing, but only just, and only barely moves while it is
  // running. The swing *is* the shot — it is the one thing on screen that
  // moves, and it needs a frame wide enough to be seen moving in. Started
  // earlier and harder the camera has the doorway filling the picture by the
  // time the leaf is half over, so the door finishes opening off the edges of
  // the screen. The walk gets the second half to itself.
  push: [500, 1780],
  travel: true,
  // Deliberately past the end of the push. The push runs on the render clock
  // and this on the wall clock, so a few dropped frames leave the camera short
  // — the slack is what stops the screen going black with the walk still
  // visibly running. If the frames were all there, the camera spends the
  // difference already inside the dark, which costs nothing to look at.
  sequence: 1900,
  veil: 320,
  // Short. This is the only beat of the sequence with nothing in it, and black
  // held past the point of reading as a cut starts reading as a load.
  hold: 300,
  reveal: 650,
}

/**
 * With reduced motion the door still opens. The camera does not move and the
 * storm does not flash.
 *
 * This used to freeze the whole scene — leaf shut, camera planted, cut to
 * black — on the reasoning that a film would have cut anyway. It is the wrong
 * reading of the setting twice over. What that setting is for is motion that
 * moves the *frame*: a camera dollying through a doorway is the thing that
 * makes people ill, and a strobing light is the thing that is genuinely
 * dangerous, and both of those are off here. A door swinging on its hinge is
 * an object moving inside a still frame, which is no more troubling than a
 * cursor blinking — and it is the only thing that explains what the press did.
 * Without it, pressing the one button on the page produces a fade to black and
 * nothing else, which does not read as a considerate cut. It reads as broken.
 *
 * Slower than the full sequence and it ends sooner, because with the camera
 * planted there is nothing to look at once the leaf has stopped.
 */
export const REDUCED_TIMELINE: DoorTimeline = {
  latch: 200,
  swing: [230, 1150],
  push: [0, 1],
  travel: false,
  sequence: 1480,
  veil: 380,
  hold: 240,
  reveal: 520,
}

export function doorTimeline(reduced: boolean): DoorTimeline {
  return reduced ? REDUCED_TIMELINE : FULL_TIMELINE
}

/**
 * Just short of square, and it stops there for a reason.
 *
 * It used to go to 105 — a little past, the way a shoved door does, so the leaf
 * tucks clear of the frame it swings into. But there is one key and one kicker
 * in this scene and both are on the visitor's side, so a leaf past ninety has
 * turned its face away from the pair of them and is showing the camera its
 * unlit back. It goes out like a light in the last fifth of its own swing, and
 * the last thing the visitor sees the door do is vanish.
 *
 * Ninety-four keeps the face towards the light for the whole travel. The leaf
 * still clears the opening — at square it is already perpendicular to the wall
 * — so nothing is lost but the tuck.
 */
export const MAX_SWING = (94 * Math.PI) / 180

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
  const t = progressOver(ms, timeline.swing)
  const settle = t > 0.72 ? Math.sin((t - 0.72) * 21) * Math.pow(1 - t, 2) * 0.45 : 0
  return AJAR + (MAX_SWING - AJAR) * (easeInOutCubic(t) + settle)
}

/**
 * How far through the doorway the camera is, 0–1.
 *
 * Accelerating, because a step towards a door and then through it is not a
 * constant speed, and because the two halves of this sequence want opposite
 * things from it. While the leaf is swinging the camera has to stay out of the
 * way — a drift, enough that the frame is not locked off, not enough to crop
 * the thing the shot is about. Once the leaf has stopped there is nothing left
 * to look at out here and the walk is the whole remaining event, so it takes
 * the last two metres quickly.
 *
 * An exponent does both with one number. Not a larger one: a doorway's apparent
 * size already goes as one over the distance to it, so the shot accelerates
 * hard on its own, and piling on more turns the pass through the lining into a
 * cut with a smear in front of it.
 */
export function pushProgress(ms: number, timeline: DoorTimeline): number {
  if (!timeline.travel) return 0
  return Math.pow(progressOver(ms, timeline.push), 1.9)
}

