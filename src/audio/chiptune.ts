import { getContext, getMasterGain } from './engine'

/**
 * A tiny lookahead sequencer for original chiptune loops.
 *
 * Why synthesise rather than ship audio files: the plan leaves the jukebox
 * track list open (§15) and flags licensing as unresolved for any non-original
 * music (§5). Generated loops are original by construction, weigh nothing, and
 * let the jukebox be genuinely functional now. `TrackSource` keeps a `file`
 * variant so real tracks can be dropped in later without touching the player.
 *
 * Timing note: `setInterval` is far too jittery to sequence music directly, so
 * the interval only *schedules* — every note is queued against the
 * AudioContext clock, which is sample-accurate.
 */

const SCHEDULE_INTERVAL_MS = 25
const LOOKAHEAD_SECONDS = 0.12

export type Channel = 'lead' | 'bass' | 'hat'

export interface Note {
  /** Sixteenth-note index from the start of the loop. */
  step: number
  /** Scientific pitch, e.g. "A4". Ignored for the `hat` channel. */
  pitch?: string
  /** Length in sixteenths. */
  length: number
  channel: Channel
}

export interface ChiptuneTrack {
  id: string
  title: string
  artist: string
  bpm: number
  /** Loop length in sixteenths. */
  steps: number
  notes: Note[]
}

export type TrackSource =
  | { kind: 'sequence'; track: ChiptuneTrack }
  | { kind: 'file'; url: string }

const NOTE_OFFSETS: Record<string, number> = {
  C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5,
  'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11,
}

function pitchToFrequency(pitch: string): number {
  const match = /^([A-G]#?)(-?\d)$/.exec(pitch)
  if (!match) return 440
  const [, name, octave] = match
  const semitonesFromA4 = NOTE_OFFSETS[name] + (Number(octave) + 1) * 12 - 69
  return 440 * Math.pow(2, semitonesFromA4 / 12)
}

const CHANNEL_CONFIG: Record<Channel, { type: OscillatorType; gain: number }> = {
  lead: { type: 'square', gain: 0.13 },
  bass: { type: 'triangle', gain: 0.2 },
  hat: { type: 'square', gain: 0.05 },
}

export class ChiptunePlayer {
  private track: ChiptuneTrack | null = null
  private timer: number | null = null
  private nextStep = 0
  private nextNoteTime = 0
  private output: GainNode | null = null

  /** Swaps the loop without restarting playback, so tracks cross over cleanly. */
  setTrack(track: ChiptuneTrack): void {
    this.track = track
    this.nextStep = 0
  }

  start(): void {
    const ctx = getContext()
    const master = getMasterGain()
    if (!ctx || !master || !this.track) return
    if (this.timer !== null) return

    if (!this.output) {
      this.output = ctx.createGain()
      this.output.gain.value = 0.7
      this.output.connect(master)
    }

    this.nextStep = 0
    this.nextNoteTime = ctx.currentTime + 0.05
    this.timer = window.setInterval(() => this.schedule(), SCHEDULE_INTERVAL_MS)
  }

  stop(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer)
      this.timer = null
    }
  }

  dispose(): void {
    this.stop()
    this.output?.disconnect()
    this.output = null
  }

  private schedule(): void {
    const ctx = getContext()
    if (!ctx || !this.track || !this.output) return

    const secondsPerStep = 60 / this.track.bpm / 4

    while (this.nextNoteTime < ctx.currentTime + LOOKAHEAD_SECONDS) {
      const step = this.nextStep % this.track.steps
      for (const note of this.track.notes) {
        if (note.step === step) {
          this.playNote(ctx, note, this.nextNoteTime, secondsPerStep)
        }
      }
      this.nextNoteTime += secondsPerStep
      this.nextStep += 1
    }
  }

  private playNote(ctx: AudioContext, note: Note, time: number, secondsPerStep: number): void {
    const config = CHANNEL_CONFIG[note.channel]
    const duration = note.length * secondsPerStep * 0.9
    const gain = ctx.createGain()

    gain.gain.setValueAtTime(0, time)
    gain.gain.linearRampToValueAtTime(config.gain, time + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration)
    gain.connect(this.output!)

    if (note.channel === 'hat') {
      // Short filtered noise burst — a square wave can't make a convincing hat.
      const bufferSize = Math.floor(ctx.sampleRate * 0.05)
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1

      const source = ctx.createBufferSource()
      source.buffer = buffer
      const filter = ctx.createBiquadFilter()
      filter.type = 'highpass'
      filter.frequency.value = 7000
      source.connect(filter)
      filter.connect(gain)
      source.start(time)
      source.stop(time + duration)
      return
    }

    const oscillator = ctx.createOscillator()
    oscillator.type = config.type
    oscillator.frequency.setValueAtTime(pitchToFrequency(note.pitch ?? 'A4'), time)
    oscillator.connect(gain)
    oscillator.start(time)
    oscillator.stop(time + duration + 0.02)
  }
}

