import { useCallback, useEffect, useRef, useState } from 'react'
import { playSfx } from '@/audio/sfx'
import { useAppFocused } from '@/ui/xp/useAppFocused'
import { isTypingTarget } from '@/ui/keyboard'
import './snake.css'

const GRID = 20
const CELL = 16
const CANVAS = GRID * CELL
const START_TICK_MS = 140
const MIN_TICK_MS = 70

type Point = { x: number; y: number }
type Direction = 'up' | 'down' | 'left' | 'right'
type Status = 'idle' | 'playing' | 'over'

const VECTORS: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

const OPPOSITE: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
}

const KEYS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
}

interface GameState {
  snake: Point[]
  direction: Direction
  /**
   * Buffered turns. Without a queue, pressing up-then-left inside one tick
   * loses the first input; with it, both are honoured on consecutive ticks —
   * which is the difference between the game feeling responsive and feeling
   * broken (plan §6).
   */
  queue: Direction[]
  food: Point
  score: number
  tickMs: number
}

function spawnFood(snake: Point[]): Point {
  // Pick from free cells rather than retrying random points, which degrades
  // badly once the snake fills most of the board.
  const occupied = new Set(snake.map((p) => `${p.x},${p.y}`))
  const free: Point[] = []
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (!occupied.has(`${x},${y}`)) free.push({ x, y })
    }
  }
  return free[Math.floor(Math.random() * free.length)] ?? { x: 0, y: 0 }
}

function initialState(): GameState {
  const snake = [
    { x: 8, y: 10 },
    { x: 7, y: 10 },
    { x: 6, y: 10 },
  ]
  return {
    snake,
    direction: 'right',
    queue: [],
    food: spawnFood(snake),
    score: 0,
    tickMs: START_TICK_MS,
  }
}

export function Snake() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const game = useRef<GameState>(initialState())
  const focused = useAppFocused('snake')
  const [status, setStatus] = useState<Status>('idle')
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(0)

  const draw = useCallback(() => {
    const ctx = canvas.current?.getContext('2d')
    if (!ctx) return
    const state = game.current

    ctx.fillStyle = '#0d1b0f'
    ctx.fillRect(0, 0, CANVAS, CANVAS)

    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 1
    for (let i = 1; i < GRID; i++) {
      ctx.beginPath()
      ctx.moveTo(i * CELL + 0.5, 0)
      ctx.lineTo(i * CELL + 0.5, CANVAS)
      ctx.moveTo(0, i * CELL + 0.5)
      ctx.lineTo(CANVAS, i * CELL + 0.5)
      ctx.stroke()
    }

    ctx.fillStyle = '#d64f9a'
    ctx.fillRect(state.food.x * CELL + 3, state.food.y * CELL + 3, CELL - 6, CELL - 6)

    state.snake.forEach((segment, index) => {
      ctx.fillStyle = index === 0 ? '#8ce87a' : '#4a7c59'
      ctx.fillRect(segment.x * CELL + 1, segment.y * CELL + 1, CELL - 2, CELL - 2)
    })
  }, [])

  const step = useCallback(() => {
    const state = game.current

    const nextDirection = state.queue.shift()
    if (nextDirection && nextDirection !== OPPOSITE[state.direction]) {
      state.direction = nextDirection
    }

    const vector = VECTORS[state.direction]
    const head = {
      x: state.snake[0].x + vector.x,
      y: state.snake[0].y + vector.y,
    }

    const hitWall = head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID
    // The tail cell is excluded: it moves out of the way this same tick, so
    // following your own tail is legal.
    const hitSelf = state.snake
      .slice(0, -1)
      .some((segment) => segment.x === head.x && segment.y === head.y)

    if (hitWall || hitSelf) {
      playSfx('error')
      setStatus('over')
      setBest((previous) => Math.max(previous, state.score))
      return
    }

    state.snake.unshift(head)

    if (head.x === state.food.x && head.y === state.food.y) {
      state.score += 1
      state.tickMs = Math.max(MIN_TICK_MS, START_TICK_MS - state.score * 3)
      state.food = spawnFood(state.snake)
      setScore(state.score)
      playSfx('pickup')
    } else {
      state.snake.pop()
    }

    draw()
  }, [draw])

  // Fixed-timestep loop driven by rAF: the tick interval shortens as the score
  // climbs, and using an accumulator keeps that independent of frame rate.
  useEffect(() => {
    if (status !== 'playing') return
    let raf = 0
    let last = performance.now()
    let accumulator = 0

    const frame = (now: number) => {
      accumulator += now - last
      last = now
      while (accumulator >= game.current.tickMs) {
        accumulator -= game.current.tickMs
        step()
        if (game.current.snake.length === 0) break
      }
      raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [status, step])

  const start = useCallback(() => {
    game.current = initialState()
    setScore(0)
    setStatus('playing')
    draw()
  }, [draw])

  useEffect(() => {
    draw()
  }, [draw])

  useEffect(() => {
    if (!focused) return
    const onKey = (event: KeyboardEvent) => {
      if (isTypingTarget(event)) return
      const direction = KEYS[event.key]
      if (direction) {
        event.preventDefault()
        const state = game.current
        // Cap the queue: holding a key shouldn't bank a dozen turns.
        const reference = state.queue[state.queue.length - 1] ?? state.direction
        if (direction !== reference && direction !== OPPOSITE[reference] && state.queue.length < 3) {
          state.queue.push(direction)
        }
        return
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        if (status !== 'playing') start()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [status, start, focused])

  return (
    <div className="snake">
      <div className="snake__hud">
        <span>SCORE {String(score).padStart(3, '0')}</span>
        <span>BEST {String(best).padStart(3, '0')}</span>
      </div>

      <div className="snake__stage">
        <canvas ref={canvas} width={CANVAS} height={CANVAS} className="snake__canvas" />

        {status !== 'playing' && (
          <div className="snake__overlay">
            <p className="snake__title">{status === 'over' ? 'GAME OVER' : 'SNAKE'}</p>
            {status === 'over' && <p className="snake__score">you got {score}</p>}
            <button type="button" className="snake__button" onClick={start}>
              {status === 'over' ? 'try again' : 'start'}
            </button>
            <p className="snake__hint">arrows or WASD</p>
          </div>
        )}
      </div>
    </div>
  )
}
