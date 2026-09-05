// The pod: Solar Jetman controls. Rotate + thrust, inertia, gravity, a fuel
// tank that only refills docked at the ship.

import type { InputState } from '../core/input'
import { accelerate, beginTick, makeBody, type Body } from '../physics/body'
import { moveBody, type TileMap } from '../physics/tiles'
import { TUNE } from '../tune'

export interface Pod {
  body: Body
  angle: number // 0 = pointing up, positive clockwise
  fuel: number
  grappled: string | null // item id
  thrusting: boolean
  dockArmed: boolean // docking only re-arms once the pod has left the dock radius
}

export function makePod(): Pod {
  const r = TUNE.pod.r
  return {
    body: makeBody(0, 0, r * 2, r * 2, TUNE.pod.mass),
    angle: 0,
    fuel: TUNE.pod.fuelMax,
    grappled: null,
    thrusting: false,
    dockArmed: false,
  }
}

export function launchPod(pod: Pod, x: number, y: number): void {
  pod.body.x = x
  pod.body.y = y
  pod.body.px = x
  pod.body.py = y
  pod.body.vx = 0
  pod.body.vy = -50
  pod.angle = 0
  pod.fuel = TUNE.pod.fuelMax
  pod.grappled = null
  pod.dockArmed = false
}

export interface PodFlightResult {
  impact: number // hardest impact speed this tick
}

export function updatePodFlight(
  pod: Pod,
  input: InputState,
  map: TileMap,
  dt: number,
): PodFlightResult {
  const t = TUNE.pod
  pod.angle += ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * t.turnRate * dt
  pod.thrusting = input.thrust && pod.fuel > 0

  let ax = 0
  let ay = TUNE.gravity
  if (pod.thrusting) {
    ax += Math.sin(pod.angle) * t.thrust
    ay += -Math.cos(pod.angle) * t.thrust
    pod.fuel = Math.max(0, pod.fuel - t.fuelBurn * dt)
  }

  beginTick(pod.body)
  accelerate(pod.body, ax, ay, dt, TUNE.maxSpeed)
  const res = moveBody(pod.body, map, dt)

  return { impact: Math.max(Math.abs(res.impactVx), Math.abs(res.impactVy)) }
}
