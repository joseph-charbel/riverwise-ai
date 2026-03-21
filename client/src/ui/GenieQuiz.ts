import { Container, Graphics, Text, TextStyle } from "pixi.js";
import type { QuizQuestion } from "../types/schemas.ts";
import { eventBus } from "../core/EventBus.ts";

const CANVAS_W = 960;
const CANVAS_H = 540;
const PANEL_W = 620;
const PANEL_H = 400;
const FADE_SPEED = 0.14;

export class GenieQuiz {
  readonly container: Container;

  private currentSceneId = "";
  private questions: QuizQuestion[] = [];
  private currentIndex = 0;
  private locked = false; // blocks input while feedback is showing

  private targetAlpha = 0;
  private animFrameId = 0;

  constructor() {
    this.container = new Container();
    this.container.zIndex = 2500;
    this.container.visible = false;
    this.container.alpha = 0;
    this.container.eventMode = "static";
  }

  show(sceneId: string, questions: QuizQuestion[]): void {
    this.currentSceneId = sceneId;
    this.questions = questions;
    this.currentIndex = 0;
    this.locked = false;
    this.renderQuestion();
    this.container.visible = true;
    this.targetAlpha = 1;
    this.startFade();
  }

  private renderQuestion(): void {
    this.container.removeChildren();

    const panelX = (CANVAS_W - PANEL_W) / 2;
    const panelY = (CANVAS_H - PANEL_H) / 2;
    const q = this.questions[this.currentIndex]!;

    // Full-screen event blocker
    const blocker = new Graphics();
    blocker.rect(0, 0, CANVAS_W, CANVAS_H);
    blocker.fill({ color: 0x000000, alpha: 0.65 });
    blocker.eventMode = "static";
    this.container.addChild(blocker);

    // Panel card
    const card = new Graphics();
    card.roundRect(panelX, panelY, PANEL_W, PANEL_H, 14);
    card.fill({ color: 0x0a1f15, alpha: 0.97 });
    card.setStrokeStyle({ width: 2, color: 0xd4a843 });
    card.stroke();
    this.container.addChild(card);

    // Genie graphic (drawn with Pixi Graphics)
    this.drawGenie(panelX + PANEL_W / 2, panelY + 52);

    // Progress indicator
    const progress = new Text({
      text: `Question ${this.currentIndex + 1} / ${this.questions.length}`,
      style: new TextStyle({ fontFamily: "Arial", fontSize: 12, fill: 0x8a9a8a, letterSpacing: 1 }),
    });
    progress.anchor.set(1, 0);
    progress.position.set(panelX + PANEL_W - 20, panelY + 14);
    progress.eventMode = "none";
    this.container.addChild(progress);

    // Question text
    const questionText = new Text({
      text: q.question,
      style: new TextStyle({
        fontFamily: "Georgia, serif",
        fontSize: 16,
        fill: 0xf0e6c8,
        wordWrap: true,
        wordWrapWidth: PANEL_W - 60,
        align: "center",
        lineHeight: 24,
      }),
    });
    questionText.anchor.set(0.5, 0);
    questionText.position.set(panelX + PANEL_W / 2, panelY + 100);
    questionText.eventMode = "none";
    this.container.addChild(questionText);

    // Option buttons
    const optionStartY = panelY + 210;
    const optionW = (PANEL_W - 60) / 2;
    const optionH = 52;
    const gap = 12;

    q.options.forEach((option, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const ox = panelX + 30 + col * (optionW + gap);
      const oy = optionStartY + row * (optionH + gap);

      this.buildOptionButton(option, i, ox, oy, optionW, optionH, null);
    });
  }

