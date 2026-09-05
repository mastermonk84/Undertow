// HUD view-model. No drawing here — render/draw.ts consumes this.

import { TUNE } from '../tune'
import { nearestItem } from './objects'
import { dockPoint } from './ship'
import { maxFuel, type GameState } from './state'

export interface Hud {
  hull: number // 0..1
  fuel: number // 0..1
  prompt: string
  message: string
  deathReason: string
  mode: GameState['mode']
  upgrades: string[]
}

export function buildHud(state: GameState): Hud {
  let prompt = ''
  switch (state.mode) {
    case 'landed':
      prompt = 'E launch pod · hold W/↑ lift off'
      break
    case 'pod': {
      if (state.pod.grappled) {
        prompt = 'E release grapple · dock at the ship to deliver'
      } else if (state.pod.wallAnchor) {
        prompt = 'E release anchor'
      } else if (nearestItem(state.items, state.pod.body.x, state.pod.body.y, TUNE.rope.grabRange)) {
        prompt = 'E grapple'
      } else {
        const dock = dockPoint(state.ship)
        const d = Math.hypot(state.pod.body.x - dock.x, state.pod.body.y - dock.y)
        if (d < 120) prompt = 'approach the ship to dock'
        else if (state.upgrades.grapple) prompt = 'E anchor to rock near a wall'
      }
      if (state.upgrades.weapon) prompt = prompt ? `${prompt} · C fire` : 'C fire'
      break
    }
    case 'flight':
      prompt = 'land gently and level on a pad'
      break
    case 'dead':
      prompt = 'Enter retry'
      break
    case 'won':
      prompt = 'Enter play again'
      break
    case 'paused':
      break
  }

  const upgrades: string[] = []
  if (state.upgrades.engine) upgrades.push('ENGINE')
  if (state.upgrades.fueltank) upgrades.push('AUX FUEL')
  if (state.upgrades.grapple) upgrades.push('WINCH')
  if (state.upgrades.weapon) upgrades.push('CUTTER')

  return {
    upgrades,
    hull: Math.max(0, state.ship.hull) / TUNE.ship.hullMax,
    fuel: state.pod.fuel / maxFuel(state),
    prompt,
    message: state.message,
    deathReason: state.deathReason,
    mode: state.mode,
  }
}
