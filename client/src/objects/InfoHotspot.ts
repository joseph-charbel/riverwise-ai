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
  private targetMechanic: string;
  private includeExample: boolean;
  private funFact: string | null;

  constructor(config: InfoHotspotConfig, panel: InfoPanel, sceneId: string, studentConfig: StudentConfig) {
    super(config);
    this.title = config.title;
    this.body = config.body;
    this.panel = panel;
    this.sceneId = sceneId;
    this.studentConfig = studentConfig;
    this.targetMechanic = config.target_mechanic ?? "";
    this.includeExample = config.include_example ?? true;
    this.funFact = config.fun_fact ?? null;
  }

  setPrefetchedContent(content: string): void {
    this.prefetchedContent = content;
  }

  protected debugColor(): number {
    return 0xffdd44;
  }

  protected debugFillAlpha(): number {
    return 0;
  }

  protected debugStrokeLayers(): Array<{ width: number; alpha: number }> {
    return [
      { width: 10, alpha: 0.12 },
      { width: 6, alpha: 0.25 },
      { width: 3, alpha: 0.5 },
      { width: 2, alpha: 0.95 },
    ];
  }

  private compose(content: string): string {
    return this.funFact ? `${content}\n\n💡${this.funFact}` : content;
  }

  execute(): void {
    eventBus.emit("info:viewed", { sceneId: this.sceneId, hotspotId: this.config.id });

    if (this.prefetchedContent !== null) {
      this.panel.show(this.title, this.compose(this.prefetchedContent));
      return;
    }

    this.panel.show(this.title, "Loading...");
    invokePrompt(this.body, this.config.id, this.studentConfig, this.targetMechanic, this.includeExample)
      .then((content) => this.panel.updateBody(this.compose(content)))
      .catch(() => this.panel.updateBody(this.compose(this.body)));
  }
}
