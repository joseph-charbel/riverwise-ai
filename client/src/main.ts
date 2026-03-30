import { Engine } from "./Engine.ts";
import config from "./config/config.yaml";
import type { SceneConfig, MapConfig } from "./types/schemas.ts";

const scenesData = config.scenes as SceneConfig[];
const mapData = config.map as MapConfig;

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
