// Towable items, pressure plates, and doors.

import { accelerate, beginTick, makeBody, type Body } from '../physics/body'
import { AIR, DOOR, moveBody, setCell, type TileMap } from '../physics/tiles'
import { TUNE } from '../tune'
import type { Door, World, WorldItemDef } from '../world/room'

export interface Item {
  def: WorldItemDef
  body: Body
  delivered: boolean
}

export function makeItems(world: World): Item[] {
  return world.itemDefs.map((def) => ({
    def,
    body: makeBody(def.x, def.y, def.size, def.size, def.mass),
    delivered: false,
  }))
}

export function updateItems(items: Item[], map: TileMap, dt: number): void {
  for (const item of items) {
    if (item.delivered) continue
    beginTick(item.body)
    accelerate(item.body, 0, TUNE.gravity, dt, TUNE.maxSpeed)
    moveBody(item.body, map, dt)
  }
}

/**
 * Plates press while any undelivered item rests on them; doors track their
 * plate. Returns the doors that toggled this tick (for audio/FX).
 */
export function updatePlatesAndDoors(world: World, items: Item[], bossDead = false): Door[] {
  for (const plate of world.plates) {
    plate.pressed = items.some((item) => {
      if (item.delivered) return false
      const b = item.body
      const r = plate.rect
      return (
        b.x + b.w / 2 > r.x &&
        b.x - b.w / 2 < r.x + r.w &&
        b.y + b.h / 2 > r.y &&
        b.y - b.h / 2 < r.y + r.h + 2
      )
    })
  }

  const toggled: Door[] = []
  for (const door of world.doors) {
    const plate = world.plates.find((p) => p.id === door.openBy)
    const shouldOpen = door.openBy === 'boss1' ? bossDead : (plate?.pressed ?? door.open)
    if (shouldOpen !== door.open) {
      door.open = shouldOpen
      for (const t of door.tiles) {
        setCell(world.map, t.tx, t.ty, shouldOpen ? AIR : DOOR)
      }
      toggled.push(door)
    }
  }
  return toggled
}

export function nearestItem(items: Item[], x: number, y: number, range: number): Item | null {
  let best: Item | null = null
  let bestD = range
  for (const item of items) {
    if (item.delivered) continue
    const d = Math.hypot(item.body.x - x, item.body.y - y)
    if (d < bestD) {
      bestD = d
      best = item
    }
  }
  return best
}