/** Compact helper for writing loops: "A4:2" → pitch A4, two sixteenths long. */
function line(channel: Channel, entries: Array<string | null>, stepOffset = 0): Note[] {
  const notes: Note[] = []
  entries.forEach((entry, index) => {
    if (!entry) return
    const [pitch, length] = entry.split(':')
    notes.push({
      channel,
      step: stepOffset + index,
      pitch: pitch || undefined,
      length: Number(length ?? 1),
    })
  })
  return notes
}

const R = null

export const TRACKS: ChiptuneTrack[] = [
  {
    id: 'basement-hours',
    title: 'Basement Hours',
    artist: 'house band',
    bpm: 104,
    steps: 32,
    notes: [
      ...line('bass', [
        'A2:2', R, R, R, 'A2:2', R, R, R, 'F2:2', R, R, R, 'F2:2', R, R, R,
        'C3:2', R, R, R, 'C3:2', R, R, R, 'G2:2', R, R, R, 'G2:2', R, R, R,
      ]),
      ...line('lead', [
        'E4:2', R, 'A4:2', R, 'C5:4', R, R, R, 'B4:2', R, 'A4:2', R, 'E4:4', R, R, R,
        'G4:2', R, 'C5:2', R, 'E5:4', R, R, R, 'D5:2', R, 'B4:2', R, 'G4:4', R, R, R,
      ]),
      ...line('hat', Array.from({ length: 32 }, (_, i) => (i % 2 === 0 ? ':1' : null))),
    ],
  },
  {
    id: 'crt-glow',
    title: 'CRT Glow',
    artist: 'house band',
    bpm: 126,
    steps: 32,
    notes: [
      ...line('bass', [
        'D2:1', R, 'D2:1', R, 'D2:1', R, 'A2:1', R, 'F2:1', R, 'F2:1', R, 'C3:1', R, 'A2:1', R,
        'D2:1', R, 'D2:1', R, 'D2:1', R, 'A2:1', R, 'G2:1', R, 'G2:1', R, 'A2:1', R, 'A2:1', R,
      ]),
      ...line('lead', [
        'D5:1', 'F5:1', 'A5:2', R, 'G5:1', 'F5:1', 'D5:2', R, 'A4:1', 'D5:1', 'F5:2', R, 'E5:2', R, R, R,
        'D5:1', 'F5:1', 'A5:2', R, 'C6:1', 'A5:1', 'G5:2', R, 'F5:1', 'E5:1', 'D5:4', R, R, R, R, R,
      ]),
      ...line('hat', Array.from({ length: 32 }, () => ':1')),
    ],
  },
  {
    id: 'four-am-commit',
    title: '4AM Commit',
    artist: 'house band',
    bpm: 88,
    steps: 32,
    notes: [
      ...line('bass', [
        'E2:4', R, R, R, R, R, R, R, 'C2:4', R, R, R, R, R, R, R,
        'G2:4', R, R, R, R, R, R, R, 'D2:4', R, R, R, R, R, R, R,
      ]),
      ...line('lead', [
        'B4:3', R, R, 'E5:3', R, R, 'D5:2', R, 'B4:6', R, R, R, R, R, R, R,
        'G4:3', R, R, 'C5:3', R, R, 'D5:2', R, 'E5:6', R, R, R, R, R, R, R,
      ]),
      ...line('hat', Array.from({ length: 32 }, (_, i) => (i % 4 === 0 ? ':1' : null))),
    ],
  },
]
