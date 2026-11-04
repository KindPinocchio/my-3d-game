export class Input {
  private held = new Map<string, Set<number>>();
  gas = false;
  brake = false;
  constructor(select: (t: number) => void) {
    const held = this.held;
    for (const name of ["gas", "brake"]) {
      const el = document.getElementById(name)!;
      held.set(name, new Set());
      const sync = () => {
        this.gas = held.get("gas")!.size > 0;
        this.brake = held.get("brake")!.size > 0;
      };
      el.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        el.setPointerCapture(e.pointerId);
        held.get(name)!.add(e.pointerId);
        sync();
      });
      for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
        el.addEventListener(event, (e) => {
          held.get(name)!.delete((e as PointerEvent).pointerId);
          sync();
        });
    }
    for (const t of [-1, 0, 1])
      document
        .getElementById(`turn${t}`)!
        .addEventListener("click", () => select(t));
    window.addEventListener("keydown", (e) => {
      if ((e.target as HTMLElement).matches("input,select")) return;
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)
      )
        e.preventDefault();
      if (["w", "W", "ArrowUp"].includes(e.key)) this.gas = true;
      if (["s", "S", "ArrowDown", " "].includes(e.key)) this.brake = true;
      if (!e.repeat) {
        if (["a", "A", "ArrowLeft"].includes(e.key)) select(-1);
        if (["d", "D", "ArrowRight"].includes(e.key)) select(1);
      }
    });
    window.addEventListener("keyup", (e) => {
      if (["w", "W", "ArrowUp"].includes(e.key)) this.gas = false;
      if (["s", "S", "ArrowDown", " "].includes(e.key)) this.brake = false;
    });
    window.addEventListener("blur", () => this.reset());
    document.addEventListener("visibilitychange", () => this.reset());
  }
  reset() {
    for (const pointers of this.held.values()) pointers.clear();
    this.gas = this.brake = false;
  }
}
