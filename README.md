# GREY CITY

An atmospheric, touch-first 3D driving prototype. Drive an aging sedan through a quiet, smog-filled procedural city. No objectives, traffic, combat, or backend.

## Play on Android

Open the deployed site in current Chrome and tap **Start Driving**. Landscape is recommended; portrait works too. Hold **ACCEL** to raise cruising speed, and **BRAKE** to lower it to a complete stop. Release either pedal to maintain the selected speed. Tap **← / ↑ / →** to queue the next intersection maneuver. Unavailable routes are disabled. The car follows its lane and slows for turns automatically. If straight is unavailable, fallback is left, then right. **II** pauses and opens graphics, dust, and performance settings. Position and settings save locally every four seconds and when pausing/leaving. Browser storage must be enabled to resume.

Desktop: W/up accelerates; S/down/Space brakes; A/left and D/right queue turns. Use the on-screen straight arrow to cancel a turn. Pointer capture supports simultaneous pedal/turn use.

## Development

Node.js 22.12+ (tested here with 24), npm, and a WebGL-capable browser.

```sh
npm ci
npm run dev
npm test
npm run typecheck
npm run build
npm run preview
```

Vite prints the development server address. For phone testing on your own computer, connect both devices to the same network and open Vite's network address. Cloud localhost addresses are not public phone links. No secrets, external textures, APIs, or runtime CDN requests are required. Use the existing checkout; a separate worktree is unnecessary.

## GitHub Pages

The included `.github/workflows/pages.yml` tests, builds, and deploys `dist` on pushes to `main`, or via **Actions → Deploy Grey City → Run workflow**. In repository **Settings → Pages → Build and deployment**, select **GitHub Actions**. The workflow needs Pages enabled and permission to deploy. Its deployment summary provides the actual public URL. Relative Vite asset paths support repository subdirectories and custom domains without hardcoded repository names. A workflow file alone does not enable Pages or prove a deployment succeeded.

## Implementation

- Deterministic coordinate hashing, independent building random streams, irregular 70–110m blocks, connected horizontal trunks, and shared vertical edges producing T and four-way junctions.
- Quadratic intersection trajectories followed by straight lane segments, arc-length motion, capped simulation steps, automatic turn speed limits, and deterministic fallback routing.
- Bounded chunk streaming, ahead-biased generation queue (one chunk per frame), eviction with instance buffer disposal, shared geometry/materials, instancing, culling, and optional lower facade detail.
- Logical world coordinates separated from rendering coordinates with a floating origin every 360m; smoothly following camera.
- Continuous spatial district fields controlling panel apartments, brick/plaster low-rise blocks, shops, institutional compounds, and industrial yards. Roof lips, windows, balconies, seams, canopies, fences, dumpsters, benches and streetlights provide scale.
- Diffuse overcast light, smoothly varying exponential fog, low-count drifting dust, and stable sparse warm windows.
- Three quality presets, capped device pixel ratio, automatic resolution reductions under sustained low FPS, pause on tab hide, versioned/validated local save state.

Modules separate road/building data (`world/World`), streaming/rendering (`world/Chunks`), driving, touch input, vehicle model, game orchestration, and atmosphere.

## Validation and limitations

Unit tests exercise seeded reproducibility, edge agreement, navigability, trajectory corridor containment, smooth district transitions, save restoration, invalid saves, large coordinates, a simulated 30-minute drive, and chunk eviction. Production build includes strict TypeScript checking. No linter is configured.

Chromium mobile-viewport smoke testing covers startup, pedals, turn selection, pause, quality settings, portrait resize, and reload. This is **not real Android hardware testing**. A 30-minute simulation does not establish 30-minute GPU/browser stability. FPS depends on the device; lower graphics quality if necessary. Performance overlay reports FPS, retained chunks, and draw calls.

This first prototype uses a connected irregular orthogonal grid rather than organic curved streets. Horizontal roads are continuous trunks; T junctions come from omitted vertical edges. Architectural types share modular footprints, with simplified material aging and no detailed signage, trees, audio, collision physics, shadows, or volumetric effects. Dust uses a shared particle size to limit complexity. Quality changes rebuild nearby chunks incrementally, briefly exposing the fog during regeneration. Districts blend probabilistically across a continuous field; individual buildings remain discrete. Coordinate precision is practical for long drives, not mathematically unbounded. Adaptive resolution only steps downward during a session; changing quality resets it.

