import { create } from 'zustand'

export interface SayOptions {
  /** Drop anything currently queued and start this immediately. */
  interrupt?: boolean
  /**
   * Transient lines auto-dismiss once fully typed and never wait for input —
   * used for hover flavour, which shouldn't demand a click to clear.
   */
  transient?: boolean
  /**
   * Cinematic lines own the whole screen: nothing else can be clicked or
   * hovered until the sequence has been read and dismissed. Used for the intro,
   * where letting the visitor click a hotspot mid-sentence would talk over the
   * narrator. The lock lifts when the last line is dismissed.
   */
  lock?: boolean
  /**
   * Ambient lines are triggered by where the pointer happens to be rather than
   * by anything the visitor did on purpose, so they yield: if the box is
   * already showing something, the line is dropped outright.
   *
   * Dropped, not queued — that is the whole point. Sweeping the pointer across
   * the room shouldn't cut the narrator off mid-sentence, and it shouldn't bank
   * a backlog of flavour the visitor then has to sit through either.
   */
  ambient?: boolean
}

interface DialogueState {
  /** The line currently being typed out, or null when the box is hidden. */
  current: string | null
  queue: string[]
  transient: boolean
  /** Flips to true when the typewriter reaches the end of `current`. */
  complete: boolean
  /**
   * True while a `lock: true` sequence is on screen — the overlay swallows
   * every pointer and key event until it is dismissed.
   */
  locked: boolean

  /** Returns false when the line was refused (see `SayOptions.ambient`). */
  say: (lines: string | string[], options?: SayOptions) => boolean
  /** Advance to the next queued line, or close the box if none remain. */
  advance: () => void
  markComplete: () => void
  clear: () => void
}

export const useDialogueStore = create<DialogueState>((set, get) => ({
  current: null,
  queue: [],
  transient: false,
  complete: false,
  locked: false,

  say: (lines, options = {}) => {
    const incoming = (Array.isArray(lines) ? lines : [lines]).filter(Boolean)
    if (incoming.length === 0) return false

    // The box is busy for as long as a line is on screen — including the beat a
    // transient line lingers after it finishes typing. Ambient callers wait for
    // it to be genuinely empty, which rate-limits hover flavour to one line per
    // read rather than one line per pixel of mouse movement.
    if (options.ambient && get().current !== null) return false

    if (options.interrupt || get().current === null) {
      const [first, ...rest] = incoming
      set({
        current: first,
        queue: rest,
        transient: options.transient ?? false,
        complete: false,
        locked: options.lock ?? false,
      })
      return true
    }

    // Appending to a running sequence: a locking line can raise the lock, but a
    // plain one must never lower it — the lock belongs to whichever line asked
    // for it and only lifts when the box closes.
    set({ queue: [...get().queue, ...incoming], locked: get().locked || (options.lock ?? false) })
    return true
  },

  advance: () => {
    const { queue } = get()
    if (queue.length === 0) {
      set({ current: null, queue: [], complete: false, transient: false, locked: false })
      return
    }
    const [next, ...rest] = queue
    set({ current: next, queue: rest, complete: false })
  },

  markComplete: () => set({ complete: true }),

  clear: () =>
    set({ current: null, queue: [], complete: false, transient: false, locked: false }),
}))
