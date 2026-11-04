import { test } from "node:test";
import assert from "node:assert/strict";
import { Scene, InstancedMesh } from "three";
import { buildings, axis } from "../src/world/World";
import {
  defaults,
  WorldEventController,
  schedule,
  stateAt,
  fallPose,
  landing,
  validConfig,
  surfaceHeight,
  type WindowAnchor,
  type WindowSchedule,
} from "../src/events/EventModel";
import { Chunks } from "../src/world/Chunks";
import { EventRenderer } from "../src/events/EventRenderer";
const worldSeed = 23871,
  eventSeed = worldSeed ^ 7183;
function sources() {
  const entries: {
    i: number;
    j: number;
    a: WindowAnchor;
    s: WindowSchedule;
  }[] = [];
  for (let i = -3; i < 4; i++)
    for (let j = -3; j < 4; j++)
      for (const b of buildings(worldSeed, { i, j })) {
        if (!b.window) continue;
        const s = schedule(eventSeed, i, j, b.window, defaults, worldSeed);
        if (s) entries.push({ i, j, a: b.window, s });
      }
  return entries;
}
const windows = sources(),
  fallers = windows.filter((w) => Number.isFinite(w.s.broken));
test("phase boundaries include recovery and a final normal city; pauses exclude time", () => {
  const e = new WorldEventController(eventSeed);
  for (const [time, phase] of [
    [0, 0],
    [60, 1],
    [90, 2],
    [120, 3],
    [150, 4],
    [240, 5],
    [360, 6],
    [495, 7],
  ]) {
    e.elapsed = time;
    assert.equal(e.phase, phase);
  }
  e.elapsed = 50;
  e.tick(20, true);
  assert.equal(e.elapsed, 50);
  e.tick(1.5, false);
  assert.equal(e.elapsed, 51.5);
});
test("initial silence, staggered windows, unaffected buildings and non-falling silhouettes", () => {
  assert.ok(windows.length > 100);
  assert.ok(fallers.length < windows.length);
  assert.ok(windows.some((w) => !Number.isFinite(w.s.silhouette)));
  assert.ok(
    windows.some(
      (w) => Number.isFinite(w.s.silhouette) && !Number.isFinite(w.s.broken),
    ),
  );
  assert.ok(new Set(windows.map((w) => w.s.flicker)).size > 50);
  for (const w of windows) {
    assert.equal(stateAt(w.s, 59).stage, "intact");
    assert.ok(w.s.flicker >= 60);
    assert.ok(w.s.silhouette >= 90);
    assert.ok(w.s.broken >= 120);
  }
});
test("each source is an actual upper-floor window and its timing is reproducible", () => {
  for (const w of windows) {
    const box = buildings(worldSeed, w).find((b) => b.window?.id === w.a.id);
    assert.ok(box);
    assert.equal(w.a.x, box.x);
    assert.equal(w.a.y, box.y);
    assert.equal(w.a.z, box.z);
    assert.ok(w.a.y > 3);
    assert.deepEqual(
      schedule(eventSeed, w.i, w.j, w.a, defaults, worldSeed),
      w.s,
    );
  }
  const w = windows[0];
  assert.notDeepEqual(
    schedule(eventSeed + 1, w.i, w.j, w.a, defaults, worldSeed),
    w.s,
  );
});
test("flicker changes gradually in subdued bounds and silhouettes precede breakage", () => {
  const w = fallers[0],
    s = w.s;
  assert.equal(stateAt(s, s.flicker).stage, "flicker");
  assert.equal(stateAt(s, s.silhouette).stage, "silhouette");
  assert.equal(stateAt(s, s.broken).stage, "breaking");
  const levels = Array.from(
    { length: 50 },
    (_, i) => stateAt(s, s.flicker + i * 0.1).light,
  );
  assert.ok(new Set(levels).size > 5);
  assert.ok(levels.every((n) => n >= 0 && n <= 0.6));
});
test("falling starts at its source; gravity reaches a stable, outside-building landing", () => {
  for (const { i, j, a, s } of fallers) {
    const start = fallPose(a, s, s.broken + 0.2);
    assert.ok(
      Math.abs(start.x - a.x) < 1e-8 &&
        Math.abs(start.z - a.z) < 1e-8 &&
        Math.abs(start.y - a.y) < 1e-8,
    );
    const p = landing(a, s),
      end = fallPose(a, s, s.landed);
    assert.ok(
      Math.abs(end.x - p.x) < 1e-8 &&
        Math.abs(end.z - p.z) < 1e-8 &&
        Math.abs(end.y - p.y) < 1e-8,
    );
    assert.ok(p.y >= surfaceHeight(worldSeed, i, j, p) + 0.13);
    for (const b of buildings(worldSeed, { i, j }).filter(
      (b) => b.h > 4 && b.w > 10 && b.d > 10,
    ))
      assert.ok(Math.abs(p.x - b.x) > b.w / 2 || Math.abs(p.z - b.z) > b.d / 2);
    assert.equal(stateAt(s, s.landed + 0.1).stage, "body");
    assert.deepEqual(fallPose(a, s, s.landed + 10), end);
  }
});
test("unloaded locations reconstruct directly; recovery restores every window and clears bodies", () => {
  for (const { s } of windows) {
    const stage = stateAt(s, 280);
    assert.deepEqual(stage, stateAt({ ...s }, 280));
    assert.equal(stateAt(s, s.end + 1).stage, "intact");
    assert.equal(stateAt(s, s.end + 1).presence, 0);
    assert.ok(stateAt(s, (s.end + s.recover) / 2).presence > 0);
    assert.ok(stateAt(s, (s.end + s.recover) / 2).presence < 1);
  }
});
test("event save roundtrip retains clock, seed, phase, config and exact resulting world states", () => {
  const e = new WorldEventController(eventSeed);
  e.config.intensity = 0.9;
  e.config.fallFrequency = 0.6;
  e.elapsed = 247.5;
  const loaded = new WorldEventController(
    1,
    JSON.parse(JSON.stringify(e.save())),
  );
  assert.deepEqual(loaded.save(), e.save());
  for (const { i, j, a } of windows.slice(0, 30))
    assert.deepEqual(
      schedule(e.seed, i, j, a, e.config),
      schedule(loaded.seed, i, j, a, loaded.config),
    );
  const bad = new WorldEventController(8, {
    elapsed: NaN,
    config: { intensity: 999, recoveryDuration: -1 },
  } as any);
  assert.equal(bad.elapsed, 0);
  assert.equal(bad.config.intensity, 1);
  assert.ok(bad.config.recoveryDuration >= 1);
  assert.ok(validConfig({ fallsAt: 0 }).fallsAt > defaults.silhouettesAt);
});
test("rendering caps active falls, reconstructs streamed bodies once and clears all event instances after recovery", () => {
  const scene = new Scene(),
    chunks = new Chunks(scene, worldSeed),
    renderer = new EventRenderer(scene),
    event = new WorldEventController(eventSeed);
  chunks.update(0, 0, 0, true);
  event.config.maxActiveFalls = 1;
  event.elapsed = 170;
  renderer.update(chunks, event, { x: 0, z: 0 });
  assert.ok(renderer.counts.active <= 1);
  event.elapsed = 280;
  renderer.update(chunks, event, { x: 0, z: 0 });
  assert.ok(renderer.counts.bodies > 0);
  const before = { ...renderer.counts };
  const snapshot = () =>
    scene.children
      .filter((o): o is InstancedMesh => o instanceof InstancedMesh)
      .map((m) => Array.from(m.instanceMatrix.array.slice(0, m.count * 16)));
  const matrices = snapshot();
  chunks.clear();
  chunks.update(0, 0, 0, true);
  renderer.update(chunks, event, { x: 0, z: 0 });
  assert.deepEqual(renderer.counts, before);
  assert.deepEqual(snapshot(), matrices);
  for (let i = 0; i < 30; i++) {
    const p = { x: axis(i), z: axis(-i) };
    chunks.origin.set(
      Math.floor(p.x / 360) * 360,
      0,
      Math.floor(p.z / 360) * 360,
    );
    chunks.update(p.x, p.z, 0, true);
    renderer.update(chunks, event, p);
    assert.ok(chunks.chunks.size <= 49);
    assert.ok(renderer.counts.bodies <= 1600);
    assert.ok(scene.children.length <= 58);
  }
  event.elapsed = 600;
  renderer.update(chunks, event, { x: 0, z: 0 });
  assert.deepEqual(renderer.counts, {
    active: 0,
    bodies: 0,
    silhouettes: 0,
    windows: 0,
  });
  renderer.dispose();
  chunks.clear();
  assert.equal(scene.children.length, 0);
});

test('zero intensity disables participation and zero frequency keeps windows from breaking', () => {
 for(const {i,j,a}of windows){assert.equal(schedule(eventSeed,i,j,a,{...defaults,intensity:0}),null);const s=schedule(eventSeed,i,j,a,{...defaults,fallFrequency:0});assert.ok(s);assert.equal(s.broken,Infinity);}
});
