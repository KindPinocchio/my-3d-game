import type { WindowAnchor } from "../events/EventModel";
export interface Point {
  x: number;
  z: number;
}
export interface Node {
  i: number;
  j: number;
}
export const directions: Point[] = [
  { x: 0, z: -1 },
  { x: 1, z: 0 },
  { x: 0, z: 1 },
  { x: -1, z: 0 },
];
export function hash(seed: number, x: number, z: number) {
  let h = Math.imul(x ^ seed, 374761393) ^ Math.imul(z, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function rng(seed: number, x: number, z: number) {
  let n = 0;
  return () => hash(seed + n++ * 7919, x, z);
}
// Bounded axis offsets keep every block 70–110m wide, at arbitrary signed coordinates.
export function axis(n: number) {
  return n * 90 + Math.sin(n * 1.73) * 9;
}
export function position(n: Node): Point {
  return { x: axis(n.i), z: axis(n.j) };
}
export function neighbor(n: Node, d: number): Node {
  const v = directions[d];
  return { i: n.i + v.x, j: n.j + v.z };
}
// Horizontal trunks always connect. Missing vertical edges create symmetric T junctions.
export function connected(seed: number, n: Node, d: number) {
  if (d % 2) return true;
  const lower = d === 0 ? n.j - 1 : n.j;
  return hash(seed + 17, n.i, lower) > 0.17;
}
export function available(seed: number, n: Node, incoming: number) {
  return [-1, 0, 1].filter((t) => connected(seed, n, (incoming + t + 4) % 4));
}
export function district(seed: number, x: number, z: number) {
  return (
    2 +
    Math.sin(x / 720 + (seed % 41)) * 1.15 +
    Math.cos(z / 880 - (seed % 17)) * 0.8
  );
}
export interface Box {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  color: number;
  glow?: boolean;
  detail?: boolean;
  window?: WindowAnchor;
}
const palette = [0x777b77, 0x89887e, 0x727875, 0x82796d, 0x77716a];
export function buildings(seed: number, n: Node): Box[] {
  const r = rng(seed, n.i, n.j),
    out: Box[] = [];
  const w = axis(n.i + 1) - axis(n.i),
    d = axis(n.j + 1) - axis(n.j);
  const zone = district(seed, axis(n.i), axis(n.j));
  const box = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: number,
    glow = false,
    detail = false,
  ) => out.push({ x, y, z, w, h, d, color, glow, detail });
  for (let a = 0; a < 2; a++)
    for (let b = 0; b < 2; b++) {
      const x = 22 + a * (w - 44),
        z = 23 + b * (d - 46),
        style = Math.max(0, Math.min(4, Math.floor(zone + (r() - 0.5) * 1.4)));
      const floors =
        style === 0
          ? 2 + Math.floor(r() * 3)
          : style === 1
            ? 5 + Math.floor(r() * 7)
            : style === 2
              ? 2 + Math.floor(r() * 3)
              : style === 3
                ? 3
                : 1;
      const bw = 15 + r() * 10,
        bd = 13 + r() * 9,
        h = floors * 3.1,
        c = palette[style];
      box(x, h / 2, z, bw, h, bd, c);
      box(x, h + 0.3, z, bw + 1, 0.6, bd + 1, 0x555b59);
      box(x, 1.6, z + bd / 2 + 0.5, 2, 3, 0.6, 0x373e3d);
      box(x, 3.3, z + bd / 2 + 1, 4, 0.25, 2, 0x606461);
      let windowId = (a * 2 + b) * 1000;
      for (let side = -1; side <= 1; side += 2)
        for (let f = 0; f < floors; f++)
          for (let q = 0; q < Math.floor(bw / 3); q++) {
            const lit = r() < 0.055;
            box(
              x - bw / 2 + 1.7 + q * 3,
              2 + f * 3.1,
              z + side * (bd / 2 + 0.06),
              1.2,
              1.55,
              0.12,
              lit ? 0x9b8656 : r() < 0.22 ? 0x626b69 : 0x354346,
              lit,
              true,
            );
            // Use street-facing, upper-floor residential windows without balconies.
            if (
              (style < 2 || (style === 2 && f > 0)) &&
              f > 0 &&
              side === (b === 0 ? -1 : 1) &&
              !(style === 1 && q % 3 === 1)
            )
              attachWindow(out[out.length - 1], windowId, a * 2 + b, 0, side);
            windowId++;
            if (style === 1 && q % 3 === 1)
              box(
                x - bw / 2 + 1.7 + q * 3,
                1 + f * 3.1,
                z + side * (bd / 2 + 0.6),
                2,
                0.65,
                1.2,
                0x747973,
                false,
                true,
              );
          }
      for (let side = -1; side <= 1; side += 2)
        for (let f = 0; f < floors; f++)
          for (let q = 0; q < Math.floor(bd / 3); q++) {
            box(
              x + side * (bw / 2 + 0.06),
              2 + f * 3.1,
              z - bd / 2 + 1.7 + q * 3,
              0.12,
              1.5,
              1.2,
              0x3c494b,
              false,
              true,
            );
            if (
              (style < 2 || (style === 2 && f > 0)) &&
              f > 0 &&
              side === (a === 0 ? -1 : 1)
            )
              attachWindow(out[out.length - 1], windowId, a * 2 + b, side, 0);
            windowId++;
          }
      if (style === 2) {
        box(x, 3.1, z + bd / 2 + 0.8, bw, 0.45, 2, 0x555e53);
        box(x, 2, z + bd / 2 + 0.12, bw - 3, 1.5, 0.15, 0x57615b);
      }
      if (style >= 3) {
        box(x, 1, z + bd / 2 + 4, bw + 3, 2, 0.35, 0x666c67);
        if (style === 4) {
          box(x, h + 1.5, z, 4, 3, 4, 0x636b68);
          box(x - 5, 1.5, z + bd / 2 + 0.2, 4, 3, 0.3, 0x3d4846);
        }
      }
      // Seams and weathering strips provide inexpensive facade relief.
      for (let q = 1; q < bw / 5; q++)
        box(
          x - bw / 2 + q * 5,
          h / 2,
          z + bd / 2 + 0.08,
          0.09,
          h,
          0.08,
          0x606763,
          false,
          true,
        );
    }
  box(w / 2, 0.3, d / 2, 10, 0.6, 5, 0x555c57); // courtyard service slab
  for (let k = 0; k < 3; k++) {
    const x = 14 + (k * (w - 28)) / 2;
    box(x, 4, 10, 0.18, 8, 0.18, 0x494f4c);
    box(x + 1.5, 8, 10, 3, 0.15, 0.2, 0x555b56);
    box(x + 2.7, 7.8, 10, 0.6, 0.12, 0.4, 0xa19c80, true);
  }
  box(13, 0.6, 17, 2, 1.2, 1.4, 0x4c594f);
  box(w - 13, 0.45, d - 15, 3, 0.3, 1, 0x6e7064);
  return out;
}

// Attached to the actual pane, so event sources cannot drift away from their facade.
function attachWindow(
  box: Box,
  id: number,
  building: number,
  nx: number,
  nz: number,
): void {
  box.window = {
    id,
    building,
    nx,
    nz,
    x: box.x,
    y: box.y,
    z: box.z,
    w: box.w,
    h: box.h,
    d: box.d,
  };
}
