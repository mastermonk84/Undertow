# Undertow

A browser Metroidvania with Solar Jetman-style flight and towing. Designed by
Luke. A heavy ship that must land softly on pads; a small pod with rotate+thrust
controls, limited fuel, and a grapple; towed cargo is the upgrade system, and
mass and fuel range gate the world physically. The final tow is the planet's
core.

## Run it locally

```
npm install
npm run dev        # dev server with hot reload — open the printed URL
```

Production build:

```
npm run build      # typecheck + bundle into dist/
npm run preview    # serve the production build locally
```

Tests (physics, world structure, game mechanisms):

```
npm test
```

## Controls

| | Keyboard | Gamepad |
|---|---|---|
| Ship tilt / pod rotate | ←/→ or A/D | left stick / dpad |
| Thrust | ↑ / W / Space | A / dpad-up / RT |
| Launch pod · grapple · release | E or X | B or X |
| Fire cutter (once installed) | C / Shift | Y |
| Pause | Esc / P | Start |
| Confirm | Enter | A |

Land **slowly, level, and centred** on a pad: pads repair the hull and save
progress. The ship cannot lift off unless the pod is docked. The pod launches
only from a landed ship and refuels only there. Heavy cargo genuinely drags —
if the rope's load beats your thrust, drag it, swing it, or come back with a
better engine.

## Feel tuning

Every constant lives in `src/tune.ts`. With `npm run dev` running, edit a value
and the running game hot-swaps it — no restart, no rebuild.

## Deploy

Static site, no backend. On Vercel: import the repo, framework preset **Vite**,
build command `npm run build`, output `dist/` (all auto-detected). Saves live
in the player's localStorage.

## Layout

```
src/core     fixed-timestep loop, input (keyboard+gamepad), camera, audio synth
src/physics  bodies, tile collision, rope constraint, landing — pure, tested
src/world    text-grid map format, the seven rooms, localStorage saves
src/game     ship, pod, items/plates/doors, boss, mode machine, HUD data
src/render   canvas drawing and particles only — no game logic
test/        Vitest suites
```

See `PLAN.md` for the design plan and milestone history.
