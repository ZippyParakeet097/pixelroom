import { useEffect, type RefObject } from 'react'
import { signAnchor } from '@/scene/signAnchor'

/** Drives the DOM sign off the scene camera. Delta from where CSS laid it out.
 *
 *  itwasstillburningoffscreen */
export function useSignProjection(target: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const node = target.current
    if (!node) return

    let base = { x: 0, y: 0 }
    const measure = () => {
      node.style.transform = ''
      const box = node.getBoundingClientRect()
      base = { x: box.left + box.width / 2, y: box.top + box.height / 2 }
    }
    measure()

    let shown: boolean | null = null
    let last = ''

    let frame = requestAnimationFrame(function apply() {
      if (signAnchor.live) {
        // `hidden` rather than opacity 0: a transparent element still paints,
        // and paint is the whole cost here.
        if (signAnchor.visible !== shown) {
          shown = signAnchor.visible
          node.style.visibility = shown ? '' : 'hidden'
        }
        if (shown) {
          const next =
            `translate(${signAnchor.x - base.x}px, ${signAnchor.y - base.y}px)` +
            ` scale(${signAnchor.scale})`
          // Same string every frame while the camera is still. Writing it anyway
          // invalidates style on an element carrying a 220px bloom.
          if (next !== last) {
            last = next
            node.style.transform = next
          }
        }
      }
      frame = requestAnimationFrame(apply)
    })

    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', measure)
      node.style.transform = ''
      node.style.visibility = ''
    }
  }, [target])
}
