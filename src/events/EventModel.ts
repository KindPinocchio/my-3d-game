import { hash, axis, connected } from "../world/World";
export interface WindowAnchor {
  id: number;
  building: number;
  nx: number;
  nz: number;
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
}
export interface EventConfig {
  flickerAt: number;
  silhouettesAt: number;
  fallsAt: number;
  escalationAt: number;
  aftermathAt: number;
  recoveryAt: number;
  recoverySpread: number;
  recoveryDuration: number;
  intensity: number;
  fallFrequency: number;
  maxActiveFalls: number;
  renderDistance: number;
}
export const defaults: EventConfig = {
  flickerAt: 60,
  silhouettesAt: 90,
  fallsAt: 120,
  escalationAt: 150,
  aftermathAt: 240,
  recoveryAt: 360,
  recoverySpread: 90,
  recoveryDuration: 45,
  intensity: 0.7,
  fallFrequency: 0.8,
  maxActiveFalls: 12,
  renderDistance: 150,
};
export const phases = [
  "Silence",
  "Flickering",
  "Silhouettes",
  "First Falls",
  "Escalation",
  "Aftermath",
  "Recovery",
  "Normal again",
] as const;
export interface EventSave {
  elapsed: number;
  phase: number;
  seed: number;
  config: EventConfig;
}
export function validConfig(input?: Partial<EventConfig>): EventConfig {
  const c = { ...defaults };
  for (const key of Object.keys(c) as (keyof EventConfig)[]) {
    const n = input?.[key];
    if (typeof n === "number" && Number.isFinite(n))
      c[key] = Math.max(0, Math.min(3600, n));
  }
  c.intensity = Math.min(1, c.intensity);
  c.fallFrequency = Math.min(1, c.fallFrequency);
  c.maxActiveFalls = Math.floor(Math.min(24, c.maxActiveFalls));
  c.renderDistance = Math.max(50, Math.min(180, c.renderDistance));
  for (const [prev, next] of [
    ["flickerAt", "silhouettesAt"],
    ["silhouettesAt", "fallsAt"],
    ["fallsAt", "escalationAt"],
    ["escalationAt", "aftermathAt"],
    ["aftermathAt", "recoveryAt"],
  ] as const)
    c[next] = Math.max(c[prev] + 1, c[next]);
  c.recoveryDuration = Math.max(1, c.recoveryDuration);
  return c;
}
export class WorldEventController {
  elapsed = 0;
  seed: number;
  config: EventConfig;
  constructor(seed: number, saved?: Partial<EventSave>) {
    this.seed = Number.isInteger(saved?.seed) ? saved!.seed! : seed;
    this.elapsed =
      typeof saved?.elapsed === "number" && Number.isFinite(saved.elapsed)
        ? Math.max(0, saved.elapsed)
        : 0;
    this.config = validConfig(saved?.config);
  }
  get phase() {
    const c = this.config;
    return [
      c.flickerAt,
      c.silhouettesAt,
      c.fallsAt,
      c.escalationAt,
      c.aftermathAt,
      c.recoveryAt,
      c.recoveryAt + c.recoverySpread + c.recoveryDuration,
    ].filter((t) => this.elapsed >= t).length;
  }
  tick(dt: number, paused: boolean) {
    if (!paused && Number.isFinite(dt) && dt > 0) this.elapsed += dt;
  }
  jump(phase: number) {
    const c = this.config;
    this.elapsed = [
      0,
      c.flickerAt,
      c.silhouettesAt,
      c.fallsAt,
      c.escalationAt,
      c.aftermathAt,
      c.recoveryAt,
      c.recoveryAt + c.recoverySpread + c.recoveryDuration,
    ][Math.max(0, Math.min(7, phase))];
  }
  save(): EventSave {
    return {
      elapsed: this.elapsed,
      phase: this.phase,
      seed: this.seed,
      config: { ...this.config },
    };
  }
}
export interface WindowSchedule {
  flicker: number;
  silhouette: number;
  broken: number;
  landed: number;
  recover: number;
  end: number;
  variation: number;
  outward: number;
  spin: number;
  ground: number;
}
export function schedule(
  seed: number,
  i: number,
  j: number,
  a: WindowAnchor,
  c: EventConfig,
  worldSeed = seed ^ 7183,
): WindowSchedule | null {
  const r = (stream: number) => hash(seed + stream * 2377 + a.id * 79, i, j);
  // A building may escape entirely; window selection is independent of facade generation.
  if (
    c.intensity <= 0 ||
    hash(seed + 109 + a.building * 73, i, j) < 0.13 ||
    r(1) > c.intensity * 0.24
  )
    return null;
  const neighborhood =
    (Math.sin(i / 7 + (seed % 23)) + Math.cos(j / 9)) * 5 + 10;
  const flicker = c.flickerAt + neighborhood + r(2) * 65;
  const silhouette =
    r(3) < 0.16
      ? Infinity
      : Math.max(c.silhouettesAt + neighborhood, flicker + 12 + r(4) * 22);
  const broken =
    c.fallFrequency <= 0 || r(5) > c.fallFrequency
      ? Infinity
      : Math.max(
          c.fallsAt +
            neighborhood +
            Math.pow(r(6), 2) * (c.aftermathAt - c.fallsAt - 15),
          silhouette + 8 + r(7) * 15,
        );
  const outward = 3.5 + r(8) * 6;
  const target = { x: a.x + a.nx * outward, z: a.z + a.nz * outward };
  const ground = surfaceHeight(worldSeed, i, j, target) + 0.14;
  const duration = Math.sqrt((2 * Math.max(0.1, a.y - ground)) / 9.81);
  const recover = c.recoveryAt + r(9) * c.recoverySpread;
  return {
    flicker,
    silhouette,
    broken,
    landed: broken + 0.2 + duration,
    recover,
    end: recover + c.recoveryDuration,
    variation: r(10),
    outward,
    spin: (r(11) - 0.5) * 1.2,
    ground,
  };
}
export type WindowStage =
  "intact" | "flicker" | "silhouette" | "breaking" | "falling" | "body";
