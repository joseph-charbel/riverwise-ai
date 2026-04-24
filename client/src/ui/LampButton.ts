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
  private lampTexture: Texture;
  private pulseFrameId = 0;
  private pulseDir = 1;
  private pulseScale = 1;

  constructor(
    questionsMap: Map<string, QuizQuestion[]>,
    quiz: GenieQuiz,
    canvasWidth: number,
    canvasHeight: number,
    lampTexture: Texture
  ) {
    this.questionsMap = questionsMap;
    this.quiz = quiz;
    this.lampTexture = lampTexture;

    this.container = new Container();
    this.container.zIndex = 999;
    this.container.eventMode = "static";
    this.container.position.set(canvasWidth - 52, canvasHeight - 52);

    this.drawLamp(false);

    eventBus.on("scene:infos:complete", (sceneId: unknown) => {
      if (sceneId === this.currentSceneId && !this.completedScenes.has(sceneId as string)) {
        this.setActive(true);
      }
    });

    eventBus.on("scene:ready", (sceneId: unknown) => {
      this.currentSceneId = sceneId as string;
      this.setActive(false);
    });

    eventBus.on("scene:complete", (sceneId: unknown) => {
      this.completedScenes.add(sceneId as string);
      this.setActive(false);
    });
  }

  private setActive(active: boolean): void {
    this.drawLamp(active);

    if (active) {
      this.startPulse();
    } else {
      this.stopPulse();
    }
  }

  private drawLamp(active: boolean): void {
    this.container.removeChildren();

    const icon = new Sprite(this.lampTexture);
    icon.anchor.set(0.5);
    const maxPx = 40;
    const scale = maxPx / Math.max(icon.texture.width, icon.texture.height);
    icon.scale.set(scale);
    icon.alpha = active ? 1 : 0.55;
    icon.eventMode = "none";
    this.container.addChild(icon);

    const label = new Text({
      text: active ? "READY!" : "LAMP",
      style: new TextStyle({
        fontFamily: "Arial",
        fontSize: 7,
        fill: active ? 0xffd700 : 0x666677,
        fontWeight: active ? "bold" : "normal",
      }),
    });
    label.anchor.set(0.5);
    label.position.set(0, 24);
    label.eventMode = "none";
    this.container.addChild(label);

    // Invisible hit area
    const hit = new Graphics();
    hit.rect(-20, -20, 40, 40);
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
