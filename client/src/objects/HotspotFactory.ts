import type { HotspotConfig } from "../types/schemas.ts";
import type { InfoPanel } from "../ui/InfoPanel.ts";
import { Hotspot } from "./Hotspot.ts";
import { NavigationHotspot } from "./NavigationHotspot.ts";
import { StateSwapHotspot } from "./StateSwapHotspot.ts";
import { AnimationHotspot } from "./AnimationHotspot.ts";
import { InfoHotspot } from "./InfoHotspot.ts";

export function createHotspot(config: HotspotConfig, infoPanel: InfoPanel, sceneId: string): Hotspot {
  switch (config.type) {
    case "navigation":
      return new NavigationHotspot(config);
    case "state_swap":
      return new StateSwapHotspot(config);
    case "one_shot_animation":
    case "loop_animation":
      return new AnimationHotspot(config);
    case "info":
      return new InfoHotspot(config, infoPanel, sceneId);
  }
}
