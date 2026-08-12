import { useWindowStore } from './windowStore'
import type { AppId } from './apps'

/**
 * True when this app owns the focused window.
 *
 * The games bind their controls to `window`, so without this check Snake would
 * eat the arrow keys while the visitor is scrolling history in Terminal.exe,
 * and Contra would keep responding to the space bar from behind a window it
 * isn't even on top of. Every app is a singleton, so matching on `appId` is
 * enough to identify "my window".
 */
export function useAppFocused(appId: AppId): boolean {
  return useWindowStore((state) => {
    const focused = state.windows.find((w) => w.id === state.focusedId)
    return focused?.appId === appId && !focused.minimized
  })
}
