// GameState and the per-tick mode machine. All game rules route through here;
// rendering never mutates this.

import { makeCamera, updateCamera, type Camera } from '../core/camera'
import type { InputState } from '../core/input'
import { classifyLanding } from '../physics/landing'
import { solveRope } from '../physics/rope'
import { DOOR, PAD, groundCodeUnder, setCell } from '../physics/tiles'
import { TUNE } from '../tune'
import { roomAt, type Pad as WorldPad, type World } from '../world/room'
import { makeItems, nearestItem, updateItems, updatePlatesAndDoors, type Item } from './objects'
import { dockPoint, makeShip, updateShipFlight, type Ship } from './ship'
import { launchPod, makePod, updatePodFlight, type Pod } from './pod'

export type Mode = 'flight' | 'landed' | 'pod' | 'dead' | 'won'

export interface Upgrades {
  engine: boolean
  fueltank: boolean
  grapple: boolean
  weapon: boolean
}

export interface GameState {
  upgrades: Upgrades
  mode: Mode
  ship: Ship
  pod: Pod
  items: Item[]
  world: World
  camera: Camera
  currentRoomId: string
  lastPadId: string | null
  ropeTaut: boolean
  ropeStrain: number
  deathReason: string
  message: string
  messageTimer: number
  time: number
}

function say(state: GameState, text: string, seconds = 2.5): void {
  state.message = text
  state.messageTimer = seconds
}

export function newGame(world: World, startPadId: string): GameState {
  const pad = world.pads.find((p) => p.id === startPadId)
  if (!pad) throw new Error(`no pad ${startPadId}`)

  // The world's doors and plates mutate the shared tile map — reset them.
  for (const door of world.doors) {
    door.open = false
    for (const t of door.tiles) setCell(world.map, t.tx, t.ty, DOOR)
  }
  for (const plate of world.plates) plate.pressed = false
  const ship = makeShip(pad.rect.x + pad.rect.w / 2, pad.rect.y - TUNE.ship.h / 2 - 0.1)

  const state: GameState = {
    upgrades: { engine: false, fueltank: false, grapple: false, weapon: false },
    mode: 'landed',
    ship,
    pod: makePod(),
    items: makeItems(world),
    world,
    camera: makeCamera(),
    currentRoomId: roomAt(world, ship.body.x, ship.body.y)?.id ?? world.rooms[0].id,
    lastPadId: startPadId,
    ropeTaut: false,
    ropeStrain: 0,
    deathReason: '',
    message: '',
    messageTimer: 0,
    time: 0,
  }
  // Snap the camera to the ship instead of lerping in from (0,0).
  const room = state.world.rooms.find((r) => r.id === state.currentRoomId)!
  updateCamera(state.camera, ship.body.x, ship.body.y, room.rect, TUNE.view.w, TUNE.view.h, 10)
  return state
}

function padUnderShip(state: GameState): WorldPad | undefined {
  const b = state.ship.body
  if (groundCodeUnder(state.world.map, b) !== PAD) return undefined
  return state.world.pads.find(
    (p) =>
      b.x - b.w / 2 >= p.rect.x - 2 &&
      b.x + b.w / 2 <= p.rect.x + p.rect.w + 2 &&
      Math.abs(b.y + b.h / 2 - p.rect.y) < 4,
  )
}

function die(state: GameState, reason: string): void {
  state.mode = 'dead'
  state.deathReason = reason
}

export function maxFuel(state: GameState): number {
  return TUNE.pod.fuelMax * (state.upgrades.fueltank ? TUNE.upgrades.fuelMul : 1)
}

export function ropeLength(state: GameState): number {
  return TUNE.rope.length * (state.upgrades.grapple ? TUNE.upgrades.ropeLenMul : 1)
}

function updateFlight(state: GameState, input: InputState, dt: number): void {
  const thrustMul = state.upgrades.engine ? TUNE.upgrades.engineThrustMul : 1
  const res = updateShipFlight(state.ship, input, state.world.map, dt, thrustMul)

  if (res.wallImpact > TUNE.landing.softVx) {
    state.ship.hull -= (res.wallImpact - TUNE.landing.softVx) * TUNE.ship.groundScrapeDamage
  }

  if (res.touchdown) {
    const { vx, vy, tilt } = res.touchdown
    const pad = padUnderShip(state)
    if (pad) {
      const landing = classifyLanding(vx, vy, tilt, TUNE.landing)
      if (landing.kind === 'crash') {
        die(state, 'The hull shattered on the pad.')
        return
      }
      state.mode = 'landed'
      state.lastPadId = pad.id
      state.ship.tilt = 0
      state.ship.latDir = 0
      state.ship.thrusting = false
      if (landing.kind === 'soft') {
        state.ship.hull = TUNE.ship.hullMax
        say(state, 'Touchdown. Hull repaired.')
      } else {
        state.ship.hull -= landing.damage
        say(state, 'Hard landing. Set down gently to repair.')
      }
    } else if (vy > TUNE.landing.crashVy) {
      die(state, 'The ship broke apart on the rocks.')
      return
    } else if (vy > TUNE.landing.softVy) {
      state.ship.hull -= (vy - TUNE.landing.softVy) * TUNE.ship.groundScrapeDamage * 4
      say(state, 'Rough ground. Find a pad.', 1.5)
    }
  }

  if (state.ship.hull <= 0) die(state, 'Hull integrity lost.')
}

