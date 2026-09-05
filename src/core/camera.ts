// Camera: follows a target, clamped to the current room rectangle.
// Room transitions are just the clamp rect changing; the lerp slides the view.

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Camera {
  x: number // top-left, world px
  y: number
}

export function makeCamera(): Camera {
  return { x: 0, y: 0 }
}

export function updateCamera(
  cam: Camera,
  targetX: number,
  targetY: number,
  clamp: Rect,
  viewW: number,
  viewH: number,
  dt: number,
): void {
  let wantX = targetX - viewW / 2
  let wantY = targetY - viewH / 2
  wantX = Math.max(clamp.x, Math.min(wantX, clamp.x + clamp.w - viewW))
  wantY = Math.max(clamp.y, Math.min(wantY, clamp.y + clamp.h - viewH))
  // If the room is smaller than the view, centre it.
  if (clamp.w < viewW) wantX = clamp.x + (clamp.w - viewW) / 2
  if (clamp.h < viewH) wantY = clamp.y + (clamp.h - viewH) / 2

  const k = 1 - Math.exp(-8 * dt) // framerate-independent smoothing
  cam.x += (wantX - cam.x) * k
  cam.y += (wantY - cam.y) * k
}
