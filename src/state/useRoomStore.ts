import { create } from 'zustand'
import { HOTSPOTS, INTRO_LINES } from '@/hotspots/hotspots'
import type { HotspotId } from '@/hotspots/types'
import { PROJECTS } from '@/content/projects'
// Static on purpose. Was `void import(...)` in five places — but <DialogueBox>
// is a static import in <App>, so this module already sat in the entry chunk.
// Split bought nothing, cost a microtask per hover, and let state move between
// the set() and the line. It reads only zustand, so no cycle.
import { useDialogueStore } from './useDialogueStore'

/**
 * The opening sequence, one beat per value.
 *
 * `door` — a closed door, facing the visitor, waiting to be opened.
 * `opening` — the leaf swings, the camera walks through it, and the frame goes
 *   to black. The room is mounted for this whole beat, behind the door, so it
 *   has finished compiling by the time anyone can see it.
 * `room` — the black lifts, the narrator starts.
 *
 * They only ever run forwards. Nothing puts the visitor back on the door. The
 * beats *inside* `opening` — the swing, the black, the hold — belong to the
 * overlay that draws them and are not modelled here.
 */
export type Stage = 'door' | 'opening' | 'room'

interface RoomState {
  stage: Stage

  /** Null means the camera is at (or heading to) the home isometric state. */
  focused: HotspotId | null
  hovered: HotspotId | null

  /**
   * The shelf row currently pulled open, by project id — a second level of
   * focus that only exists inside the bookshelf. Each row of the shelf *is* a
   * project, so opening one is a camera move to that row, not a modal.
   */
  shelfProject: string | null
  /** The row under the pointer (or the keyboard cursor), by index. */
  shelfCursor: number | null

  /** True once the camera tween has finished; panels wait for this. */
  cameraSettled: boolean

  /** Hotspots the visitor has already focused, for first-visit-only copy. */
  visited: Set<HotspotId>
  /** Hotspots whose hover line has already played, so it plays only once. */
  hoverLinesPlayed: Set<HotspotId>

  /** Blocks hotspot input while a modal-ish panel owns the pointer. */
  inputLocked: boolean

  /**
   * True once the room's canvas has actually drawn a frame.
   *
   * The intro's black hold waits on this. Normally it is long since true —
   * the room mounts when the door starts moving and has the whole swing to
   * compile — but a visitor who cuts the swing short reaches the black in a
   * couple of hundred ms, and lifting it then uncovers a page with no room
   * painted on it yet.
   */
  scenePainted: boolean

  /**
   * One-way latch: the curtains are drawn across the window until the visitor
   * first looks at it, then stay open for the rest of the session.
   *
   * Deliberately not a toggle. The point is the reveal — the storm is hidden
   * behind fabric, leaking through the crack, until you go near it once. A
   * curtain that could close again would turn a moment into a switch.
   */
  curtainsOpen: boolean

  /**
   * Whether the CRT is powered. Flipped by the power button modelled on the
   * monitor's bezel, which turns the tube off and walks you away from the desk.
   *
   * It stays off after you leave — you switched it off, so the room shows a
   * dark monitor — and comes back on when you next sit down, which is what the
   * screen's existing power-on flash was always there for.
   */
  monitorOn: boolean
  setMonitorOn: (on: boolean) => void

  /** Starts the swing. */
  openDoor: () => void
  /** The black lifts. */
  enterRoom: () => void
  focusHotspot: (id: HotspotId) => void
  returnHome: () => void
  /** One level out: an open shelf row first, then the room. */
  stepBack: () => void
  selectProject: (id: string | null) => void
  setShelfCursor: (index: number | null) => void
  setHovered: (id: HotspotId | null) => void
  setCameraSettled: (settled: boolean) => void
  setInputLocked: (locked: boolean) => void
  /** One-way latch, set by the canvas on its first drawn frame. */
  markScenePainted: () => void
}

/**
 * Camera/interaction state machine (plan §4).
 *
 * `focused` is the single source of truth for where the camera should be:
 * `null` → home, otherwise that hotspot's preset. The rig only ever reads it,
 * so there is no way for the camera to end up somewhere unnamed.
 *
 * Dialogue lives in its own store (`useDialogueStore`) and is driven from here
 * rather than the other way round — the dialogue box is a passive overlay that
 * renders whatever is queued (plan §4).
 */