  private buildOptionButton(
    text: string,
    index: number,
    x: number,
    y: number,
    w: number,
    h: number,
    state: "correct" | "wrong" | null
  ): void {
    const btn = new Graphics();
    const fillColor = state === "correct" ? 0x1b5e20 : state === "wrong" ? 0x7f0000 : 0x1a3a2a;
    const strokeColor = state === "correct" ? 0x66bb6a : state === "wrong" ? 0xef5350 : 0x4a8060;

    btn.roundRect(0, 0, w, h, 8);
    btn.fill({ color: fillColor, alpha: 0.9 });
    btn.setStrokeStyle({ width: state ? 2.5 : 1.5, color: strokeColor });
    btn.stroke();
    btn.position.set(x, y);

    if (!this.locked && state === null) {
      btn.eventMode = "static";
      btn.cursor = "pointer";
      btn.on("pointerover", () => {
        btn.tint = 0xdddddd;
      });
      btn.on("pointerout", () => {
        btn.tint = 0xffffff;
      });
      btn.on("pointerdown", () => this.handleAnswer(index));
    }

    this.container.addChild(btn);

    const label = new Text({
      text,
      style: new TextStyle({
        fontFamily: "Arial, sans-serif",
        fontSize: 13,
        fill: state === "correct" ? 0xa5d6a7 : state === "wrong" ? 0xef9a9a : 0xd0e8d0,
        wordWrap: true,
        wordWrapWidth: w - 20,
        align: "center",
        lineHeight: 18,
      }),
    });
    label.anchor.set(0.5, 0.5);
    label.position.set(x + w / 2, y + h / 2);
    label.eventMode = "none";
    this.container.addChild(label);
  }

  private handleAnswer(selectedIndex: number): void {
    if (this.locked) return;
    this.locked = true;

    const q = this.questions[this.currentIndex]!;
    const isCorrect = selectedIndex === q.correct;

    // Rebuild buttons with feedback colours
    const panelX = (CANVAS_W - PANEL_W) / 2;
    const panelY = (CANVAS_H - PANEL_H) / 2;
    const optionStartY = panelY + 210;
    const optionW = (PANEL_W - 60) / 2;
    const optionH = 52;
    const gap = 12;

    // Remove existing option buttons (everything after genie + progress + question = first 4 children after card)
    // Simpler: just re-render options in-place by removing last N children
    const childCount = this.container.children.length;
    const optionChildrenStart = childCount - q.options.length * 2;
    for (let i = childCount - 1; i >= optionChildrenStart; i--) {
      this.container.removeChildAt(i);
    }

    q.options.forEach((option, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const ox = panelX + 30 + col * (optionW + gap);
      const oy = optionStartY + row * (optionH + gap);

      let state: "correct" | "wrong" | null = null;
      if (i === q.correct) state = "correct";
      else if (i === selectedIndex && !isCorrect) state = "wrong";

      this.buildOptionButton(option, i, ox, oy, optionW, optionH, state);
    });

    if (isCorrect) {
      setTimeout(() => {
        this.currentIndex++;
        if (this.currentIndex >= this.questions.length) {
          this.showCompletion();
        } else {
          this.locked = false;
          this.renderQuestion();
        }
      }, 800);
    } else {
      // Wrong: show feedback then re-enable
      setTimeout(() => {
        this.locked = false;
        this.renderQuestion();
      }, 1000);
    }
  }

  private drawGenie(cx: number, cy: number): void {
    const g = new Graphics();

    // Smoke/wisp base
    g.ellipse(cx, cy + 8, 28, 14);
    g.fill({ color: 0x8b6914, alpha: 0.35 });

    // Body (robe)
    g.ellipse(cx, cy - 4, 18, 22);
    g.fill({ color: 0xd4a843, alpha: 0.9 });

    // Head
    g.circle(cx, cy - 28, 16);
    g.fill({ color: 0xf5d785 });

    // Turban
    g.ellipse(cx, cy - 40, 18, 8);
    g.fill({ color: 0x6b3fa0 });
    g.circle(cx, cy - 44, 5);
    g.fill({ color: 0xd4a843 });

    // Eyes
    g.circle(cx - 5, cy - 30, 2.5);
    g.fill({ color: 0x1a0a3a });
    g.circle(cx + 5, cy - 30, 2.5);
    g.fill({ color: 0x1a0a3a });

    // Smile
    g.setStrokeStyle({ width: 1.5, color: 0x8b5e1a });
    g.arc(cx, cy - 25, 6, 0.2, Math.PI - 0.2);
    g.stroke();

    // Stars
    for (const [sx, sy] of [[-22, -35], [24, -20], [-28, -10], [30, -38]] as [number, number][]) {
      g.circle(cx + sx, cy + sy, 2);
      g.fill({ color: 0xffd700, alpha: 0.7 });
    }

    g.eventMode = "none";
    this.container.addChild(g);
  }

