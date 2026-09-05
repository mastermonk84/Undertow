import { describe, expect, it } from 'vitest'
import { classifyLanding, type LandingThresholds } from '../src/physics/landing'

const T: LandingThresholds = {
  softVy: 60,
  softVx: 45,
  softTilt: 0.15,
  crashVy: 190,
  damageScale: 0.5,
  tiltDamage: 120,
}

describe('landing classification', () => {
  it('just under every threshold is soft with zero damage', () => {
    const r = classifyLanding(44.9, 59.9, 0.149, T)
    expect(r.kind).toBe('soft')
    expect(r.damage).toBe(0)
  })

  it('just over the descent threshold is hard with damage', () => {
    const r = classifyLanding(0, 61, 0, T)
    expect(r.kind).toBe('hard')
    expect(r.damage).toBeGreaterThan(0)
  })

  it('too much tilt alone makes a landing hard', () => {
    const r = classifyLanding(0, 30, 0.3, T)
    expect(r.kind).toBe('hard')
    expect(r.damage).toBeGreaterThan(0)
  })

  it('damage is monotonic in impact speed', () => {
    let prev = -1
    for (const vy of [61, 80, 110, 150, 189]) {
      const r = classifyLanding(0, vy, 0, T)
      expect(r.damage).toBeGreaterThan(prev)
      prev = r.damage
    }
  })

  it('at or above crash speed the ship is lost', () => {
    expect(classifyLanding(0, 190, 0, T).kind).toBe('crash')
    expect(classifyLanding(0, 400, 0, T).kind).toBe('crash')
  })

  it('drift alone can make a landing hard', () => {
    const r = classifyLanding(80, 20, 0, T)
    expect(r.kind).toBe('hard')
  })
})
