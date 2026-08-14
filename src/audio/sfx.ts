import { getContext, getMasterGain } from './engine'

export type SfxName =
  | 'hover'
  | 'select'
  | 'back'
  | 'blip'
  | 'error'
  | 'pickup'
  /* The jukebox's mechanism. These three are noise, not tone: a solenoid, a
     latch and a stylus have no pitch, and an oscillator asked to play one
     comes out as a beep pretending to be a machine. */
  | 'clunk'
  | 'clack'
  | 'latch'
  | 'needle'
  | 'tick'

interface ToneSpec {
  frequency: number
  /** Ratio applied to `frequency` at the end of the envelope. */
  bend?: number
  duration: number
  type: OscillatorType
  gain: number
}

interface NoiseSpec {
  filter: BiquadFilterType
  frequency: number
  q: number
  /** Ratio applied to the filter frequency across the envelope. */
  sweep?: number
  duration: number
  gain: number
  /** A sine thump underneath, for the sounds that have mass behind them. */
  thump?: { frequency: number; gain: number }
  /**
   * A bright contact transient on top.
   *
   * Not decoration. The first cut of the key press was body and thump only —
   * everything under 500Hz — and it was inaudible on laptop speakers, which
   * roll off exactly where it lived. What you actually hear when a switch
   * closes is the snap; the body is what you feel.
   */
  snap?: { frequency: number; duration: number; gain: number }
}

const NOISE_SPECS: Record<'clunk' | 'clack' | 'latch' | 'needle' | 'tick', NoiseSpec> = {
  /** A relay dropping, or a record seating on the platter. Inside the cabinet,
      so it is duller than a key under your finger — but it still gets a snap,
      or it disappears under the music entirely. */
  clunk: {
    filter: 'lowpass',
    frequency: 520,
    q: 1.1,
    sweep: 0.35,
    duration: 0.12,
    gain: 0.4,
    thump: { frequency: 74, gain: 0.16 },
    snap: { frequency: 2100, duration: 0.02, gain: 0.09 },
  },
  /** A transport key under a finger: the switch closing, then the body of the
      key hitting its stop. Brighter and shorter than the mechanism's `clunk`,
      because this one happens on the outside of the cabinet. */
  clack: {
    filter: 'lowpass',
    frequency: 900,
    q: 0.9,
    sweep: 0.3,
    duration: 0.075,
    gain: 0.34,
    thump: { frequency: 128, gain: 0.11 },
    snap: { frequency: 3000, duration: 0.028, gain: 0.3 },
  },
  /** The gripper closing. Bright, brief, no body. */
  latch: { filter: 'bandpass', frequency: 2700, q: 1.8, duration: 0.05, gain: 0.2 },
  /** The stylus landing — the one sound that has to read as contact rather
      than as a switch, so it decays over a much longer tail. */
  needle: { filter: 'highpass', frequency: 2400, q: 0.7, sweep: 0.45, duration: 0.2, gain: 0.11 },
  /**
   * The cabinet's hover.
   *
   * Deliberately not the room's `hover`, which is a square-wave beep — right
   * for a corkboard note, wrong for a machine made of springs and relays. This
   * is a dry contact tick, and it is quiet: it fires whenever the pointer
   * crosses a key or a title strip, so anything with a tail would stack into a
   * rattle as the pointer moves down the rack.
   */
  tick: { filter: 'bandpass', frequency: 1750, q: 2.4, duration: 0.028, gain: 0.085 },
}

/**
 * A half-second of white noise, generated once and looped by every noise voice.
 *
 * Regenerated if the context's sample rate changes, which happens when the page
 * moves between output devices — a buffer built for 48kHz played at 44.1 is
 * still noise, but the filter frequencies stop meaning what they say.
 */
let noiseBuffer: AudioBuffer | null = null

function getNoise(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer

  const length = Math.floor(ctx.sampleRate * 0.5)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1

  noiseBuffer = buffer
  return buffer
}

const SPECS: Record<Exclude<SfxName, 'blip' | keyof typeof NOISE_SPECS>, ToneSpec> = {
  hover: { frequency: 880, duration: 0.045, type: 'square', gain: 0.06 },
  select: { frequency: 520, bend: 1.6, duration: 0.13, type: 'square', gain: 0.11 },
  back: { frequency: 440, bend: 0.62, duration: 0.14, type: 'square', gain: 0.1 },
  error: { frequency: 180, bend: 0.75, duration: 0.22, type: 'sawtooth', gain: 0.09 },
  pickup: { frequency: 660, bend: 2.0, duration: 0.18, type: 'triangle', gain: 0.12 },
}

