import { create } from 'zustand'
import { ChiptunePlayer, TRACKS } from './chiptune'
import { unlockAudio } from './engine'
import { playCoin, playMotor, playSfx } from './sfx'

/**
 * Where the cabinet's mechanism is in its cycle.
 *
 * Modelled after what a carousel machine actually does, which is four distinct
 * moves and not one: the magazine indexes to the chosen record *first*, and
 * only then does the gripper motor run; the gripper lifts the disc clear and
 * carries it to the turntable; the pickup drops. Sound follows the mechanism
 * rather than the click, so pressing a selection starts a machine rather than a
 * track.
 *
 * The phase lives here and not in <JukeboxMechanism> for two reasons. The
 * moment audio starts is a property of the cycle, so the thing that owns the
 * cycle has to own the timing. And the panel needs to say "wait" during it,
 * which it cannot do if the only copy of that fact is inside the 3D layer.
 */
export type MechPhase = 'idle' | 'indexing' | 'lifting' | 'cueing' | 'playing' | 'returning'

/**
 * How long each move takes, in milliseconds. Exported because the mechanism
 * tweens against these exact numbers — two copies of a duration is two things
 * to keep in step, and the one that drifts is always the animation.
 *
 * Tuned to about two seconds end to end. Long enough that the moves read as
 * separate, short enough that pressing a track and hearing nothing does not
 * feel like a bug — which is the whole risk of putting a machine in front of a
 * play button.
 */
export const PHASE_MS: Record<Exclude<MechPhase, 'idle' | 'playing'>, number> = {
  indexing: 700,
  lifting: 780,
  cueing: 460,
  returning: 720,
}

/** The stylus lands before the cue finishes, not at the end of it. */
const NEEDLE_LEAD_MS = 170

/**
 * The player instance is module-scoped rather than stored in state: it holds
 * live Web Audio nodes and a scheduler handle, neither of which should be
 * compared or replaced on re-render.
 */
let player: ChiptunePlayer | null = null

function getPlayer(): ChiptunePlayer {
  if (!player) player = new ChiptunePlayer()
  return player
}

/**
 * One timer for the whole cycle, cleared by every command.
 *
 * Each step schedules the next, so at most one is ever pending — and any new
 * instruction cancels whatever the machine was about to do next, which is what
 * stops a half-finished cycle from starting a track nobody asked for.
 */
let timer: ReturnType<typeof setTimeout> | null = null

function schedule(ms: number, run: () => void): void {
  if (timer !== null) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    run()
  }, ms)
}

function cancel(): void {
  if (timer !== null) clearTimeout(timer)
  timer = null
}

/** True while a disc is out of the magazine, so the wheel must not turn. */
function discIsOut(phase: MechPhase): boolean {
  return phase !== 'idle' && phase !== 'indexing'
}

interface JukeboxState {
  /** Which disc the magazine is indexed to — i.e. what the mechanism believes. */
  trackIndex: number
  /**
   * A selection accepted but not yet loaded, held while the previous disc goes
   * back. The panel highlights this so a press lights up immediately; the
   * mechanism ignores it, because until the magazine is empty again there is
   * nothing it can do about it.
   */
  queued: number | null
  phase: MechPhase
  /** Audio is running. Strictly narrower than "the machine is busy". */
  isPlaying: boolean

  /** Load and play a track, mechanism first. The one way in. */
  request: (index: number) => void
  stop: () => void
  toggle: () => void
  next: () => void
  previous: () => void
}

export const useJukeboxStore = create<JukeboxState>((set, get) => {
  /** Index the magazine, then run the gripper, then cue, then start. */
  function loadCycle(): void {
    set({ phase: 'indexing' })
    playSfx('clunk')
    playMotor(PHASE_MS.indexing / 1000)

    schedule(PHASE_MS.indexing, () => {
      set({ phase: 'lifting' })
      playSfx('latch')
      playMotor(PHASE_MS.lifting / 1000)

      schedule(PHASE_MS.lifting, () => {
        set({ phase: 'cueing' })
        playSfx('clunk')

        schedule(PHASE_MS.cueing - NEEDLE_LEAD_MS, () => {
          playSfx('needle')

          schedule(NEEDLE_LEAD_MS, () => {
            const instance = getPlayer()
            instance.setTrack(TRACKS[get().trackIndex])
            instance.start()
            set({ phase: 'playing', isPlaying: true })
          })
        })
      })
    })
  }

  /** Put whatever is on the turntable back before touching the magazine. */
  function returnDisc(then: () => void): void {
    set({ phase: 'returning' })
    playSfx('latch')
    playMotor(PHASE_MS.returning / 1000)
    schedule(PHASE_MS.returning, then)
  }

  return {
    trackIndex: 0,
    queued: null,
    phase: 'idle',
    isPlaying: false,

    request: (index) => {
      unlockAudio()
      cancel()
      getPlayer().stop()

      // The coin goes in when the selection is accepted, whether that came from
      // a title strip or from the skip keys — a real machine wants paying for
      // each play, not for each visit. It rattles over the top of the indexing
      // motor, which is fine: the strikes are up at 1–2.5kHz and the motor is a
      // 40Hz buzz under an 800Hz whine, so they never sit on each other.
      playCoin()

      const wasOut = discIsOut(get().phase)
      set({ queued: index, isPlaying: false })

      // `trackIndex` only moves once the magazine is free to turn. Setting it up
      // front would index the wheel with a disc still lifted out of it, and the
      // empty slot would arrive back under a disc that had rotated away.
      const start = () => {
        set({ trackIndex: index, queued: null })
        loadCycle()
      }

      if (wasOut) returnDisc(start)
      else start()
    },

    stop: () => {
      cancel()
      getPlayer().stop()

      const wasOut = discIsOut(get().phase)
      set({ isPlaying: false, queued: null })

      if (wasOut) returnDisc(() => set({ phase: 'idle' }))
      else set({ phase: 'idle' })
    },

    toggle: () => {
      const { phase, trackIndex, request, stop } = get()
      if (phase === 'idle') request(trackIndex)
      else stop()
    },

    next: () => get().request((get().trackIndex + 1) % TRACKS.length),

    previous: () => get().request((get().trackIndex - 1 + TRACKS.length) % TRACKS.length),
  }
})