export const useRoomStore = create<RoomState>((set, get) => ({
  stage: 'door',
  focused: null,
  hovered: null,
  shelfProject: null,
  shelfCursor: null,
  cameraSettled: true,
  visited: new Set(),
  hoverLinesPlayed: new Set(),
  inputLocked: false,
  scenePainted: false,
  curtainsOpen: false,
  monitorOn: true,

  markScenePainted: () => {
    if (!get().scenePainted) set({ scenePainted: true })
  },

  openDoor: () => {
    if (get().stage !== 'door') return
    set({ stage: 'opening' })
  },

  enterRoom: () => {
    if (get().stage === 'room') return
    set({ stage: 'room' })
    // Locked: the room shouldn't be touchable while the narrator is still
    // setting the scene — a hotspot click landing mid-intro interrupts its own
    // introduction (plan §8).
    useDialogueStore.getState().say(INTRO_LINES, { lock: true })
  },

  focusHotspot: (id) => {
    const { focused, visited, inputLocked } = get()
    if (inputLocked || focused === id) return

    const def = HOTSPOTS[id]
    const isRepeat = visited.has(id)
    const lines = (isRepeat && def.narrator.focusRepeat) || def.narrator.focus

    set({
      focused: id,
      hovered: null,
      shelfProject: null,
      shelfCursor: null,
      cameraSettled: false,
      visited: new Set(visited).add(id),
      // Also latched here, not only on hover: a click can arrive without a
      // preceding hover (touch, or a pointer that enters already over the
      // window), and arriving at the window to find it still curtained would
      // be the one way to miss the reveal entirely.
      curtainsOpen: get().curtainsOpen || id === 'window',
      // Sitting down at a monitor you switched off turns it back on. Anything
      // else would leave the PC hotspot looking broken to a visitor who does
      // not remember pressing the button.
      monitorOn: get().monitorOn || id === 'pc',
    })

    useDialogueStore.getState().say(lines, { interrupt: true })
  },

  returnHome: () => {
    if (get().focused === null) return
    set({ focused: null, hovered: null, shelfProject: null, shelfCursor: null, cameraSettled: false })
    useDialogueStore.getState().clear()
  },

  stepBack: () => {
    const { inputLocked, shelfProject, focused } = get()
    // A panel that owns the keyboard handles its own way out.
    if (inputLocked) return
    if (shelfProject !== null) {
      get().selectProject(null)
      return
    }
    if (focused !== null) get().returnHome()
  },

  /**
   * Opens (or closes) one row of the shelf. This is a camera move like any
   * other — `cameraSettled` drops so the case study waits for the lean-in,
   * exactly as hotspot panels wait for the dolly.
   */
  selectProject: (id) => {
    const { inputLocked, shelfProject, focused } = get()
    if (inputLocked || focused !== 'bookshelf' || shelfProject === id) return

    const project = id === null ? null : PROJECTS.find((p) => p.id === id)
    if (id !== null && !project) return

    set({
      shelfProject: id,
      shelfCursor: project ? PROJECTS.indexOf(project) : get().shelfCursor,
      cameraSettled: false,
    })

    if (!project) {
      useDialogueStore.getState().clear()
      return
    }
    useDialogueStore
      .getState()
      .say([`You slide ${project.title} off the shelf.`], { interrupt: true, transient: true })
  },

  setMonitorOn: (on) => {
    if (get().monitorOn === on) return
    set({ monitorOn: on })
  },

  setShelfCursor: (index) => {
    if (get().shelfCursor === index) return
    set({ shelfCursor: index })
  },

  setHovered: (id) => {
    const { hovered, focused, inputLocked, hoverLinesPlayed } = get()
    if (focused !== null || inputLocked) return
    if (hovered === id) return

    set({ hovered: id })
    if (id === null) return

    // Hover copy is one-shot per hotspot — repeating it every pass across the
    // room turns the narrator into wallpaper.
    const line = hoverLinesPlayed.has(id) ? null : HOTSPOTS[id].narrator.hover

    // The curtains and their line are one beat, not two: the copy narrates the
    // reveal as it happens. So the fabric must not move on a hover whose line
    // the narrator was too busy to take — that would spend the reveal in
    // silence and leave the line, whenever it finally lands, describing
    // something that already happened. Both wait for the next pass instead.
    const reveal = () => {
      if (id === 'window') set({ curtainsOpen: true })
    }

    // Nothing queued to sync with, so there is nothing to wait for.
    if (!line) {
      reveal()
      return
    }

    // Ambient: a pointer that drifts across three hotspots on its way
    // somewhere shouldn't fire three lines, and shouldn't cut off the one
    // that's still being read.
    const spoke = useDialogueStore.getState().say([line], { transient: true, ambient: true })
    if (!spoke) return
    // The latch only closes on a line that actually played, so one the
    // narrator was too busy to deliver is still waiting the next time the
    // pointer comes past.
    set({ hoverLinesPlayed: new Set(get().hoverLinesPlayed).add(id) })
    reveal()
  },

  setCameraSettled: (settled) => set({ cameraSettled: settled }),
  setInputLocked: (locked) => set({ inputLocked: locked }),
}))