/**
 * Blip pitches for the dialogue typewriter (plan §8).
 *
 * Two variants rather than one: a single fixed pitch reads as a machine, and
 * the caller alternates between them with a small random detune so repeated
 * lines don't sound identical.
 */
const BLIP_PITCHES = [740, 620]
let blipIndex = 0

function playTone(spec: ToneSpec): void {
  const ctx = getContext()
  const master = getMasterGain()
  if (!ctx || !master || ctx.state !== 'running') return

  const now = ctx.currentTime
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()

  oscillator.type = spec.type
  oscillator.frequency.setValueAtTime(spec.frequency, now)
  if (spec.bend) {
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(20, spec.frequency * spec.bend),
      now + spec.duration,
    )
  }

  // Tiny attack avoids the click a hard gate produces at these durations.
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(spec.gain, now + 0.005)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + spec.duration)

  oscillator.connect(gain)
  gain.connect(master)
  oscillator.start(now)
  oscillator.stop(now + spec.duration + 0.02)
}

/* A predicate rather than a bare `in` check: the negative branch has to narrow
   too, or the tone lookup below stops type-checking against its own table. */
function isNoise(name: SfxName): name is keyof typeof NOISE_SPECS {
  return name in NOISE_SPECS
}

function playNoise(spec: NoiseSpec): void {
  const ctx = getContext()
  const master = getMasterGain()
  if (!ctx || !master || ctx.state !== 'running') return

  const now = ctx.currentTime
  const source = ctx.createBufferSource()
  source.buffer = getNoise(ctx)
  source.loop = true

  const filter = ctx.createBiquadFilter()
  filter.type = spec.filter
  filter.Q.value = spec.q
  filter.frequency.setValueAtTime(spec.frequency, now)
  if (spec.sweep) {
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(40, spec.frequency * spec.sweep),
      now + spec.duration,
    )
  }

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(spec.gain, now + 0.004)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + spec.duration)

  source.connect(filter)
  filter.connect(gain)
  gain.connect(master)
  source.start(now)
  source.stop(now + spec.duration + 0.02)

  if (spec.snap) {
    const snap = ctx.createBufferSource()
    snap.buffer = getNoise(ctx)
    snap.loop = true
    const snapFilter = ctx.createBiquadFilter()
    snapFilter.type = 'highpass'
    snapFilter.Q.value = 0.7
    snapFilter.frequency.value = spec.snap.frequency
    const snapGain = ctx.createGain()
    snapGain.gain.setValueAtTime(spec.snap.gain, now)
    snapGain.gain.exponentialRampToValueAtTime(0.0001, now + spec.snap.duration)
    snap.connect(snapFilter)
    snapFilter.connect(snapGain)
    snapGain.connect(master)
    snap.start(now)
    snap.stop(now + spec.snap.duration + 0.02)
  }

  if (!spec.thump) return

  const thump = ctx.createOscillator()
  const thumpGain = ctx.createGain()
  thump.type = 'sine'
  thump.frequency.setValueAtTime(spec.thump.frequency, now)
  thump.frequency.exponentialRampToValueAtTime(spec.thump.frequency * 0.6, now + spec.duration)
  thumpGain.gain.setValueAtTime(spec.thump.gain, now)
  thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + spec.duration)
  thump.connect(thumpGain)
  thumpGain.connect(master)
  thump.start(now)
  thump.stop(now + spec.duration + 0.02)
}

/**
 * A coin going in: four strikes down the chute, then the box.
 *
 * Struck metal is not a pitched note, so each strike is three sine partials at
 * inharmonic ratios rather than one tone with harmonics — that is the whole
 * difference between a coin and a bell. The strikes are unevenly spaced and
 * unevenly pitched on purpose; four equal taps read as a countdown, and the
 * last one drops both in pitch and in brightness because by then it has stopped
 * falling and landed.
 */
