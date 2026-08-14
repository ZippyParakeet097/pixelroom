import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PALETTE, makeGlowMaterial, makeMaterial } from './palette'
import { DOOR_GRID, PLATE_RECT, namePlateFaceTexture, namePlateTexture } from './textures'
import { Block, PickProxy } from './primitives'
import { PixelationPass } from './PixelationPass'
import { AJAR, doorTimeline, latchAngle, pushProgress, swingAngle } from './doorSequence'
import { prefersReducedMotion } from './motion'
import { useRoomStore } from '@/state/useRoomStore'
import { noRaycast } from '@/hotspots/Hotspot'

type Vec3 = [number, number, number]

/**
 * The opening shot: one door, dead on, standing ajar onto a storm.
 *
 * Deliberately not the room's camera. The room is an isometric diorama you look
 * *into*; this is a doorway you stand in front of, so the framing is square to
 * the wall and the FOV is wide enough to have real perspective in it. The jambs
 * flaring past as the camera walks through is the whole reason the sequence
 * reads as going somewhere rather than as a slide transition.
 *
 * The leaf is a painted two-panel door — plum, with the panels sunk behind a
 * frame of stiles and rails — carrying a lever handle and the name on a plate.
 *
 * The far side is pitch black, and the lit side is the one the visitor is
 * standing on. That is deliberate: a camera moving at a black rectangle for a
 * second reads as a camera that is not moving, so the motion has to come from
 * this side of the wall — the casing, the lining and the jambs raking past the
 * lens as the dolly goes through them. Give the far side a value of its own
 * and it stops being a doorway; it becomes a grey box hanging behind one.
 *
 * The weather is the only thing that ever shows what is back there, and it
 * runs on its own clock — sparse, random, and completely indifferent to what
 * the visitor is doing. See `advanceStorm`.
 */

/**
 * Thick on purpose. The reveal — the depth of wall the camera passes through —
 * is the only surface in the shot that sweeps past the lens, and a 30cm one is
 * gone in three frames. Half a metre gives the walk something to happen in.
 */
const WALL = { half: 7, height: 5, thickness: 0.5 } as const
/** The hole in the wall. The slab is cut slightly smaller so it can move. */
const OPENING = { half: 0.6, height: 2.3 } as const
const SLAB = { width: 1.16, height: 2.26, depth: 0.06 } as const
/** Gap under the door — and the line the storm comes through when it flashes. */
const UNDERCUT = 0.035

const HINGE_X = -OPENING.half

/**
 * The frame: two stiles and three rails, standing proud of the slab behind
 * them so that the two panels are real recesses.
 *
 * Modelled rather than painted. A panel is read from the shadow in its top
 * corner and the light on its bottom edge, and neither of those is a thing a
 * map can hold still while the leaf swings through ninety degrees — at four
 * texels of moulding a painted one either disappears or turns into a drawn
 * outline the moment the light moves off the face.
 */
const FRAME = { depth: 0.04, stile: 0.13 } as const

/** The architrave round the opening. Wide enough to be a moulding, not a line. */
const CASING = { width: 0.08, depth: 0.025 } as const

/**
 * The lining: the painted board on the inside faces of the opening, carrying
 * the casing round the corner and into the hole.
 *
 * This is the fix for the walk. Without it the reveal is bare wall — unlit,
 * because the only key is out front and the inside faces of a hole point
 * sideways — so the open doorway is a black rectangle with a bright outline
 * and the dolly has nothing to move against. Lined, the opening is a short
 * bright tunnel, and a tunnel raking out past the edges of frame is the whole
 * sensation of going through a door.
 *
 * Only the front of the reveal is boarded. Behind `depth` the tunnel goes to
 * bare dark wall, which is what keeps the far end reading as somewhere else,
 * and it stops short of the leaf so the two never intersect while the door is
 * still shut.
 */
const LINING = { thickness: 0.035, depth: 0.2 } as const

/**
 * Where each rail starts and stops, up from the bottom of the leaf. The gaps
 * between them are the panels.
 *
 * The top rail is deep for a two-panel door, and deliberately: it is the only
 * part of a leaf that is flat all the way across, so it is where the plate has
 * to go, and it wants a hand's width of clearance above and below the plate or
 * the name reads as having been stuck on wherever it fit.
 */
const RAILS: readonly (readonly [number, number])[] = [
  [0, 0.26],
  [0.86, 1.06],
  [1.72, SLAB.height],
]

