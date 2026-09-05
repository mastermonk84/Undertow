// GameState and the per-tick mode machine. All game rules route through here;
// rendering never mutates this.

import { makeCamera, updateCamera, type Camera } from '../core/camera'
import type { InputState } from '../core/input'
import { classifyLanding } from '../physics/landing'
import { solveRope, solveRopeAnchor } from '../physics/rope'
import {
  AIR,
  BARRIER,
  DOOR,
  PAD,
  cellAt,
  groundCodeUnder,
  nearestSolidCell,
  setCell,
} from '../physics/tiles'
import { TUNE } from '../tune'
import { roomAt, type Pad as WorldPad, type World } from '../world/room'
import { clearSave, readSave, writeSave, type SaveData } from '../world/save'
import { makeItems, nearestItem, updateItems, updatePlatesAndDoors, type Item } from './objects'
import { dockPoint, makeShip, updateShipFlight, type Ship } from './ship'
import { launchPod, makePod, updatePodFlight, type Pod } from './pod'

export type Mode = 'flight' | 'landed' | 'pod' | 'dead' | 'won' | 'paused'

export interface Upgrades {
  engine: boolean
  fueltank: boolean
  grapple: boolean
  weapon: boolean
}

export interface Shot {
  x: number
  y: number
  px: number
  py: number
  vx: number
  vy: number
  ttl: number
}

// Feel events for audio/particles, drained by main each tick.
export interface GameEvent {
  kind: 'thud' | 'impact' | 'boom' | 'shot' | 'blast' | 'chime' | 'door' | 'launch'
  x: number
  y: number
  intensity: number
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
  shots: Shot[]
  events: GameEvent[]
  shake: number
  deathReason: string
  deadCooldown: number
  pausedFrom: Mode
  barriersCleared: Set<string> // "tx,ty" (M5)
  bossDead: boolean // (M7)
  message: string
  messageTimer: number
  time: number
}

function say(state: GameState, text: string, seconds = 2.5): void {
  state.message = text
  state.messageTimer = seconds
}

function emit(state: GameState, kind: GameEvent['kind'], x: number, y: number, intensity = 1): void {
  state.events.push({ kind, x, y, intensity })
}

function kick(state: GameState, amount: number): void {
  state.shake = Math.min(16, Math.max(state.shake, amount))
}

