# Undertow — Project Plan

A browser Metroidvania with Solar Jetman-style flight and towing. Designed by Luke.
This document is the working plan: architecture, physics model, data formats, and
milestones. It gets updated as milestones complete and decisions change.

## Concept

Two vehicles, one loop:

- **Main ship** — big and heavy. Hull integrity instead of fuel. Flies
  Lunar-Lander style: main vertical thruster plus lateral thrusters, and lateral
  thrust tilts the ship. A soft, upright landing on a touch pad is the core skill
  check. Pads are save points and repair. The ship cannot lift off unless the pod
  is docked.
- **Pod** — small, Solar Jetman controls (rotate + thrust, inertia, gravity).
  Limited fuel. Launches only from a landed ship; refuels and delivers only at it.
  Carries a grapple to tow objects. Cargo has mass; the rope shares load by mass,
  so heavy cargo drags the pod.
- **Progression** — towed items are the upgrades (engines, fuel tanks, grapples,
  later weapons and shields). Mass and fuel range gate areas physically, not via
  flags. Relocating the ship to deeper pads extends pod range. That is the
  Metroidvania spine.
- **Story** — the player believes they are the hero; the ending reveals they are
  not. The final tow is the planet's core.

## Decisions on record

1. **The v2 prototype is gone.** `tow-vania-v2.html` was never pushed and could
   not be recovered, so the game is rebuilt from the written design. There is no
   "match the prototype" target; feel is tuned from scratch. Every tuning
   constant lives in `src/tune.ts` (the successor to the prototype's `TUNE`) so
   feel iteration is a constant tweak, never a code change.
2. **Ship flight model: upright + tilt.** Main vertical thruster, lateral
   thrusters, tilt follows lateral thrust. Soft landing = slow descent, little
   horizontal drift, near-level tilt, footprint on the pad. (The alternative —
   full rotate+thrust like the pod — was considered and rejected as too
   punishing for the big ship.)
3. **Rope model: single taut-only distance constraint** between pod and cargo.
   It pulls, never pushes; impulses are split by inverse mass, which gives
   "heavy cargo drags the pod" and momentum conservation for free. No segmented
   rope simulation — cosmetic sag arrives with the feel-pass milestone.
4. **Input:** keyboard first, gamepad with Milestone 4, touch later (secondary).
   Controls are digital (rotate/thrust), so deferring gamepad costs no feel work.
5. **Upgrades install by delivery:** tow the item back to the landed ship and
   bring it into the dock zone. A successful pad landing repairs the hull
   (refined when death/respawn arrives in Milestone 4).
6. Placeholder vector/rect art until the feel-pass milestone. Logical
   resolution ~960×540, scaled to fit, crisp edges.
7. **Fresh-start revision:** with no prototype to match, tuning feel with the
   designer is the critical path, so the milestone cut changed: Milestone 1 is
   now a feel sandbox (ship landing + pod/rope towing only), the full loop
   moved to Milestone 2, and the Vercel deploy moved from last to first so
   every push is playable at a URL. Vite HMR on `src/tune.ts` doubles as live
   feel tuning — tweak a constant and the running game updates.

## Stack

TypeScript, HTML canvas 2D, Vite, Vitest for physics tests. No framework, no
backend, no physics library. Static deploy (Vercel). Saves in localStorage.
Desktop browsers with keyboard and gamepad are primary; touch is secondary.

## Architecture

Kept deliberately small. No ECS, no scene graph, no config framework. Add
abstraction only when a second use appears.

```
index.html, package.json, tsconfig.json, vite.config.ts
src/main.ts            bootstrap: wires loop + input + game + render
src/tune.ts            ALL feel constants in one place
src/core/loop.ts       fixed 60 Hz timestep, accumulator, render interpolation
src/core/input.ts      keyboard now; gamepad (M4), touch (later)
src/core/camera.ts     follow + room clamping (transitions in M3)
src/core/audio.ts      (M6)
src/physics/body.ts    Body type, semi-implicit Euler integrate — pure fns
src/physics/tiles.ts   AABB/circle vs tile-grid collision, axis-separated — pure fns
src/physics/rope.ts    taut distance constraint, inverse-mass impulse share — pure fns
src/physics/landing.ts landing classification (soft / hard / crash) — pure fns
src/world/room.ts      map format: text grid + object list; parser
src/world/rooms/*.ts   hand-authored rooms (M1: one sandbox room)
src/world/save.ts      (M4) localStorage save state
src/game/state.ts      GameState + per-tick update orchestration, mode machine
src/game/ship.ts       heavy ship: thrust, tilt, hull, landing, lift-off gate
src/game/pod.ts        rotate+thrust, fuel, launch/dock, grapple attach/release
src/game/objects.ts    towables (upgrades, crate), pressure plate, door, relic
src/game/hud.ts        HUD view-model (fuel, hull, prompts) — no drawing
src/render/draw.ts     canvas 2D drawing only, reads state, never mutates
test/rope.test.ts, landing.test.ts, tiles.test.ts   (Vitest)
```

`src/physics` is pure functions only, unit-tested. `src/render` draws and never
mutates game state.

## Physics model

- Units: pixels and seconds. Fixed dt = 1/60 with an accumulator; rendering
  interpolates between the previous and current physics positions.
- Integration: semi-implicit Euler (`v += (g + F/m)·dt; p += v·dt`).
- Bodies: ship = AABB (with tilt for feel/landing checks), pod and towables =
  circles. Per-body mass.
- Tile collision: axis-separated move-and-resolve against solid tiles, velocity
  zeroed on the hit axis (restitution ≈ 0). Tile size 16 px.
- Rope: when `dist(pod, cargo) > ropeLength`, remove separating relative
  velocity along the rope with an impulse split by inverse mass, plus a
  positional projection split the same way. A slack rope does nothing.
- Landing: on pad contact, classify by impact velocity and tilt. Under
  thresholds = soft landing (save, repair, pod launch enabled); moderately over
  = hull damage scaled by excess; far over = crash. All thresholds in `tune.ts`.
- Lift-off is blocked unless the pod is docked.
- Fuel: pod thrust burns fuel at a constant rate; an empty tank means no thrust
  (gravity still applies — drift home or die); refuel only while docked.

## Map format

Per room: a text grid (`#` rock, `.` air, `=` pad surface, …) plus a typed
object list: pads (id, difficulty), items (kind, mass, position), pressure
plates, doors (linked by id), relic, and room exits (Milestone 3). Rooms are
plain TypeScript data modules — no loader framework. Milestones 1–2 use this
same shape with one or two rooms; Milestone 3 makes the format real with the
full map and camera transitions.

## Save format (lands in Milestone 4; state shapes anticipate it from day one)

```
{ version, currentPadId, hull, fuel, upgradesInstalled[], doorsOpen[],
  itemsDelivered[], itemPositions{} }
```

Stored in localStorage, versioned for migration.

## Milestones

Each milestone ends with a report: what to test by hand, what I'm unsure about,
what I'd cut. No milestone starts without explicit approval.

> **Status:** milestones 1–7 are implemented (all-milestone approval given
> 2026-09-05); 46 automated tests cover physics, world seams, and mechanisms.
> What remains is human playtesting and feel tuning in `src/tune.ts`, and the
> actual Vercel hookup (the build is deploy-ready; connecting the repo to a
> Vercel account is a user action). One design change during M7: delivering
> the relic is now a mid-game story beat; the ending is delivering the core
> after the Warden falls.

### Milestone 1 — feel sandbox + deploy *(done)*

Only the two feel-critical systems, in front of the designer as fast as
possible: ship flight/landing and pod+rope towing.

Scaffold Vite/TS/Vitest. Physics pure functions test-first. One
larger-than-screen sandbox room with camera follow. Ship flight and landing on
two pads of different difficulty; hull damage and crash. Pod launch, dock,
refuel, fuel limit, grapple, and two loose test masses — one light, one heavy —
to tow around. Fuel and hull HUD. Vercel deploy from the first push so every
subsequent push is playable at a URL.

Build order: scaffold + deploy pipeline → physics pure functions test-first →
loop/input/camera + ship flight and landing → pod/fuel/grapple/rope + test
masses → HUD → tuning pass + milestone report.

Physics tests:
- rope: mass ratio 1:9 → acceleration split 9:1; the impulse conserves
  momentum; slack rope exerts zero force; post-solve distance ≤ rope length.
- landing: just-under thresholds → soft; just-over → damage; damage monotonic
  in impact speed; crash threshold.
- tiles: a body comes to rest on the floor; a wall stops horizontal motion;
  corner penetration resolves without tunneling at sandbox speeds.

Acceptance: physics tests and `vite build` green; the sandbox is live at a URL;
the designer plays it and signs off on (or redlines) the feel — the pod is
floaty but controllable, heavy cargo visibly and physically drags, a careful
landing succeeds reliably and a careless one hurts.

### Milestone 2 — the full loop

Upgrade delivery and install at the ship (engine upgrade → stronger ship
thrust), crate + pressure plate + door, relic, win/lose states, and the
complete route playable end to end: Pad A → tow engine home → land Pad B →
crate on plate → door → relic → win. Optional: a deterministic input-replay
test locking the route (the fixed timestep makes the sim reproducible).

### Milestone 3 — rooms and a real map

Real map format, camera transitions between rooms, a hand-authored map of 6–8
rooms with 3 pads of increasing landing difficulty.

### Milestone 4 — save/load and death

Save/load (localStorage), pause menu, restart from pad, death and respawn feel.
Gamepad input.

### Milestone 5 — grapple upgrades and combat seed

Grapple upgrades that change rope behaviour (length, stiffness, wall-grapple
slingshot). One pod weapon and destructible barriers.

### Milestone 6 — feel pass

Audio (thrust, rope strain, touchdown, impacts), particles, screen shake.
Cosmetic rope sag.

### Milestone 7 — boss and ship

First boss, title screen, production polish on the already-live Vercel deploy.

## Rules (restated so they travel with the repo)

Simplicity first. Surgical changes. State assumptions before implementing.
Each milestone ends with: what to test, what's uncertain, what could be cut.
No milestone starts without approval.
