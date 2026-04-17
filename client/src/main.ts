import { Engine } from "./Engine.ts";
import { showStudentSetup } from "./ui/StudentSetup.ts";
import { loadStudentOptions } from "./utils/studentOptions.ts";
import type { SceneConfig, MapConfig, StudentConfig } from "./types/schemas.ts";

interface GameConfig {
  map: MapConfig;
  scenes: SceneConfig[];
  student?: StudentConfig;
}

const configs = import.meta.glob("./config/*.yaml", {
  eager: true,
  import: "default",
}) as Record<string, GameConfig>;

const SELECTED_CONFIG = "riverwise" as const;
const key = `./config/${SELECTED_CONFIG}.yaml`;
const cfg = configs[key];
if (!cfg) {
  const available = Object.keys(configs)
    .map((k) => k.replace("./config/", "").replace(".yaml", ""))
    .join(", ");
  throw new Error(
    `[Riverwise] Unknown config "${SELECTED_CONFIG}". Available: ${available}`,
  );
}

const { map: mapData, scenes: scenesData } = cfg;
const container = document.getElementById("app")!;

const studentOptions = loadStudentOptions();
const studentConfig = await showStudentSetup(container, studentOptions);

const engine = new Engine();
engine
  .start(container, scenesData, mapData, studentConfig)
  .then(() => {
    console.log("[Riverwise] Engine started. Select a scene from the map.");
  })
  .catch((err) => {
    console.error("[Riverwise] Failed to start:", err);
  });
