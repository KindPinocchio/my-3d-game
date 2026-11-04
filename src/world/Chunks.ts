import * as T from "three";
import type { WindowAnchor } from "../events/EventModel";
import { axis, buildings, connected, type Box } from "./World";
const geometry = new T.BoxGeometry(1, 1, 1),
  solid = new T.MeshLambertMaterial(),
  glow = new T.MeshBasicMaterial();
export interface ChunkWindow {
  anchor: WindowAnchor;
  color: number;
}
export class Chunks {
  chunks = new Map<string, T.Group>();
  origin = new T.Vector3();
  radius = 2;
  low = false;
  constructor(
    public scene: T.Scene,
    public seed: number,
  ) {}
  build(i: number, j: number) {
    const g = new T.Group(),
      w = axis(i + 1) - axis(i),
      d = axis(j + 1) - axis(j),
      boxes = buildings(this.seed, { i, j });
    const add = (
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
      color: number,
    ) => boxes.push({ x, y, z, w, h, d, color });
    add(w / 2, -0.24, d / 2, w, 0.4, d, 0x777a70);
    add(w / 2, -0.01, 0, w + 1, 0.12, 14, 0x3e4546);
    if (connected(this.seed, { i, j }, 2))
      add(0, 0, d / 2, 14, 0.12, d + 1, 0x3e4546);
    else add(0, 0.03, d / 2, 14, 0.15, d - 16, 0x777a70);
    add(w / 2, 0.12, 8.2, w - 17, 0.3, 2.6, 0x8b8d83);
    add(8.2, 0.12, d / 2, 2.6, 0.3, d - 17, 0x8b8d83);
    for (let k = 18; k < w - 12; k += 12)
      add(k, 0.065, 0, 4, 0.015, 0.12, 0x92938a);
    const selected = this.low
      ? boxes.filter((b) => !b.detail || b.glow || b.window)
      : boxes;
    for (const lit of [false, true]) {
      const bs = selected.filter((b) => !!b.glow === lit);
      if (!bs.length) continue;
      const mesh = new T.InstancedMesh(geometry, lit ? glow : solid, bs.length),
        m = new T.Matrix4(),
        q = new T.Quaternion();
      bs.forEach((b: Box, k: number) => {
        m.compose(
          new T.Vector3(b.x, b.y, b.z),
          q,
          new T.Vector3(b.w, b.h, b.d),
        );
        mesh.setMatrixAt(k, m);
        mesh.setColorAt(k, new T.Color(b.color));
      });
      mesh.computeBoundingSphere();
      g.add(mesh);
    }
    g.userData = {
      i,
      j,
      windows: boxes
        .filter((b) => b.window)
        .map((b) => ({ anchor: b.window!, color: b.color })),
    };
    this.scene.add(g);
    this.chunks.set(`${i},${j}`, g);
    return g;
  }
  update(x: number, z: number, heading: number, initial = false) {
    const i = Math.floor(x / 90),
      j = Math.floor(z / 90),
      needed: { i: number; j: number; score: number }[] = [];
    for (let a = i - this.radius; a <= i + this.radius; a++)
      for (let b = j - this.radius; b <= j + this.radius; b++) {
        if (!this.chunks.has(`${a},${b}`))
          needed.push({
            i: a,
            j: b,
            score:
              (a - i) ** 2 +
              (b - j) ** 2 -
              ((a - i) * Math.sin(heading) + (b - j) * Math.cos(heading)) * 0.5,
          });
      }
    needed.sort((a, b) => a.score - b.score);
    for (const n of needed.slice(0, initial ? 100 : 1)) this.build(n.i, n.j);
    for (const [key, g] of this.chunks) {
      if (
        Math.abs(g.userData.i - i) > this.radius + 1 ||
        Math.abs(g.userData.j - j) > this.radius + 1
      ) {
        this.scene.remove(g);
        g.traverse((o) => {
          if (o instanceof T.InstancedMesh) o.dispose();
        });
        this.chunks.delete(key);
      } else
        g.position.set(
          axis(g.userData.i) - this.origin.x,
          0,
          axis(g.userData.j) - this.origin.z,
        );
    }
  }
  clear() {
    for (const g of this.chunks.values()) {
      this.scene.remove(g);
      g.traverse((o) => {
        if (o instanceof T.InstancedMesh) o.dispose();
      });
    }
    this.chunks.clear();
  }
}
