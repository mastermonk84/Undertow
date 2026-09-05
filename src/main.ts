import { startLoop } from './core/loop'
import { Input } from './core/input'
import { update, newGame } from './game/state'
import { draw } from './render/draw'
import { TUNE } from './tune'
import { buildWorld } from './world/room'
import { sandbox } from './world/rooms/sandbox'

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
const world = buildWorld([sandbox], TUNE.tileSize)
let state = newGame(world, 'padA')

startLoop(
  (dt) => {
    state = update(state, input.poll(), dt)
  },
  (alpha) => {
    draw(ctx, state, alpha)
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
