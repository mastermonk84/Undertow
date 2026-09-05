// The Warden: wakes when the pod enters The Root, dies to cutter shots,
// and its death opens the core hatch.

import { describe, expect, it } from 'vitest'
import type { InputState } from '../src/core/input'
import { newGame, update, type GameState } from '../src/game/state'
import { AIR, DOOR, cellAt } from '../src/physics/tiles'
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

function podInRoot(): GameState {
  let s = newGame(buildWorld(rooms, TUNE.tileSize), 'padA')
  s = update(s, { ...IDLE, action: true }, 1 / 60) // launch pod
  // Teleport the pod into The Root's upper cavern.
  s.pod.body.x = 72 * 16
  s.pod.body.y = 74 * 16
  s.pod.body.vx = 0
  s.pod.body.vy = 0
  return s
}

describe('the Warden', () => {
  it('sleeps until the pod enters The Root', () => {
    const world = buildWorld(rooms, TUNE.tileSize)
    let s = newGame(world, 'padA')
    expect(s.boss.awake).toBe(false)
    s = update(s, IDLE, 1 / 60)
    expect(s.boss.awake).toBe(false)
  })

  it('wakes when the pod arrives and fires bolts', () => {
    let s = podInRoot()
    s = update(s, IDLE, 1 / 60)
    expect(s.boss.awake).toBe(true)
    for (let i = 0; i < 150 && s.mode === 'pod'; i++) {
      s = update(s, { ...IDLE, thrust: i % 4 === 0 }, 1 / 60) // stay alive-ish
      if (s.bossShots.length > 0) break
    }
    expect(s.bossShots.length).toBeGreaterThan(0)
  })

  it('dies to cutter hits and the hatch opens; state persists in the save shape', () => {
    let s = podInRoot()
    s.upgrades.weapon = true
    s = update(s, IDLE, 1 / 60)
    expect(cellAt(s.world.map, 70, 89)).toBe(DOOR)

    // Land direct hits by spawning shots on top of it.
    for (let i = 0; i < TUNE.boss.hp; i++) {
      s.shots.push({
        x: s.boss.x,
        y: s.boss.y,
        px: s.boss.x,
        py: s.boss.y,
        vx: 0,
        vy: 0,
        ttl: 0.5,
      })
      s = update(s, IDLE, 1 / 60)
      if (s.mode !== 'pod') break // boss may kill the pod meanwhile — irrelevant here
    }
    expect(s.boss.dead).toBe(true)
    expect(s.bossDead).toBe(true)
    s = update(s, IDLE, 1 / 60) // doors react on the tick after the kill
    expect(cellAt(s.world.map, 70, 89)).toBe(AIR)
  })

  it('a dead boss stays dead when loaded from save data', () => {
    const world = buildWorld(rooms, TUNE.tileSize)
    const s = newGame(world, 'padC', {
      version: 1,
      padId: 'padC',
      upgrades: { engine: true, fueltank: true, grapple: true, weapon: true },
      itemsDelivered: [],
      itemPositions: {},
      barriersCleared: [],
      bossDead: true,
    })
    expect(s.boss.dead).toBe(true)
    const s2 = update(s, IDLE, 1 / 60)
    expect(cellAt(s2.world.map, 70, 89)).toBe(AIR)
  })
})