/** The face everything mounted on the door sits on: the front of the frame. */
const FACE = SLAB.depth / 2 + FRAME.depth

/** A lever on a rose, on the latch stile just above the middle rail. */
const HANDLE = {
  x: SLAB.width - FRAME.stile / 2,
  y: 1.2,
  rose: 0.05,
  reach: 0.03,
  lever: 0.16,
  bar: 0.03,
} as const

const INTRO_FOV = 42
const CAMERA_START: Vec3 = [0, 1.58, 4.5]
/**
 * Through the wall and a little way past it.
 *
 * Stopping short of the opening was tried and is worse: the last second is
 * then a slow creep at a rectangle that is already most of the screen, which
 * is a zoom rather than a walk. The lining has to actually leave frame, and it
 * only does that once the camera is inside the hole. Past the back face by
 * about half a metre — far enough that the tunnel mouth is behind the lens,
 * close enough that no time is spent staring at an empty box.
 */
const CAMERA_END: Vec3 = [0, 1.45, -0.85]
const LOOK_START: Vec3 = [0, 1.18, 0]
const LOOK_END: Vec3 = [0, 1.18, -6]

const HOVER_SPEED = 9

/** The scene's base light level, lifted for the length of a strike. */
const AMBIENT = 3.4

const STEEL = new THREE.Color('#c4cede')

/**
 * The leaf: painted, not timber. Frame and panel — see the materials below.
 *
 * Authored much lighter than they read. The blit at the end of the pixelation
 * pass writes what it sampled straight out, so the frame buffer's encode lands
 * on colour that has already been through one — everything on screen is roughly
 * the square of what was authored, and a value picked by eye out of the palette
 * arrives crushed to black. These two are picked backwards from where they have
 * to land: a chocolate frame and a panel a couple of stops under it, still
 * separated after the squaring.
 */
const LEAF = new THREE.Color('#a09588')
const PANEL = new THREE.Color('#7a6e64')

/**
 * The plate the name sits on, in world units: `PLATE_RECT` measured on
 * the door's texel grid, mapped onto the leaf. Everything is derived from where
 * the letters actually land rather than measured against them, so the plate
 * cannot drift off its own engraving.
 *
 * Centred on the lettering rather than on the leaf. The word lands where the
 * texel grid lets it, which is half a texel off centre, and a plate centred on
 * the door instead leaves visibly more margin at one end than the other.
 */
const PLATE = {
  width: (PLATE_RECT.width * SLAB.width) / DOOR_GRID.width,
  height: (PLATE_RECT.height * SLAB.height) / DOOR_GRID.height,
  x: ((PLATE_RECT.x + PLATE_RECT.width / 2) * SLAB.width) / DOOR_GRID.width,
  /** Texture rows count down from the head of the door; the leaf's y counts up. */
  y: SLAB.height * (1 - (PLATE_RECT.y + PLATE_RECT.height / 2) / DOOR_GRID.height),
  depth: 0.005,
} as const
/**
 * The far side: black, and what a strike does to it.
 *
 * Both are literal black. The visitor is walked into somewhere unlit, and the
 * only thing that ever shows what is back there is the weather — so the room
 * has no value of its own to read as a grey box hanging behind the doorway.
 * Two colours rather than one so a strike still separates a floor from a wall.
 */
const VOID_DARK = new THREE.Color('#000000')
const VOID_FLOOR = new THREE.Color('#000000')
const VOID_LIT = new THREE.Color('#dfe6f7')
/** The wedge a strike throws through the opening, across the floor this side. */
const SPILL = new THREE.Color('#cfdcff')

/**
 * The falloff of that wedge, as a map: a soft disc centred on the doorway end
 * of the quad and dying out before its far edge.
 *
 * Painted rather than lit. A real light behind the wall has no idea the wall
 * is there — nothing here casts shadows, by design — so it would lay the same
 * glow on the front of the wall as on the floor, and light passing straight
 * through masonry reads as a bug rather than as a doorway. A quad is the whole
 * effect, costs one draw, and can be widened by the leaf's own angle.
 */
