// Fixed 60Hz timestep with an accumulator; render gets an interpolation alpha.

export const DT = 1 / 60

export function startLoop(update: (dt: number) => void, render: (alpha: number) => void): void {
  let acc = 0
  let last = performance.now()

  function frame(now: number): void {
    // Cap the catch-up so a background tab doesn't fast-forward the sim.
    acc += Math.min((now - last) / 1000, 0.25)
    last = now
    while (acc >= DT) {
      update(DT)
      acc -= DT
    }
    render(acc / DT)
    requestAnimationFrame(frame)
  }

  requestAnimationFrame(frame)
}
