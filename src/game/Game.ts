import { WorldEventController, type EventSave } from "../events/EventModel";
import { EventRenderer } from "../events/EventRenderer";
import { EventDebug } from "../events/EventDebug";
import * as T from "three";
import { Chunks } from "../world/Chunks";
import { Vehicle, type VehicleState } from "./Vehicle";
import { Input } from "./Input";
import { car } from "./Car";
import { Atmosphere } from "../atmosphere/Atmosphere";
interface Settings {
  quality: string;
  dust: boolean;
  fps: boolean;
}
export class Game {
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(58, 1, 0.2, 470);
  renderer = new T.WebGLRenderer({
    antialias: false,
    powerPreference: "high-performance",
  });
  event: WorldEventController;
  eventRenderer: EventRenderer;
  eventDebug: EventDebug;
  vehicle: Vehicle;
  chunks: Chunks;
  atmos: Atmosphere;
  input: Input;
  car = car();
  settings: Settings = { quality: "Medium", dust: true, fps: false };
  paused = true;
  seed = 23871;
  last = 0;
  elapsed = 0;
  saveTimer = 0;
  frames = 0;
  fpsTimer = 0;
  fps = 60;
  scale = 1;
  follow = new T.Vector3();
  aim = new T.Vector3();
  constructor() {
    let state: VehicleState | undefined;
    let eventSave: Partial<EventSave> | undefined;
    try {
      const s = JSON.parse(localStorage.getItem("grey-city-v1") || "null");
      if (s?.version === 1) {
        if (Number.isInteger(s.seed)) this.seed = s.seed;
        state = s.vehicle;
        eventSave = s.event;
        this.settings = {
          quality: ["Low", "Medium", "High"].includes(s.settings?.quality)
            ? s.settings.quality
            : "Medium",
          dust: s.settings?.dust !== false,
          fps: s.settings?.fps === true,
        };
      }
    } catch {
      /* Invalid saves safely start a new drive. */
    }
    this.event = new WorldEventController(this.seed ^ 7183, eventSave);
    this.eventRenderer = new EventRenderer(this.scene);
    this.eventDebug = new EventDebug(this.event, () => this.save());
    this.vehicle = new Vehicle(this.seed, state);
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    document.getElementById("app")!.prepend(this.renderer.domElement);
    this.scene.add(this.car);
    this.chunks = new Chunks(this.scene, this.seed);
    this.atmos = new Atmosphere(this.scene);
    this.input = new Input((t) => this.vehicle.select(t));
    this.applyQuality();
    this.chunks.update(
      this.vehicle.point.x,
      this.vehicle.point.z,
      this.vehicle.heading,
      true,
    );
    this.place(true);
    window.addEventListener("resize", () => this.resize());
    this.resize();
    document.getElementById("begin")!.onclick = () => {
      document.getElementById("loading")!.textContent = "Opening the city…";
      requestAnimationFrame(() => {
        document.getElementById("start")!.classList.add("hidden");
        this.paused = false;
      });
    };
    document.getElementById("pause")!.onclick = () => this.pause();
    document.getElementById("resume")!.onclick = () => {
      document.getElementById("settings")!.classList.add("hidden");
      this.paused = false;
    };
    const quality = document.getElementById("quality") as HTMLSelectElement;
    quality.value = this.settings.quality;
    quality.onchange = () => {
      this.settings.quality = quality.value;
      this.applyQuality();
      this.save();
    };
    for (const key of ["dust", "fps"] as const) {
      const el = document.getElementById(key) as HTMLInputElement;
      el.checked = this.settings[key];
      el.onchange = () => {
        this.settings[key] = el.checked;
        this.save();
      };
    }
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.pause();
      this.last = 0;
    });
    window.addEventListener("pagehide", () => this.save());
    requestAnimationFrame((t) => this.frame(t));
  }
  pause() {
    this.paused = true;
    this.input.reset();
    this.save();
    document.getElementById("settings")!.classList.remove("hidden");
  }
  save() {
    try {
      localStorage.setItem(
        "grey-city-v1",
        JSON.stringify({
          version: 1,
          seed: this.seed,
          vehicle: this.vehicle.state,
          settings: this.settings,
          event: this.event.save(),
        }),
      );
    } catch {
      /* Storage may be disabled or full. */
    }
  }
  applyQuality() {
    this.chunks.radius = this.settings.quality === "High" ? 3 : 2;
    this.chunks.low = this.settings.quality === "Low";
    this.chunks.clear();
    this.scale = 1;
    this.resize();
  }
  resize() {
    const w = window.innerWidth,
      h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(
      Math.min(
        devicePixelRatio,
        this.settings.quality === "High"
          ? 1.6
          : this.settings.quality === "Low"
            ? 0.85
            : 1.2,
      ) * this.scale,
    );
    this.renderer.setSize(w, h);
  }
  place(snap = false) {
    const p = this.vehicle.point,
      origin = this.chunks.origin;
    const ox = Math.floor(p.x / 360) * 360,
      oz = Math.floor(p.z / 360) * 360;
    if (origin.x !== ox || origin.z !== oz) {
      this.camera.position.x += origin.x - ox;
      this.camera.position.z += origin.z - oz;
      this.aim.x += origin.x - ox;
      this.aim.z += origin.z - oz;
      origin.set(ox, 0, oz);
    }
    this.car.position.set(p.x - origin.x, 0, p.z - origin.z);
    this.car.rotation.y = this.vehicle.heading;
    if (snap) {
      this.camera.position
        .copy(this.car.position)
        .add(new T.Vector3(0, 6.5, 12));
      this.aim.copy(this.car.position);
    }
  }
  frame(time: number) {
    requestAnimationFrame((t) => this.frame(t));
    const realDt = this.last ? Math.max(0, (time - this.last) / 1000) : 0;
    const dt = Math.min(realDt, 0.05);
    this.event.tick(realDt, this.paused);
    this.last = time;
    if (!this.paused) {
      for (let t = dt; t > 0; t -= 1 / 60)
        this.vehicle.update(
          Math.min(t, 1 / 60),
          this.input.gas,
          this.input.brake,
        );
      this.elapsed += dt;
      this.saveTimer += dt;
      if (this.saveTimer > 4) {
        this.save();
        this.saveTimer = 0;
      }
    }
    this.place();
    const p = this.vehicle.point;
    this.chunks.update(p.x, p.z, this.vehicle.heading);
    const h = this.vehicle.heading;
    this.follow
      .copy(this.car.position)
      .add(new T.Vector3(-Math.sin(h) * 11, 6.2, -Math.cos(h) * 11));
    this.camera.position.lerp(this.follow, 1 - Math.exp(-dt * 4));
    const target = this.car.position
      .clone()
      .add(new T.Vector3(Math.sin(h) * 7, 1.3, Math.cos(h) * 7));
    this.aim.lerp(target, 1 - Math.exp(-dt * 5));
    this.camera.lookAt(this.aim);
    this.atmos.update(
      this.paused ? 0 : dt,
      this.car.position,
      this.settings.dust,
    );
    this.eventRenderer.update(this.chunks, this.event, p, this.camera);
    this.eventDebug.update(this.event, this.eventRenderer);
    this.renderer.render(this.scene, this.camera);
    this.frames++;
    this.fpsTimer += dt;
    if (this.fpsTimer > 2) {
      this.fps = this.frames / this.fpsTimer;
      this.frames = 0;
      this.fpsTimer = 0;
      if (!this.paused && this.fps < 27 && this.scale > 0.65) {
        this.scale -= 0.1;
        this.resize();
      }
    }
    document.getElementById("speed")!.textContent = String(
      Math.round(this.vehicle.state.speed * 3.6),
    );
    const opts = this.vehicle.options();
    for (const t of [-1, 0, 1]) {
      const b = document.getElementById(`turn${t}`) as HTMLButtonElement;
      b.disabled = !opts.includes(t);
      b.classList.toggle("selected", this.vehicle.state.choice === t);
      b.setAttribute("aria-pressed", String(this.vehicle.state.choice === t));
    }
    document.getElementById("route")!.textContent =
      `NEXT · ${["LEFT", "STRAIGHT", "RIGHT"][this.vehicle.state.choice + 1]}${!opts.includes(this.vehicle.state.choice) ? " · AUTO TURN" : ""}`;
    const stats = document.getElementById("stats")!;
    stats.classList.toggle("hidden", !this.settings.fps);
    stats.textContent = `${Math.round(this.fps)} FPS · ${this.chunks.chunks.size} chunks · ${this.renderer.info.render.calls} draws`;
  }
}
