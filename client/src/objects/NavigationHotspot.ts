import type { NavigationHotspotConfig } from "../types/schemas.ts";
import { eventBus } from "../core/EventBus.ts";
import { Hotspot } from "./Hotspot.ts";

export class NavigationHotspot extends Hotspot {
  private targetNode: string;

  constructor(config: NavigationHotspotConfig) {
    super(config);
    this.targetNode = config.target_node;
  }

  protected debugColor(): number {
    return 0x00ff88;
  }

  execute(): void {
    eventBus.emit("scene:load", this.targetNode);
  }
}
