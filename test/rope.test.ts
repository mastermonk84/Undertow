import { describe, expect, it } from 'vitest'
import { makeBody } from '../src/physics/body'
import { solveRope } from '../src/physics/rope'

const LENGTH = 100

describe('rope constraint', () => {
  it('does nothing while slack', () => {
    const pod = makeBody(0, 0, 10, 10, 1)
    const cargo = makeBody(50, 0, 10, 10, 9)
    pod.vx = -20
    const res = solveRope(pod, cargo, LENGTH)
    expect(res.taut).toBe(false)
    expect(pod.vx).toBe(-20)
    expect(cargo.vx).toBe(0)
    expect(cargo.x).toBe(50)
  })

  it('splits the impulse by inverse mass (1:9 masses -> 9:1 velocity change)', () => {
    const pod = makeBody(0, 0, 10, 10, 1)
    const cargo = makeBody(110, 0, 10, 10, 9)
    pod.vx = -30 // pod pulling away from cargo -> separating
    const res = solveRope(pod, cargo, LENGTH)
    expect(res.taut).toBe(true)
    const dPod = Math.abs(pod.vx - -30)
    const dCargo = Math.abs(cargo.vx - 0)
    expect(dPod / dCargo).toBeCloseTo(9, 5)
  })

  it('conserves momentum across the impulse', () => {
    const pod = makeBody(0, 0, 10, 10, 1)
    const cargo = makeBody(110, 0, 10, 10, 9)
    pod.vx = -30
    cargo.vy = 5
    const before = { px: pod.mass * pod.vx + cargo.mass * cargo.vx, py: pod.mass * pod.vy + cargo.mass * cargo.vy }
    solveRope(pod, cargo, LENGTH)
    const after = { px: pod.mass * pod.vx + cargo.mass * cargo.vx, py: pod.mass * pod.vy + cargo.mass * cargo.vy }
    expect(after.px).toBeCloseTo(before.px, 6)
    expect(after.py).toBeCloseTo(before.py, 6)
  })

  it('removes separating velocity along the rope', () => {
    const pod = makeBody(0, 0, 10, 10, 1)
    const cargo = makeBody(110, 0, 10, 10, 9)
    pod.vx = -30
    solveRope(pod, cargo, LENGTH)
    const dx = cargo.x - pod.x
    const dy = cargo.y - pod.y
    const d = Math.hypot(dx, dy)
    const vrel = ((cargo.vx - pod.vx) * dx + (cargo.vy - pod.vy) * dy) / d
    expect(vrel).toBeLessThanOrEqual(1e-6)
  })

  it('projects the bodies back to rope length', () => {
    const pod = makeBody(0, 0, 10, 10, 1)
    const cargo = makeBody(120, 0, 10, 10, 9)
    solveRope(pod, cargo, LENGTH)
    expect(Math.hypot(cargo.x - pod.x, cargo.y - pod.y)).toBeCloseTo(LENGTH, 5)
  })

  it('moves the lighter body further during projection', () => {
    const pod = makeBody(0, 0, 10, 10, 1)
    const cargo = makeBody(120, 0, 10, 10, 9)
    solveRope(pod, cargo, LENGTH)
    expect(Math.abs(pod.x - 0)).toBeGreaterThan(Math.abs(cargo.x - 120))
  })
})
