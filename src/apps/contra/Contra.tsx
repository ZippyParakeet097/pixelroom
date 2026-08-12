import { useCallback, useEffect, useRef, useState } from 'react'
import {
  PLATFORMS,
  PLAYER_SIZE,
  RUN_SECONDS,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  createState,
  update,
  type GameState,
  type InputState,
} from './engine'
import { playSfx } from '@/audio/sfx'
import { useAppFocused } from '@/ui/xp/useAppFocused'
import { isTypingTarget } from '@/ui/keyboard'
import './contra.css'

const SCALE = 2

const KEY_MAP: Record<string, keyof InputState> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  a: 'left',
  d: 'right',
  w: 'up',
  z: 'jump',
  ' ': 'jump',
  x: 'fire',
}

export function Contra() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const state = useRef<GameState>(createState())
  const input = useRef<InputState>({ left: false, right: false, up: false, jump: false, fire: false })

  const focused = useAppFocused('contra')
  const [phase, setPhase] = useState(state.current.phase)
  const [hud, setHud] = useState({ lives: 3, score: 0, time: 0 })

  const draw = useCallback(() => {
    const ctx = canvas.current?.getContext('2d')
    if (!ctx) return
    const game = state.current

    ctx.save()
    if (game.shake > 0) {
      ctx.translate((Math.random() - 0.5) * game.shake * 10, (Math.random() - 0.5) * game.shake * 10)
    }

    // Backdrop: jungle-ish bands, no scrolling.
    ctx.fillStyle = '#14101a'
    ctx.fillRect(-10, -10, VIEW_WIDTH + 20, VIEW_HEIGHT + 20)
    ctx.fillStyle = '#1d2a20'
    ctx.fillRect(-10, 90, VIEW_WIDTH + 20, VIEW_HEIGHT)
    ctx.fillStyle = '#24352a'
    for (let i = 0; i < 9; i++) {
      const x = i * 40 - 8
      ctx.fillRect(x, 96, 22, 90)
    }

    ctx.fillStyle = '#3d5c45'
    for (const platform of PLATFORMS) {
      ctx.fillRect(platform.x, platform.y, platform.width, 8)
      ctx.fillStyle = '#2a4231'
      ctx.fillRect(platform.x, platform.y + 8, platform.width, 5)
      ctx.fillStyle = '#3d5c45'
    }

    for (const enemy of game.enemies) {
      ctx.fillStyle = enemy.flash > 0 ? '#ffffff' : enemyColor(enemy.kind)
      ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height)
      ctx.fillStyle = '#14101a'
      if (enemy.kind === 'turret') {
        ctx.fillRect(enemy.x + 4, enemy.y + 4, 6, 6)
      } else {
        ctx.fillRect(enemy.x + 2, enemy.y + 3, 2, 2)
        ctx.fillRect(enemy.x + enemy.width - 4, enemy.y + 3, 2, 2)
      }
    }

    const player = game.player
    // Blink while invulnerable so the state is legible without a HUD element.
    const visible = player.invuln <= 0 || Math.floor(game.time * 20) % 2 === 0
    if (visible) {
      ctx.fillStyle = '#4fd6c8'
      ctx.fillRect(player.x, player.y, PLAYER_SIZE.width, PLAYER_SIZE.height)
      ctx.fillStyle = '#e8e0d0'
      ctx.fillRect(player.x + 2, player.y + 1, 6, 5)
      ctx.fillStyle = '#14101a'
      if (player.aimUp) {
        ctx.fillRect(player.x + 4, player.y - 4, 2, 5)
      } else {
        ctx.fillRect(player.facing > 0 ? player.x + PLAYER_SIZE.width : player.x - 4, player.y + 6, 4, 2)
      }
    }

    for (const bullet of game.bullets) {
      ctx.fillStyle = bullet.hostile ? '#d64f9a' : '#f0a848'
      ctx.fillRect(Math.round(bullet.x) - 1, Math.round(bullet.y) - 1, 3, 3)
    }

    for (const particle of game.particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, particle.life * 3))
      ctx.fillStyle = particle.color
      ctx.fillRect(Math.round(particle.x), Math.round(particle.y), 2, 2)
    }
    ctx.globalAlpha = 1
    ctx.restore()
  }, [])

  useEffect(() => {
    let raf = 0
    let last = performance.now()

    const frame = (now: number) => {
      // Clamp: a backgrounded tab can hand back a multi-second delta, which
      // would tunnel the player straight through the floor.
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now

      const game = state.current
      const before = game.phase
      update(game, input.current, dt)
      draw()

      if (game.phase !== before) {
        setPhase(game.phase)
        playSfx(game.phase === 'cleared' ? 'pickup' : 'error')
      }
      setHud({ lives: game.lives, score: game.score, time: game.time })

      raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [draw])

  const start = useCallback(() => {
    state.current = createState()
    state.current.phase = 'playing'
    setPhase('playing')
    playSfx('select')
  }, [])

  useEffect(() => {
    if (!focused) {
      // Release every held key when focus leaves, or the player keeps running
      // in a direction the visitor can no longer stop.
      input.current = { left: false, right: false, up: false, jump: false, fire: false }
      return
    }
    const onDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event)) return
      const key = KEY_MAP[event.key] ?? KEY_MAP[event.key.toLowerCase()]
      if (key) {
        event.preventDefault()
        input.current[key] = true
        return
      }
      if (event.key === 'Enter' && state.current.phase !== 'playing') {
        event.preventDefault()
        start()
      }
    }
    const onUp = (event: KeyboardEvent) => {
      if (isTypingTarget(event)) return
      const key = KEY_MAP[event.key] ?? KEY_MAP[event.key.toLowerCase()]
      if (key) {
        event.preventDefault()
        input.current[key] = false
      }
    }

    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [start, focused])

  const remaining = Math.max(0, Math.ceil(RUN_SECONDS - hud.time))

  return (
    <div className="contra">
      <div className="contra__hud">
        <span>
          {'♦'.repeat(Math.max(0, hud.lives))}
          {'·'.repeat(Math.max(0, 3 - hud.lives))}
        </span>
        <span>{String(hud.score).padStart(6, '0')}</span>
        <span>{phase === 'playing' ? `${remaining}s` : '--'}</span>
      </div>

      <div className="contra__stage">
        <canvas
          ref={canvas}
          width={VIEW_WIDTH}
          height={VIEW_HEIGHT}
          className="contra__canvas"
          style={{ width: VIEW_WIDTH * SCALE, height: VIEW_HEIGHT * SCALE }}
        />

        {phase !== 'playing' && (
          <div className="contra__overlay">
            <p className="contra__title">
              {phase === 'cleared' ? 'CLEARED' : phase === 'dead' ? 'GAME OVER' : 'CONTRA.EXE'}
            </p>
            {phase !== 'idle' && <p className="contra__score">{hud.score} pts</p>}
            <button type="button" className="contra__button" onClick={start}>
              {phase === 'idle' ? 'insert coin' : 'again'}
            </button>
            <p className="contra__hint">←/→ move · Z jump · X shoot · ↑ aim up</p>
            <p className="contra__scope">one screen, 75 seconds, no continues</p>
          </div>
        )}
      </div>
    </div>
  )
}

function enemyColor(kind: string): string {
  if (kind === 'runner') return '#c9563f'
  if (kind === 'turret') return '#8a6ab0'
  return '#c4a44a'
}
