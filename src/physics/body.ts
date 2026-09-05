// Pure body type and integration helpers. No game imports.

export interface Body {
  x: number
  y: number
  px: number // previous position, for render interpolation
  py: number
  vx: number
  vy: number
  w: number
  h: number
  mass: number
}

export function makeBody(x: number, y: number, w: number, h: number, mass: number): Body {
  return { x, y, px: x, py: y, vx: 0, vy: 0, w, h, mass }
}

/** Snapshot position at the start of a tick so the renderer can interpolate. */
export function beginTick(b: Body): void {
  b.px = b.x
  b.py = b.y
}

/** Apply an acceleration for dt and clamp speed. Position advances in moveBody. */
export function accelerate(b: Body, ax: number, ay: number, dt: number, maxSpeed: number): void {
  b.vx += ax * dt
  b.vy += ay * dt
  const sp = Math.hypot(b.vx, b.vy)
  if (sp > maxSpeed) {
    const k = maxSpeed / sp
    b.vx *= k
    b.vy *= k
  }
}
