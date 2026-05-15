import { Container, Graphics, Sprite, Text, TextStyle, type Texture } from "pixi.js";
import type { QuizQuestion } from "../types/schemas.ts";
import { eventBus } from "../core/EventBus.ts";

const CANVAS_W = 960;
const CANVAS_H = 540;
const PANEL_W = 620;
const PANEL_H = 400;
const FADE_SPEED = 0.14;
const QUIZ_BLUE = 0x1e93ee;
const QUIZ_DARK_BLUE = 0x0D47A1;
const QUIZ_LIGHT_BLUE = 0x8fcfff;

export class GenieQuiz {
  readonly container: Container;

  private readonly panelTexture: Texture;
  private readonly waterDropIconTexture: Texture;

  private currentSceneId = "";
  private questions: QuizQuestion[] = [];
  private currentIndex = 0;
  private locked = false; // blocks input while feedback is showing

  private targetAlpha = 0;
  private animFrameId = 0;

  constructor(panelTexture: Texture, waterDropIconTexture: Texture) {
    this.panelTexture = panelTexture;
    this.waterDropIconTexture = waterDropIconTexture;
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

    const cardSprite = new Sprite(this.panelTexture);
    cardSprite.position.set(panelX, panelY);
    cardSprite.width = PANEL_W;
    cardSprite.height = PANEL_H;
    cardSprite.eventMode = "none";
    this.container.addChild(cardSprite);

    this.drawWaterDropIcon(panelX + PANEL_W / 2, panelY + 52);

    // Progress indicator
    const progress = new Text({
      text: `Question ${this.currentIndex + 1} / ${this.questions.length}`,
      style: new TextStyle({ fontFamily: "Poppins, sans-serif", fontSize: 13, fill: QUIZ_DARK_BLUE, fontWeight: "bold" }),
    });
    progress.anchor.set(1, 0);
    progress.position.set(panelX + PANEL_W - 36, panelY + 22);
    progress.eventMode = "none";
    this.container.addChild(progress);
    this.drawQuestionProgress(panelX + PANEL_W - 46, panelY + 56, this.currentIndex, this.questions.length);

    // Question text
    const questionText = new Text({
      text: q.question,
      style: new TextStyle({
        fontFamily: "Poppins, sans-serif",
        fontWeight: "bold",
        fontSize: 20,
        fill: QUIZ_DARK_BLUE,
        wordWrap: true,
        wordWrapWidth: PANEL_W - 100,
        align: "center",
        lineHeight: 24,
      }),
    });
    questionText.anchor.set(0.5, 0);
    questionText.position.set(panelX + PANEL_W / 2, panelY + 100);
    questionText.eventMode = "none";
    this.container.addChild(questionText);

    // Option buttons
    const optionStartY = panelY + 195;
    const optionW = (PANEL_W - 100) / 2;
    const optionH = 52;
    const gap = 12;
    const optionGroupX = panelX + (PANEL_W - optionW * 2 - gap) / 2;

    q.options.forEach((option, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const ox = optionGroupX + col * (optionW + gap);
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
    const fillColor = state === "correct" ? 0x2ea94f : state === "wrong" ? 0xef4444 : QUIZ_BLUE;
    const strokeColor = state === "correct" ? 0x2ea94f : state === "wrong" ? 0xef4444 : 0x5dbbff;

    btn.roundRect(0, 0, w, h, 10);
    btn.fill({ color: fillColor, alpha: 0.96 });
    btn.setStrokeStyle({ width: state ? 2.5 : 3, color: strokeColor });
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

    if (state === "correct" || state === "wrong") {
      const badge = new Graphics();
      const badgeX = x + w - 32;
      const badgeY = y + h / 2;
      const badgeColor = state === "correct" ? 0x2ea94f : 0xef4444;
      badge.circle(badgeX, badgeY, 18);
      badge.fill({ color: 0xffffff, alpha: 1 });
      badge.setStrokeStyle({ width: 1.5, color: state === "correct" ? 0xd8f4df : 0xffd6d6 });
      badge.stroke();
      badge.setStrokeStyle({ width: 4, color: badgeColor });
      if (state === "correct") {
        badge.moveTo(badgeX - 8, badgeY - 1);
        badge.lineTo(badgeX - 2, badgeY + 6);
        badge.lineTo(badgeX + 9, badgeY - 8);
      } else {
        badge.moveTo(badgeX - 7, badgeY - 7);
        badge.lineTo(badgeX + 7, badgeY + 7);
        badge.moveTo(badgeX + 7, badgeY - 7);
        badge.lineTo(badgeX - 7, badgeY + 7);
      }
      badge.stroke();
      badge.eventMode = "none";
      this.container.addChild(badge);
    }

    const label = new Text({
      text,
      style: new TextStyle({
        fontFamily: "Poppins, sans-serif",
        fontSize: 12,
        fontWeight: "bold",
        fill: 0xffffff,
        wordWrap: true,
        wordWrapWidth: state === null ? w - 36 : w - 86,
        align: "center",
        lineHeight: 16,
      }),
    });
    label.anchor.set(0.5, 0.5);
    label.position.set(x + w / 2 - (state === null ? 0 : 16), y + h / 2);
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
    const optionStartY = panelY + 195;
    const optionW = (PANEL_W - 100) / 2;
    const optionH = 52;
    const gap = 12;
    const optionGroupX = panelX + (PANEL_W - optionW * 2 - gap) / 2;

    // Remove existing option buttons.
    // Simpler: just re-render options in-place by removing last N children
    const childCount = this.container.children.length;
    const optionChildrenStart = childCount - q.options.length * 2;
    for (let i = childCount - 1; i >= optionChildrenStart; i--) {
      this.container.removeChildAt(i);
    }

    q.options.forEach((option, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const ox = optionGroupX + col * (optionW + gap);
      const oy = optionStartY + row * (optionH + gap);

      let state: "correct" | "wrong" | null = null;
      if (isCorrect && i === q.correct) state = "correct";
      else if (!isCorrect && i === selectedIndex) state = "wrong";

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

  private drawQuestionProgress(rightX: number, y: number, activeCount: number, total: number): void {
    const radius = 5;
    const spacing = 30;
    const width = (total - 1) * spacing + radius * 2;
    const startX = rightX - width + radius;
    const active = Math.min(activeCount, total);

    const line = new Graphics();
    line.moveTo(startX, y);
    line.lineTo(startX + (total - 1) * spacing, y);
    line.setStrokeStyle({ width: 2, color: QUIZ_LIGHT_BLUE, alpha: 1 });
    line.stroke();
    line.eventMode = "none";
    this.container.addChild(line);

    for (let i = 0; i < total; i++) {
      const x = startX + i * spacing;
      const circle = new Graphics();
      circle.circle(x, y, radius);
      if (i < active) {
        circle.fill({ color: QUIZ_BLUE, alpha: 1 });
      } else {
        circle.fill({ color: 0xffffff, alpha: 0.85 });
      }
      circle.setStrokeStyle({ width: 2, color: QUIZ_BLUE, alpha: 1 });
      circle.stroke();
      circle.eventMode = "none";
      this.container.addChild(circle);
    }
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

    const cardSprite = new Sprite(this.panelTexture);
    cardSprite.position.set(panelX, panelY);
    cardSprite.width = PANEL_W;
    cardSprite.height = PANEL_H;
    cardSprite.eventMode = "none";
    this.container.addChild(cardSprite);

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

    this.drawWaterDropIcon(panelX + PANEL_W / 2, panelY + 100);

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
        fontFamily: "Poppins, sans-serif",
        fontSize: 26,
        fill: 0x0D47A1,
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
        fontFamily: "Poppins, sans-serif",
        fontSize: 14,
        fill: 0x1E88E5,
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

  private drawWaterDropIcon(cx: number, cy: number): void {
    const icon = new Sprite(this.waterDropIconTexture);
    icon.anchor.set(0.5);
    icon.width = 190;
    icon.height = 127;
    icon.position.set(cx, cy);
    icon.eventMode = "none";
    this.container.addChild(icon);
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
