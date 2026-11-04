import { test } from "node:test";
import assert from "node:assert/strict";
import {
  axis,
  available,
  buildings,
  connected,
  district,
  neighbor,
  position,
} from "../src/world/World";
import { Vehicle } from "../src/game/Vehicle";
test("seeded layout is reproducible and independent of generation order", () => {
  const a = buildings(123, { i: -42, j: 19 });
  buildings(123, { i: 20, j: 2 });
  assert.deepEqual(a, buildings(123, { i: -42, j: 19 }));
  assert.notDeepEqual(a, buildings(124, { i: -42, j: 19 }));
});
test("adjacent nodes agree on edges; every approach has a valid exit", () => {
  for (let i = -20; i < 20; i++)
    for (let j = -20; j < 20; j++)
      for (let d = 0; d < 4; d++) {
        const n = { i, j };
        assert.equal(
          connected(20, n, d),
          connected(20, neighbor(n, d), (d + 2) % 4),
        );
        assert.ok(available(20, n, d).length);
        assert.ok(axis(i + 1) - axis(i) > 60);
        assert.ok(axis(i + 1) - axis(i) < 120);
      }
});
test("district field is continuous across block boundaries", () => {
  for (let i = -100; i < 100; i++) {
    const x = axis(i);
    assert.ok(
      Math.abs(district(5, x - 0.01, 400) - district(5, x + 0.01, 400)) < 0.001,
    );
  }
});
test("trajectories stay in road corridor for every junction maneuver", () => {
  for (const incoming of [0, 1, 2, 3])
    for (const turn of [-1, 0, 1]) {
      const v = new Vehicle(12);
      v.state.direction = incoming;
      v.state.turn = turn;
      v.makePath();
      for (const p of v.path) {
        const node = position(v.state.node);
        assert.ok(
          Math.min(Math.abs(p.x - node.x), Math.abs(p.z - node.z)) <= 7.01,
        );
      }
    }
});
test("restored vehicle continues along identical valid route", () => {
  const a = new Vehicle(123);
  for (let i = 0; i < 800; i++) a.update(1 / 60, true, false);
  const b = new Vehicle(123, JSON.parse(JSON.stringify(a.state)));
  assert.deepEqual(a.point, b.point);
  for (let i = 0; i < 1000; i++) {
    a.update(1 / 60, false, false);
    b.update(1 / 60, false, false);
  }
  assert.deepEqual(a.state, b.state);
  assert.deepEqual(a.point, b.point);
});
test("invalid saves fall back without corrupting coordinates", () => {
  const v = new Vehicle(123, {
    node: { i: 0, j: 0 },
    direction: 0,
    progress: NaN,
  } as any);
  assert.ok(Number.isFinite(v.point.x));
});
test("30 minutes of driving and repeated turns remain finite and connected", () => {
  const v = new Vehicle(123);
  for (let i = 0; i < 108000; i++) {
    if (i % 500 === 0) v.select(i % 1000 === 0 ? -1 : 1);
    v.update(1 / 60, true, false);
    assert.ok(Number.isFinite(v.point.x) && Number.isFinite(v.point.z));
    assert.ok(v.state.speed <= 19.45);
    assert.ok(v.state.progress <= v.length);
  }
  assert.ok(Math.abs(v.state.node.i) + Math.abs(v.state.node.j) > 10);
});
test("large coordinate restoration retains a valid logical road position", () => {
  const v = new Vehicle(123, {
    node: { i: 1000000, j: -1000000 },
    direction: 1,
    progress: 20,
    speed: 10,
    cruise: 12,
    turn: 0,
    choice: 0,
  });
  assert.ok(Math.abs(v.point.x - axis(1000000)) < 120);
  assert.ok(Number.isFinite(v.point.z));
});

test("streaming evicts distant chunks and bounds retained instances", async () => {
  const { Scene } = await import("three");
  const { Chunks } = await import("../src/world/Chunks");
  const scene = new Scene(),
    chunks = new Chunks(scene, 123);
  for (let i = 0; i < 60; i++) {
    chunks.update(i * 90, -i * 90, 0, true);
    assert.ok(chunks.chunks.size <= 49);
    assert.equal(scene.children.length, chunks.chunks.size);
  }
  chunks.clear();
  assert.equal(scene.children.length, 0);
});
