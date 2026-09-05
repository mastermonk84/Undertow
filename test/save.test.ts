// Save round-trip: write a save, boot with startGame, check it was applied.

import { beforeEach, describe, expect, it } from 'vitest'
import type { InputState } from '../src/core/input'
import { newGame, startGame, update } from '../src/game/state'
import { TUNE } from '../src/tune'
import { buildWorld } from '../src/world/room'
import { rooms } from '../src/world/rooms/world'
import { readSave, writeSave, type SaveData } from '../src/world/save'

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

// Minimal localStorage for node.
const store = new Map<string, string>()
beforeEach(() => {
  store.clear()
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  } as unknown as Storage
})

function world() {
  return buildWorld(rooms, TUNE.tileSize)
}

describe('save/load', () => {
  it('boots fresh at pad A when no save exists', () => {
    const s = startGame(world())
    expect(s.lastPadId).toBe('padA')
    expect(s.upgrades.engine).toBe(false)
  })

  it('applies a save: pad, upgrades, delivered items, item positions', () => {
    const data: SaveData = {
      version: 1,
      padId: 'padB',
      upgrades: { engine: true, fueltank: false, grapple: false, weapon: false },
      itemsDelivered: ['engine1'],
      itemPositions: { crate1: { x: 999, y: 333 } },
      barriersCleared: [],
      bossDead: false,
    }
    writeSave(data)
    const s = startGame(world())
    expect(s.lastPadId).toBe('padB')
    expect(s.upgrades.engine).toBe(true)
    expect(s.items.find((i) => i.def.id === 'engine1')!.delivered).toBe(true)
    const crate = s.items.find((i) => i.def.id === 'crate1')!
    expect(crate.body.x).toBe(999)
    // Ship actually sits on pad B.
    const padB = s.world.pads.find((p) => p.id === 'padB')!
    expect(Math.abs(s.ship.body.x - (padB.rect.x + padB.rect.w / 2))).toBeLessThan(1)
  })

  it('soft landing writes a save', () => {
    let s = newGame(world(), 'padA')
    // Hover just above the pad and drop gently.
    s = update(s, { ...IDLE, thrust: true }, 1 / 60) // lift off
    expect(s.mode).toBe('flight')
    s.ship.body.vy = 30
    s.ship.body.y -= 2
    for (let i = 0; i < 120 && s.mode === 'flight'; i++) s = update(s, IDLE, 1 / 60)
    expect(s.mode).toBe('landed')
    expect(readSave()?.padId).toBe('padA')
  })

  it('pause menu restart returns to the last saved pad', () => {
    writeSave({
      version: 1,
      padId: 'padC',
      upgrades: { engine: true, fueltank: true, grapple: false, weapon: false },
      itemsDelivered: [],
      itemPositions: {},
      barriersCleared: [],
      bossDead: false,
    })
    let s = startGame(world())
    expect(s.lastPadId).toBe('padC')
    s = update(s, { ...IDLE, pause: true }, 1 / 60)
    expect(s.mode).toBe('paused')
    s = update(s, { ...IDLE, action: true }, 1 / 60)
    expect(s.mode).toBe('landed')
    expect(s.lastPadId).toBe('padC')
  })

  it('death then confirm respawns from the save after the cooldown', () => {
    let s = startGame(world())
    s.mode = 'dead'
    s.deadCooldown = 0.9
    s = update(s, { ...IDLE, confirm: true }, 1 / 60)
    expect(s.mode).toBe('dead') // cooldown still running
    for (let i = 0; i < 60; i++) s = update(s, IDLE, 1 / 60)
    s = update(s, { ...IDLE, confirm: true }, 1 / 60)
    expect(s.mode).toBe('landed')
  })
})