export function stateAt(
  s: WindowSchedule,
  time: number,
): { stage: WindowStage; presence: number; light: number } {
  const presence =
    1 - Math.min(1, Math.max(0, (time - s.recover) / (s.end - s.recover)));
  if (time < s.flicker || presence <= 0)
    return { stage: "intact", presence: 0, light: 0 };
  let stage: WindowStage =
    time < s.silhouette
      ? "flicker"
      : time < s.broken
        ? "silhouette"
        : time < s.broken + 0.2
          ? "breaking"
          : time < s.landed
            ? "falling"
            : "body";
  // Muted, irregular pulses with long dark intervals; capped to avoid strobing.
  const t = time - s.flicker,
    gate = Math.sin(t * 0.61 + s.variation * 18) > 0.1;
  const light = gate
    ? 0.35 + 0.25 * Math.sin(t * (0.8 + s.variation * 1.1))
    : 0.025;
  return { stage, presence, light };
}
export function landing(a: WindowAnchor, s: WindowSchedule) {
  return { x: a.x + a.nx * s.outward, y: s.ground, z: a.z + a.nz * s.outward };
}
export function fallPose(a: WindowAnchor, s: WindowSchedule, time: number) {
  const p = landing(a, s),
    t = Math.max(0, time - s.broken - 0.2),
    u = time >= s.landed ? 1 : Math.min(1, t / (s.landed - s.broken - 0.2));
  return {
    x: a.x + (p.x - a.x) * u,
    y: time >= s.landed ? p.y : Math.max(s.ground, a.y - 4.905 * t * t),
    z: a.z + (p.z - a.z) * u,
    tilt: s.spin * u,
  };
}

// Landing sources face block edges. Sample the exact sidewalk/horizontal road top,
// including raised service strips where a vertical road is absent.
export function surfaceHeight(
  seed: number,
  i: number,
  j: number,
  p: { x: number; z: number },
) {
  const w = axis(i + 1) - axis(i),
    d = axis(j + 1) - axis(j);
  if (
    (Math.abs(p.x - 8.2) <= 1.3 && p.z >= 8.5 && p.z <= d - 8.5) ||
    (Math.abs(p.z - 8.2) <= 1.3 && p.x >= 8.5 && p.x <= w - 8.5)
  )
    return 0.27;
  if (p.z <= 7 || p.z >= d - 7) return 0.05;
  if (p.x <= 7) return connected(seed, { i, j }, 2) ? 0.06 : 0.105;
  if (p.x >= w - 7) return connected(seed, { i: i + 1, j }, 2) ? 0.06 : 0.105;
  return -0.04;
}
