import { describe, expect, it } from 'vitest'
import { beginTick, makeBody } from '../src/physics/body'
import { AIR, ROCK, cellAt, makeTileMap, moveBody, setCell } from '../src/physics/tiles'

const DT = 1 / 60

// 20x20 map, 16px tiles, solid floor at row 15 and wall at column 12.
function makeRoom() {
  const map = makeTileMap(20, 20, 16)
  for (let tx = 0; tx < 20; tx++) setCell(map, tx, 15, ROCK)
  for (let ty = 0; ty < 15; ty++) setCell(map, 12, ty, ROCK)
  return map
}

describe('tile collision', () => {
  it('out of bounds reads as solid', () => {
    const map = makeRoom()
    expect(cellAt(map, -1, 5)).toBe(ROCK)
    expect(cellAt(map, 5, 999)).toBe(ROCK)
    expect(cellAt(map, 5, 5)).toBe(AIR)
  })

  it('a falling body lands on the floor and stays there', () => {
    const map = makeRoom()
    const b = makeBody(5 * 16, 13 * 16, 12, 12, 1)
    let grounded = false
    for (let i = 0; i < 120; i++) {
      beginTick(b)
      b.vy += 150 * DT
      const res = moveBody(b, map, DT)
      if (res.onGround) grounded = true
    }
    expect(grounded).toBe(true)
    expect(b.vy).toBe(0)
    // Resting on top of row 15 => bottom edge at y=240.
    expect(b.y + b.h / 2).toBeLessThanOrEqual(15 * 16)
    expect(b.y + b.h / 2).toBeGreaterThan(15 * 16 - 1)
  })

  it('reports the impact velocity on touchdown', () => {
    const map = makeRoom()
    // Bottom edge 1px above the floor: one step at 100px/s reaches it.
    const b = makeBody(5 * 16, 15 * 16 - 6 - 1, 12, 12, 1)
    b.vy = 100
    const res = moveBody(b, map, DT)
    expect(res.hitY).toBe(true)
    expect(res.impactVy).toBe(100)
    expect(b.vy).toBe(0)
  })

  it('a wall stops horizontal motion', () => {
    const map = makeRoom()
    const b = makeBody(10 * 16, 14 * 16, 12, 12, 1)
    b.vx = 200
    let hit = false
    for (let i = 0; i < 60; i++) {
      beginTick(b)
      const res = moveBody(b, map, DT)
      if (res.hitX) hit = true
    }
    expect(hit).toBe(true)
    expect(b.vx).toBe(0)
    expect(b.x + b.w / 2).toBeLessThanOrEqual(12 * 16)
  })

  it('does not tunnel at the clamped max speed', () => {
    const map = makeRoom()
    const b = makeBody(5 * 16, 5 * 16, 12, 12, 1)
    b.vy = 520 // TUNE.maxSpeed
    for (let i = 0; i < 120; i++) {
      beginTick(b)
      moveBody(b, map, DT)
    }
    expect(b.y + b.h / 2).toBeLessThanOrEqual(15 * 16)
  })

  it('resolves a corner clip without sticking', () => {
    const map = makeRoom()
    // Nestled just off the wall/floor corner so one step clips both.
    const b = makeBody(186, 234, 12, 12, 1)
    b.vx = 150
    b.vy = 150
    const res = moveBody(b, map, DT)
    expect(res.hitX || res.hitY).toBe(true)
    // Body must end up outside all solid tiles.
    expect(b.x + b.w / 2).toBeLessThanOrEqual(12 * 16)
    expect(b.y + b.h / 2).toBeLessThanOrEqual(15 * 16)
  })
})
