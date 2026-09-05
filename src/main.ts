import { GameAudio } from './core/audio'
import { Input } from './core/input'
import { startLoop } from './core/loop'
import { startGame, update, type GameEvent } from './game/state'
import { draw } from './render/draw'
import { DEBRIS, DUST, FLAME, GLITTER, Particles, SPARK } from './render/particles'
import { TUNE } from './tune'
import { buildWorld } from './world/room'
import { rooms } from './world/rooms/world'

const canvas = document.getElementById('game') as HTMLCanvasElement
canvas.width = TUNE.view.w
canvas.height = TUNE.view.h
const ctx = canvas.getContext('2d')!

function fit(): void {
  const scale = Math.min(window.innerWidth / TUNE.view.w, window.innerHeight / TUNE.view.h)
  canvas.style.width = `${TUNE.view.w * scale}px`
  canvas.style.height = `${TUNE.view.h * scale}px`
}
fit()
window.addEventListener('resize', fit)

const input = new Input(window)
const audio = new GameAudio()
const particles = new Particles()
const world = buildWorld(rooms, TUNE.tileSize)
let state = startGame(world)
state.mode = 'title'

// Audio contexts must start from a user gesture.
window.addEventListener('keydown', () => audio.ensure(), { once: true })

function onEvent(e: GameEvent): void {
  switch (e.kind) {
    case 'thud':
      audio.play('thud', e.intensity)
      particles.burst(e.x, e.y, 10, { speed: 60, colors: DUST, ttl: 0.7, grav: 120 })
      break
    case 'impact':
      audio.play('impact', e.intensity)
      particles.burst(e.x, e.y, 14, { speed: 130, colors: SPARK, ttl: 0.4, grav: 300 })
      break
    case 'boom':
      audio.play('boom', e.intensity)
      particles.burst(e.x, e.y, 50, { speed: 260, colors: [...FLAME, '#ffffff'], ttl: 1.1, grav: 150, size: 4 })
      break
    case 'shot':
      audio.play('zap', e.intensity)
      break
    case 'blast':
      audio.play('rumble', e.intensity)
      particles.burst(e.x, e.y, 26, { speed: 180, colors: DEBRIS, ttl: 0.9, grav: 350, size: 3.5 })
      break
    case 'chime':
      audio.play('chime', e.intensity)
      particles.burst(e.x, e.y, 12, { speed: 50, colors: GLITTER, ttl: 0.8, grav: -60 })
      break
    case 'door':
      audio.play('rumble', e.intensity)
      particles.burst(e.x, e.y, 16, { speed: 90, colors: DUST, ttl: 0.8, grav: 200 })
      break
    case 'launch':
      audio.play('thud', 0.3)
      particles.burst(e.x, e.y, 8, { speed: 70, colors: DUST, ttl: 0.5, grav: 100 })
      break
  }
}

function exhaust(dt: number): void {
  const ship = state.ship
  if ((state.mode === 'flight' || state.mode === 'landed') && ship.thrusting) {
    particles.burst(ship.body.x, ship.body.y + ship.body.h / 2 + 4, Math.ceil(dt * 220), {
      speed: 120,
      colors: FLAME,
      ttl: 0.35,
      dirX: Math.sin(ship.tilt) * 0.4,
      dirY: 1,
      spread: 0.5,
      grav: -40,
    })
  }
  if (state.mode === 'pod' && state.pod.thrusting) {
    const a = state.pod.angle
    particles.burst(
      state.pod.body.x - Math.sin(a) * TUNE.pod.r,
      state.pod.body.y + Math.cos(a) * TUNE.pod.r,
      Math.ceil(dt * 140),
      {
        speed: 90,
        colors: FLAME,
        ttl: 0.3,
        dirX: -Math.sin(a),
        dirY: Math.cos(a),
        spread: 0.5,
      },
    )
  }
}

startLoop(
  (dt) => {
    state = update(state, input.poll(), dt)
    for (const e of state.events) onEvent(e)
    exhaust(dt)
    particles.update(dt)

    const thrust =
      state.mode === 'flight' && state.ship.thrusting
        ? 'ship'
        : state.mode === 'pod' && state.pod.thrusting
          ? 'pod'
          : 'none'
    audio.setThrust(thrust)
    audio.setStrain(state.mode === 'pod' && state.ropeTaut ? state.ropeStrain : 0)
  },
  (alpha) => {
    draw(ctx, state, alpha, particles)
  },
)

// Debug/playtest handle: inspect or poke the live state from the console.
Object.defineProperty(window, '__undertow', { get: () => state })

// Live feel tuning: edits to tune.ts hot-swap into the running sim.
if (import.meta.hot) {
  import.meta.hot.accept('./tune', (mod) => {
    if (mod) Object.assign(TUNE, mod.TUNE)
  })
}
