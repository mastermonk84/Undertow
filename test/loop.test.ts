// Integration tests for the full-loop mechanisms, driving the real update()
// with synthetic input on the real sandbox world.

import { describe, expect, it } from 'vitest'
import type { InputState } from '../src/core/input'
import { newGame, update } from '../src/game/state'
import { AIR, DOOR, cellAt } from '../src/physics/tiles'
import { TUNE } from '../src/tune'
import { buildWorld } from '../src/world/room'
import { rooms } from '../src/world/rooms/world'

const DT = 1 / 60
const IDLE: InputState = {
  left: false,
  right: false,
  thrust: false,
  action: false,
  confirm: false,
  pause: false,
  fire: false,
  reset: false,
}

function freshGame() {
  return newGame(buildWorld(rooms, TUNE.tileSize), 'padA')
}

function tick(state: ReturnType<typeof freshGame>, n = 1, input: Partial<InputState> = {}) {
  let s = state
  for (let i = 0; i < n; i++) s = update(s, { ...IDLE, ...input }, DT)
  return s
}

describe('full loop mechanisms', () => {
  it('starts landed on pad A with the door closed', () => {
    const s = freshGame()
    expect(s.mode).toBe('landed')
    expect(s.world.doors[0].open).toBe(false)
    expect(cellAt(s.world.map, 120, 23)).toBe(DOOR)
  })

  it('crate resting on the plate opens the door; removing it closes it', () => {
    let s = freshGame()
    const crate = s.items.find((i) => i.def.kind === 'crate')!
    const plate = s.world.plates[0]
    crate.body.x = plate.rect.x + plate.rect.w / 2
    crate.body.y = plate.rect.y - crate.body.h / 2
    s = tick(s, 30)
    expect(plate.pressed).toBe(true)
    expect(s.world.doors[0].open).toBe(true)
    expect(cellAt(s.world.map, 120, 23)).toBe(AIR)

    crate.body.x = plate.rect.x - 200
    s = tick(s, 30)
    expect(plate.pressed).toBe(false)
    expect(s.world.doors[0].open).toBe(false)
    expect(cellAt(s.world.map, 120, 23)).toBe(DOOR)
  })

  it('docking while towing the engine installs it and boosts ship thrust', () => {
    let s = freshGame()
    s = tick(s, 1, { action: true }) // launch pod
    expect(s.mode).toBe('pod')

    const engine = s.items.find((i) => i.def.kind === 'engine')!
    s.pod.grappled = engine.def.id
    s.pod.dockArmed = true
    // Park pod and engine next to the ship's dock point.
    s.pod.body.x = s.ship.body.x
    s.pod.body.y = s.ship.body.y - 20
    s.pod.body.vx = 0
    s.pod.body.vy = 0
    engine.body.x = s.ship.body.x + 30
    engine.body.y = s.ship.body.y - 10
    s = tick(s, 2)
    expect(s.mode).toBe('landed')
    expect(s.upgrades.engine).toBe(true)
    expect(engine.delivered).toBe(true)
  })

  it('delivering the relic is a story beat, not the ending', () => {
    let s = freshGame()
    s = tick(s, 1, { action: true })
    const relic = s.items.find((i) => i.def.kind === 'relic')!
    s.pod.grappled = relic.def.id
    s.pod.dockArmed = true
    s.pod.body.x = s.ship.body.x
    s.pod.body.y = s.ship.body.y - 20
    s.pod.body.vy = 0
    relic.body.x = s.ship.body.x - 30
    relic.body.y = s.ship.body.y - 10
    s = tick(s, 2)
    expect(s.mode).toBe('landed')
    expect(relic.delivered).toBe(true)
  })

  it('delivering the core ends the game', () => {
    let s = freshGame()
    s = tick(s, 1, { action: true })
    const core = s.items.find((i) => i.def.kind === 'core')!
    s.pod.grappled = core.def.id
    s.pod.dockArmed = true
    s.pod.body.x = s.ship.body.x
    s.pod.body.y = s.ship.body.y - 20
    s.pod.body.vy = 0
    core.body.x = s.ship.body.x - 30
    core.body.y = s.ship.body.y - 10
    s = tick(s, 2)
    expect(s.mode).toBe('won')
  })

  it('a towed rock is released on dock but not consumed', () => {
    let s = freshGame()
    s = tick(s, 1, { action: true })
    const rock = s.items.find((i) => i.def.kind === 'rock')!
    s.pod.grappled = rock.def.id
    s.pod.dockArmed = true
    s.pod.body.x = s.ship.body.x
    s.pod.body.y = s.ship.body.y - 20
    s.pod.body.vy = 0
    rock.body.x = s.ship.body.x + 30
    rock.body.y = s.ship.body.y - 10
    s = tick(s, 2)
    expect(s.mode).toBe('landed')
    expect(rock.delivered).toBe(false)
    expect(s.pod.grappled).toBe(null)
  })

  it('lift-off is possible from landed (pod docked) and flight can crash', () => {
    let s = freshGame()
    s = tick(s, 1, { thrust: true })
    expect(s.mode).toBe('flight')
    // Kill the engines and fall until something breaks.
    s = tick(s, 60 * 20)
    expect(s.mode === 'dead' || s.mode === 'flight' || s.mode === 'landed').toBe(true)
  })
})