  private showCompletion(): void {
    this.container.removeChildren();

    const panelX = (CANVAS_W - PANEL_W) / 2;
    const panelY = (CANVAS_H - PANEL_H) / 2;

    // Blocker
    const blocker = new Graphics();
    blocker.rect(0, 0, CANVAS_W, CANVAS_H);
    blocker.fill({ color: 0x000000, alpha: 0.65 });
    blocker.eventMode = "static";
    this.container.addChild(blocker);

    // Card
    const card = new Graphics();
    card.roundRect(panelX, panelY, PANEL_W, PANEL_H, 14);
    card.fill({ color: 0x0a200f, alpha: 0.97 });
    card.setStrokeStyle({ width: 2.5, color: 0x66bb6a });
    card.stroke();
    this.container.addChild(card);

    // Star burst decoration
    const stars = new Graphics();
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const r = 70 + (i % 3) * 20;
      const sx = panelX + PANEL_W / 2 + Math.cos(angle) * r;
      const sy = panelY + PANEL_H / 2 + Math.sin(angle) * r * 0.6;
      stars.circle(sx, sy, 3 + (i % 3));
      stars.fill({ color: 0xffd700, alpha: 0.5 + (i % 3) * 0.15 });
    }
    stars.eventMode = "none";
    this.container.addChild(stars);

    // Genie (happy)
    this.drawGenie(panelX + PANEL_W / 2, panelY + 100);

    // Checkmark
    const check = new Text({
      text: "✓",
      style: new TextStyle({ fontFamily: "Arial", fontSize: 52, fill: 0x66bb6a, fontWeight: "bold" }),
    });
    check.anchor.set(0.5);
    check.position.set(panelX + PANEL_W / 2, panelY + 200);
    check.eventMode = "none";
    this.container.addChild(check);

    // Title
    const title = new Text({
      text: "Scene Complete!",
      style: new TextStyle({
        fontFamily: "Georgia, serif",
        fontSize: 26,
        fill: 0xa5d6a7,
        fontWeight: "bold",
      }),
    });
    title.anchor.set(0.5);
    title.position.set(panelX + PANEL_W / 2, panelY + 268);
    title.eventMode = "none";
    this.container.addChild(title);

    const sub = new Text({
      text: "Your knowledge has restored balance to this area.",
      style: new TextStyle({
        fontFamily: "Arial",
        fontSize: 14,
        fill: 0x81c784,
        align: "center",
        wordWrap: true,
        wordWrapWidth: PANEL_W - 80,
      }),
    });
    sub.anchor.set(0.5);
    sub.position.set(panelX + PANEL_W / 2, panelY + 310);
    sub.eventMode = "none";
    this.container.addChild(sub);

    // Emit and auto-close
    eventBus.emit("scene:complete", this.currentSceneId);

    setTimeout(() => {
      this.targetAlpha = 0;
      this.startFade();
    }, 2800);
  }

  private startFade(): void {
    if (this.animFrameId) return;
    const tick = () => {
      const diff = this.targetAlpha - this.container.alpha;
      if (Math.abs(diff) < 0.01) {
        this.container.alpha = this.targetAlpha;
        if (this.targetAlpha === 0) this.container.visible = false;
        this.animFrameId = 0;
        return;
      }
      this.container.alpha += diff * FADE_SPEED;
      this.animFrameId = requestAnimationFrame(tick);
    };
    this.animFrameId = requestAnimationFrame(tick);
  }
}
