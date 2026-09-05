// Towable items and (from M2) plates, doors, and delivery.

import { accelerate, beginTick, makeBody, type Body } from '../physics/body'
import { moveBody, type TileMap } from '../physics/tiles'
import { TUNE } from '../tune'
import type { World, WorldItemDef } from '../world/room'

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
