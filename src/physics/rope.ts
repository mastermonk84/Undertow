// Taut-only distance constraint between two bodies. Pure: no game imports.
// The rope pulls, never pushes. Impulse and position correction are split by
// inverse mass, so heavy cargo drags a light pod and momentum is conserved.

import type { Body } from './body'

export interface RopeResult {
  taut: boolean
  strain: number // separating speed removed this step (for audio/FX later)
}

export function solveRope(a: Body, b: Body, length: number, stiffness = 1): RopeResult {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const d = Math.hypot(dx, dy)
  if (d <= length || d === 0) return { taut: false, strain: 0 }

  const nx = dx / d
  const ny = dy / d
  const invA = 1 / a.mass
  const invB = 1 / b.mass
  const invSum = invA + invB

  // Remove separating relative velocity along the rope.
  const vrel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
  let strain = 0
  if (vrel > 0) {
    const j = (vrel / invSum) * stiffness
    a.vx += j * nx * invA
    a.vy += j * ny * invA
    b.vx -= j * nx * invB
    b.vy -= j * ny * invB
    strain = vrel
  }

  // Project the overshoot away, weighted the same way.
  const over = (d - length) * stiffness
  a.x += nx * over * (invA / invSum)
  a.y += ny * over * (invA / invSum)
  b.x -= nx * over * (invB / invSum)
  b.y -= ny * over * (invB / invSum)

  return { taut: true, strain }
}
