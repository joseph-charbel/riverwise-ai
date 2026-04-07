import type { InfoHotspotConfig, StudentConfig } from "../types/schemas.ts";
import type { InfoPanel } from "../ui/InfoPanel.ts";
import { Hotspot } from "./Hotspot.ts";
import { eventBus } from "../core/EventBus.ts";
import { invokePrompt } from "../services/api.ts";

export class InfoHotspot extends Hotspot {
  private title: string;
  private body: string;
  private panel: InfoPanel;
  private sceneId: string;
  private prefetchedContent: string | null = null;
  private studentConfig: StudentConfig;

  constructor(config: InfoHotspotConfig, panel: InfoPanel, sceneId: string, studentConfig: StudentConfig) {
    super(config);
    this.title = config.title;
    this.body = config.body;
    this.panel = panel;
    this.sceneId = sceneId;
    this.studentConfig = studentConfig;
  }

  setPrefetchedContent(content: string): void {
    this.prefetchedContent = content;
  }

  protected debugColor(): number {
    return 0xffdd44;
  }

  execute(): void {
    eventBus.emit("info:viewed", { sceneId: this.sceneId, hotspotId: this.config.id });

    if (this.prefetchedContent !== null) {
      this.panel.show(this.title, this.prefetchedContent);
      return;
    }

    this.panel.show(this.title, "Loading...");
    invokePrompt(this.body, this.config.id, this.studentConfig)
      .then((content) => this.panel.updateBody(content))
      .catch(() => this.panel.updateBody(this.body));
  }
}
