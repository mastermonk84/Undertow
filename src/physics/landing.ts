// Landing classification. Pure: thresholds are passed in, no game imports.

export interface LandingThresholds {
  softVy: number
  softVx: number
  softTilt: number
  crashVy: number
  damageScale: number
  tiltDamage: number
}

export type LandingKind = 'soft' | 'hard' | 'crash'

export interface LandingResult {
  kind: LandingKind
  damage: number
}

/**
 * Classify a touchdown. vy is downward impact speed (positive), vx drift,
 * tilt in radians. Damage grows monotonically with each excess.
 */
export function classifyLanding(
  vx: number,
  vy: number,
  tilt: number,
  t: LandingThresholds,
): LandingResult {
  if (vy >= t.crashVy) return { kind: 'crash', damage: Infinity }

  const overVy = Math.max(0, vy - t.softVy)
  const overVx = Math.max(0, Math.abs(vx) - t.softVx)
  const overTilt = Math.max(0, Math.abs(tilt) - t.softTilt)

  if (overVy === 0 && overVx === 0 && overTilt === 0) {
    return { kind: 'soft', damage: 0 }
  }

  const damage = (overVy + 0.5 * overVx) * t.damageScale + overTilt * t.tiltDamage
  return { kind: 'hard', damage }
}