export function newGame(world: World, startPadId: string, save?: SaveData): GameState {
  const pad = world.pads.find((p) => p.id === startPadId)
  if (!pad) throw new Error(`no pad ${startPadId}`)

  // The world's doors and plates mutate the shared tile map — reset them.
  for (const door of world.doors) {
    door.open = false
    for (const t of door.tiles) setCell(world.map, t.tx, t.ty, DOOR)
  }
  for (const plate of world.plates) plate.pressed = false
  for (const t of world.barrierTiles) setCell(world.map, t.tx, t.ty, BARRIER)
  const ship = makeShip(pad.rect.x + pad.rect.w / 2, pad.rect.y - TUNE.ship.h / 2 - 0.1)

  const state: GameState = {
    upgrades: save
      ? { ...save.upgrades }
      : { engine: false, fueltank: false, grapple: false, weapon: false },
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
    shots: [],
    events: [],
    shake: 0,
    deathReason: '',
    deadCooldown: 0,
    pausedFrom: 'landed',
    barriersCleared: new Set(save?.barriersCleared ?? []),
    bossDead: save?.bossDead ?? false,
    message: '',
    messageTimer: 0,
    time: 0,
  }

  if (save) {
    for (const item of state.items) {
      if (save.itemsDelivered.includes(item.def.id)) item.delivered = true
      const pos = save.itemPositions[item.def.id]
      if (pos) {
        item.body.x = pos.x
        item.body.y = pos.y
        item.body.px = pos.x
        item.body.py = pos.y
      }
    }
  }
  // Re-open any blasted barrier cells (persisted across saves).
  for (const key of state.barriersCleared) {
    const [tx, ty] = key.split(',').map(Number)
    setCell(world.map, tx, ty, AIR)
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

function die(state: GameState, reason: string, x?: number, y?: number): void {
  state.mode = 'dead'
  state.deathReason = reason
  state.deadCooldown = 0.9
  emit(state, 'boom', x ?? state.ship.body.x, y ?? state.ship.body.y, 1.2)
  kick(state, 13)
}

/** Boot entry: resume the save if one exists, else a fresh game at Pad A. */
export function startGame(world: World): GameState {
  const save = readSave()
  return save ? newGame(world, save.padId, save) : newGame(world, 'padA')
}

function saveGame(state: GameState): void {
  const itemPositions: SaveData['itemPositions'] = {}
  for (const item of state.items) {
    if (!item.delivered) itemPositions[item.def.id] = { x: item.body.x, y: item.body.y }
  }
  writeSave({
    version: 1,
    padId: state.lastPadId ?? 'padA',
    upgrades: { ...state.upgrades },
    itemsDelivered: state.items.filter((i) => i.delivered).map((i) => i.def.id),
    itemPositions,
    barriersCleared: [...state.barriersCleared],
    bossDead: state.bossDead,
  })
}

export function maxFuel(state: GameState): number {
  return TUNE.pod.fuelMax * (state.upgrades.fueltank ? TUNE.upgrades.fuelMul : 1)
}

export function ropeLength(state: GameState): number {
  return TUNE.rope.length * (state.upgrades.grapple ? TUNE.upgrades.ropeLenMul : 1)
}

export function ropeStiffness(state: GameState): number {
  return state.upgrades.grapple ? TUNE.rope.winchStiffness : TUNE.rope.stiffness
}

function updateFlight(state: GameState, input: InputState, dt: number): void {
  const thrustMul = state.upgrades.engine ? TUNE.upgrades.engineThrustMul : 1
  const res = updateShipFlight(state.ship, input, state.world.map, dt, thrustMul)

  if (res.wallImpact > TUNE.landing.softVx) {
    state.ship.hull -= (res.wallImpact - TUNE.landing.softVx) * TUNE.ship.groundScrapeDamage
    emit(state, 'impact', state.ship.body.x, state.ship.body.y, res.wallImpact / 200)
    kick(state, 3)
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
        saveGame(state)
        say(state, 'Touchdown. Hull repaired. Progress saved.')
        emit(state, 'thud', state.ship.body.x, state.ship.body.y + state.ship.body.h / 2, 0.8)
        kick(state, 2)
      } else {
        state.ship.hull -= landing.damage
        say(state, 'Hard landing. Set down gently to repair.')
        emit(state, 'impact', state.ship.body.x, state.ship.body.y + state.ship.body.h / 2, 1)
        kick(state, 6)
      }
    } else if (vy > TUNE.landing.crashVy) {
      die(state, 'The ship broke apart on the rocks.')
      return
    } else if (vy > TUNE.landing.softVy) {
      state.ship.hull -= (vy - TUNE.landing.softVy) * TUNE.ship.groundScrapeDamage * 4
      say(state, 'Rough ground. Find a pad.', 1.5)
      emit(state, 'impact', state.ship.body.x, state.ship.body.y + state.ship.body.h / 2, 0.6)
      kick(state, 4)
    } else {
      emit(state, 'thud', state.ship.body.x, state.ship.body.y + state.ship.body.h / 2, 0.4)
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
    emit(state, 'launch', p.x, p.y, 0.5)
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
    if (pod.grappled || pod.wallAnchor) {
      pod.grappled = null
      pod.wallAnchor = null
      say(state, 'Grapple released.', 1.2)
    } else {
      const item = nearestItem(state.items, pod.body.x, pod.body.y, TUNE.rope.grabRange)
      if (item) {
        pod.grappled = item.def.id
        say(state, `Grappled: ${item.def.kind} (mass ${item.def.mass})`, 1.6)
      } else if (state.upgrades.grapple) {
        const anchor = nearestSolidCell(
          state.world.map,
          pod.body.x,
          pod.body.y,
          TUNE.rope.grabRange,
        )
        if (anchor) {
          pod.wallAnchor = anchor
          say(state, 'Anchored. Swing.', 1.2)
        }
      }
    }
  }

  if (input.fire && state.upgrades.weapon && pod.fireCooldown <= 0) {
    pod.fireCooldown = TUNE.weapon.cooldown
    emit(state, 'shot', pod.body.x, pod.body.y, 0.7)
    state.shots.push({
      x: pod.body.x + Math.sin(pod.angle) * (TUNE.pod.r + 3),
      y: pod.body.y - Math.cos(pod.angle) * (TUNE.pod.r + 3),
      px: pod.body.x,
      py: pod.body.y,
      vx: pod.body.vx + Math.sin(pod.angle) * TUNE.weapon.shotSpeed,
      vy: pod.body.vy - Math.cos(pod.angle) * TUNE.weapon.shotSpeed,
      ttl: TUNE.weapon.ttl,
    })
  }
  pod.fireCooldown -= dt

  const thrustMul = state.upgrades.engine ? TUNE.upgrades.engineThrustMul : 1
  const res = updatePodFlight(pod, input, state.world.map, dt, thrustMul)
  if (res.impact > TUNE.pod.crashSpeed) {
    die(state, 'The pod was smashed against the rock.', pod.body.x, pod.body.y)
    return
  }

  state.ropeTaut = false
  state.ropeStrain = 0
  if (pod.grappled) {
    const item = state.items.find((i) => i.def.id === pod.grappled)
    if (item) {
      const rope = solveRope(pod.body, item.body, ropeLength(state), ropeStiffness(state))
      state.ropeTaut = rope.taut
      state.ropeStrain = rope.strain
    }
  } else if (pod.wallAnchor) {
    const rope = solveRopeAnchor(
      pod.body,
      pod.wallAnchor.x,
      pod.wallAnchor.y,
      ropeLength(state),
      ropeStiffness(state),
    )
    state.ropeTaut = rope.taut
    state.ropeStrain = rope.strain
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
    pod.wallAnchor = null
    pod.fuel = maxFuel(state)
    state.mode = 'landed'
    say(state, 'Pod docked. Fuel topped up.', 1.6)
    emit(state, 'chime', dock.x, dock.y, 0.5)
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
  if (item.delivered) {
    emit(state, 'chime', state.ship.body.x, state.ship.body.y - 20, 1)
    saveGame(state)
  }
}

function updateShots(state: GameState, dt: number): void {
  const map = state.world.map
  const s = map.size
  for (const shot of state.shots) {
    shot.px = shot.x
    shot.py = shot.y
    shot.x += shot.vx * dt
    shot.y += shot.vy * dt
    shot.ttl -= dt
    const tx = Math.floor(shot.x / s)
    const ty = Math.floor(shot.y / s)
    const cell = cellAt(map, tx, ty)
    if (cell === AIR) continue
    shot.ttl = 0
    if (cell === BARRIER) {
      // Blast: clear barrier cells around the impact and remember them.
      const r = Math.ceil(TUNE.weapon.blastRadius / s)
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const bx = tx + dx
          const by = ty + dy
          const cx = (bx + 0.5) * s
          const cy = (by + 0.5) * s
          if (Math.hypot(cx - shot.x, cy - shot.y) > TUNE.weapon.blastRadius) continue
          if (cellAt(map, bx, by) !== BARRIER) continue
          setCell(map, bx, by, AIR)
          state.barriersCleared.add(`${bx},${by}`)
        }
      }
      say(state, 'The rock crumbles.', 1.0)
      emit(state, 'blast', shot.x, shot.y, 1)
      kick(state, 6)
    }
  }
  state.shots = state.shots.filter((shot) => shot.ttl > 0)
}

