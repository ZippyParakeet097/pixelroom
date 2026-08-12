import { useCallback, useEffect, useRef, useState } from 'react'
import { BANNER, COMMANDS, COMMAND_MAP, type CommandContext } from './commands'
import { useWindowStore } from '@/ui/xp/windowStore'
import { playSfx } from '@/audio/sfx'
import './terminal.css'

interface Line {
  id: number
  text: string
  tone: 'normal' | 'error' | 'accent' | 'input'
}

let lineId = 0

function makeLines(texts: string[], tone: Line['tone'] = 'normal'): Line[] {
  return texts.map((text) => ({ id: lineId++, text, tone }))
}

export function Terminal() {
  const [lines, setLines] = useState<Line[]>(() => makeLines(BANNER))
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState<number | null>(null)

  const scroller = useRef<HTMLDivElement>(null)
  const field = useRef<HTMLInputElement>(null)
  const open = useWindowStore((s) => s.open)

  // Pin to the bottom as output arrives.
  useEffect(() => {
    const element = scroller.current
    if (element) element.scrollTop = element.scrollHeight
  }, [lines])

  const context: CommandContext = {
    clear: () => setLines([]),
    launch: (appId) => open(appId),
  }

  const submit = useCallback(
    (raw: string) => {
      const trimmed = raw.trim()
      setLines((previous) => [...previous, ...makeLines([`C:\\> ${raw}`], 'input')])

      if (trimmed.length > 0) {
        setHistory((previous) => [trimmed, ...previous].slice(0, 50))
      }
      setHistoryIndex(null)
      setInput('')

      if (trimmed.length === 0) return

      const [name, ...args] = trimmed.split(/\s+/)
      const command = COMMAND_MAP.get(name.toLowerCase())

      if (!command) {
        playSfx('error')
        setLines((previous) => [
          ...previous,
          ...makeLines([`'${name}' is not recognized as a command. Try \`help\`.`], 'error'),
        ])
        return
      }

      const result = command.run(args, context)
      if (result) {
        playSfx(result.tone === 'error' ? 'error' : 'blip')
        setLines((previous) => [...previous, ...makeLines(result.lines, result.tone ?? 'normal')])
      }
    },
    // `context` is rebuilt each render but only closes over stable setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open],
  )

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      submit(input)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (history.length === 0) return
      const next = historyIndex === null ? 0 : Math.min(historyIndex + 1, history.length - 1)
      setHistoryIndex(next)
      setInput(history[next])
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (historyIndex === null) return
      const next = historyIndex - 1
      if (next < 0) {
        setHistoryIndex(null)
        setInput('')
      } else {
        setHistoryIndex(next)
        setInput(history[next])
      }
      return
    }

    if (event.key === 'Tab') {
      event.preventDefault()
      const prefix = input.trim().toLowerCase()
      if (!prefix) return
      const matches = COMMANDS.filter((c) => !c.hidden && c.name.startsWith(prefix))
      if (matches.length === 1) {
        setInput(matches[0].name + ' ')
      } else if (matches.length > 1) {
        setLines((previous) => [
          ...previous,
          ...makeLines(['  ' + matches.map((m) => m.name).join('   ')]),
        ])
      }
    }
  }

  return (
    <div className="term" onClick={() => field.current?.focus()}>
      <div className="term__scroll" ref={scroller}>
        {lines.map((line) => (
          <pre key={line.id} className={`term__line term__line--${line.tone}`}>
            {line.text || ' '}
          </pre>
        ))}

        <div className="term__prompt">
          <span className="term__caret">C:\&gt;</span>
          <input
            ref={field}
            className="term__input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            aria-label="Terminal input"
            autoFocus
          />
        </div>
      </div>
    </div>
  )
}
