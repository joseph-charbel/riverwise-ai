import { Container, Sprite, Assets } from "pixi.js";
import type { SceneConfig } from "../types/schemas.ts";
import type { InfoPanel } from "../ui/InfoPanel.ts";
import { createHotspot } from "./HotspotFactory.ts";
import { Hotspot } from "./Hotspot.ts";
import { StateSwapHotspot } from "./StateSwapHotspot.ts";
import { AnimationHotspot } from "./AnimationHotspot.ts";
import { eventBus } from "../core/EventBus.ts";

export class Scene {
  readonly container: Container;
  readonly nodeId: string;
  private hotspots: Hotspot[] = [];
  private config: SceneConfig;
  private infoPanel: InfoPanel;

  private totalInfoCount = 0;
  private viewedInfos = new Set<string>();
  private infoViewedHandler: (payload: unknown) => void;

  constructor(config: SceneConfig, infoPanel: InfoPanel) {
    this.config = config;
    this.infoPanel = infoPanel;
    this.nodeId = config.node_id;
    this.container = new Container();

    this.infoViewedHandler = (payload: unknown) => {
      const { sceneId, hotspotId } = payload as { sceneId: string; hotspotId: string };
      if (sceneId !== this.nodeId) return;
      this.viewedInfos.add(hotspotId);
      if (this.totalInfoCount > 0 && this.viewedInfos.size >= this.totalInfoCount) {
        eventBus.emit("scene:infos:complete", this.nodeId);
      }
    };

    eventBus.on("info:viewed", this.infoViewedHandler);
  }

  async init(): Promise<void> {
    // Count info hotspots up front so the tracker knows the target
    this.totalInfoCount = this.config.hotspots.filter((h) => h.type === "info").length;

    const bgTexture = await Assets.load(this.config.background_asset);
    const bg = new Sprite(bgTexture);
    this.container.addChild(bg);

    for (const hConfig of this.config.hotspots) {
      const hotspot = createHotspot(hConfig, this.infoPanel, this.nodeId);

      await hotspot.loadImage();

      if (hotspot instanceof StateSwapHotspot) {
        await hotspot.init();
        this.container.addChild(hotspot.displaySprite);
      } else if (hotspot instanceof AnimationHotspot) {
        await hotspot.init();
        if (hotspot.displaySprite) {
          this.container.addChild(hotspot.displaySprite);
        }
      }

      hotspot.addTo(this.container);
      this.hotspots.push(hotspot);
    }
  }

  destroy(): void {
    eventBus.off("info:viewed", this.infoViewedHandler);
    for (const hotspot of this.hotspots) {
      hotspot.destroy();
    }
    this.hotspots = [];
    this.container.destroy({ children: true });
  }
}
