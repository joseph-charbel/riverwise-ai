import { Container, Graphics, Text, TextStyle } from "pixi.js";
import type { QuizQuestion } from "../types/schemas.ts";
import type { GenieQuiz } from "./GenieQuiz.ts";
import { eventBus } from "../core/EventBus.ts";

export class LampButton {
  readonly container: Container;

  private currentSceneId = "";
  private completedScenes = new Set<string>();
  private questionsMap: Map<string, QuizQuestion[]>;
  private quiz: GenieQuiz;
  private pulseFrameId = 0;
  private pulseDir = 1;
  private pulseScale = 1;

  constructor(
    questionsMap: Map<string, QuizQuestion[]>,
    quiz: GenieQuiz,
    canvasWidth: number,
    canvasHeight: number
  ) {
    this.questionsMap = questionsMap;
    this.quiz = quiz;

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

    // Glow aura when active
    if (active) {
      const glow = new Graphics();
      glow.circle(0, 0, 38);
      glow.fill({ color: 0xffd700, alpha: 0.18 });
      glow.circle(0, 0, 28);
      glow.fill({ color: 0xffd700, alpha: 0.15 });
      glow.eventMode = "none";
      this.container.addChild(glow);
    }

    // Button background
    const bg = new Graphics();
    bg.circle(0, 0, 24);
    bg.fill({ color: active ? 0x3a2800 : 0x1a1a2a, alpha: active ? 0.92 : 0.7 });
    bg.setStrokeStyle({ width: 2, color: active ? 0xffd700 : 0x44445a });
    bg.stroke();
    this.container.addChild(bg);

    // Lamp SVG-like shape drawn with Graphics
    const lamp = new Graphics();
    const lc = active ? 0xffd700 : 0x888899;

    // Spout
    lamp.moveTo(-16, -2);
    lamp.bezierCurveTo(-22, -6, -26, -2, -22, 2);
    lamp.bezierCurveTo(-18, 6, -12, 4, -8, 2);
    lamp.setStrokeStyle({ width: 2.5, color: lc });
    lamp.stroke();

    // Body
    lamp.ellipse(2, 2, 12, 7);
    lamp.fill({ color: lc, alpha: active ? 1 : 0.7 });

    // Handle
    lamp.arc(14, -2, 6, -Math.PI / 2, Math.PI / 2);
    lamp.setStrokeStyle({ width: 2, color: lc });
    lamp.stroke();

    // Base
    lamp.moveTo(-6, 10);
    lamp.lineTo(10, 10);
    lamp.setStrokeStyle({ width: 2, color: lc });
    lamp.stroke();

    // Flame when active
    if (active) {
      const flame = new Graphics();
      flame.ellipse(0, -10, 4, 7);
      flame.fill({ color: 0xff8c00, alpha: 0.9 });
      flame.ellipse(0, -13, 2.5, 4);
      flame.fill({ color: 0xffee58, alpha: 0.95 });
      flame.eventMode = "none";
      this.container.addChild(flame);
    }

    lamp.eventMode = "none";
    this.container.addChild(lamp);

    // Label
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
    label.position.set(0, 20);
    label.eventMode = "none";
    this.container.addChild(label);

    // Interactivity
    bg.eventMode = "static";
    bg.hitArea = { contains: (x: number, y: number) => x * x + y * y <= 576 }; // r=24
    if (active) {
      bg.cursor = "pointer";
      bg.on("pointerdown", () => {
        const questions = this.questionsMap.get(this.currentSceneId);
        if (questions && questions.length > 0) {
          this.quiz.show(this.currentSceneId, questions);
        }
      });
      bg.on("pointerover", () => this.container.scale.set(1.12));
      bg.on("pointerout", () => this.container.scale.set(this.pulseScale));
    } else {
      bg.cursor = "default";
    }
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