const COIN_STRIKES = [
  { at: 0, frequency: 1850, gain: 0.15, duration: 0.09 },
  { at: 0.072, frequency: 2450, gain: 0.11, duration: 0.07 },
  { at: 0.158, frequency: 1560, gain: 0.13, duration: 0.11 },
  { at: 0.256, frequency: 980, gain: 0.1, duration: 0.19 },
]

/** Ratios off the fundamental, with how much of the strike each one carries. */
const COIN_PARTIALS: Array<[number, number]> = [
  [1, 1],
  [2.41, 0.5],
  [4.13, 0.24],
]

export function playCoin(): void {
  const ctx = getContext()
  const master = getMasterGain()
  if (!ctx || !master || ctx.state !== 'running') return

  const now = ctx.currentTime

  for (const strike of COIN_STRIKES) {
    const at = now + strike.at

    for (const [ratio, share] of COIN_PARTIALS) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(strike.frequency * ratio, at)
      gain.gain.setValueAtTime(0, at)
      gain.gain.linearRampToValueAtTime(strike.gain * share, at + 0.003)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + strike.duration)
      osc.connect(gain)
      gain.connect(master)
      osc.start(at)
      osc.stop(at + strike.duration + 0.02)
    }

    // The scrape of the edge on the chute wall, under each strike.
    const scrape = ctx.createBufferSource()
    scrape.buffer = getNoise(ctx)
    scrape.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.Q.value = 2.2
    filter.frequency.value = strike.frequency * 1.4
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(strike.gain * 0.4, at)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.035)
    scrape.connect(filter)
    filter.connect(gain)
    gain.connect(master)
    scrape.start(at)
    scrape.stop(at + 0.06)
  }
}

/**
 * The transport motor: a low buzz under a band of noise, spun up and back down
 * over `seconds`.
 *
 * Takes its length from the caller rather than looping with a stop handle,
 * because every use of it is a mechanism phase whose duration the jukebox store
 * already knows. A one-shot of a known length cannot outlive the move it is
 * scoring, which a start/stop pair can whenever a phase is cut short.
 */
export function playMotor(seconds: number): void {
  const ctx = getContext()
  const master = getMasterGain()
  if (!ctx || !master || ctx.state !== 'running') return

  const now = ctx.currentTime
  const duration = Math.min(3, Math.max(0.12, seconds))
  const spinUp = Math.min(0.09, duration * 0.25)
  const spinDown = Math.min(0.14, duration * 0.3)

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(0.075, now + spinUp)
  gain.gain.setValueAtTime(0.075, now + duration - spinDown)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
  gain.connect(master)

  // Armature buzz. Sawtooth through a lowpass rather than a sine: a motor is
  // harmonics, and a sine at this pitch is felt more than heard.
  const buzz = ctx.createOscillator()
  buzz.type = 'sawtooth'
  buzz.frequency.setValueAtTime(34, now)
  buzz.frequency.linearRampToValueAtTime(47, now + spinUp)
  buzz.frequency.setValueAtTime(47, now + duration - spinDown)
  buzz.frequency.linearRampToValueAtTime(31, now + duration)

  const buzzFilter = ctx.createBiquadFilter()
  buzzFilter.type = 'lowpass'
  buzzFilter.frequency.value = 240
  buzz.connect(buzzFilter)
  buzzFilter.connect(gain)

  // Gear whine over the top, so it reads as something turning rather than
  // something humming.
  const whine = ctx.createBufferSource()
  whine.buffer = getNoise(ctx)
  whine.loop = true
  const whineFilter = ctx.createBiquadFilter()
  whineFilter.type = 'bandpass'
  whineFilter.Q.value = 4.5
  whineFilter.frequency.setValueAtTime(620, now)
  whineFilter.frequency.linearRampToValueAtTime(940, now + spinUp)
  whineFilter.frequency.setValueAtTime(940, now + duration - spinDown)
  whineFilter.frequency.linearRampToValueAtTime(560, now + duration)
  const whineGain = ctx.createGain()
  whineGain.gain.value = 0.5
  whine.connect(whineFilter)
  whineFilter.connect(whineGain)
  whineGain.connect(gain)

  buzz.start(now)
  whine.start(now)
  buzz.stop(now + duration + 0.02)
  whine.stop(now + duration + 0.02)
}

