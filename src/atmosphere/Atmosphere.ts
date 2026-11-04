import * as T from "three";
import { rng } from "../world/World";
export class Atmosphere {
  fog = new T.FogExp2(0x929c9f, 0.012);
  dust: T.Points;
  time = 0;
  constructor(public scene: T.Scene) {
    scene.background = new T.Color(0x929c9f);
    scene.fog = this.fog;
    scene.add(new T.HemisphereLight(0xc9d2d4, 0x656457, 2));
    const sun = new T.DirectionalLight(0xd7dbd3, 1.1);
    sun.position.set(-30, 60, 20);
    scene.add(sun);
    const r = rng(90, 0, 0),
      pos = new Float32Array(180 * 3);
    for (let k = 0; k < pos.length; k += 3) {
      pos[k] = (r() - 0.5) * 100;
      pos[k + 1] = r() * 18;
      pos[k + 2] = (r() - 0.5) * 100;
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.BufferAttribute(pos, 3));
    this.dust = new T.Points(
      g,
      new T.PointsMaterial({
        color: 0xc2c4b8,
        size: 0.055,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      }),
    );
    scene.add(this.dust);
  }
  update(dt: number, p: T.Vector3, on: boolean) {
    this.time += dt;
    this.fog.density = 0.0105 + Math.sin(this.time / 65) * 0.0025;
    this.dust.visible = on;
    this.dust.position.copy(p);
    const a = this.dust.geometry.attributes.position;
    for (let i = 0; i < a.count; i++) {
      a.setX(i, ((a.getX(i) + dt * 0.18 + 50) % 100) - 50);
      a.setY(i, (a.getY(i) + dt * 0.035) % 18);
    }
    a.needsUpdate = true;
  }
}
