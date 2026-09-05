// Canvas 2D drawing only. Reads GameState + Hud, never mutates game logic.

import type { Body } from '../physics/body'
import { AIR, BARRIER, DOOR, PAD, ROCK, cellAt } from '../physics/tiles'
import { TUNE } from '../tune'
import { buildHud } from '../game/hud'
import { ropeLength, type GameState } from '../game/state'
import type { Item } from '../game/objects'
import type { Particles } from './particles'

function ix(b: Body, alpha: number): number {
  return b.px + (b.x - b.px) * alpha
}

function iy(b: Body, alpha: number): number {
  return b.py + (b.y - b.py) * alpha
}

const ROCK_FILL = '#242b35'
const ROCK_EDGE = '#3d4a5c'
const PAD_FILL = '#14402f'
const PAD_EDGE = '#3fe08f'
const DOOR_FILL = '#4a3566'
const BARRIER_FILL = '#5e2c2c'

export function draw(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  alpha: number,
  particles?: Particles,
): void {
  const { w: vw, h: vh } = TUNE.view
  const cam = state.camera

  const grad = ctx.createLinearGradient(0, 0, 0, vh)
  grad.addColorStop(0, '#0a0e18')
  grad.addColorStop(1, '#101725')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, vw, vh)

  const shakeX = (Math.random() - 0.5) * 2 * state.shake
  const shakeY = (Math.random() - 0.5) * 2 * state.shake

  ctx.save()
  ctx.translate(-Math.round(cam.x + shakeX), -Math.round(cam.y + shakeY))

  drawTiles(ctx, state)
  drawPlates(ctx, state)
  for (const item of state.items) drawItem(ctx, item, alpha)
  drawRope(ctx, state, alpha)
  drawShots(ctx, state, alpha)
  drawBoss(ctx, state, alpha)
  particles?.draw(ctx)
  drawShip(ctx, state, alpha)
  if (state.mode === 'pod') drawPod(ctx, state, alpha)

  ctx.restore()

  drawHud(ctx, state)
}

function drawTiles(ctx: CanvasRenderingContext2D, state: GameState): void {
  const map = state.world.map
  const s = map.size
  const cam = state.camera
  const x0 = Math.max(0, Math.floor(cam.x / s))
  const x1 = Math.min(map.wTiles - 1, Math.ceil((cam.x + TUNE.view.w) / s))
  const y0 = Math.max(0, Math.floor(cam.y / s))
  const y1 = Math.min(map.hTiles - 1, Math.ceil((cam.y + TUNE.view.h) / s))

  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const c = cellAt(map, tx, ty)
      if (c === AIR) continue
      const x = tx * s
      const y = ty * s
      if (c === ROCK) {
        ctx.fillStyle = ROCK_FILL
        ctx.fillRect(x, y, s, s)
        if (cellAt(map, tx, ty - 1) === AIR) {
          ctx.fillStyle = ROCK_EDGE
          ctx.fillRect(x, y, s, 3)
        }
      } else if (c === PAD) {
        ctx.fillStyle = PAD_FILL
        ctx.fillRect(x, y, s, s)
        ctx.fillStyle = PAD_EDGE
        ctx.fillRect(x, y, s, 3)
      } else if (c === DOOR) {
        ctx.fillStyle = DOOR_FILL
        ctx.fillRect(x + 2, y, s - 4, s)
      } else if (c === BARRIER) {
        ctx.fillStyle = BARRIER_FILL
        ctx.fillRect(x, y, s, s)
        ctx.strokeStyle = '#8a4444'
        ctx.strokeRect(x + 1.5, y + 1.5, s - 3, s - 3)
      }
    }
  }
}

function drawPlates(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const plate of state.world.plates) {
    const r = plate.rect
    ctx.fillStyle = plate.pressed ? '#3fe08f' : '#2a6a4d'
    ctx.fillRect(r.x + 2, r.y + r.h - 5, r.w - 4, 5)
  }
}

const ITEM_COLORS: Record<string, string> = {
  rock: '#8d99a6',
  boulder: '#5f6a76',
  crate: '#b08a4f',
  engine: '#5fa8f5',
  fueltank: '#4fd6c2',
  grapple: '#c78ef0',
  weapon: '#f08e8e',
  relic: '#ffd75e',
  core: '#ff8659',
}

