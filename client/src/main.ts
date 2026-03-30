import { Engine } from "./Engine.ts";
import type { SceneConfig, MapConfig } from "./types/schemas.ts";

interface GameConfig {
  map: MapConfig;
  scenes: SceneConfig[];
}

const configs = import.meta.glob("./config/*.yaml", {
  eager: true,
  import: "default",
}) as Record<string, GameConfig>;

// Choose which config to load (edit the string below)
// - "default" => SVG map + scenes
// - "riverwise" => PNG map + scenes
const SELECTED_CONFIG = "riverwise" as const;
const key = `./config/${SELECTED_CONFIG}.yaml`;
const cfg = configs[key];
if (!cfg) {
  const available = Object.keys(configs)
    .map((k) => k.replace("./config/", "").replace(".yaml", ""))
    .join(", ");
  throw new Error(
    `[Riverwise] Unknown config "${SELECTED_CONFIG}". Available: ${available}`
  );
}

const { map: mapData, scenes: scenesData } = cfg;

const container = document.getElementById("app")!;
const engine = new Engine();

engine
  .start(
    container,
    scenesData,
    mapData,
    scenesData[0]!.node_id
  )
  .then(() => {
    console.log("[Riverwise] Engine started. Press M to open the map.");
  })
  .catch((err) => {
    console.error("[Riverwise] Failed to start:", err);
  });
