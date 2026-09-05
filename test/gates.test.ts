// Progression gates are physical: the pod hover-lifts a cargo only while
// thrust force exceeds (1 + cargoMass) * gravity. These tests pin the tuning
// so a tweak in tune.ts cannot silently break the Metroidvania spine.

import { describe, expect, it } from 'vitest'
import { TUNE } from '../src/tune'
import { rooms } from '../src/world/rooms/world'

function canHoverLift(thrust: number, cargoMass: number): boolean {
  return thrust > (1 + cargoMass) * TUNE.gravity
}

function itemMass(id: string): number {
  for (const room of rooms) {
    for (const o of room.objects) {
      if (o.type === 'item' && o.id === id) return o.mass
    }
  }
  throw new Error(`no item ${id}`)
}

describe('mass gates', () => {
  const base = TUNE.pod.thrust
  const upgraded = TUNE.pod.thrust * TUNE.upgrades.engineThrustMul

  it('the starting pod lifts the tutorial rock, crate, and engine', () => {
    expect(canHoverLift(base, itemMass('rock1'))).toBe(true)
    expect(canHoverLift(base, itemMass('crate1'))).toBe(true)
    expect(canHoverLift(base, itemMass('engine1'))).toBe(true)
  })

  it('the core is untowable without the engine upgrade', () => {
    expect(canHoverLift(base, itemMass('core1'))).toBe(false)
    expect(canHoverLift(upgraded, itemMass('core1'))).toBe(true)
  })

  it('the boulder stays a drag-only mass even fully upgraded', () => {
    expect(canHoverLift(upgraded, itemMass('boulder1'))).toBe(false)
  })

  it('the ship can climb: main thrust beats gravity with margin', () => {
    expect(TUNE.ship.mainThrust).toBeGreaterThan(TUNE.gravity * 1.4)
  })
})