function drawItem(ctx: CanvasRenderingContext2D, item: Item, alpha: number): void {
  if (item.delivered) return
  const x = ix(item.body, alpha)
  const y = iy(item.body, alpha)
  const r = item.body.w / 2
  ctx.fillStyle = ITEM_COLORS[item.def.kind] ?? '#ffffff'
  if (item.def.kind === 'crate') {
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
    ctx.strokeStyle = '#7a5c2e'
    ctx.strokeRect(x - r + 1.5, y - r + 1.5, r * 2 - 3, r * 2 - 3)
  } else if (item.def.kind === 'relic') {
    ctx.beginPath()
    ctx.moveTo(x, y - r)
    ctx.lineTo(x + r, y)
    ctx.lineTo(x, y + r)
    ctx.lineTo(x - r, y)
    ctx.closePath()
    ctx.fill()
  } else {
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    ctx.beginPath()
    ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.4, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawRope(ctx: CanvasRenderingContext2D, state: GameState, alpha: number): void {
  if (state.mode !== 'pod') return
  let tx: number
  let ty: number
  if (state.pod.grappled) {
    const item = state.items.find((i) => i.def.id === state.pod.grappled)
    if (!item) return
    tx = ix(item.body, alpha)
    ty = iy(item.body, alpha)
  } else if (state.pod.wallAnchor) {
    tx = state.pod.wallAnchor.x
    ty = state.pod.wallAnchor.y
  } else {
    return
  }
  const px = ix(state.pod.body, alpha)
  const py = iy(state.pod.body, alpha)
  ctx.strokeStyle = state.ropeTaut ? '#d8e0ea' : 'rgba(216,224,234,0.45)'
  ctx.lineWidth = state.ropeTaut ? 1.5 : 1
  ctx.beginPath()
  ctx.moveTo(px, py)
  if (state.ropeTaut) {
    ctx.lineTo(tx, ty)
  } else {
    // Slack rope sags toward gravity.
    const dist = Math.hypot(tx - px, ty - py)
    const sag = Math.min(40, (ropeLength(state) - dist) * 0.35)
    ctx.quadraticCurveTo((px + tx) / 2, (py + ty) / 2 + sag, tx, ty)
  }
  ctx.stroke()
  ctx.lineWidth = 1
}

function drawShots(ctx: CanvasRenderingContext2D, state: GameState, alpha: number): void {
  ctx.fillStyle = '#ffe08a'
  for (const shot of state.shots) {
    const x = shot.px + (shot.x - shot.px) * alpha
    const y = shot.py + (shot.y - shot.py) * alpha
    ctx.beginPath()
    ctx.arc(x, y, 2.5, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawBoss(ctx: CanvasRenderingContext2D, state: GameState, alpha: number): void {
  const boss = state.boss
  if (boss.dead) return
  const x = boss.px + (boss.x - boss.px) * alpha
  const y = boss.py + (boss.y - boss.py) * alpha
  const r = TUNE.boss.r

  // Bulk: a dark knot with a slow-breathing outline.
  const pulse = 1 + Math.sin(state.time * 2.2) * 0.06
  ctx.fillStyle = boss.flash > 0 ? '#f4f7fa' : '#1a1420'
  ctx.beginPath()
  ctx.arc(x, y, r * pulse, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = boss.flash > 0 ? '#ffffff' : '#5e2c66'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.lineWidth = 1

  // The eye tracks the pod.
  const pod = state.pod.body
  const dx = pod.x - x
  const dy = pod.y - y
  const d = Math.hypot(dx, dy) || 1
  ctx.fillStyle = '#ff5e4d'
  ctx.beginPath()
  ctx.arc(x + (dx / d) * 6, y + (dy / d) * 6, 5, 0, Math.PI * 2)
  ctx.fill()

  // Bolts.
  ctx.fillStyle = '#ff6a5e'
  for (const bolt of state.bossShots) {
    const bx = bolt.px + (bolt.x - bolt.px) * alpha
    const by = bolt.py + (bolt.y - bolt.py) * alpha
    ctx.beginPath()
    ctx.arc(bx, by, 3.5, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawShip(ctx: CanvasRenderingContext2D, state: GameState, alpha: number): void {
  const ship = state.ship
  const x = ix(ship.body, alpha)
  const y = iy(ship.body, alpha)
  const w = ship.body.w
  const h = ship.body.h

  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(ship.tilt)

  if (ship.thrusting) {
    const flick = 1 + Math.sin(state.time * 60) * 0.25
    ctx.fillStyle = '#ffb14d'
    ctx.beginPath()
    ctx.moveTo(-7, h / 2)
    ctx.lineTo(7, h / 2)
    ctx.lineTo(0, h / 2 + 16 * flick)
    ctx.closePath()
    ctx.fill()
  }

  // Hull
  ctx.fillStyle = '#c8d2dd'
  ctx.beginPath()
  ctx.moveTo(-w / 2, h / 2)
  ctx.lineTo(-w / 2 + 6, -h / 2)
  ctx.lineTo(w / 2 - 6, -h / 2)
  ctx.lineTo(w / 2, h / 2)
  ctx.closePath()
  ctx.fill()

  // Cockpit
  ctx.fillStyle = '#7fd4ff'
  ctx.beginPath()
  ctx.arc(0, -h / 2 + 6, 6, Math.PI, 0)
  ctx.fill()

  // Legs
  ctx.strokeStyle = '#96a2b0'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(-w / 2 + 4, h / 2 - 2)
  ctx.lineTo(-w / 2 - 3, h / 2 + 4)
  ctx.moveTo(w / 2 - 4, h / 2 - 2)
  ctx.lineTo(w / 2 + 3, h / 2 + 4)
  ctx.stroke()
  ctx.lineWidth = 1

  // Lateral thruster puffs
  if (state.mode === 'flight' && ship.latDir !== 0) {
    ctx.fillStyle = 'rgba(255,220,150,0.8)'
    const px = -ship.latDir * (w / 2 + 4)
    ctx.beginPath()
    ctx.arc(px, 0, 4, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}

function drawPod(ctx: CanvasRenderingContext2D, state: GameState, alpha: number): void {
  const pod = state.pod
  const x = ix(pod.body, alpha)
  const y = iy(pod.body, alpha)
  const r = TUNE.pod.r

  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(pod.angle)

  if (pod.thrusting) {
    const flick = 1 + Math.sin(state.time * 70) * 0.3
    ctx.fillStyle = '#ffc26b'
    ctx.beginPath()
    ctx.moveTo(-3, r)
    ctx.lineTo(3, r)
    ctx.lineTo(0, r + 10 * flick)
    ctx.closePath()
    ctx.fill()
  }

  ctx.fillStyle = '#e8eef4'
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#5fc7ff'
  ctx.beginPath()
  ctx.arc(0, -2, 3, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

function drawHud(ctx: CanvasRenderingContext2D, state: GameState): void {
  const hud = buildHud(state)
  const { w: vw, h: vh } = TUNE.view

  ctx.font = '11px monospace'
  ctx.textBaseline = 'top'

  drawBar(ctx, 14, 14, 150, 'HULL', hud.hull, hud.hull > 0.3 ? '#69d98c' : '#e86a5e')
  drawBar(ctx, 14, 34, 150, 'FUEL', hud.fuel, hud.fuel > 0.25 ? '#5fc7ff' : '#e8b45e')

  if (hud.prompt && hud.mode !== 'won' && hud.mode !== 'title') {
    ctx.fillStyle = 'rgba(230,238,246,0.85)'
    ctx.textAlign = 'center'
    ctx.fillText(hud.prompt, vw / 2, vh - 26)
    ctx.textAlign = 'left'
  }

  if (hud.message) {
    ctx.font = '14px monospace'
    ctx.fillStyle = '#f4f7fa'
    ctx.textAlign = 'center'
    ctx.fillText(hud.message, vw / 2, 60)
    ctx.textAlign = 'left'
  }

  if (hud.upgrades.length > 0) {
    ctx.textAlign = 'right'
    ctx.fillStyle = 'rgba(150,190,230,0.7)'
    ctx.fillText(hud.upgrades.join(' · '), vw - 14, 16)
    ctx.textAlign = 'left'
  }

  if (hud.mode === 'won') {
    ctx.fillStyle = 'rgba(4,5,8,0.88)'
    ctx.fillRect(0, 0, vw, vh)
    ctx.textAlign = 'center'
    ctx.font = '26px monospace'
    ctx.fillStyle = '#ff8659'
    ctx.fillText('THE FINAL TOW', vw / 2, vh / 2 - 80)
    ctx.font = '14px monospace'
    ctx.fillStyle = '#c8d2dd'
    const lines = [
      'The core seats itself in the hold, and the ship comes alive.',
      'Behind you, every pad goes dark. The caves stop breathing.',
      'You were told this was a rescue.',
      'Rescues do not leave a world hollow.',
      '',
      'The undertow lets go. It has nothing left to hold.',
    ]
    lines.forEach((line, i) => ctx.fillText(line, vw / 2, vh / 2 - 36 + i * 22))
    ctx.fillStyle = 'rgba(200,210,221,0.7)'
    ctx.fillText('Press Enter', vw / 2, vh / 2 + 108)
    ctx.textAlign = 'left'
  }

  if (hud.mode === 'title') {
    ctx.fillStyle = 'rgba(5,6,10,0.82)'
    ctx.fillRect(0, 0, vw, vh)
    ctx.textAlign = 'center'
    ctx.font = 'bold 54px monospace'
    ctx.fillStyle = '#e6eef6'
    ctx.fillText('UNDERTOW', vw / 2, vh / 2 - 110)
    ctx.font = '14px monospace'
    ctx.fillStyle = '#7fa8c8'
    ctx.fillText('Bring it all home.', vw / 2, vh / 2 - 66)
    ctx.fillStyle = '#c8d2dd'
    const help = [
      'SHIP    ←/→ tilt · ↑/W/Space thrust · land soft and level on pads',
      'POD     E launch from a landed ship · ←/→ rotate · ↑ thrust',
      'GRAPPLE E near cargo · tow it home · dock to deliver',
      'C fire (with cutter) · Esc pause · gamepad supported',
    ]
    help.forEach((line, i) => ctx.fillText(line, vw / 2, vh / 2 - 16 + i * 22))
    ctx.fillStyle = 'rgba(230,238,246,0.85)'
    ctx.fillText('Press Enter to descend', vw / 2, vh / 2 + 96)
    ctx.textAlign = 'left'
  }

  if (hud.mode === 'dead') {
    ctx.fillStyle = 'rgba(6,8,12,0.75)'
    ctx.fillRect(0, 0, vw, vh)
    ctx.textAlign = 'center'
    ctx.font = '26px monospace'
    ctx.fillStyle = '#e86a5e'
    ctx.fillText('LOST', vw / 2, vh / 2 - 40)
    ctx.font = '14px monospace'
    ctx.fillStyle = '#c8d2dd'
    ctx.fillText(hud.deathReason, vw / 2, vh / 2 - 4)
    ctx.fillText('Press Enter to return to your last pad', vw / 2, vh / 2 + 24)
    ctx.textAlign = 'left'
  }

  if (hud.mode === 'paused') {
    ctx.fillStyle = 'rgba(6,8,12,0.7)'
    ctx.fillRect(0, 0, vw, vh)
    ctx.textAlign = 'center'
    ctx.font = '26px monospace'
    ctx.fillStyle = '#e6eef6'
    ctx.fillText('PAUSED', vw / 2, vh / 2 - 56)
    ctx.font = '14px monospace'
    ctx.fillStyle = '#c8d2dd'
    ctx.fillText('Esc / Enter — resume', vw / 2, vh / 2 - 12)
    ctx.fillText('E — restart from last pad', vw / 2, vh / 2 + 12)
    ctx.fillText('N — abandon save, new expedition', vw / 2, vh / 2 + 36)
    ctx.textAlign = 'left'
  }
}

function drawBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  label: string,
  frac: number,
  color: string,
): void {
  ctx.fillStyle = 'rgba(20,26,34,0.8)'
  ctx.fillRect(x, y, w, 14)
  ctx.fillStyle = color
  ctx.fillRect(x + 2, y + 2, Math.max(0, (w - 4) * Math.min(1, frac)), 10)
  ctx.fillStyle = '#0b0e13'
  ctx.fillText(label, x + 6, y + 3)
}
