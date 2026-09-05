// Map format: each room is a text grid plus a typed object list, placed at a
// world-tile offset. buildWorld stitches rooms into one tile map; rooms remain
// as camera regions. Grid chars: '#' rock, '.' air, '=' pad tile, '%' barrier.

import type { Rect } from '../core/camera'
import {
  AIR,
  BARRIER,
  DOOR,
  PAD,
  ROCK,
  makeTileMap,
  setCell,
  type TileMap,
} from '../physics/tiles'

export type ItemKind =
  | 'rock'
  | 'boulder'
  | 'crate'
  | 'engine'
  | 'fueltank'
  | 'grapple'
  | 'weapon'
  | 'relic'
  | 'core'

export interface PadDef {
  type: 'pad'
  id: string
  tx: number
  ty: number
  tw: number
}

export interface ItemDef {
  type: 'item'
  id: string
  kind: ItemKind
  tx: number
  ty: number
  mass: number
  size: number // px, body is size x size
}

export interface PlateDef {
  type: 'plate'
  id: string
  tx: number
  ty: number
  tw: number
}

export interface DoorDef {
  type: 'door'
  id: string
  tx: number
  ty: number
  tw: number
  th: number
  openBy: string // plate id (or boss id later)
}

export type RoomObject = PadDef | ItemDef | PlateDef | DoorDef

export interface RoomDef {
  id: string
  name: string
  tx: number // placement in world tiles
  ty: number
  grid: string[]
  objects: RoomObject[]
}

export interface Room {
  id: string
  name: string
  rect: Rect
}

export interface Pad {
  id: string
  rect: Rect // the landable strip, world px (1 tile tall)
}

export interface Plate {
  id: string
  rect: Rect
  pressed: boolean
}

export interface Door {
  id: string
  tiles: { tx: number; ty: number }[]
  openBy: string
  open: boolean
}

export interface WorldItemDef {
  id: string
  kind: ItemKind
  x: number
  y: number
  mass: number
  size: number
}

export interface World {
  map: TileMap
  rooms: Room[]
  pads: Pad[]
  plates: Plate[]
  doors: Door[]
  itemDefs: WorldItemDef[]
}

const CHAR_CODES: Record<string, number> = {
  '#': ROCK,
  '.': AIR,
  '=': PAD,
  '%': BARRIER,
}

export function buildWorld(defs: RoomDef[], size: number): World {
  let wTiles = 0
  let hTiles = 0
  for (const d of defs) {
    wTiles = Math.max(wTiles, d.tx + d.grid[0].length)
    hTiles = Math.max(hTiles, d.ty + d.grid.length)
  }
  const map = makeTileMap(wTiles, hTiles, size)

  const world: World = { map, rooms: [], pads: [], plates: [], doors: [], itemDefs: [] }

  for (const d of defs) {
    const cols = d.grid[0].length
    for (let ry = 0; ry < d.grid.length; ry++) {
      const row = d.grid[ry]
      if (row.length !== cols) {
        throw new Error(`room ${d.id}: row ${ry} is ${row.length} chars, expected ${cols}`)
      }
      for (let rx = 0; rx < cols; rx++) {
        const code = CHAR_CODES[row[rx]]
        if (code === undefined) throw new Error(`room ${d.id}: unknown tile '${row[rx]}'`)
        if (code !== AIR) setCell(map, d.tx + rx, d.ty + ry, code)
      }
    }

    world.rooms.push({
      id: d.id,
      name: d.name,
      rect: { x: d.tx * size, y: d.ty * size, w: cols * size, h: d.grid.length * size },
    })

    for (const o of d.objects) {
      const wx = (d.tx + o.tx) * size
      const wy = (d.ty + o.ty) * size
      if (o.type === 'pad') {
        world.pads.push({ id: o.id, rect: { x: wx, y: wy, w: o.tw * size, h: size } })
      } else if (o.type === 'item') {
        world.itemDefs.push({
          id: o.id,
          kind: o.kind,
          x: wx + size / 2,
          y: wy + size / 2,
          mass: o.mass,
          size: o.size,
        })
      } else if (o.type === 'plate') {
        world.plates.push({
          id: o.id,
          rect: { x: wx, y: wy, w: o.tw * size, h: size },
          pressed: false,
        })
      } else {
        const tiles: { tx: number; ty: number }[] = []
        for (let dy = 0; dy < o.th; dy++) {
          for (let dx = 0; dx < o.tw; dx++) {
            tiles.push({ tx: d.tx + o.tx + dx, ty: d.ty + o.ty + dy })
            setCell(map, d.tx + o.tx + dx, d.ty + o.ty + dy, DOOR)
          }
        }
        world.doors.push({ id: o.id, tiles, openBy: o.openBy, open: false })
      }
    }
  }

  return world
}

export function roomAt(world: World, x: number, y: number): Room | undefined {
  return world.rooms.find(
    (r) => x >= r.rect.x && x < r.rect.x + r.rect.w && y >= r.rect.y && y < r.rect.y + r.rect.h,
  )
}
