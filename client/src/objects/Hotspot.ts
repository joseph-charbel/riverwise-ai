import {
  Container,
  Graphics,
  Sprite,
  Assets,
  Circle,
  Rectangle,
  Polygon,
} from "pixi.js";
import type { HotspotConfig, HotspotGeometry } from "../types/schemas.ts";
import { eventBus } from "../core/EventBus.ts";

declare const ENGINE_DEBUG: boolean;

const HOVER_SCALE = 1.08;
const HOVER_SPEED = 0.15;

function buildHitArea(geo: HotspotGeometry) {
  switch (geo.shape) {
    case "rect":
      return new Rectangle(0, 0, geo.w, geo.h);
    case "circle":
      return new Circle(0, 0, geo.r);
    case "polygon":
      return new Polygon(geo.points);
  }
}

export abstract class Hotspot {
  /** Root container positioned at the hotspot's geometry location */
  readonly root: Container;
  /** Invisible hit-area graphic */
  private hitGraphic: Graphics;
  /** Optional visible image sprite */
  protected imageSprite: Sprite | null = null;

  protected config: HotspotConfig;
  private targetScale = 1;
  private currentScale = 1;
  private animFrameId = 0;

  constructor(config: HotspotConfig) {
    this.config = config;
    this.root = new Container();
    this.hitGraphic = new Graphics();

    const geo = config.geometry;

    // Position root at the hotspot location
    if (geo.shape === "rect") {
      this.root.position.set(geo.x, geo.y);
    } else if (geo.shape === "circle") {
      this.root.position.set(geo.x, geo.y);
    }

    // Set pivot to center so scale expands from center
    if (geo.shape === "rect") {
      this.root.pivot.set(geo.w / 2, geo.h / 2);
      this.root.position.set(geo.x + geo.w / 2, geo.y + geo.h / 2);
    } else if (geo.shape === "circle") {
      // Already centered for circles
    }

    // Debug outlines
    if (ENGINE_DEBUG) {
      this.drawDebug();
    }

    // Hit area
    this.hitGraphic.hitArea = buildHitArea(geo);
    this.hitGraphic.eventMode = "static";
    this.hitGraphic.cursor = "pointer";

    this.hitGraphic.on("pointerover", () => {
      eventBus.emit("hotspot:hover:enter", config.id);
      this.targetScale = HOVER_SCALE;
      this.startScaleAnim();
    });
    this.hitGraphic.on("pointerout", () => {
      eventBus.emit("hotspot:hover:leave", config.id);
      this.targetScale = 1;
      this.startScaleAnim();
    });
    this.hitGraphic.on("pointerdown", () => {
      eventBus.emit("hotspot:click", config.id);
      this.execute();
    });

    this.root.addChild(this.hitGraphic);
  }

  /** Load the image_asset if one was provided in config, sized to geometry */
  async loadImage(): Promise<void> {
    if (!this.config.image_asset) return;
    const texture = await Assets.load(this.config.image_asset);
    this.imageSprite = new Sprite(texture);

    const geo = this.config.geometry;
    if (geo.shape === "rect") {
      this.imageSprite.width = geo.w;
      this.imageSprite.height = geo.h;
    } else if (geo.shape === "circle") {
      this.imageSprite.anchor.set(0.5);
      this.imageSprite.width = geo.r * 2;
      this.imageSprite.height = geo.r * 2;
    }

    // Insert behind hit graphic so pointer events still fire
    this.root.addChildAt(this.imageSprite, 0);
  }

  private startScaleAnim(): void {
    if (this.animFrameId) return;
    const tick = () => {
      const diff = this.targetScale - this.currentScale;
      if (Math.abs(diff) < 0.001) {
        this.currentScale = this.targetScale;
        this.root.scale.set(this.currentScale);
        this.animFrameId = 0;
        return;
      }
      this.currentScale += diff * HOVER_SPEED;
      this.root.scale.set(this.currentScale);
      this.animFrameId = requestAnimationFrame(tick);
    };
    this.animFrameId = requestAnimationFrame(tick);
  }

  private drawDebug(): void {
    const geo = this.config.geometry;
    const color = this.debugColor();
    this.hitGraphic.setStrokeStyle({ width: 2, color });

    if (geo.shape === "rect") {
      this.hitGraphic.rect(0, 0, geo.w, geo.h);
    } else if (geo.shape === "circle") {
      this.hitGraphic.circle(0, 0, geo.r);
    } else if (geo.shape === "polygon") {
      this.hitGraphic.poly(geo.points);
    }
    this.hitGraphic.fill({ color, alpha: 0.15 });
    this.hitGraphic.stroke();
  }

  protected debugColor(): number {
    return 0xffffff;
  }

  abstract execute(): void;

  get id(): string {
    return this.config.id;
  }

  destroy(): void {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    this.hitGraphic.removeAllListeners();
    this.imageSprite?.destroy();
    this.root.destroy({ children: true });
  }

  addTo(parent: Container): void {
    parent.addChild(this.root);
  }
}
