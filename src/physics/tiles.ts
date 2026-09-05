// Tile map and axis-separated AABB collision. Pure: no game imports.

import type { Body } from './body'

// Cell codes. Anything non-zero blocks movement.
export const AIR = 0
export const ROCK = 1
export const PAD = 2
export const DOOR = 3
export const BARRIER = 4

export interface TileMap {
  wTiles: number
  hTiles: number
  size: number
  cells: Uint8Array
}

export function makeTileMap(wTiles: number, hTiles: number, size: number): TileMap {
  return { wTiles, hTiles, size, cells: new Uint8Array(wTiles * hTiles) }
}

/** Out-of-bounds counts as solid rock so nothing escapes the world. */
export function cellAt(map: TileMap, tx: number, ty: number): number {
  if (tx < 0 || ty < 0 || tx >= map.wTiles || ty >= map.hTiles) return ROCK
  return map.cells[ty * map.wTiles + tx]
}

export function setCell(map: TileMap, tx: number, ty: number, code: number): void {
  if (tx < 0 || ty < 0 || tx >= map.wTiles || ty >= map.hTiles) return
  map.cells[ty * map.wTiles + tx] = code
}

function overlapsSolid(map: TileMap, x: number, y: number, w: number, h: number): boolean {
  const s = map.size
  const x0 = Math.floor((x - w / 2) / s)
  const x1 = Math.floor((x + w / 2 - 0.001) / s)
  const y0 = Math.floor((y - h / 2) / s)
  const y1 = Math.floor((y + h / 2 - 0.001) / s)
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (cellAt(map, tx, ty) !== AIR) return true
    }
  }
  return false
}

export interface MoveResult {
  hitX: boolean
  hitY: boolean
  onGround: boolean // hit while moving downward
  impactVx: number // velocity at the moment of contact (0 if no hit)
  impactVy: number
}

const EPS = 0.01

/**
 * Advance a body by v*dt with axis-separated collision against the map.
 * On contact the velocity component is zeroed and the pre-contact velocity
 * reported so callers can classify landings and impacts.
 */
export function moveBody(b: Body, map: TileMap, dt: number): MoveResult {
  const s = map.size
  const res: MoveResult = { hitX: false, hitY: false, onGround: false, impactVx: 0, impactVy: 0 }

  b.x += b.vx * dt
  if (overlapsSolid(map, b.x, b.y, b.w, b.h)) {
    res.hitX = true
    res.impactVx = b.vx
    if (b.vx > 0) {
      const tx = Math.floor((b.x + b.w / 2 - 0.001) / s)
      b.x = tx * s - b.w / 2 - EPS
    } else if (b.vx < 0) {
      const tx = Math.floor((b.x - b.w / 2) / s)
      b.x = (tx + 1) * s + b.w / 2 + EPS
    }
    b.vx = 0
  }

  b.y += b.vy * dt
  if (overlapsSolid(map, b.x, b.y, b.w, b.h)) {
    res.hitY = true
    res.impactVy = b.vy
    if (b.vy > 0) {
      const ty = Math.floor((b.y + b.h / 2 - 0.001) / s)
      b.y = ty * s - b.h / 2 - EPS
      res.onGround = true
    } else if (b.vy < 0) {
      const ty = Math.floor((b.y - b.h / 2) / s)
      b.y = (ty + 1) * s + b.h / 2 + EPS
    }
    b.vy = 0
  }

  return res
}

/** Nearest solid cell centre within range of a point, or null. */
export function nearestSolidCell(
  map: TileMap,
  x: number,
  y: number,
  range: number,
): { x: number; y: number } | null {
  const s = map.size
  const t0x = Math.floor((x - range) / s)
  const t1x = Math.floor((x + range) / s)
  const t0y = Math.floor((y - range) / s)
  const t1y = Math.floor((y + range) / s)
  let best: { x: number; y: number } | null = null
  let bestD = range
  for (let ty = t0y; ty <= t1y; ty++) {
    for (let tx = t0x; tx <= t1x; tx++) {
      if (cellAt(map, tx, ty) === AIR) continue
      const cx = (tx + 0.5) * s
      const cy = (ty + 0.5) * s
      const d = Math.hypot(cx - x, cy - y)
      if (d < bestD) {
        bestD = d
        best = { x: cx, y: cy }
      }
    }
  }
  return best
}

/** The dominant cell code under a body's feet (for pad detection). */
export function groundCodeUnder(map: TileMap, b: Body): number {
  const s = map.size
  const ty = Math.floor((b.y + b.h / 2 + 1) / s)
  const x0 = Math.floor((b.x - b.w / 2) / s)
  const x1 = Math.floor((b.x + b.w / 2 - 0.001) / s)
  let best = AIR
  for (let tx = x0; tx <= x1; tx++) {
    const c = cellAt(map, tx, ty)
    if (c === PAD) return PAD
    if (c !== AIR) best = c
  }
  return best
}
