// M5 mechanics: wall-grapple slingshot physics and the cutter vs barriers.

import { describe, expect, it } from 'vitest'
import type { InputState } from '../src/core/input'
import { newGame, update } from '../src/game/state'
import { makeBody } from '../src/physics/body'
import { solveRopeAnchor } from '../src/physics/rope'
import { AIR, BARRIER, cellAt } from '../src/physics/tiles'
import { TUNE } from '../src/tune'
import { buildWorld } from '../src/world/room'
import { rooms } from '../src/world/rooms/world'

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

describe('wall anchor rope', () => {
  it('preserves tangential speed (the slingshot)', () => {
    const b = makeBody(120, 0, 10, 10, 1)
    b.vy = 200 // moving perpendicular to the rope direction
    solveRopeAnchor(b, 0, 0, 100)
    expect(b.vy).toBeCloseTo(200, 5)
    expect(Math.hypot(b.x, b.y)).toBeCloseTo(100, 5)
  })

  it('removes only separating radial velocity', () => {
    const b = makeBody(120, 0, 10, 10, 1)
    b.vx = 50 // flying straight away from the anchor
    b.vy = 80
    solveRopeAnchor(b, 0, 0, 100)
    expect(b.vx).toBeCloseTo(0, 5)
    expect(b.vy).toBeCloseTo(80, 5)
  })

  it('slack anchor rope does nothing', () => {
    const b = makeBody(50, 0, 10, 10, 1)
    b.vx = 50
    const res = solveRopeAnchor(b, 0, 0, 100)
    expect(res.taut).toBe(false)
    expect(b.vx).toBe(50)
  })
})

describe('cutter vs barriers', () => {
  it('a shot fired into the plug clears barrier cells and records them', () => {
    let s = newGame(buildWorld(rooms, TUNE.tileSize), 'padA')
    s = update(s, { ...IDLE, action: true }, 1 / 60) // launch pod
    expect(s.mode).toBe('pod')
    s.upgrades.weapon = true

    // The Gullet plug occupies world cols 68-76, rows 63-65.
    expect(cellAt(s.world.map, 72, 63)).toBe(BARRIER)

    // Hover the pod just above the plug, pointing straight down.
    s.pod.body.x = 72.5 * 16
    s.pod.body.y = 61 * 16
    s.pod.body.vx = 0
    s.pod.body.vy = 0
    s.pod.angle = Math.PI // nose down

    s = update(s, { ...IDLE, fire: true }, 1 / 60)
    for (let i = 0; i < 30; i++) s = update(s, IDLE, 1 / 60)

    expect(cellAt(s.world.map, 72, 63)).toBe(AIR)
    expect(s.barriersCleared.size).toBeGreaterThan(0)
    for (const key of s.barriersCleared) {
      const [tx, ty] = key.split(',').map(Number)
      expect(cellAt(s.world.map, tx, ty)).toBe(AIR)
    }
  })

  it('firing without the weapon upgrade does nothing', () => {
    let s = newGame(buildWorld(rooms, TUNE.tileSize), 'padA')
    s = update(s, { ...IDLE, action: true }, 1 / 60)
    s = update(s, { ...IDLE, fire: true }, 1 / 60)
    expect(s.shots.length).toBe(0)
  })

  it('a fresh game restores blasted barriers in the shared map', () => {
    const world = buildWorld(rooms, TUNE.tileSize)
    let s = newGame(world, 'padA')
    s = update(s, { ...IDLE, action: true }, 1 / 60)
    s.upgrades.weapon = true
    s.pod.body.x = 72.5 * 16
    s.pod.body.y = 61 * 16
    s.pod.body.vy = 0
    s.pod.angle = Math.PI
    s = update(s, { ...IDLE, fire: true }, 1 / 60)
    for (let i = 0; i < 30; i++) s = update(s, IDLE, 1 / 60)
    expect(cellAt(world.map, 72, 63)).toBe(AIR)

    newGame(world, 'padA')
    expect(cellAt(world.map, 72, 63)).toBe(BARRIER)
  })
})