export function update(state: GameState, input: InputState, dt: number): GameState {
  state.time += dt
  state.events.length = 0
  state.shake *= Math.exp(-5 * dt)
  if (state.messageTimer > 0) {
    state.messageTimer -= dt
    if (state.messageTimer <= 0) state.message = ''
  }

  if (
    input.pause &&
    (state.mode === 'flight' || state.mode === 'landed' || state.mode === 'pod')
  ) {
    state.pausedFrom = state.mode
    state.mode = 'paused'
    return state
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
      state.deadCooldown -= dt
      if (input.confirm && state.deadCooldown <= 0) return startGame(state.world)
      break
    case 'won':
      if (input.confirm) {
        clearSave()
        return newGame(state.world, 'padA')
      }
      break
    case 'paused':
      if (input.pause || input.confirm) {
        state.mode = state.pausedFrom
      } else if (input.action) {
        return startGame(state.world) // restart from last pad
      } else if (input.reset) {
        clearSave()
        return newGame(state.world, 'padA')
      }
      return state
  }

  // Items, plates, doors, and shots exist in the world whatever the mode.
  updateItems(state.items, state.world.map, dt)
  for (const door of updatePlatesAndDoors(state.world, state.items)) {
    const t = door.tiles[0]
    emit(state, 'door', (t.tx + 0.5) * 16, (t.ty + 0.5) * 16, 0.8)
  }
  updateShots(state, dt)

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
