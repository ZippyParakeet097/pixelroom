/**
 * Arcade-scoped run-and-gun engine (plan §6).
 *
 * Explicitly NOT a Contra clone: one fixed screen, no scrolling, no tilemap,
 * no level progression. Three enemy types on a timed wave table, a 75-second
 * loop, then a clear screen. Everything the plan cut is genuinely absent
 * rather than stubbed (plan §14).
 *
 * The engine is plain data + functions with no React in it, so the component
 * only owns the canvas and the input listeners.
 */

export const VIEW_WIDTH = 320
export const VIEW_HEIGHT = 200
export const RUN_SECONDS = 75

const GRAVITY = 620
const JUMP_VELOCITY = -232
const RUN_SPEED = 92
const PLAYER_WIDTH = 10
const PLAYER_HEIGHT = 16
const INVULN_SECONDS = 1.4
const FIRE_COOLDOWN = 0.16

export interface Platform {
  x: number
  y: number
  width: number
}

export const PLATFORMS: Platform[] = [
  { x: 0, y: 176, width: VIEW_WIDTH },
  { x: 36, y: 126, width: 76 },
  { x: 208, y: 126, width: 76 },
  { x: 122, y: 80, width: 76 },
]

export type EnemyKind = 'runner' | 'turret' | 'flyer'

export interface Enemy {
  id: number
  kind: EnemyKind
  x: number
  y: number
  vx: number
  vy: number
  hp: number
  /** Seconds until this enemy may fire again. */
  cooldown: number
  /** Drives the flyer's sine path. */
  phase: number
  width: number
  height: number
  flash: number
}

export interface Bullet {
  x: number
  y: number
  vx: number
  vy: number
  hostile: boolean
  life: number
}

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  color: string
}

export interface Player {
  x: number
  y: number
  vx: number
  vy: number
  onGround: boolean
  facing: 1 | -1
  aimUp: boolean
  invuln: number
  cooldown: number
}

export type Phase = 'idle' | 'playing' | 'dead' | 'cleared'

export interface GameState {
  phase: Phase
  time: number
  player: Player
  enemies: Enemy[]
  bullets: Bullet[]
  particles: Particle[]
  lives: number
  score: number
  nextEnemyId: number
  waveIndex: number
  shake: number
}

export interface InputState {
  left: boolean
  right: boolean
  up: boolean
  jump: boolean
  fire: boolean
}

interface WaveEntry {
  at: number
  kind: EnemyKind
  x: number
  y: number
}

/**
 * Hand-authored spawn table. A table rather than a random director because at
 * this length the pacing *is* the level design — the difficulty curve and the
 * breathing room between pushes both need to be deliberate.
 */
export const WAVES: WaveEntry[] = [
  { at: 1.5, kind: 'runner', x: 320, y: 160 },
  { at: 4.0, kind: 'runner', x: -12, y: 160 },
  { at: 7.0, kind: 'runner', x: 320, y: 160 },
  { at: 8.0, kind: 'flyer', x: -14, y: 60 },

  { at: 12.0, kind: 'turret', x: 240, y: 110 },
  { at: 13.5, kind: 'runner', x: -12, y: 160 },
  { at: 16.0, kind: 'runner', x: 320, y: 160 },
  { at: 18.0, kind: 'flyer', x: 334, y: 48 },

  { at: 22.0, kind: 'turret', x: 60, y: 110 },
  { at: 24.0, kind: 'runner', x: 320, y: 160 },
  { at: 25.5, kind: 'runner', x: -12, y: 160 },
  { at: 28.0, kind: 'flyer', x: -14, y: 70 },
  { at: 29.0, kind: 'flyer', x: 334, y: 40 },

  { at: 34.0, kind: 'runner', x: 320, y: 160 },
  { at: 35.0, kind: 'runner', x: 320, y: 160 },
  { at: 36.5, kind: 'runner', x: -12, y: 160 },
  { at: 38.0, kind: 'turret', x: 150, y: 64 },

  { at: 43.0, kind: 'flyer', x: -14, y: 55 },
  { at: 44.0, kind: 'runner', x: -12, y: 160 },
  { at: 46.0, kind: 'runner', x: 320, y: 160 },
  { at: 48.0, kind: 'turret', x: 240, y: 110 },

  { at: 53.0, kind: 'runner', x: 320, y: 160 },
  { at: 54.0, kind: 'flyer', x: 334, y: 62 },
  { at: 55.5, kind: 'runner', x: -12, y: 160 },
  { at: 57.0, kind: 'runner', x: -12, y: 160 },
  { at: 59.0, kind: 'turret', x: 60, y: 110 },

  { at: 63.0, kind: 'flyer', x: -14, y: 44 },
  { at: 64.0, kind: 'flyer', x: 334, y: 68 },
  { at: 65.5, kind: 'runner', x: 320, y: 160 },
  { at: 67.0, kind: 'runner', x: -12, y: 160 },
  { at: 68.5, kind: 'runner', x: 320, y: 160 },
  { at: 70.0, kind: 'runner', x: -12, y: 160 },
]

