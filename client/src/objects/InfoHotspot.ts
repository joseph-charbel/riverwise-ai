import type { InfoHotspotConfig, StudentConfig } from "../types/schemas.ts";
import type { InfoPanel } from "../ui/InfoPanel.ts";
import { Hotspot } from "./Hotspot.ts";
import { eventBus } from "../core/EventBus.ts";
import { invokePrompt } from "../services/api.ts";
import { GlowFilter } from "pixi-filters";

const DEBUG_OUTLINE_THICKNESS = 2;
const DEBUG_GLOW_PULSE_SPEED = 1;
const TAU = Math.PI * 2;

export class InfoHotspot extends Hotspot {
  private glowFrameId = 0;
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

  private phaseOffsetFromId(id: string): number {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    }
    return (hash / 0xffffffff) * TAU;
  }

  protected drawDebug(): void {
    const geo = this.config.geometry;
    const phaseOffset = this.phaseOffsetFromId(this.config.id);
    this.hitGraphic.setStrokeStyle({ width: DEBUG_OUTLINE_THICKNESS, color: 0xffdd44, alpha: 0.7 });
    this.drawDebugShape(geo);
    this.hitGraphic.stroke();

    const glow = new GlowFilter({
      color: 0xffdd44,
      distance: 18,
      outerStrength: 3,
      innerStrength: 0,
      quality: 0.3,
    });
    this.hitGraphic.filters = [glow];

    const start = performance.now();
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      glow.outerStrength = 3 + 2 * Math.sin(t * DEBUG_GLOW_PULSE_SPEED + phaseOffset);
      this.glowFrameId = requestAnimationFrame(tick);
    };
    this.glowFrameId = requestAnimationFrame(tick);
  }

  destroy(): void {
    if (this.glowFrameId) cancelAnimationFrame(this.glowFrameId);
    super.destroy();
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