function makeSpillTexture(): THREE.Texture {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  // Centred on the top edge, which is the door end: row 0 of the canvas is
  // v = 1, and the quad is laid down with v = 1 against the threshold.
  const gradient = ctx.createRadialGradient(size / 2, 0, 0, size / 2, 0, size)
  gradient.addColorStop(0, 'rgba(255,255,255,0.95)')
  gradient.addColorStop(0.45, 'rgba(255,255,255,0.34)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  return texture
}

/**
 * One strike, as a curve: time in seconds against brightness.
 *
 * Lightning is not a fade in and out — it is two or three separate discharges
 * down the same channel, a few tens of milliseconds apart, and the flicker
 * between them is the whole tell. A single smooth pulse at this length reads as
 * a light being switched on, which is exactly what it must not read as.
 */
const STRIKE: [number, number][] = [
  [0, 0],
  [0.03, 1],
  [0.09, 0.16],
  [0.14, 0.86],
  [0.2, 0.07],
  [0.26, 1],
  [0.44, 0.28],
  [0.66, 0.05],
  [0.85, 0],
]
const STRIKE_LENGTH = STRIKE[STRIKE.length - 1][0]

function strikeAt(t: number): number {
  for (let i = 1; i < STRIKE.length; i++) {
    const [time, level] = STRIKE[i]
    if (t > time) continue
    const [prevTime, prevLevel] = STRIKE[i - 1]
    return THREE.MathUtils.lerp(prevLevel, level, (t - prevTime) / (time - prevTime))
  }
  return 0
}

interface Storm {
  /** Seconds until the next strike, or `t >= 0` while one is running. */
  wait: number
  t: number
}

/**
 * Seconds until the next strike.
 *
 * Sparse, and deliberately so. This is weather, not a light cue — it belongs to
 * the scene rather than to anything the visitor did, so it has to be rare
 * enough that catching one feels like luck. Uneven, so nobody starts counting.
 */
function nextStrikeWait(): number {
  return 9 + Math.random() * 15
}

/**
 * The first one, sooner. Not much sooner — but a visitor who presses the button
 * inside ten seconds should still have a fair chance of having seen the weather
 * exist, and at the full spacing that chance is close to none.
 */
function firstStrikeWait(): number {
  return 3.5 + Math.random() * 7
}

/** Advances the weather by one frame and returns this frame's brightness. */
function advanceStorm(storm: Storm, delta: number): number {
  if (storm.t >= 0) {
    storm.t += delta
    if (storm.t <= STRIKE_LENGTH) return strikeAt(storm.t)
    storm.t = -1
    storm.wait = nextStrikeWait()
    return 0
  }
  storm.wait -= delta
  if (storm.wait <= 0) storm.t = 0
  return 0
}

/**
 * Append `?doorAt=900` to pin the sequence to that millisecond and hold it
 * there, the same way `?debugPicks` draws the room's pick volumes.
 *
 * Two seconds of swing and dolly is not something you can art-direct by
 * watching it go past — every pose worth judging is on screen for a frame and a
 * half. Pinned, each one can be looked at properly.
 */
const PINNED_AT = (() => {
  if (typeof location === 'undefined') return null
  const raw = new URLSearchParams(location.search).get('doorAt')
  const ms = raw === null ? Number.NaN : Number(raw)
  return Number.isFinite(ms) ? ms : null
})()

function DoorScene({ onOpen }: { onOpen: () => void }) {
  const camera = useThree((s) => s.camera)
  const opening = useRoomStore((s) => s.stage !== 'door')

  const timeline = useMemo(() => doorTimeline(prefersReducedMotion()), [])

  const materials = useMemo(
    () => ({
      wall: makeMaterial('#2a2334'),
      /* A slim painted casing, a shade lighter than the wall and standing a
         couple of centimetres proud. Tried the modern thing of a dark shadow
         gap first: on a wall this dark it is invisible, and the leaf reads as a
         rectangle of timber floating in a flat field with nothing to give the
         doorway a size. */
      casing: makeMaterial('#969ab1'),
      /* The reveal, a shade under the casing it turns in from. Same board,
         seen edge-on and away from the key, so it cannot be the same value on
         screen without reading as a separate lighter thing stuck inside the
         opening. */
      lining: makeMaterial('#7c8098'),
      floor: makeMaterial(PALETTE.floorAlt),
      threshold: makeMaterial(PALETTE.ink),
      /* No map on either. Two passes at a painted figure into the leaf — plank
         seams and knots, then a soft ribbon with pores — and at this size both
         came back as speckle scattered over it, which reads as dirt rather than
         as a finish. Even a gradient down the face separates into bands the
         posterise step then hardens. A painted door across a dark room is one
         colour, and the difference between these two is the recess. */
      slab: makeMaterial(`#${LEAF.getHexString()}`),
      panel: makeMaterial(`#${PANEL.getHexString()}`),
      /* White, and the sign comes entirely from its map. Like the lettering it
         can then be dimmed with one scalar as the leaf swings into the dark. */
      plate: makeMaterial('#ffffff', { map: namePlateFaceTexture() }),
      /* The lettering stays white and takes its colour from its map, so it can
         be dimmed with one scalar as the door swings into the dark. */
      engraving: makeMaterial('#ffffff', { map: namePlateTexture(), alphaTest: 0.5 }),
      steel: makeMaterial(`#${STEEL.getHexString()}`),
      /* Unlit on purpose. This *is* the far side — during a strike it has to go
         to full white regardless of where the scene's lights are, and between
         strikes it has to sit darker than anything a lit surface can reach, or
         the doorway stops reading as a hole. Inside-out, because it is a room
         rather than a backdrop: see the geometry. */
      beyond: makeGlowMaterial(`#${VOID_DARK.getHexString()}`, { side: THREE.BackSide }),
      beyondFloor: makeGlowMaterial(`#${VOID_FLOOR.getHexString()}`),
      /* Additive, so it lifts the floor it lies on instead of replacing it,
         and so its soft edge needs no guesswork about what is underneath.
         Depth-write off for the same reason as any other decal. */
      spill: makeGlowMaterial(`#${SPILL.getHexString()}`, {
        map: makeSpillTexture(),
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    }),
    [],
  )

  // Unlike the room's furniture, this scene really does unmount — every material
  // here would otherwise stay on the GPU for the rest of the session, for a shot
  // that is over in two seconds. Geometries are R3F's to clean up; the door's
  // maps belong to the shared cache and are not ours to dispose. The spill's is
  // ours — it is drawn here, for here, and nothing else ever asks for it.
  useEffect(() => {
    const owned = Object.values(materials)
    const spillMap = materials.spill.map
    return () => {
      for (const material of owned) material.dispose()
      spillMap?.dispose()
    }
  }, [materials])

  const leaf = useRef<THREE.Group>(null)
  const lever = useRef<THREE.Group>(null)
  const bolt = useRef<THREE.DirectionalLight>(null)
  const behind = useRef<THREE.PointLight>(null)
  const fill = useRef<THREE.AmbientLight>(null)
  const spill = useRef<THREE.Group>(null)
  /**
   * When the press landed, on the wall clock. Null until it does.
   *
   * Wall clock, not accumulated frame deltas, and this matters more than it
   * looks. `DoorIntro` schedules the fade and the cut on `setTimeout`, so the
   * overlay's idea of the sequence is wall time no matter what; if the swing
   * runs on summed `delta`s instead, the two only agree while every frame
   * arrives on schedule. They do not. This chunk lands, three compiles its
   * shaders, and the first frames of the one animation on the page that has to
   * hit its marks are the most expensive it will ever draw — and a tab that is
   * not in front stops rendering altogether.
   *
   * Summed deltas make dropped frames *slow the door down*, so the veil comes
   * up on a leaf that is still moving, or on one barely off the latch. Read off
   * the clock, a dropped frame skips the pose instead, which is what a dropped
   * frame is supposed to cost.
   */
  const started = useRef<number | null>(null)
  const hovered = useRef(false)
  const glint = useRef(0)
  // Runs on its own clock from the moment the scene mounts, and keeps running
  // through the swing. Nothing the visitor does starts, stops or hurries it.
  const storm = useRef<Storm>({ wait: firstStrikeWait(), t: -1 })
  /** Fades the weather out once the door is moving — see the frame loop. */
  const weather = useRef(1)

  const lookAt = useMemo(() => new THREE.Vector3(...LOOK_START), [])
  const from = useMemo(() => new THREE.Vector3(...CAMERA_START), [])
  const to = useMemo(() => new THREE.Vector3(...CAMERA_END), [])
  const lookFrom = useMemo(() => new THREE.Vector3(...LOOK_START), [])
  const lookTo = useMemo(() => new THREE.Vector3(...LOOK_END), [])

  useEffect(() => {
    camera.position.copy(from)
    camera.lookAt(lookAt)
  }, [camera, from, lookAt])

  /** The press starts the clock. Only the clock — the weather is not ours. */
  useEffect(() => {
    if (!opening) return
    started.current = performance.now()
  }, [opening])

  useFrame((_, delta) => {
    const now = performance.now()
    const ms = PINNED_AT ?? (started.current === null ? 0 : now - started.current)
    const swing = swingAngle(ms, timeline)
    /** 0 where the door started, 1 at a right angle, and past 1 beyond that. */
    const open = Math.max(0, (swing - AJAR) / (Math.PI / 2))
    const push = pushProgress(ms, timeline)

    if (leaf.current) leaf.current.rotation.y = swing
    // Turned before the hinge has taken any of it — the throw is the door's
    // whole answer to the click for the first fifth of a second.
    if (lever.current) lever.current.rotation.z = latchAngle(ms, timeline)

    // Pulled down over the walk — to a floor, not to nothing. A strike is a
    // hard cut from black to white, and the walk is the one stretch where the
    // doorway is most of the screen; at full strength that is a full-screen
    // strobe. The storm keeps its own timing either way, it just lands softly
    // once the leaf is moving.
    if (opening) weather.current = THREE.MathUtils.damp(weather.current, 0.4, 1.5, delta)
    // No weather at all under reduced motion. This is the one effect on the
    // page that is not merely movement someone might find unpleasant: a
    // repeating hard cut from black to white is the exact thing that setting
    // exists to switch off, and there is no gentler version of lightning.
    const flash = timeline.travel ? advanceStorm(storm.current, delta) * weather.current : 0
    // Black except during a strike. There was an eyes-adjusting lift on the
    // walk in — the far side coming up with `push` — and it read as exactly
    // what it was: a grey box behind the doorway, growing. A doorway onto the
    // dark has to be dark, so the weather is the only thing that ever lifts it.
    // The floor takes a touch more, so a strike still puts a horizon back there.
    materials.beyond.color.lerpColors(VOID_DARK, VOID_LIT, flash)
    materials.beyondFloor.color.lerpColors(VOID_FLOOR, VOID_LIT, Math.min(1, flash * 1.3))
    if (behind.current) behind.current.intensity = flash * 90
    // The same strike out here, as sky rather than as a source. Nothing on the
    // visitor's side of the wall can be lit by a light behind it, so without
    // this the flash is a bright hole in a dark room, which is what a crack
    // under a door looks like — not what a storm does to a hallway. It also
    // lands on the face of the leaf, which is the one moving thing in the shot.
    if (bolt.current) bolt.current.intensity = flash * 5
    if (fill.current) fill.current.intensity = AMBIENT + flash * 2.4

    // The wedge a strike throws through the opening and across the floor on
    // this side, as wide as the leaf has left it. Driven by `flash`, because
    // there is nothing back there to spill: the light is the weather, so the
    // wedge exists exactly as long as the strike does.
    const wedge = Math.min(1, 0.14 + open * 1.2)
    materials.spill.opacity = flash * wedge * 0.85
    // Anchored at the threshold, so local +Y is length away from the door and
    // local X is the width of the mouth — see the group it scales.
    if (spill.current) spill.current.scale.set(0.34 + wedge * 0.66, 0.5 + wedge * 0.5, 1)

    /**
     * Swallowed by the dark — but only at the very end of the swing, and only
     * a little.
     *
     * This used to be `1 - min(1, open) * 0.72`: a third of its brightness gone
     * by the time the leaf was a quarter open, and under a third left at
     * square. That is on top of two other things already taking it down. The
     * leaf turns away from the key as it swings, so Lambert is dimming it
     * anyway; and the pixelation pass posterises to 26 levels over a signal
     * that has already been squared, so anything under about a fortieth of full
     * is written out as black. The three together put the leaf at literal zero
     * before it was half open.
     *
     * Which is the whole reason the sequence read as having no animation in it.
     * The leaf is the only thing in the shot that moves; it was going black on
     * the way, so what you saw was a door dissolving rather than a door
     * opening — and the frames where it was still visible were the frames where
     * it had barely moved. Nothing else was wrong with the swing. It was being
     * turned off while it ran.
     */
    const shade = 1 - Math.max(0, open - 0.7) * 1.4
    materials.slab.color.copy(LEAF).multiplyScalar(shade)
    materials.panel.color.copy(PANEL).multiplyScalar(shade)
    materials.engraving.color.setScalar(shade)
    materials.plate.color.setScalar(shade)
    materials.steel.color.copy(STEEL).multiplyScalar(shade)

    const goal = hovered.current && !opening ? 1 : 0
    if (Math.abs(glint.current - goal) > 0.001) {
      glint.current = THREE.MathUtils.damp(glint.current, goal, HOVER_SPEED, delta)
      // Only the pull lights up. The affordance is the handle, and brightening
      // the whole slab on hover reads as a state change rather than as a thing
      // you can take hold of.
      materials.steel.emissive.setRGB(glint.current * 0.2, glint.current * 0.23, glint.current * 0.3)
    }

    if (push <= 0) return

    camera.position.lerpVectors(from, to, push)
    // A walk rather than a dolly: two sine terms an octave apart for the gait,
    // and a slow lateral sway, all scaled by how far in the camera already is
    // so the first step out of stillness isn't a lurch.
    const stride = (now / 1000) * 6.4
    camera.position.y += (Math.sin(stride) * 0.014 + Math.sin(stride * 2) * 0.005) * push
    camera.position.x += Math.sin(stride * 0.5) * 0.01 * push
    lookAt.lerpVectors(lookFrom, lookTo, push)
    camera.lookAt(lookAt)
  })

  return (
    <>
      {/* Three's lights are physical units — Lambert divides irradiance by π —
          and this palette's walls are very dark on purpose. Lit to pre-r155
          intuition every surface here renders black, which is a hard bug to
          see, because unlit materials keep drawing perfectly through it.

          These two are calibrated to land the mahogany on screen at roughly the
          colour it was authored at: a hair over 1.0 in linear, so the texture
          is the finish rather than a dark base the lights have to rescue. */}
      <ambientLight ref={fill} intensity={AMBIENT} color="#5b4a6e" />
      {/* One light, from the visitor's side of the wall — the closed door is lit
          by wherever they have been standing, and there is nothing on the other
          side to light it but the weather. Warm, because a cool key on a red
          timber takes the red straight out of it. */}
      <directionalLight position={[3.5, 5, 7]} intensity={4.8} color="#e6d7c2" />
      {/* The kicker, and it exists for one object.

          Side on from the right and almost level, which is very nearly useless
          to everything else in the shot: the wall, the casing and the floor all
          face the wrong way to take much of it. The leaf's face does not. Shut,
          it is square to the camera and picks up almost none of this; open, it
          has turned to face straight into it. So the light comes *up* on the
          leaf over exactly the span where the key is falling off it, and the
          one thing that moves stays lit the whole way round instead of sinking
          into the wall behind it. */}
      <directionalLight position={[9, 2.4, 0.5]} intensity={3.2} color="#d8c9b4" />
      {/* The strike, out here as sky. Directional rather than a point: a
          discharge miles up does not fall off across four metres of hallway,
          and a point light close enough to matter draws a soft circle on the
          wall that reads as somebody outside with a torch. */}
      <directionalLight ref={bolt} position={[2.4, 4.5, 6]} intensity={0} color="#dbe6ff" />
      {/* And the same strike behind the wall, raking the reveal and the inner
          edge of the leaf — the only light the far side of this scene ever
          gets, which is what keeps it a dark room rather than a lit one. */}
      <pointLight
        ref={behind}
        position={[0.3, 1.7, -1.1]}
        intensity={0}
        distance={6}
        decay={2}
        color="#dbe6ff"
      />

      {/* Wall, built as three boxes around a real hole: the camera goes through
          it, so the reveals have to be geometry rather than a painted opening.
          Its back faces point away from the only light, so once the camera is
          through, the wall it came from is gone. */}
      <Block
        size={[WALL.half - OPENING.half, WALL.height, WALL.thickness]}
        position={[-(OPENING.half + (WALL.half - OPENING.half) / 2), WALL.height / 2, 0]}
        material={materials.wall}
      />
      <Block
        size={[WALL.half - OPENING.half, WALL.height, WALL.thickness]}
        position={[OPENING.half + (WALL.half - OPENING.half) / 2, WALL.height / 2, 0]}
        material={materials.wall}
      />
      <Block
        size={[OPENING.half * 2, WALL.height - OPENING.height, WALL.thickness]}
        position={[0, OPENING.height + (WALL.height - OPENING.height) / 2, 0]}
        material={materials.wall}
      />

      {/* The architrave: three strips standing proud of the wall face, just
          outside the opening. Without them the leaf is a rectangle floating in
          a flat dark field — the wall has no features of its own to give the
          doorway a size. Cool, and the only cool thing in the shot: painted
          architrave against a chocolate leaf. It was warm while the door was
          plum, and once the door went brown the two were one brown silhouette
          with a black line between them. */}
      <Block
        size={[CASING.width, OPENING.height + CASING.width, CASING.depth]}
        position={[
          -OPENING.half - CASING.width / 2,
          (OPENING.height + CASING.width) / 2,
          WALL.thickness / 2,
        ]}
        material={materials.casing}
      />
      <Block
        size={[CASING.width, OPENING.height + CASING.width, CASING.depth]}
        position={[
          OPENING.half + CASING.width / 2,
          (OPENING.height + CASING.width) / 2,
          WALL.thickness / 2,
        ]}
        material={materials.casing}
      />
      <Block
        size={[OPENING.half * 2 + CASING.width * 2, CASING.width, CASING.depth]}
        position={[0, OPENING.height + CASING.width / 2, WALL.thickness / 2]}
        material={materials.casing}
      />

      {/* The lining: three boards down the inside faces of the opening, set in
          from the front of the wall so they stop before the leaf. No board on
          the floor — the threshold is already there and a bright strip across
          the bottom of the hole caps the line of light under the door. */}
      {[-1, 1].map((side) => (
        <Block
          key={side}
          size={[LINING.thickness, OPENING.height, LINING.depth]}
          position={[
            side * (OPENING.half - LINING.thickness / 2),
            OPENING.height / 2,
            WALL.thickness / 2 - LINING.depth / 2,
          ]}
          material={materials.lining}
        />
      ))}
      <Block
        size={[OPENING.half * 2, LINING.thickness, LINING.depth]}
        position={[
          0,
          OPENING.height - LINING.thickness / 2,
          WALL.thickness / 2 - LINING.depth / 2,
        ]}
        material={materials.lining}
      />

      {/* The far side: a box the far side of the wall, drawn from the inside.
          A flat quad across the opening would be simpler, and wrong twice over
          — the leaf swings *through* where it would have to sit, so the door
          would clip into it half way through the swing, and the camera reaches
          the far wall of this shot with the veil still lifting. A room the
          camera ends up inside of is black from every position it can be in. */}
      <mesh position={[0, 1.5, -3]} material={materials.beyond} raycast={noRaycast}>
        <boxGeometry args={[6, 6, 6]} />
      </mesh>
      {/* Its floor. Invisible between strikes, which is correct — there is
          nothing back there to see. During one it separates from the wall, and
          the horizon that appears for those few frames is the only thing that
          says the far side is a room with a depth to it rather than a hole cut
          in the picture. */}
      <mesh
        position={[0, 0.001, -3]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={materials.beyondFloor}
        raycast={noRaycast}
      >
        <planeGeometry args={[6, 6]} />
      </mesh>

      {/* Floor on this side only. It stops at the wall, and nothing at all is
          modelled past it — that absence is the void the camera walks into. */}
      <mesh
        position={[0, 0, WALL.thickness / 2 + 5]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={materials.floor}
        raycast={noRaycast}
      >
        <planeGeometry args={[WALL.half * 2, 10]} />
      </mesh>
      {/* The light let out onto this side, as a quad rather than as a light —
          see `makeSpillTexture`. Hinged at the threshold: the group sits on it
          and the plane hangs back off the group towards the camera, so scaling
          the group grows the wedge away from the door instead of about its own
          middle. Local +Y runs from the camera to the doorway, which is where
          the map's bright end is. */}
      <group
        ref={spill}
        position={[0, 0.004, WALL.thickness / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <mesh position={[0, -1.9, 0]} material={materials.spill} raycast={noRaycast}>
          <planeGeometry args={[3.4, 3.8]} />
        </mesh>
      </group>

      {/* Threshold strip, on the near side of the opening only. Run through the
          middle it would sit under the undercut and cap the line of light that
          gets out beneath the door, which is half of what says there is weather
          back there. */}
      <Block
        size={[OPENING.half * 2, 0.014, 0.22]}
        position={[0, 0.007, 0.08]}
        material={materials.threshold}
      />

      <group
        onPointerOver={() => {
          hovered.current = true
        }}
        onPointerOut={() => {
          hovered.current = false
        }}
        onClick={onOpen}
      >
        {/* Hinged at the left edge and set back into the reveal. Local +X runs
            across the slab from the hinge, so a positive rotation about Y takes
            it into -Z — away from the visitor, into the dark. */}
        <group ref={leaf} position={[HINGE_X, UNDERCUT, -0.03]} rotation={[0, AJAR, 0]}>
          <PickProxy
            size={[SLAB.width, SLAB.height, SLAB.depth + 0.2]}
            position={[SLAB.width / 2, SLAB.height / 2, 0.06]}
          />

          {/* The slab the panels are the face of, and the frame standing proud
              of it. Rails run between the stiles rather than across them: two
              coplanar front faces meeting in the corner of the leaf is a
              z-fight, and at this pixel size a z-fight is a block of the wrong
              colour flickering on and off. */}
          <Block
            size={[SLAB.width, SLAB.height, SLAB.depth]}
            position={[SLAB.width / 2, SLAB.height / 2, 0]}
            material={materials.panel}
          />
          {[FRAME.stile / 2, SLAB.width - FRAME.stile / 2].map((x) => (
            <Block
              key={x}
              size={[FRAME.stile, SLAB.height, FRAME.depth]}
              position={[x, SLAB.height / 2, SLAB.depth / 2 + FRAME.depth / 2]}
              material={materials.slab}
            />
          ))}
          {RAILS.map(([from, to]) => (
            <Block
              key={from}
              size={[SLAB.width - FRAME.stile * 2, to - from, FRAME.depth]}
              position={[SLAB.width / 2, (from + to) / 2, SLAB.depth / 2 + FRAME.depth / 2]}
              material={materials.slab}
            />
          ))}

          {/* The nameplate: a plate, and the lettering on a quad a millimetre
              in front of it. The lettering's quad is the whole face of the door
              rather than the size of the plate — that is what keeps its texels
              on the slab's grid, which is the only pitch the pass samples
              cleanly. Everything outside the letters is cut away by
              `alphaTest`, so the two agree about where the plate is. */}
          <Block
            size={[PLATE.width, PLATE.height, PLATE.depth]}
            position={[PLATE.x, PLATE.y, FACE + PLATE.depth / 2]}
            material={materials.plate}
          />
          <mesh
            position={[SLAB.width / 2, SLAB.height / 2, FACE + PLATE.depth + 0.001]}
            material={materials.engraving}
            raycast={noRaycast}
          >
            <planeGeometry args={[SLAB.width, SLAB.height]} />
          </mesh>

          {/* The handle: a rose on the stile and a lever off the front of it,
              pointing back towards the hinge the way a lever does. Six sides
              rather than a smooth lathe: at two blocks wide on screen a rounder
              form spends its triangles describing a highlight the posterise step
              quantises away, and the flats catch the key light more crisply.

              The rose is fixed and only the lever turns, which is why they are
              two objects rather than one group. Spinning the rose with it would
              be free, and would put a six-sided plate visibly rotating on the
              door — the one part of a handle that is screwed to the stile. */}
          <mesh
            position={[HANDLE.x, HANDLE.y, FACE + HANDLE.reach / 2]}
            rotation={[Math.PI / 2, 0, 0]}
            material={materials.steel}
          >
            <cylinderGeometry args={[HANDLE.rose, HANDLE.rose, HANDLE.reach, 6]} />
          </mesh>
          {/* Hung off the spindle rather than off its own centre, so a rotation
              about Z is the lever turning in the rose instead of the bar
              tumbling end over end. Local -X runs from the spindle out to the
              free end, so positive Z takes that end down — the direction a
              hand pushes a lever. */}
          <group ref={lever} position={[HANDLE.x, HANDLE.y, FACE + HANDLE.reach]}>
            <Block
              size={[HANDLE.lever, HANDLE.bar, HANDLE.bar]}
              position={[-HANDLE.lever / 2 + HANDLE.rose / 2, 0, HANDLE.bar / 2]}
              material={materials.steel}
            />
          </group>
        </group>
      </group>

      {/* Half the room's divisor, because this is a close-up: see `DOOR_GRID`. */}
      <PixelationPass divisor={2} colorLevels={26} vignette={0.5} />
    </>
  )
}

export function IntroDoor({ onOpen }: { onOpen: () => void }) {
  return (
    <Canvas
      flat
      dpr={[1, 2]}
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
      camera={{ fov: INTRO_FOV, near: 0.05, far: 40, position: CAMERA_START }}
      onCreated={(state) => {
        state.gl.setClearColor(PALETTE.black, 1)
        state.gl.shadowMap.enabled = false
      }}
    >
      <DoorScene onOpen={onOpen} />
    </Canvas>
  )
}
