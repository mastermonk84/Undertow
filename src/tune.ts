// Every feel constant in the game lives here. Tweak while `vite dev` runs —
// HMR reloads the sim with the new numbers.

export const TUNE = {
  tileSize: 16,
  view: { w: 960, h: 540 },

  gravity: 150, // px/s^2, downward
  maxSpeed: 520, // hard clamp; keeps bodies under one tile per step

  ship: {
    w: 44,
    h: 26,
    mass: 12,
    mainThrust: 260, // px/s^2 while main thruster burns (engine upgrade multiplies)
    latThrust: 110, // px/s^2 sideways
    tiltMax: 0.32, // rad of visual+landing tilt at full lateral burn
    tiltRate: 3.0, // rad/s toward target tilt
    hullMax: 100,
    liftKick: 60, // px/s upward on lift-off
    groundScrapeDamage: 0.06, // hull per px/s of off-pad impact speed
  },

  pod: {
    r: 7,
    mass: 1,
    // Thrust force vs cargo weight is the mass gate: the pod hover-lifts a
    // cargo only while thrust > (1 + cargoMass) * gravity. At 320 the pod
    // lifts up to ~1.1 mass; with the engine upgrade (x1.45) up to ~2.0.
    // Heavier cargo must be dragged and swung, Solar Jetman style.
    thrust: 320, // px/s^2 along facing
    turnRate: 4.4, // rad/s
    fuelMax: 100,
    fuelBurn: 8.5, // fuel/s while thrusting
    dockRange: 30, // px from ship dock point
    crashSpeed: 220, // impact px/s that destroys the pod
  },

  rope: {
    length: 96,
    grabRange: 38, // px from pod centre to item centre (or wall, with the winch)
    stiffness: 0.6, // base rope is stretchy; the winch upgrade makes it crisp
    winchStiffness: 1.0,
  },

  weapon: {
    shotSpeed: 430,
    cooldown: 0.22, // s between shots
    ttl: 1.1, // s shot lifetime
    blastRadius: 22, // px — barrier cells cleared around an impact
  },

  delivery: {
    range: 150, // px from ship centre for a towed item to count as delivered on dock
  },

  upgrades: {
    engineThrustMul: 1.45, // ship AND pod thrust multiplier
    fuelMul: 1.6, // pod tank capacity multiplier
    ropeLenMul: 1.4, // grapple winch rope length multiplier
  },

  landing: {
    softVy: 60, // max descent px/s for a clean touchdown
    softVx: 45, // max drift px/s
    softTilt: 0.15, // max rad
    crashVy: 190, // at/above this the ship is lost outright
    damageScale: 0.5, // hull per px/s over the soft thresholds
    tiltDamage: 120, // hull per rad over the soft tilt
  },
}
