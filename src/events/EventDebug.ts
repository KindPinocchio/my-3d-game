import { phases, type WorldEventController } from "./EventModel";
import type { EventRenderer } from "./EventRenderer";
export class EventDebug {
  private status?: HTMLElement;
  constructor(event: WorldEventController, save: () => void) {
    if (new URLSearchParams(location.search).get("eventDebug") !== "1") return;
    const panel = document.createElement("details");
    panel.id = "event-debug";
    panel.innerHTML = `<summary>Event tools</summary><p id="event-status" role="status"></p><label>Phase <select id="event-phase">${phases.map((p, i) => `<option value="${i}">${p}</option>`).join("")}</select></label><button id="event-jump">Jump</button><button id="event-start">Start event now</button><label>Intensity <input id="event-intensity" type="range" min="0" max="1" step="0.05" value="${event.config.intensity}"></label><label>Fall frequency <input id="event-frequency" type="range" min="0" max="1" step="0.05" value="${event.config.fallFrequency}"></label><button id="event-reset">Reset event</button>`;
    document.body.append(panel);
    this.status = panel.querySelector("#event-status")!;
    panel.querySelector<HTMLButtonElement>("#event-jump")!.onclick = () => {
      event.jump(
        Number(panel.querySelector<HTMLSelectElement>("#event-phase")!.value),
      );
      save();
    };
    panel.querySelector<HTMLButtonElement>("#event-start")!.onclick = () => {
      event.jump(1);
      save();
    };
    panel.querySelector<HTMLButtonElement>("#event-reset")!.onclick = () => {
      event.jump(0);
      save();
    };
    for (const [id, key] of [
      ["event-intensity", "intensity"],
      ["event-frequency", "fallFrequency"],
    ] as const)
      panel.querySelector<HTMLInputElement>(`#${id}`)!.oninput = (e) => {
        event.config[key] = Number((e.target as HTMLInputElement).value);
        save();
      };
  }
  update(event: WorldEventController, renderer: EventRenderer) {
    if (this.status)
      this.status.textContent = `${phases[event.phase]} · ${event.elapsed.toFixed(1)}s · ${renderer.counts.active} falling · ${renderer.counts.bodies} bodies · ${renderer.counts.silhouettes} silhouettes · ${renderer.counts.windows} windows`;
  }
}