const ENEMY_SPECS: Record<EnemyKind, { hp: number; width: number; height: number; score: number }> = {
  runner: { hp: 1, width: 10, height: 16, score: 100 },
  turret: { hp: 3, width: 14, height: 14, score: 250 },
  flyer: { hp: 2, width: 14, height: 10, score: 150 },
}

export function createState(): GameState {
  return {
    phase: 'idle',
    time: 0,
    player: {
      x: VIEW_WIDTH / 2 - PLAYER_WIDTH / 2,
      y: 160,
      vx: 0,
      vy: 0,
      onGround: true,
      facing: 1,
      aimUp: false,
      invuln: 0,
      cooldown: 0,
    },
    enemies: [],
    bullets: [],
    particles: [],
    lives: 3,
    score: 0,
    nextEnemyId: 1,
    waveIndex: 0,
    shake: 0,
  }
}

function overlaps(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by
}

function spawnEnemy(state: GameState, entry: WaveEntry): void {
  const spec = ENEMY_SPECS[entry.kind]
  state.enemies.push({
    id: state.nextEnemyId++,
    kind: entry.kind,
    x: entry.x,
    y: entry.y,
    vx: entry.kind === 'runner' ? (entry.x < 0 ? 44 : -44) : entry.kind === 'flyer' ? (entry.x < 0 ? 52 : -52) : 0,
    vy: 0,
    hp: spec.hp,
    cooldown: entry.kind === 'turret' ? 1.2 : 0,
    phase: 0,
    width: spec.width,
    height: spec.height,
    flash: 0,
  })
}

function burst(state: GameState, x: number, y: number, color: string, count = 8): void {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4
    const speed = 40 + Math.random() * 70
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 20,
      life: 0.35 + Math.random() * 0.25,
      color,
    })
  }
}

function killPlayer(state: GameState): void {
  state.lives -= 1
  state.shake = 0.35
  burst(state, state.player.x + PLAYER_WIDTH / 2, state.player.y + PLAYER_HEIGHT / 2, '#4fd6c8', 14)

  if (state.lives <= 0) {
    state.phase = 'dead'
    return
  }

  state.player.x = VIEW_WIDTH / 2 - PLAYER_WIDTH / 2
  state.player.y = 150
  state.player.vx = 0
  state.player.vy = 0
  state.player.invuln = INVULN_SECONDS
}

/** Advances the simulation. `dt` is clamped by the caller. */
export function update(state: GameState, input: InputState, dt: number): void {
  if (state.phase !== 'playing') return

  state.time += dt
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt)

  while (state.waveIndex < WAVES.length && WAVES[state.waveIndex].at <= state.time) {
    spawnEnemy(state, WAVES[state.waveIndex])
    state.waveIndex += 1
  }

  updatePlayer(state, input, dt)
  updateEnemies(state, dt)
  updateBullets(state, dt)
  updateParticles(state, dt)

  if (state.time >= RUN_SECONDS && state.enemies.length === 0) {
    state.phase = 'cleared'
  }
}

function updatePlayer(state: GameState, input: InputState, dt: number): void {
  const player = state.player

  player.vx = 0
  if (input.left) {
    player.vx = -RUN_SPEED
    player.facing = -1
  }
  if (input.right) {
    player.vx = RUN_SPEED
    player.facing = 1
  }
  player.aimUp = input.up

  if (input.jump && player.onGround) {
    player.vy = JUMP_VELOCITY
    player.onGround = false
  }

  player.vy += GRAVITY * dt
  player.x += player.vx * dt

  // Walls stop the player rather than wrapping: this is one screen and the
  // edges are the arena boundary.
  player.x = Math.max(0, Math.min(VIEW_WIDTH - PLAYER_WIDTH, player.x))

  const previousBottom = player.y + PLAYER_HEIGHT
  player.y += player.vy * dt
  const bottom = player.y + PLAYER_HEIGHT

  player.onGround = false
  for (const platform of PLATFORMS) {
    const withinX = player.x + PLAYER_WIDTH > platform.x && player.x < platform.x + platform.width
    // One-way platforms: only land when falling through the surface from above.
    if (withinX && player.vy >= 0 && previousBottom <= platform.y + 1 && bottom >= platform.y) {
      player.y = platform.y - PLAYER_HEIGHT
      player.vy = 0
      player.onGround = true
      break
    }
  }

  if (player.y > VIEW_HEIGHT + 40) killPlayer(state)

  if (player.invuln > 0) player.invuln -= dt
  if (player.cooldown > 0) player.cooldown -= dt

  if (input.fire && player.cooldown <= 0) {
    player.cooldown = FIRE_COOLDOWN
    const muzzleY = player.y + (player.aimUp ? 0 : 6)
    const muzzleX = player.x + (player.aimUp ? PLAYER_WIDTH / 2 - 1 : player.facing > 0 ? PLAYER_WIDTH : -2)
    state.bullets.push({
      x: muzzleX,
      y: muzzleY,
      vx: player.aimUp ? 0 : 280 * player.facing,
      vy: player.aimUp ? -280 : 0,
      hostile: false,
      life: 1.4,
    })
  }
}

