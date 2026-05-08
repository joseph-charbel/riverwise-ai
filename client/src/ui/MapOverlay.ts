import {
  Container,
  Sprite,
  Assets,
  Rectangle,
  Text,
  TextStyle,
} from "pixi.js";
import type { MapConfig, MapNodeConfig } from "../types/schemas.ts";
import { eventBus } from "../core/EventBus.ts";

interface NodeEntry {
  config: MapNodeConfig;
  iconSprite: Sprite;
  label: Text;
  completed: boolean;
  baseW: number;
  baseH: number;
}

const LOCKED_TINT = 0x888888;
const MAP_BTN_SIZE = 64;

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

    // --- Persistent map button at bottom-left (sprite added in init) ---
    this.mapButton = new Container();
    this.mapButton.zIndex = 999;
    this.mapButton.eventMode = "static";
    this.mapButton.cursor = "pointer";
    const half = MAP_BTN_SIZE / 2;
    this.mapButton.hitArea = new Rectangle(-half, -half, MAP_BTN_SIZE, MAP_BTN_SIZE);
    this.mapButton.position.set(50, canvasHeight - 50);
    this.mapButton.on("pointerdown", () => this.toggle());
    this.mapButton.on("pointerover", () => this.mapButton.scale.set(1.1));
    this.mapButton.on("pointerout", () => this.mapButton.scale.set(1));

    window.addEventListener("keydown", (e) => {
      if (e.key === "m" || e.key === "M") this.toggle();
    });
  }

  /** Every location with a lower `order` must be completed first. */
  private isNodeUnlocked(entry: NodeEntry): boolean {
    return this.nodeEntries.every(
      (o) => o.config.order >= entry.config.order || o.completed,
    );
  }

  /** Locked locations cannot be entered; completed ones stay replayable. */
  private canVisit(entry: NodeEntry): boolean {
    return this.isNodeUnlocked(entry) || entry.completed;
  }

  private async applyNodeState(entry: NodeEntry): Promise<void> {
    const unlocked = this.isNodeUnlocked(entry);
    const showLocked = !unlocked && !entry.completed;
    const visitable = this.canVisit(entry);

    let asset: string;
    if (entry.completed) {
      asset = entry.config.icon_complete;
    } else if (showLocked && entry.config.icon_locked) {
      asset = entry.config.icon_locked;
    } else {
      asset = entry.config.icon_incomplete;
    }
    entry.iconSprite.texture = await Assets.load(asset);

    if (showLocked && !entry.config.icon_locked) {
      entry.iconSprite.tint = LOCKED_TINT;
    } else {
      entry.iconSprite.tint = 0xffffff;
    }

    entry.label.alpha = showLocked ? 0.45 : 1;

    entry.iconSprite.removeAllListeners();

    if (visitable) {
      entry.iconSprite.eventMode = "static";
      entry.iconSprite.cursor = "pointer";
      const { baseW, baseH } = entry;
      entry.iconSprite.on("pointerdown", () => {
        this.toggle();
        eventBus.emit("scene:load", entry.config.node_id);
      });
      entry.iconSprite.on("pointerover", () => {
        entry.iconSprite.width = baseW * 1.2;
        entry.iconSprite.height = baseH * 1.2;
      });
      entry.iconSprite.on("pointerout", () => {
        entry.iconSprite.width = baseW;
        entry.iconSprite.height = baseH;
      });
    } else {
      entry.iconSprite.eventMode = "none";
      entry.iconSprite.cursor = "default";
      entry.iconSprite.width = entry.baseW;
      entry.iconSprite.height = entry.baseH;
    }
  }

  private async refreshAllNodes(): Promise<void> {
    await Promise.all(this.nodeEntries.map((e) => this.applyNodeState(e)));
  }

  async init(): Promise<void> {
    const mapTex = await Assets.load("assets/sprites/map icon.png");
    const mapSprite = new Sprite(mapTex);
    mapSprite.anchor.set(0.5);
    mapSprite.width = MAP_BTN_SIZE;
    mapSprite.height = MAP_BTN_SIZE;
    mapSprite.eventMode = "none";
    this.mapButton.addChild(mapSprite);

    // Full-screen background — blocks clicks reaching the scene below
    const bgTex = await Assets.load(this.config.background_asset);
    const bg = new Sprite(bgTex);
    bg.width = this.canvasW;
    bg.height = this.canvasH;
    bg.eventMode = "static";
    this.container.addChild(bg);

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

      const label = new Text({ text: node.label, style: labelStyle });
      label.anchor.set(0.5, 0);
      label.position.set(node.x, node.y + 32);
      label.eventMode = "none";

      const entry: NodeEntry = {
        config: node,
        iconSprite,
        label,
        completed: false,
        baseW: node.w,
        baseH: node.h,
      };
      this.nodeEntries.push(entry);

      this.container.addChild(iconSprite);
      this.container.addChild(label);
    }

    this.nodeEntries.sort((a, b) => a.config.order - b.config.order);
    await this.refreshAllNodes();
  }

  async setCompleted(nodeId: string, completed: boolean): Promise<void> {
    const entry = this.nodeEntries.find((e) => e.config.node_id === nodeId);
    if (!entry || entry.completed === completed) return;
    entry.completed = completed;
    await this.refreshAllNodes();
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
