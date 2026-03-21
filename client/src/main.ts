import { Engine } from "./Engine.ts";
import scenesData from "./config/scenes.json";
import mapData from "./config/map.json";
import type { SceneConfig, MapConfig } from "./types/schemas.ts";

const container = document.getElementById("app")!;
const engine = new Engine();

engine
  .start(
    container,
    scenesData as SceneConfig[],
    mapData as MapConfig,
    scenesData[0]!.node_id
  )
  .then(() => {
    console.log("[Riverwise] Engine started. Press M to open the map.");
  })
  .catch((err) => {
    console.error("[Riverwise] Failed to start:", err);
  });
