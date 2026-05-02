import {
  Container,
  Sprite,
  Assets,
  Graphics,
  Text,
  TextStyle,
} from "pixi.js";
import type { MapConfig, MapNodeConfig } from "../types/schemas.ts";
import { eventBus } from "../core/EventBus.ts";

interface NodeEntry {
  config: MapNodeConfig;
  iconSprite: Sprite;
  completed: boolean;
}

export class MapOverlay {
  readonly container: Container;
  readonly mapButton: Container;

  private visible = false;
  private config: MapConfig;
  private nodeEntries: NodeEntry[] = [];
  private canvasW: number;
  private canvasH: number;

  constructor(config: MapConfig, canvasWidth: number, canvasHeight: number) {
    this.config = config;
    this.canvasW = canvasWidth;
    this.canvasH = canvasHeight;

    this.container = new Container();
    this.container.visible = false;
    this.container.zIndex = 1000;
    this.container.eventMode = "static"; // ensures children receive events

    // --- Persistent map button at bottom center ---
    this.mapButton = new Container();
    this.mapButton.zIndex = 999;
    this.mapButton.eventMode = "static";
    this.mapButton.position.set(canvasWidth / 2, canvasHeight - 30);

    const btnBg = new Graphics();
    btnBg.roundRect(-28, -18, 56, 36, 8);
    btnBg.fill({ color: 0x2a2a4a, alpha: 0.85 });
    btnBg.setStrokeStyle({ width: 2, color: 0x6c7bb3 });
    btnBg.stroke();
    btnBg.eventMode = "static";
    btnBg.cursor = "pointer";
    btnBg.hitArea = { contains: (x: number, y: number) => x >= -28 && x <= 28 && y >= -18 && y <= 18 };
    btnBg.on("pointerdown", () => this.toggle());
    btnBg.on("pointerover", () => this.mapButton.scale.set(1.1));
    btnBg.on("pointerout", () => this.mapButton.scale.set(1));
    this.mapButton.addChild(btnBg);

    const icon = new Graphics();
    icon.circle(0, -2, 10);
    icon.fill({ color: 0x6c7bb3 });
    icon.circle(0, -2, 4);
    icon.fill({ color: 0xffffff });
    icon.eventMode = "none"; // decorative only — don't intercept events
    this.mapButton.addChild(icon);

    const btnLabel = new Text({
      text: "MAP",
      style: new TextStyle({ fontFamily: "Arial", fontSize: 8, fill: 0xaabbdd, fontWeight: "bold" }),
    });
    btnLabel.anchor.set(0.5);
    btnLabel.position.set(0, 13);
    btnLabel.eventMode = "none";
    this.mapButton.addChild(btnLabel);

    window.addEventListener("keydown", (e) => {
      if (e.key === "m" || e.key === "M") this.toggle();
    });
  }

  async init(): Promise<void> {
    // Full-screen background — blocks clicks reaching the scene below
    const bgTex = await Assets.load(this.config.background_asset);
    const bg = new Sprite(bgTex);
    bg.width = this.canvasW;
    bg.height = this.canvasH;
    bg.eventMode = "static";
    this.container.addChild(bg);

    // Close button (top-right)
    // const closeBtn = new Graphics();
    // closeBtn.roundRect(-22, -22, 44, 44, 6);
    // closeBtn.fill({ color: 0x1a2e25, alpha: 0.8 });
    // closeBtn.setStrokeStyle({ width: 1.5, color: 0x4a7a5a });
    // closeBtn.stroke();
    // closeBtn.eventMode = "static";
    // closeBtn.cursor = "pointer";
    // closeBtn.hitArea = { contains: (x: number, y: number) => x >= -22 && x <= 22 && y >= -22 && y <= 22 };
    // closeBtn.position.set(this.canvasW - 38, 38);
    // closeBtn.on("pointerdown", () => this.toggle());
    // closeBtn.on("pointerover", () => closeBtn.scale.set(1.1));
    // closeBtn.on("pointerout", () => closeBtn.scale.set(1));
    // this.container.addChild(closeBtn);

    // const xLabel = new Text({
    //   text: "✕",
    //   style: new TextStyle({ fontFamily: "Arial", fontSize: 18, fill: 0x8ec9a6 }),
    // });
    // xLabel.anchor.set(0.5);
    // xLabel.position.set(this.canvasW - 38, 38);
    // xLabel.eventMode = "none";
    // this.container.addChild(xLabel);

    // Node markers with completion state icons
    const labelStyle = new TextStyle({
      fontFamily: "Georgia, serif",
      fontSize: 13,
      fill: 0xc8e6c9,
      align: "center",
    });

    for (const node of this.config.nodes) {
      const tex = await Assets.load(node.icon_incomplete);
      const iconSprite = new Sprite(tex);
      iconSprite.anchor.set(0.5);
      iconSprite.width = node.w;
      iconSprite.height = node.h;
      iconSprite.position.set(node.x, node.y);
      iconSprite.eventMode = "static";
      iconSprite.cursor = "pointer";

      const entry: NodeEntry = { config: node, iconSprite, completed: false };
      this.nodeEntries.push(entry);

      iconSprite.on("pointerdown", () => {
        this.toggle();
        eventBus.emit("scene:load", node.node_id);
      });
      const baseW = node.w;
      const baseH = node.h;
      iconSprite.on("pointerover", () => {
        iconSprite.width = baseW * 1.2;
        iconSprite.height = baseH * 1.2;
      });
      iconSprite.on("pointerout", () => {
        iconSprite.width = baseW;
        iconSprite.height = baseH;
      });

      const label = new Text({ text: node.label, style: labelStyle });
      label.anchor.set(0.5, 0);
      label.position.set(node.x, node.y + 32);
      label.eventMode = "none";

      this.container.addChild(iconSprite);
      this.container.addChild(label);
    }
  }

  async setCompleted(nodeId: string, completed: boolean): Promise<void> {
    const entry = this.nodeEntries.find((e) => e.config.node_id === nodeId);
    if (!entry || entry.completed === completed) return;
    entry.completed = completed;
    const asset = completed ? entry.config.icon_complete : entry.config.icon_incomplete;
    entry.iconSprite.texture = await Assets.load(asset);
  }

  open(): void {
    if (this.visible) return;
    this.visible = true;
    this.container.visible = true;
    eventBus.emit("map:open");
  }

  toggle(): void {
    this.visible = !this.visible;
    this.container.visible = this.visible;
    eventBus.emit(this.visible ? "map:open" : "map:close");
  }

  get isOpen(): boolean {
    return this.visible;
  }
}
