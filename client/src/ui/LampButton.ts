import { Container, Graphics, Sprite, Text, TextStyle, Texture } from "pixi.js";
import type { QuizQuestion } from "../types/schemas.ts";
import type { GenieQuiz } from "./GenieQuiz.ts";
import { eventBus } from "../core/EventBus.ts";

export class LampButton {
  readonly container: Container;

  private currentSceneId = "";
  private completedScenes = new Set<string>();
  private questionsMap: Map<string, QuizQuestion[]>;
  private quiz: GenieQuiz;
  private lampTextures: Texture[];
  private infoCountMap: Map<string, number>;
  private viewedIds = new Set<string>();
  private iconSprite: Sprite | null = null;
  private isActive = false;
  private pulseFrameId = 0;
  private pulseDir = 1;
  private pulseScale = 1;

  constructor(
    questionsMap: Map<string, QuizQuestion[]>,
    quiz: GenieQuiz,
    canvasWidth: number,
    canvasHeight: number,
    lampTextures: Texture[],
    infoCountMap: Map<string, number>
  ) {
    this.questionsMap = questionsMap;
    this.quiz = quiz;
    this.lampTextures = lampTextures;
    this.infoCountMap = infoCountMap;

    this.container = new Container();
    this.container.zIndex = 999;
    this.container.eventMode = "static";
    this.container.position.set(Math.round(canvasWidth - 70), Math.round(canvasHeight - 70));

    this.drawLamp(false);

    eventBus.on("info:viewed", (data: unknown) => {
      const { sceneId, hotspotId } = data as { sceneId: string; hotspotId: string };
      if (sceneId === this.currentSceneId && !this.isActive) {
        this.viewedIds.add(hotspotId);
        this.updateIconFrame();
      }
    });

    eventBus.on("scene:infos:complete", (sceneId: unknown) => {
      if (sceneId === this.currentSceneId && !this.completedScenes.has(sceneId as string)) {
        this.setActive(true);
      }
    });

    eventBus.on("scene:ready", (sceneId: unknown) => {
      this.currentSceneId = sceneId as string;
      this.viewedIds.clear();
      this.setActive(false);
    });

    eventBus.on("scene:complete", (sceneId: unknown) => {
      this.completedScenes.add(sceneId as string);
      this.setActive(false);
    });
  }

  private setActive(active: boolean): void {
    this.isActive = active;
    this.drawLamp(active);

    if (active) {
      this.startPulse();
    } else {
      this.stopPulse();
    }
  }

  /** 5 textures 0..4. N=4: 0→1→2→3→4. N=3: 0→1→3→4 (skip frame 2). */
  private getFrameIndex(viewed: number, total: number): number {
    if (total === 0) return 0;
    if (viewed === 0) return 0;
    if (viewed >= total) return 4;

    if (total === 3) {
      if (viewed === 1) return 1;
      if (viewed === 2) return 3;
    }
    if (total === 4) {
      return viewed; // 1,2,3
    }
    if (total === 2) {
      if (viewed === 1) return 2; // 0 → 2 → 4
    }
    if (total > 4) {
      return Math.min(3, Math.ceil((viewed * 3) / (total - 1)));
    }
    return 0;
  }

  private updateIconFrame(): void {
    if (!this.iconSprite) return;
    const total = this.infoCountMap.get(this.currentSceneId) ?? 0;
    const frameIdx = this.getFrameIndex(this.viewedIds.size, total);
    const tex = this.lampTextures[frameIdx] ?? this.lampTextures[0]!;
    this.iconSprite.texture = tex;
  }

  private drawLamp(active: boolean): void {
    this.container.removeChildren();
    this.iconSprite = null;

    const total = this.infoCountMap.get(this.currentSceneId) ?? 0;
    const frameIdx = active ? 4 : this.getFrameIndex(this.viewedIds.size, total);
    const texture = this.lampTextures[frameIdx] ?? this.lampTextures[0]!;

    const icon = new Sprite(texture);
    icon.roundPixels = true;
    icon.anchor.set(0.5);
    const maxPx = 58;
    const s = maxPx / Math.max(icon.texture.width, icon.texture.height);
    const scale = Math.round(s * 10000) / 10000;
    icon.scale.set(scale);
    icon.alpha = active ? 1 : 0.75 + 0.12 * (frameIdx / 4);
    icon.eventMode = "none";
    this.container.addChild(icon);
    this.iconSprite = icon;

    const label = new Text({
      text: active ? "READY!" : "LAMP",
      style: new TextStyle({
        fontFamily: "Arial, sans-serif",
        fontSize: 11,
        fill: active ? 0xffe082 : 0xc8d0e0,
        fontWeight: "bold",
        letterSpacing: 0.4,
        dropShadow: {
          color: 0x000000,
          alpha: 0.45,
          blur: 0,
          distance: 1,
        },
        stroke: { color: 0x0a0a12, width: 1, join: "round" },
      }),
    });
    label.anchor.set(0.5);
    label.position.set(0, 36);
    label.eventMode = "none";
    this.container.addChild(label);

    const hit = new Graphics();
    hit.rect(-34, -34, 68, 68);
    hit.fill({ color: 0x000000, alpha: 0 });
    hit.eventMode = "static";
    if (active) {
      hit.cursor = "pointer";
      hit.on("pointerdown", () => {
        const questions = this.questionsMap.get(this.currentSceneId);
        if (questions && questions.length > 0) {
          this.quiz.show(this.currentSceneId, questions);
        }
      });
      hit.on("pointerover", () => this.container.scale.set(1.12));
      hit.on("pointerout", () => this.container.scale.set(this.pulseScale));
    } else {
      hit.cursor = "default";
    }
    this.container.addChild(hit);
  }

  private startPulse(): void {
    if (this.pulseFrameId) return;
    const tick = () => {
      this.pulseScale += 0.005 * this.pulseDir;
      if (this.pulseScale > 1.08) this.pulseDir = -1;
      if (this.pulseScale < 0.96) this.pulseDir = 1;
      this.container.scale.set(this.pulseScale);
      this.pulseFrameId = requestAnimationFrame(tick);
    };
    this.pulseFrameId = requestAnimationFrame(tick);
  }

  private stopPulse(): void {
    if (this.pulseFrameId) {
      cancelAnimationFrame(this.pulseFrameId);
      this.pulseFrameId = 0;
    }
    this.pulseScale = 1;
    this.container.scale.set(1);
  }
}
