import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Chunks, ChunkWindow } from "../world/Chunks";
import { axis } from "../world/World";
import {
  fallPose,
  landing,
  schedule,
  stateAt,
  type WindowAnchor,
  type WindowSchedule,
  type WorldEventController,
} from "./EventModel";
interface Entry {
  a: WindowAnchor;
  s: WindowSchedule;
  color: T.Color;
}
// Six shared low-poly parts, merged once. Instances have no skeleton or physics objects.
function personGeometry(pose = 0) {
  const parts: T.BufferGeometry[] = [];
  for (const [x, y, z, w, h, d, tilt] of [
    [0, 0.68, 0, 0.24, 0.28, 0.23, 0],
    [0, 0.22, 0, 0.39, 0.64, 0.23, 0],
    [-0.27, 0.16, 0, 0.13, 0.65, 0.14, -0.07],
    [0.27, 0.16, 0, 0.13, 0.65, 0.14, 0.1],
    [-0.12, -0.49, 0, 0.16, 0.75, 0.18, -0.05],
    [0.12, -0.49, 0, 0.16, 0.75, 0.18, 0.06],
  ]) {
    const g = new T.BoxGeometry(w, h, d);
    g.rotateZ(
      tilt +
        (Math.abs(x) > 0.2
          ? pose * 0.15 * Math.sign(x)
          : y < 0
            ? pose * 0.13 * Math.sign(x)
            : 0),
    );
    g.translate(x, y, z);
    parts.push(g);
  }
  const merged = mergeGeometries(parts);
  for (const g of parts) g.dispose();
  return merged;
}
class Pool {
  mesh: T.InstancedMesh;
  used = 0;
  private matrix = new T.Matrix4();
  private rotation = new T.Quaternion();
  private scale = new T.Vector3();
  private position = new T.Vector3();
  private euler = new T.Euler();
  constructor(
    scene: T.Scene,
    geometry: T.BufferGeometry,
    material: T.Material,
    public capacity: number,
  ) {
    this.mesh = new T.InstancedMesh(geometry, material, capacity);
    this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
  }
  reset() {
    this.used = 0;
  }
  add(
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    rx = 0,
    ry = 0,
    rz = 0,
    color?: T.Color,
  ) {
    if (this.used >= this.capacity) return false;
    this.euler.set(rx, ry, rz);
    this.rotation.setFromEuler(this.euler);
    this.position.set(x, y, z);
    this.scale.set(sx, sy, sz);
    this.matrix.compose(this.position, this.rotation, this.scale);
    this.mesh.setMatrixAt(this.used, this.matrix);
    if (color) this.mesh.setColorAt(this.used, color);
    this.used++;
    return true;
  }
  finish() {
    this.mesh.count = this.used;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  dispose(scene: T.Scene) {
    scene.remove(this.mesh);
    this.mesh.dispose();
  }
}
export class EventRenderer {
  private cache = new WeakMap<
    T.Group,
    { seed: number; signature: string; entries: Entry[] }
  >();
  private box = new T.BoxGeometry(1, 1, 1);
  private humans = [personGeometry(), personGeometry(1), personGeometry(2)];
  private dark = new T.MeshLambertMaterial({ color: 0x292e2e });
  private paneMaterial = new T.MeshBasicMaterial();
  private glassMaterial = new T.MeshBasicMaterial({
    color: 0x899692,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
  });
  private shardMaterial = new T.MeshBasicMaterial({ color: 0x8e9c9c });
  private panes: Pool;
  private figures: Pool[];
  private glass: Pool;
  private fragments: Pool;
  private bodies: Pool[];
  counts = { active: 0, bodies: 0, silhouettes: 0, windows: 0 };
  private color = new T.Color();
  private frustum = new T.Frustum();
  private projection = new T.Matrix4();
  private source = new T.Vector3();
  constructor(public scene: T.Scene) {
    this.panes = new Pool(scene, this.box, this.paneMaterial, 1600);
    this.figures = this.humans.map((g) => new Pool(scene, g, this.dark, 500));
    this.glass = new Pool(scene, this.box, this.glassMaterial, 500);
    this.bodies = this.humans.map((g) => new Pool(scene, g, this.dark, 540));
    this.fragments = new Pool(scene, this.box, this.shardMaterial, 144);
  }
  update(
    chunks: Chunks,
    event: WorldEventController,
    player: { x: number; z: number },
    camera?: T.Camera,
  ) {
    if (camera) {
      camera.updateMatrixWorld();
      this.frustum.setFromProjectionMatrix(
        this.projection.multiplyMatrices(
          camera.projectionMatrix,
          camera.matrixWorldInverse,
        ),
      );
    }
    const pools = [
      this.panes,
      ...this.figures,
      this.glass,
      this.fragments,
      ...this.bodies,
    ];
    for (const p of pools) p.reset();
    this.counts = { active: 0, bodies: 0, silhouettes: 0, windows: 0 };
    const config = event.config,
      time = event.elapsed,
      signature = JSON.stringify(config);
    // Sorting gives nearby falls priority under the animation cap. No per-world history is retained.
    const groups = [...chunks.chunks.values()].sort(
      (a, b) =>
        Math.hypot(
          axis(a.userData.i) - player.x,
          axis(a.userData.j) - player.z,
        ) -
        Math.hypot(
          axis(b.userData.i) - player.x,
          axis(b.userData.j) - player.z,
        ),
    );
    for (const g of groups) {
      let cached = this.cache.get(g);
      if (
        !cached ||
        cached.seed !== event.seed ||
        cached.signature !== signature
      ) {
        const entries: Entry[] = [];
        for (const w of g.userData.windows as ChunkWindow[]) {
          const s = schedule(
            event.seed,
            g.userData.i,
            g.userData.j,
            w.anchor,
            config,
            chunks.seed,
          );
          if (s) entries.push({ a: w.anchor, s, color: new T.Color(w.color) });
        }
        cached = { seed: event.seed, signature, entries };
        this.cache.set(g, cached);
      }
      const ox = axis(g.userData.i),
        oz = axis(g.userData.j);
      for (const { a, s, color } of cached.entries) {
        const distance = Math.hypot(ox + a.x - player.x, oz + a.z - player.z);
        if (distance > config.renderDistance) continue;
        const state = stateAt(s, time);
        if (state.stage === "intact") continue;
        const variant = Math.min(2, Math.floor(s.variation * 3));
        const sizeBase = 0.91 + s.variation * 0.14;
        const x = ox + a.x - chunks.origin.x,
          z = oz + a.z - chunks.origin.z,
          angle = Math.atan2(a.nx, a.nz),
          presence = state.presence,
          broken = ["breaking", "falling", "body"].includes(state.stage);
        this.color.setHex(broken ? 0x171e20 : 0xb1b49e);
        if (!broken) this.color.multiplyScalar(state.light);
        this.color.lerp(color, 1 - presence);
        this.panes.add(
          x + a.nx * 0.075,
          a.y,
          z + a.nz * 0.075,
          a.w,
          a.h,
          a.d,
          0,
          0,
          0,
          this.color,
        );
        this.counts.windows++;
        if (state.stage === "silhouette" || state.stage === "breaking") {
          if (
            this.figures[0].add(
              x + a.nx * 0.2,
              a.y,
              z + a.nz * 0.2,
              0.79 * presence,
              0.79 * presence,
              0.4 * presence,
              0,
              angle,
              s.spin * 0.07,
            )
          )
            this.counts.silhouettes++;
          if (!broken)
            this.glass.add(
              x + a.nx * 0.32,
              a.y,
              z + a.nz * 0.32,
              a.w,
              a.h,
              a.d * 0.5,
            );
        }
        if (state.stage === "breaking" || state.stage === "falling") {
          const age = time - s.broken;
          if (
            age < 1.4 &&
            distance < 80 &&
            (!camera ||
              this.frustum.containsPoint(this.source.set(x, a.y, z))) &&
            this.counts.active < config.maxActiveFalls
          ) {
            for (let k = 0; k < 6; k++) {
              const v = (k + 1) * 0.23;
              this.fragments.add(
                x + a.nx * (0.3 + age * (1 + v)) + (a.nz * v - 0.5) * age,
                Math.max(0.3, a.y + v * age - 4.905 * age * age),
                z + a.nz * (0.3 + age * (1 + v)) + (a.nx * v - 0.5) * age,
                0.06,
                0.12,
                0.035,
                age * (k + 1),
                age * 2,
              );
            }
          }
          if (
            state.stage === "falling" &&
            distance < 100 &&
            this.counts.active < config.maxActiveFalls
          ) {
            const p = fallPose(a, s, time);
            if (
              camera &&
              !this.frustum.containsPoint(
                this.source.set(
                  ox + p.x - chunks.origin.x,
                  p.y,
                  oz + p.z - chunks.origin.z,
                ),
              )
            )
              continue;
            const u = Math.min(
              1,
              (time - s.broken - 0.2) / (s.landed - s.broken - 0.2),
            );
            this.figures[variant].add(
              ox + p.x - chunks.origin.x,
              p.y,
              oz + p.z - chunks.origin.z,
              sizeBase,
              sizeBase * (0.92 + s.variation * 0.14),
              sizeBase,
              (-u * Math.PI) / 2,
              angle + s.spin * u,
              (s.variation - 0.5) * 0.22 * u,
            );
            this.counts.active++;
          }
        }
        if (state.stage === "body") {
          const p = landing(a, s); // street-facing sources and outward travel keep landings outside footprints
          const bx = ox + p.x - chunks.origin.x,
            bz = oz + p.z - chunks.origin.z;
          // A small stable pose variation changes the spread/heading without unique geometry.
          const size = sizeBase * presence;
          if (
            this.counts.bodies < 1600 &&
            this.bodies[variant].add(
              bx,
              p.y - (1 - presence) * 0.3,
              bz,
              size,
              size * (0.92 + s.variation * 0.14),
              size,
              -Math.PI / 2,
              angle + s.spin,
              (s.variation - 0.5) * 0.22,
            )
          )
            this.counts.bodies++;
        }
      }
    }
    for (const p of pools) p.finish();
  }
  dispose() {
    for (const p of [
      this.panes,
      ...this.figures,
      this.glass,
      this.fragments,
      ...this.bodies,
    ])
      p.dispose(this.scene);
    for (const g of [this.box, ...this.humans]) g.dispose();
    for (const m of [
      this.dark,
      this.paneMaterial,
      this.glassMaterial,
      this.shardMaterial,
    ])
      m.dispose();
  }
}
