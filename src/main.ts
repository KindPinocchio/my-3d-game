import "./style.css";
import { Game } from "./game/Game";
document.querySelector("#app")!.innerHTML =
  `<header><span class="brand">GREY CITY</span><span class="speed"><span id="speed">0</span> <small>KM/H</small></span><button id="pause" aria-label="Pause and settings">II</button></header><div id="route">NEXT · STRAIGHT</div><div id="stats" class="hidden"></div><div class="controls"><div class="group"><button id="turn-1" aria-label="Select left turn">←</button><button id="turn0" aria-label="Select straight">↑</button><button id="turn1" aria-label="Select right turn">→</button></div><div class="group pedals"><button id="brake">BRAKE</button><button id="gas">ACCEL<br>＋</button></div></div><section id="start" class="cover"><span class="eyebrow">AN ATMOSPHERIC DRIVING EXPERIENCE</span><h1>GREY CITY</h1><p>An endless drive through the forgotten city.<br>No destination. Just the road ahead.</p><button id="begin">Start Driving →</button><footer>Hold ACCEL to set your cruising speed. BRAKE to slow down.<br>Choose a turn before the next junction.<br>Keyboard: W/S speed · A/D turns · Space brake<br>Landscape recommended · Progress saved automatically</footer><p id="loading" role="status"></p></section><section id="settings" class="cover hidden"><span class="eyebrow">THE CITY CAN WAIT</span><h2>Paused</h2><label>Graphics <select id="quality"><option>Low</option><option>Medium</option><option>High</option></select></label><label>Drifting dust <input id="dust" type="checkbox"></label><label>Performance <input id="fps" type="checkbox"></label><button id="resume">Resume Driving →</button></section>`;
try {
  new Game();
} catch (e) {
  document.getElementById("loading")!.textContent =
    `Unable to start WebGL. Try an updated Chrome browser. ${e instanceof Error ? e.message : ""}`;
}
