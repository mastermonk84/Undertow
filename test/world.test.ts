// Structural checks on the hand-authored world: buildWorld validates row
// lengths and legend chars by throwing; here we check the seams and contents.

import { describe, expect, it } from 'vitest'
import { AIR, DOOR, PAD, cellAt } from '../src/physics/tiles'
import { TUNE } from '../src/tune'
import { buildWorld } from '../src/world/room'
import { rooms } from '../src/world/rooms/world'

const world = buildWorld(rooms, TUNE.tileSize)

describe('world map', () => {
  it('has seven rooms and three pads', () => {
    expect(world.rooms.map((r) => r.id)).toEqual(['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7'])
    expect(world.pads.map((p) => p.id).sort()).toEqual(['padA', 'padB', 'padC'])
  })

  it('has all nine items', () => {
    expect(world.itemDefs.map((i) => i.id).sort()).toEqual([
      'boulder1',
      'core1',
      'crate1',
      'engine1',
      'fueltank1',
      'grapple1',
      'relic1',
      'rock1',
      'weapon1',
    ])
  })

  it('every door has a plate or boss trigger id', () => {
    const d1 = world.doors.find((d) => d.id === 'd1')!
    expect(world.plates.some((p) => p.id === d1.openBy)).toBe(true)
    const d2 = world.doors.find((d) => d.id === 'd2')!
    expect(d2.openBy).toBe('boss1')
  })

  it('pad tiles are actually PAD cells with solid support below', () => {
    for (const pad of world.pads) {
      const ty = pad.rect.y / 16
      for (let tx = pad.rect.x / 16; tx < (pad.rect.x + pad.rect.w) / 16; tx++) {
        expect(cellAt(world.map, tx, ty), `${pad.id} tile ${tx}`).toBe(PAD)
        expect(cellAt(world.map, tx, ty + 1), `${pad.id} support ${tx}`).not.toBe(AIR)
      }
    }
  })

  it('room seams are open where the map intends passages', () => {
    // R1 <-> R2 at world cols 48-51, rows 22-27
    expect(cellAt(world.map, 48, 24)).toBe(AIR)
    expect(cellAt(world.map, 51, 24)).toBe(AIR)
    // R2 <-> R3 at cols 93-96, rows 20-26
    expect(cellAt(world.map, 93, 23)).toBe(AIR)
    expect(cellAt(world.map, 96, 23)).toBe(AIR)
    // R2 shaft down to R5 at cols 70-74, rows 33-34
    expect(cellAt(world.map, 72, 33)).toBe(AIR)
    expect(cellAt(world.map, 72, 34)).toBe(AIR)
    // R4 <-> R5 at cols 48-51, rows 54-60
    expect(cellAt(world.map, 48, 56)).toBe(AIR)
    expect(cellAt(world.map, 51, 56)).toBe(AIR)
    // R5 <-> R6 at cols 93-96, rows 56-62
    expect(cellAt(world.map, 93, 58)).toBe(AIR)
    expect(cellAt(world.map, 96, 58)).toBe(AIR)
    // R5 sealed shaft to R7: barrier plug then open below into R7
    expect(cellAt(world.map, 72, 63)).not.toBe(AIR) // '%' plug
    expect(cellAt(world.map, 72, 66)).toBe(AIR)
    expect(cellAt(world.map, 72, 68)).toBe(AIR)
  })

  it('the relic chamber door is closed and the core hatch too', () => {
    expect(cellAt(world.map, 120, 23)).toBe(DOOR) // d1, R3 local col 25 row 23
    expect(cellAt(world.map, 70, 89)).toBe(DOOR) // d2, R7 local col 20 row 21
  })
})
