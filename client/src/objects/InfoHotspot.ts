import type { InfoHotspotConfig } from "../types/schemas.ts";
import type { InfoPanel } from "../ui/InfoPanel.ts";
import { Hotspot } from "./Hotspot.ts";
import { eventBus } from "../core/EventBus.ts";

export class InfoHotspot extends Hotspot {
  private title: string;
  private body: string;
  private panel: InfoPanel;
  private sceneId: string;

  constructor(config: InfoHotspotConfig, panel: InfoPanel, sceneId: string) {
    super(config);
    this.title = config.title;
    this.body = config.body;
    this.panel = panel;
    this.sceneId = sceneId;
  }

  protected debugColor(): number {
    return 0xffdd44;
  }

  execute(): void {
    this.panel.show(this.title, "Loading...");
    eventBus.emit("info:viewed", { sceneId: this.sceneId, hotspotId: this.config.id });

    fetch("/api/dummy-invoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: this.body }),
    })
      .then((res) => res.json())
      .then((data: { content: string }) => {
        this.panel.updateBody(data.content);
      })
      .catch(() => {
        this.panel.updateBody(this.body);
      });
  }
}