/* Sampled one-shots ---------------------------------------------------------
 *
 * Everything above is synthesised, and deliberately: a beep, a relay or a coin
 * is a handful of numbers, and shipping a recording of one is a network request
 * for something an oscillator already does exactly. A door is the other way
 * round. It is a latch letting go, a stile flexing and a dry hinge, none of
 * them periodic and none of them separable, and the synthesised version was
 * three voices each approximating a different part of one event.
 */

/**
 * Encoded bytes, by URL — kept apart from the decode below so that pulling a
 * sample down early does not drag an AudioContext into existence with it. The
 * page can prefetch on mount; the context still waits for the gesture that is
 * allowed to create it.
 */
const encodedSamples = new Map<string, Promise<ArrayBuffer | null>>()
/** Decoded buffers, by URL. `decodeAudioData` detaches what it is handed, so
 *  this promise is the one-and-only decode of each file. */
const decodedSamples = new Map<string, Promise<AudioBuffer | null>>()

export function prefetchSample(url: string): void {
  if (encodedSamples.has(url)) return
  encodedSamples.set(
    url,
    fetch(url)
      .then((response) => (response.ok ? response.arrayBuffer() : null))
      .catch(() => null),
  )
}

/** Null for anything that failed to arrive or failed to decode. Callers are
 *  expected to have something to fall back to rather than go silent. */
export function loadSample(url: string): Promise<AudioBuffer | null> {
  const cached = decodedSamples.get(url)
  if (cached) return cached

  prefetchSample(url)
  const pending = (encodedSamples.get(url) as Promise<ArrayBuffer | null>).then(async (bytes) => {
    const ctx = getContext()
    if (!bytes || !ctx) return null
    try {
      return await ctx.decodeAudioData(bytes)
    } catch {
      return null
    }
  })

  decodedSamples.set(url, pending)
  return pending
}

function playSample(buffer: AudioBuffer, gain: number): void {
  const ctx = getContext()
  const master = getMasterGain()
  if (!ctx || !master || ctx.state !== 'running') return

  const level = ctx.createGain()
  level.gain.value = gain
  level.connect(master)

  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.connect(level)
  source.start(ctx.currentTime)
}

/**
 * The door being opened, as one recording of the whole gesture.
 *
 * One sample rather than a cue per beat, because the beats are already in it
 * and they land where the animation puts them: the mechanism rattles for the
 * first fifth of a second, which is exactly `latch` and the lever going over;
 * the bolt lets go at about a quarter of a second, which is where `swing`
 * starts; and the rest is the leaf moving, decaying out around where it reaches
 * its stop. So it is fired on the press and then left alone — nothing here is
 * retimed against the door, and nothing is layered over it. Two doors opening
 * at once is the one mistake in this that would be audible on any speaker.
 */
const DOOR_OPEN = '/assets/audio/open-door.mp3'

/**
 * Held well under unity.
 *
 * The file is mastered to a hair under full scale, and everything else in this
 * room was authored quiet — through the 0.35 master a recording at unity opens
 * the page a good deal louder than anything the visitor meets afterwards.
 *
 * Tuned down by ear from there. The bolt letting go is a single full-scale
 * transient a quarter of a second in, and it is the loudest thing in the
 * session by some way: set where the body of the door sat comfortably, that one
 * spike still arrived as a crack. This is that spike's level, and the rest of
 * the door came down with it.
 */
const DOOR_OPEN_GAIN = 0.12

/** Call on mount, so the click is not waiting on the network. */
export function prefetchDoorOpen(): void {
  prefetchSample(DOOR_OPEN)
}

/** Call from the press, once `unlockAudio` has resolved. */
export function playDoorOpen(): void {
  void loadSample(DOOR_OPEN).then((buffer) => {
    // A door that made no sound at all would read as the click having missed.
    // The synthesised latch is not the recording, but it is the press.
    if (!buffer) {
      playSfx('latch')
      return
    }
    playSample(buffer, DOOR_OPEN_GAIN)
  })
}

export function playSfx(name: SfxName): void {
  if (isNoise(name)) {
    playNoise(NOISE_SPECS[name])
    return
  }

  if (name === 'blip') {
    const base = BLIP_PITCHES[blipIndex % BLIP_PITCHES.length]
    blipIndex += 1
    playTone({
      frequency: base * (0.97 + Math.random() * 0.06),
      duration: 0.035,
      type: 'square',
      gain: 0.05,
    })
    return
  }

  playTone(SPECS[name])
}
