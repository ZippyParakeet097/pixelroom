/**
 * Shared Web Audio context (plan §2).
 *
 * Browsers create an AudioContext in the `suspended` state until a real user
 * gesture resumes it. The boot screen's "enter" click is that gesture — see
 * `unlockAudio`. Everything that makes noise goes through `getContext`, so a
 * caller can never accidentally spawn a second context.
 */

let context: AudioContext | null = null
let masterGain: GainNode | null = null
let muted = false

export function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (context) return context

  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null

  context = new Ctor()
  masterGain = context.createGain()
  masterGain.gain.value = 0.35
  masterGain.connect(context.destination)
  return context
}

export function getMasterGain(): GainNode | null {
  getContext()
  return masterGain
}

/** Call from a user-gesture handler. Safe to call repeatedly. */
export function unlockAudio(): void {
  const ctx = getContext()
  if (ctx && ctx.state === 'suspended') void ctx.resume()
}

export function setMuted(next: boolean): void {
  muted = next
  const gain = getMasterGain()
  const ctx = getContext()
  if (!gain || !ctx) return
  // Ramp rather than snap; an instant gain change clicks audibly.
  gain.gain.cancelScheduledValues(ctx.currentTime)
  gain.gain.setTargetAtTime(next ? 0 : 0.35, ctx.currentTime, 0.02)
}

export function isMuted(): boolean {
  return muted
}