function updateEnemies(state: GameState, dt: number): void {
  const player = state.player

  for (const enemy of state.enemies) {
    if (enemy.flash > 0) enemy.flash -= dt

    if (enemy.kind === 'runner') {
      enemy.x += enemy.vx * dt
      enemy.vy += GRAVITY * dt
      enemy.y += enemy.vy * dt
      for (const platform of PLATFORMS) {
        const withinX = enemy.x + enemy.width > platform.x && enemy.x < platform.x + platform.width
        if (withinX && enemy.y + enemy.height >= platform.y && enemy.y + enemy.height <= platform.y + 12) {
          enemy.y = platform.y - enemy.height
          enemy.vy = 0
        }
      }
    } else if (enemy.kind === 'flyer') {
      enemy.phase += dt
      enemy.x += enemy.vx * dt
      enemy.y += Math.sin(enemy.phase * 3.4) * 34 * dt
      enemy.cooldown -= dt
      if (enemy.cooldown <= 0) {
        enemy.cooldown = 1.6 + Math.random() * 0.8
        state.bullets.push({
          x: enemy.x + enemy.width / 2,
          y: enemy.y + enemy.height,
          vx: 0,
          vy: 96,
          hostile: true,
          life: 3,
        })
      }
    } else {
      // Turret: stationary, leads the player horizontally.
      enemy.cooldown -= dt
      if (enemy.cooldown <= 0) {
        enemy.cooldown = 1.5 + Math.random() * 0.6
        const dx = player.x - enemy.x
        const dy = player.y - enemy.y
        const length = Math.hypot(dx, dy) || 1
        state.bullets.push({
          x: enemy.x + enemy.width / 2,
          y: enemy.y + enemy.height / 2,
          vx: (dx / length) * 88,
          vy: (dy / length) * 88,
          hostile: true,
          life: 3.5,
        })
      }
    }

    if (
      player.invuln <= 0 &&
      overlaps(player.x, player.y, PLAYER_WIDTH, PLAYER_HEIGHT, enemy.x, enemy.y, enemy.width, enemy.height)
    ) {
      killPlayer(state)
    }
  }

  // Runners and flyers that walk off the arena are gone for good.
  state.enemies = state.enemies.filter(
    (enemy) => enemy.hp > 0 && enemy.x > -60 && enemy.x < VIEW_WIDTH + 60 && enemy.y < VIEW_HEIGHT + 60,
  )
}

function updateBullets(state: GameState, dt: number): void {
  const player = state.player

  for (const bullet of state.bullets) {
    bullet.x += bullet.vx * dt
    bullet.y += bullet.vy * dt
    bullet.life -= dt

    if (bullet.hostile) {
      if (
        player.invuln <= 0 &&
        overlaps(player.x, player.y, PLAYER_WIDTH, PLAYER_HEIGHT, bullet.x - 1, bullet.y - 1, 3, 3)
      ) {
        bullet.life = 0
        killPlayer(state)
      }
      continue
    }

    for (const enemy of state.enemies) {
      if (enemy.hp <= 0) continue
      if (overlaps(bullet.x - 1, bullet.y - 1, 3, 3, enemy.x, enemy.y, enemy.width, enemy.height)) {
        bullet.life = 0
        enemy.hp -= 1
        enemy.flash = 0.08
        if (enemy.hp <= 0) {
          state.score += ENEMY_SPECS[enemy.kind].score
          burst(state, enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, '#f0a848')
        }
        break
      }
    }
  }

  state.bullets = state.bullets.filter(
    (bullet) =>
      bullet.life > 0 &&
      bullet.x > -8 &&
      bullet.x < VIEW_WIDTH + 8 &&
      bullet.y > -8 &&
      bullet.y < VIEW_HEIGHT + 8,
  )
}

function updateParticles(state: GameState, dt: number): void {
  for (const particle of state.particles) {
    particle.x += particle.vx * dt
    particle.y += particle.vy * dt
    particle.vy += GRAVITY * 0.5 * dt
    particle.life -= dt
  }
  state.particles = state.particles.filter((particle) => particle.life > 0)
}

export const PLAYER_SIZE = { width: PLAYER_WIDTH, height: PLAYER_HEIGHT }
