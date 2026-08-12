import './notes.css'

/**
 * readme.txt — a Notepad-styled note that explains the room without the
 * narrator having to lecture. Read-only on purpose: an editable textarea
 * implies persistence the site deliberately doesn't have (plan §14).
 */
export function Notes() {
  return (
    <div className="notes">
      <pre className="notes__body">{`
  readme.txt
  ──────────────────────────────────────────

  You're at the desk in a room that is, itself,
  the portfolio. Nothing here is a menu.

  Things worth trying:

    · Terminal.exe   — type `}<code>help</code>{`. There's more
                       in there than the list shows.
    · Resume.pdf     — the boring important one.
    · Snake.exe      — arrow keys. You know how it goes.
    · Contra.exe     — ←/→ move, Z jump, X shoot.

  Back in the room:

    · The jukebox works. Three loops, generated
      live, no download.
    · The whiteboard hands you a marker.
    · The window has the contact details.
    · Esc steps back from anything.

  That's the whole site. Go poke at it.
`}</pre>
    </div>
  )
}
