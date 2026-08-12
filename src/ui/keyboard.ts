/**
 * True when a key event originated from somewhere the visitor is typing.
 *
 * Several overlays listen for keys on `window` — the dialogue box advances on
 * Enter/Space, the room chrome mutes on M. Those listeners are global, so
 * without this guard they fire while the visitor is typing into Terminal.exe:
 * Enter advances the narrator instead of running the command, and because the
 * dialogue handler calls `preventDefault`, the space bar stops inserting
 * spaces at all.
 */
export function isTypingTarget(event: Event): boolean {
  const target = event.target as HTMLElement | null
  if (!target) return false

  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return target.isContentEditable
}
