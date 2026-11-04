import * as T from "three";
export function car() {
  const g = new T.Group(),
    geo = new T.BoxGeometry(1, 1, 1);
  const mats = new Map<number, T.Material>();
  const box = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: number,
  ) => {
    let m = mats.get(color);
    if (!m) {
      m = new T.MeshLambertMaterial({ color });
      mats.set(color, m);
    }
    const b = new T.Mesh(geo, m);
    b.position.set(x, y, z);
    b.scale.set(w, h, d);
    g.add(b);
  };
  box(0, 0.7, 0, 1.8, 0.65, 4.1, 0x42494a);
  box(0, 1.25, -0.2, 1.55, 0.65, 2, 0x535c5c);
  box(0, 1.36, 0.84, 1.4, 0.42, 0.05, 0x25383d);
  box(0, 1.36, -1.22, 1.4, 0.42, 0.05, 0x26373b);
  for (const x of [-0.79, 0.79]) box(x, 1.35, -0.2, 0.03, 0.42, 1.6, 0x2b3c40);
  for (const x of [-0.91, 0.91])
    for (const z of [-1.25, 1.25]) {
      const tire = new T.Mesh(
        new T.CylinderGeometry(0.36, 0.36, 0.23, 10),
        new T.MeshLambertMaterial({ color: 0x242928 }),
      );
      tire.rotation.z = Math.PI / 2;
      tire.position.set(x, 0.4, z);
      g.add(tire);
    }
  box(0, 0.52, -2.1, 1.85, 0.18, 0.15, 0x6a706c);
  box(0, 0.52, 2.1, 1.85, 0.18, 0.15, 0x6a706c);
  for (const x of [-0.64, 0.64]) {
    box(x, 0.83, -2.07, 0.38, 0.2, 0.05, 0x883f36);
    box(x, 0.83, 2.07, 0.4, 0.2, 0.05, 0xc4bc92);
  }
  box(0, 0.65, -2.15, 0.5, 0.16, 0.03, 0xaaa99a);
  return g;
}