function updateLanded(state: GameState, input: InputState): void {
  state.ship.thrusting = false
  if (input.action) {
    const p = dockPoint(state.ship)
    launchPod(state.pod, p.x, p.y - TUNE.pod.r - 2, maxFuel(state))
    state.mode = 'pod'
    return
  }
  if (input.thrust) {
    // Lift-off requires the pod docked — in 'landed' mode it always is.
    state.ship.body.vy = -TUNE.ship.liftKick
    state.ship.thrusting = true
    state.mode = 'flight'
  }
}

function updatePod(state: GameState, input: InputState, dt: number): void {
  const pod = state.pod

  if (input.action) {
    if (pod.grappled) {
      pod.grappled = null
      say(state, 'Grapple released.', 1.2)
    } else {
      const item = nearestItem(state.items, pod.body.x, pod.body.y, TUNE.rope.grabRange)
      if (item) {
        pod.grappled = item.def.id
        say(state, `Grappled: ${item.def.kind} (mass ${item.def.mass})`, 1.6)
      }
    }
  }

  const thrustMul = state.upgrades.engine ? TUNE.upgrades.engineThrustMul : 1
  const res = updatePodFlight(pod, input, state.world.map, dt, thrustMul)
  if (res.impact > TUNE.pod.crashSpeed) {
    die(state, 'The pod was smashed against the rock.')
    return
  }

  state.ropeTaut = false
  state.ropeStrain = 0
  if (pod.grappled) {
    const item = state.items.find((i) => i.def.id === pod.grappled)
    if (item) {
      const rope = solveRope(pod.body, item.body, ropeLength(state), TUNE.rope.stiffness)
      state.ropeTaut = rope.taut
      state.ropeStrain = rope.strain
    }
  }

  if (pod.fuel <= 0 && !pod.thrusting && state.messageTimer <= 0) {
    say(state, 'Fuel exhausted. Drift home.', 1.2)
  }

  const dock = dockPoint(state.ship)
  const dockDist = Math.hypot(pod.body.x - dock.x, pod.body.y - dock.y)
  if (!pod.dockArmed) {
    if (dockDist > TUNE.pod.dockRange * 1.5) pod.dockArmed = true
  } else if (dockDist < TUNE.pod.dockRange) {
    const towed = pod.grappled ? state.items.find((i) => i.def.id === pod.grappled) : undefined
    pod.grappled = null
    pod.fuel = maxFuel(state)
    state.mode = 'landed'
    say(state, 'Pod docked. Fuel topped up.', 1.6)
    if (towed) deliver(state, towed)
  }
}

/** A towed item counts as delivered if it's close to the ship when the pod docks. */
function deliver(state: GameState, item: Item): void {
  const b = state.ship.body
  if (Math.hypot(item.body.x - b.x, item.body.y - b.y) > TUNE.delivery.range) return

  switch (item.def.kind) {
    case 'engine':
      item.delivered = true
      state.upgrades.engine = true
      say(state, 'Engine installed. The ship feels lighter.', 3)
      break
    case 'fueltank':
      item.delivered = true
      state.upgrades.fueltank = true
      say(state, 'Auxiliary fuel tank fitted.', 3)
      break
    case 'grapple':
      item.delivered = true
      state.upgrades.grapple = true
      say(state, 'Heavy grapple winch installed.', 3)
      break
    case 'weapon':
      item.delivered = true
      state.upgrades.weapon = true
      say(state, 'Mining cutter mounted on the pod.', 3)
      break
    case 'relic':
      item.delivered = true
      state.mode = 'won'
      break
    case 'core':
      item.delivered = true
      state.mode = 'won'
      break
    default:
      // Rocks, boulders, crates just get set down.
      break
  }
}

export function update(state: GameState, input: InputState, dt: number): GameState {
  state.time += dt
  if (state.messageTimer > 0) {
    state.messageTimer -= dt
    if (state.messageTimer <= 0) state.message = ''
  }

  switch (state.mode) {
    case 'flight':
      updateFlight(state, input, dt)
      break
    case 'landed':
      updateLanded(state, input)
      break
    case 'pod':
      updatePod(state, input, dt)
      break
    case 'dead':
      if (input.confirm) return newGame(state.world, 'padA')
      break
    case 'won':
      if (input.confirm) return newGame(state.world, 'padA')
      break
  }

  // Items, plates, and doors exist in the world whatever the mode.
  updateItems(state.items, state.world.map, dt)
  updatePlatesAndDoors(state.world, state.items)

  const focus = state.mode === 'pod' ? state.pod.body : state.ship.body
  const room = roomAt(state.world, focus.x, focus.y)
  if (room && room.id !== state.currentRoomId) {
    state.currentRoomId = room.id
    say(state, `— ${room.name} —`, 1.8)
  }
  const clamp = state.world.rooms.find((r) => r.id === state.currentRoomId)!.rect
  updateCamera(state.camera, focus.x, focus.y, clamp, TUNE.view.w, TUNE.view.h, dt)

  return state
}
