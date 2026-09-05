// The main ship: heavy, upright, Lunar-Lander controls. Lateral thrust tilts
// it; landing softly and level on a pad is the core skill check.

import type { InputState } from '../core/input'
import { accelerate, beginTick, makeBody, type Body } from '../physics/body'
import { moveBody, type TileMap } from '../physics/tiles'
import { TUNE } from '../tune'

export interface Ship {
  body: Body
  tilt: number
  hull: number
  thrusting: boolean
  latDir: number
}

export function makeShip(x: number, y: number): Ship {
  return {
    body: makeBody(x, y, TUNE.ship.w, TUNE.ship.h, TUNE.ship.mass),
    tilt: 0,
    hull: TUNE.ship.hullMax,
    thrusting: false,
    latDir: 0,
  }
}

export interface ShipFlightResult {
  touchdown: { vx: number; vy: number; tilt: number } | null
  wallImpact: number // |impact speed| into a wall this tick, 0 if none
}

export function updateShipFlight(
  ship: Ship,
  input: InputState,
  map: TileMap,
  dt: number,
): ShipFlightResult {
  const t = TUNE.ship
  ship.latDir = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  ship.thrusting = input.thrust

  const targetTilt = ship.latDir * t.tiltMax
  const dTilt = targetTilt - ship.tilt
  const maxStep = t.tiltRate * dt
  ship.tilt += Math.abs(dTilt) <= maxStep ? dTilt : Math.sign(dTilt) * maxStep

  const ax = ship.latDir * t.latThrust
  const ay = (ship.thrusting ? -t.mainThrust : 0) + TUNE.gravity

  beginTick(ship.body)
  accelerate(ship.body, ax, ay, dt, TUNE.maxSpeed)
  const res = moveBody(ship.body, map, dt)

  return {
    touchdown: res.onGround
      ? { vx: ship.body.vx, vy: res.impactVy, tilt: ship.tilt }
      : null,
    wallImpact: res.hitX ? Math.abs(res.impactVx) : 0,
  }
}

/** World-space point the pod launches from and docks to. */
export function dockPoint(ship: Ship): { x: number; y: number } {
  return { x: ship.body.x, y: ship.body.y - ship.body.h / 2 - 4 }
}
