import {
  available,
  directions,
  neighbor,
  position,
  type Node,
  type Point,
} from "../world/World";
export interface VehicleState {
  node: Node;
  direction: number;
  progress: number;
  speed: number;
  cruise: number;
  turn: number;
  choice: number;
}
export class Vehicle {
  state: VehicleState;
  path: Point[] = [];
  lengths: number[] = [];
  length = 0;
  point: Point = { x: 0, z: 0 };
  heading = 0;
  constructor(
    public seed: number,
    saved?: VehicleState,
  ) {
    this.state = {
      node: { i: 0, j: 0 },
      direction: 0,
      progress: 0,
      speed: 0,
      cruise: 8,
      turn: 0,
      choice: 0,
    };
    if (
      saved &&
      Number.isInteger(saved.node?.i) &&
      Number.isInteger(saved.node?.j) &&
      Math.abs(saved.node.i) < 1e9 &&
      Math.abs(saved.node.j) < 1e9 &&
      [0, 1, 2, 3].includes(saved.direction) &&
      [saved.progress, saved.speed, saved.cruise].every(Number.isFinite) &&
      [-1, 0, 1].includes(saved.turn) &&
      [-1, 0, 1].includes(saved.choice)
    ) {
      this.state = {
        ...saved,
        progress: Math.max(0, saved.progress),
        speed: Math.max(0, Math.min(19.44, saved.speed)),
        cruise: Math.max(0, Math.min(19.44, saved.cruise)),
      };
      if (!available(seed, saved.node, saved.direction).includes(saved.turn))
        this.state.turn = available(seed, saved.node, saved.direction)[0];
    }
    if (
      !available(seed, this.state.node, this.state.direction).includes(
        this.state.turn,
      )
    )
      this.state.turn = available(
        seed,
        this.state.node,
        this.state.direction,
      )[0];
    this.makePath();
    this.state.progress = Math.min(this.state.progress, this.length);
    this.locate();
  }
  makePath() {
    const s = this.state,
      p = position(s.node),
      a = directions[s.direction],
      b = directions[(s.direction + s.turn + 4) % 4];
    const start = { x: p.x - a.x * 14 - a.z * 2, z: p.z - a.z * 14 + a.x * 2 },
      end = { x: p.x + b.x * 14 - b.z * 2, z: p.z + b.z * 14 + b.x * 2 };
    this.path = [];
    for (let k = 0; k <= 20; k++) {
      const t = k / 20,
        u = 1 - t;
      this.path.push({
        x: u * u * start.x + 2 * u * t * (p.x - a.z * 2) + t * t * end.x,
        z: u * u * start.z + 2 * u * t * (p.z + a.x * 2) + t * t * end.z,
      });
    }
    const next = position(neighbor(s.node, (s.direction + s.turn + 4) % 4));
    this.path.push({
      x: next.x - b.x * 14 - b.z * 2,
      z: next.z - b.z * 14 + b.x * 2,
    });
    this.lengths = [0];
    this.length = 0;
    for (let k = 1; k < this.path.length; k++) {
      this.length += Math.hypot(
        this.path[k].x - this.path[k - 1].x,
        this.path[k].z - this.path[k - 1].z,
      );
      this.lengths.push(this.length);
    }
  }
  select(t: number) {
    const s = this.state,
      n = neighbor(s.node, (s.direction + s.turn + 4) % 4),
      d = (s.direction + s.turn + 4) % 4;
    if (available(this.seed, n, d).includes(t)) s.choice = t;
  }
  options() {
    const s = this.state,
      d = (s.direction + s.turn + 4) % 4;
    return available(this.seed, neighbor(s.node, d), d);
  }
  update(dt: number, gas: boolean, brake: boolean) {
    const s = this.state;
    if (gas) s.cruise = Math.min(19.44, s.cruise + dt * 3);
    if (brake) s.cruise = Math.max(0, s.cruise - dt * 9);
    const approaching = this.length - s.progress < 25 && s.choice !== 0;
    const limit = (s.progress < 24 && s.turn !== 0) || approaching ? 7 : 19.44,
      target = Math.min(s.cruise, limit);
    s.speed += Math.max(-dt * 7, Math.min(dt * 2.7, target - s.speed));
    s.progress += s.speed * dt;
    if (s.progress >= this.length) {
      s.progress -= this.length;
      s.direction = (s.direction + s.turn + 4) % 4;
      s.node = neighbor(s.node, s.direction);
      const opts = available(this.seed, s.node, s.direction);
      s.turn = opts.includes(s.choice)
        ? s.choice
        : opts.includes(0)
          ? 0
          : opts[0];
      s.choice = 0;
      this.makePath();
    }
    this.locate();
  }
  locate() {
    let k = 1;
    while (k < this.lengths.length - 1 && this.lengths[k] < this.state.progress)
      k++;
    const a = this.path[k - 1],
      b = this.path[k],
      t = Math.max(
        0,
        Math.min(
          1,
          (this.state.progress - this.lengths[k - 1]) /
            (this.lengths[k] - this.lengths[k - 1]),
        ),
      );
    this.point = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
    this.heading = Math.atan2(b.x - a.x, b.z - a.z);
  }
}