## The Falling Event

The existing drive now includes a silent, non-graphic environmental event. A new save starts with 60 seconds of ordinary driving, excluding all paused time. Older saves without event data start at silence while preserving their vehicle position. Reloading continues the event clock rather than restarting it.

| Active play time | Global phase |
| --- | --- |
| 0–60 seconds | Silence |
| 60–90 seconds | Rare, subdued window flickering |
| 90–120 seconds | Dark human silhouettes behind selected panes |
| 120–150 seconds | First broken windows and falls |
| 150–240 seconds | Escalation |
| 240–360 seconds | Persistent aftermath |
| 360–495 seconds | Staggered recovery |
| 495+ seconds | Normal city again |

These are broad phases, not synchronized commands. Individual residential buildings and upper-floor windows have deterministic delays. Some buildings stay unaffected; some windows only flicker; some silhouettes remain standing. Six small fragments briefly represent broken glass. Figures fall outward from their actual window under analytic gravity, with restrained tumbling, then become motionless. There is no blood, sound, combat, or body collision physics.

**Recovery is part of this version:** after the aftermath, bodies gradually shrink/sink away and dark openings return to their original panes. Each window recovers at a different time. The city eventually becomes normal and remains normal; the event does not automatically repeat.

### Architecture and persistence

`events/EventModel.ts` defines the configurable phase clock, validated save format, per-window schedules, gravity, ground sampling and recovery. Window anchors are attached to actual residential panes in `world/World.ts`, without consuming additional architecture random numbers. Street-facing upper floors are selected, avoiding balcony windows and ground-floor storefronts. `events/EventRenderer.ts` reconstructs current state from seed, coordinates and clock. It uses fixed-capacity shared geometry pools, three human poses, a nearby/visible fall limit (12 by default), a 150m event radius, and weak caches of loaded chunks. Windows, silhouettes, fragments and bodies add at most nine instanced draw calls. Figures outside the animation range are not actively simulated; their later aftermath is calculated directly.

The existing save now includes event elapsed time, derived phase, seed and configuration, while retaining old save compatibility. No per-body history or unbounded world ledger is saved. Returning to an unloaded chunk reconstructs identical poses and openings for the current clock; no previous animations are replayed and no duplicate bodies are added. The clock uses active elapsed time independently of the capped vehicle simulation timestep. Pausing and hiding the browser tab freeze progression. Debug changes to intensity/frequency deliberately reconstruct the corresponding history.

### Touch-accessible development tools

Add `?eventDebug=1` to the game URL to reveal a collapsible **Event tools** panel. It provides **Start event now**, phase selection plus **Jump**, intensity, fall frequency, **Reset event**, and counts of nearby rendered windows, silhouettes, falling figures and bodies. Phase jumps also work while paused. Reset restarts event time without moving the vehicle or changing the seed. The panel is absent during ordinary play and stays above the driving controls when enabled.

Default timings and limits are centralized in `defaults` in `src/events/EventModel.ts`. Event configuration is saved along with the event, so existing saves retain their tuning.

### Event validation and limits

Automated tests cover phase/pause timing, deterministic window association, staggered participation, flickering, falling trajectories, ground sampling, static landing, save restoration, recovery, instancing limits, streaming cleanup and identical body transforms after unloading/reloading. Existing road, driving and world tests remain in place. Chromium mobile-viewport testing exercises actual visible falls, silhouettes, aftermath, saved progression, pause, continued acceleration/turn selection, recovery, portrait rotation and hidden debug tools.

This is not a real Android performance benchmark. Bodies have three simple limb arrangements and use procedural tumbling rather than physics ragdolls. Window openings use dark overlays over solid procedural facades; there are no modeled interiors or detailed fracture meshes. Landings use the known road/sidewalk/terrain surfaces, without general prop collision. Recovery is a stylized shrink/settle and pane-color restoration, with no repair animation. Rendering caps can omit some figures in unusually dense views; reconstruction remains deterministic. There are no additional runtime dependencies.
