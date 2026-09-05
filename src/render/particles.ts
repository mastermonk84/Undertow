// Cosmetic particles in world coordinates. Ticked at the fixed timestep,
// drawn inside the camera transform. Never touches game state.

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  ttl: number
  ttl0: number
  size: number
  color: string
  grav: number
}

const MAX = 500

export class Particles {
  private list: Particle[] = []

  private push(p: Particle): void {
    if (this.list.length >= MAX) this.list.shift()
    this.list.push(p)
  }

  burst(
    x: number,
    y: number,
    count: number,
    opts: {
      speed: number
      colors: string[]
      ttl: number
      size?: number
      grav?: number
      dirX?: number
      dirY?: number
      spread?: number // radians around dir; default full circle
    },
  ): void {
    for (let i = 0; i < count; i++) {
      let ang: number
      if (opts.dirX !== undefined || opts.dirY !== undefined) {
        const base = Math.atan2(opts.dirY ?? 0, opts.dirX ?? 0)
        ang = base + (Math.random() - 0.5) * (opts.spread ?? 0.8)
      } else {
        ang = Math.random() * Math.PI * 2
      }
      const sp = opts.speed * (0.4 + Math.random() * 0.6)
      this.push({
        x,
        y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        ttl: opts.ttl * (0.6 + Math.random() * 0.4),
        ttl0: opts.ttl,
        size: (opts.size ?? 2.5) * (0.7 + Math.random() * 0.6),
        color: opts.colors[Math.floor(Math.random() * opts.colors.length)],
        grav: opts.grav ?? 0,
      })
    }
  }

  update(dt: number): void {
    for (const p of this.list) {
      p.vy += p.grav * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.ttl -= dt
    }
    this.list = this.list.filter((p) => p.ttl > 0)
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.list) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.ttl / (p.ttl0 * 0.5)))
      ctx.fillStyle = p.color
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
    }
    ctx.globalAlpha = 1
  }
}

export const FLAME = ['#ffb14d', '#ff8a3d', '#ffd98a']
export const DUST = ['#8d99a6', '#6d7884', '#a8b2bd']
export const SPARK = ['#ffdd88', '#ffb14d', '#ffffff']
export const DEBRIS = ['#8a4444', '#5e2c2c', '#a86a4a']
export const GLITTER = ['#ffd75e', '#fff2b8']
