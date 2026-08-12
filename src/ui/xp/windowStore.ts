import { create } from 'zustand'
import { APPS, type AppId } from './apps'

export interface WindowInstance {
  id: string
  appId: AppId
  x: number
  y: number
  width: number
  height: number
  z: number
  minimized: boolean
  maximized: boolean
}

interface WindowState {
  windows: WindowInstance[]
  focusedId: string | null
  nextZ: number
  /** Cascade offset so successive windows don't stack exactly on top. */
  spawnIndex: number

  open: (appId: AppId) => void
  close: (id: string) => void
  focus: (id: string) => void
  minimize: (id: string) => void
  restore: (id: string) => void
  toggleMaximize: (id: string) => void
  move: (id: string, x: number, y: number) => void
  closeAll: () => void
}

let instanceCounter = 0

const CASCADE_STEP = 26
const CASCADE_WRAP = 5

export const useWindowStore = create<WindowState>((set, get) => ({
  windows: [],
  focusedId: null,
  nextZ: 1,
  spawnIndex: 0,

  open: (appId) => {
    const definition = APPS[appId]
    const { windows, spawnIndex } = get()

    // Singleton apps focus (and un-minimise) the existing window instead of
    // spawning a duplicate — two Terminal.exes would be a bug, not a feature.
    if (definition.singleton) {
      const existing = windows.find((w) => w.appId === appId)
      if (existing) {
        set((state) => ({
          windows: state.windows.map((w) =>
            w.id === existing.id ? { ...w, minimized: false, z: state.nextZ } : w,
          ),
          focusedId: existing.id,
          nextZ: state.nextZ + 1,
        }))
        return
      }
    }

    instanceCounter += 1
    const offset = (spawnIndex % CASCADE_WRAP) * CASCADE_STEP
    const instance: WindowInstance = {
      id: `${appId}-${instanceCounter}`,
      appId,
      x: 46 + offset,
      y: 30 + offset,
      width: definition.defaultSize.width,
      height: definition.defaultSize.height,
      z: get().nextZ,
      minimized: false,
      maximized: false,
    }

    set((state) => ({
      windows: [...state.windows, instance],
      focusedId: instance.id,
      nextZ: state.nextZ + 1,
      spawnIndex: state.spawnIndex + 1,
    }))
  },

  close: (id) =>
    set((state) => {
      const windows = state.windows.filter((w) => w.id !== id)
      // Focus falls to whatever was most recently on top, not to nothing.
      const top = windows.filter((w) => !w.minimized).sort((a, b) => b.z - a.z)[0]
      return { windows, focusedId: state.focusedId === id ? (top?.id ?? null) : state.focusedId }
    }),

  focus: (id) =>
    set((state) => {
      if (state.focusedId === id) {
        const target = state.windows.find((w) => w.id === id)
        if (target && !target.minimized) return state
      }
      return {
        windows: state.windows.map((w) =>
          w.id === id ? { ...w, z: state.nextZ, minimized: false } : w,
        ),
        focusedId: id,
        nextZ: state.nextZ + 1,
      }
    }),

  minimize: (id) =>
    set((state) => {
      const windows = state.windows.map((w) => (w.id === id ? { ...w, minimized: true } : w))
      const top = windows.filter((w) => !w.minimized).sort((a, b) => b.z - a.z)[0]
      return { windows, focusedId: top?.id ?? null }
    }),

  restore: (id) => get().focus(id),

  toggleMaximize: (id) =>
    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === id ? { ...w, maximized: !w.maximized, z: state.nextZ } : w,
      ),
      focusedId: id,
      nextZ: state.nextZ + 1,
    })),

  move: (id, x, y) =>
    set((state) => ({
      windows: state.windows.map((w) => (w.id === id ? { ...w, x, y } : w)),
    })),

  closeAll: () => set({ windows: [], focusedId: null, spawnIndex: 0 }),
}))
