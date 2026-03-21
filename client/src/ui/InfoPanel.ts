import { Container, Graphics, Text, TextStyle } from "pixi.js";

const PANEL_W = 420;
const PANEL_H = 260;
const CANVAS_W = 960;
const CANVAS_H = 540;
const FADE_SPEED = 0.12;

export class InfoPanel {
  readonly container: Container;
  private visible = false;
  private targetAlpha = 0;
  private animFrameId = 0;
  private bodyText: Text | null = null;

  constructor() {
    this.container = new Container();
    this.container.zIndex = 2000;
    this.container.visible = false;
    this.container.alpha = 0;
    this.container.eventMode = "static";
  }

  show(title: string, body: string): void {
    // Rebuild content each call
    this.container.removeChildren();
    this.bodyText = null;

    const x = (CANVAS_W - PANEL_W) / 2;
    const y = (CANVAS_H - PANEL_H) / 2;

    // Backdrop blocker (full-screen, transparent — eats clicks behind the panel)
    const blocker = new Graphics();
    blocker.rect(0, 0, CANVAS_W, CANVAS_H);
    blocker.fill({ color: 0x000000, alpha: 0.01 });
    blocker.eventMode = "static";
    blocker.on("pointerdown", () => this.hide());
    this.container.addChild(blocker);

    // Panel card
    const card = new Graphics();
    card.roundRect(x, y, PANEL_W, PANEL_H, 12);
    card.fill({ color: 0x0f2318, alpha: 0.95 });
    card.setStrokeStyle({ width: 2, color: 0x4a9a6e });
    card.stroke();
    // Subtle inner highlight line at top
    card.setStrokeStyle({ width: 1, color: 0x6ec99a, alpha: 0.3 });
    card.moveTo(x + 16, y + 1);
    card.lineTo(x + PANEL_W - 16, y + 1);
    card.stroke();
    this.container.addChild(card);

    // Title
    const titleText = new Text({
      text: title,
      style: new TextStyle({
        fontFamily: "Georgia, serif",
        fontSize: 20,
        fill: 0x8eeeb4,
        fontWeight: "bold",
      }),
    });
    titleText.position.set(x + 24, y + 22);
    titleText.eventMode = "none";
    this.container.addChild(titleText);

    // Divider
    const divider = new Graphics();
    divider.moveTo(x + 24, y + 56);
    divider.lineTo(x + PANEL_W - 24, y + 56);
    divider.setStrokeStyle({ width: 1, color: 0x3d6b55 });
    divider.stroke();
    divider.eventMode = "none";
    this.container.addChild(divider);

    // Body text (word-wrapped)
    this.bodyText = new Text({
      text: body,
      style: new TextStyle({
        fontFamily: "Arial, sans-serif",
        fontSize: 14,
        fill: 0xc8e6c9,
        wordWrap: true,
        wordWrapWidth: PANEL_W - 48,
        lineHeight: 22,
      }),
    });
    this.bodyText.position.set(x + 24, y + 68);
    this.bodyText.eventMode = "none";
    this.container.addChild(this.bodyText);

    // Close button (top-right of card)
    const closeBtn = new Graphics();
    closeBtn.circle(0, 0, 14);
    closeBtn.fill({ color: 0x1a3a28, alpha: 0.9 });
    closeBtn.setStrokeStyle({ width: 1.5, color: 0x4a9a6e });
    closeBtn.stroke();
    closeBtn.position.set(x + PANEL_W - 20, y + 20);
    closeBtn.eventMode = "static";
    closeBtn.cursor = "pointer";
    closeBtn.on("pointerdown", () => this.hide());
    closeBtn.on("pointerover", () => closeBtn.scale.set(1.15));
    closeBtn.on("pointerout", () => closeBtn.scale.set(1));
    this.container.addChild(closeBtn);

    const xIcon = new Text({
      text: "✕",
      style: new TextStyle({ fontFamily: "Arial", fontSize: 13, fill: 0x8eeeb4 }),
    });
    xIcon.anchor.set(0.5);
    xIcon.position.set(x + PANEL_W - 20, y + 20);
    xIcon.eventMode = "none";
    this.container.addChild(xIcon);

    // Animate in
    this.container.visible = true;
    this.visible = true;
    this.targetAlpha = 1;
    this.startFade();
  }

  updateBody(newBody: string): void {
    if (this.bodyText) {
      this.bodyText.text = newBody;
    }
  }

  hide(): void {
    if (!this.visible) return;
    this.visible = false;
    this.targetAlpha = 0;
    this.startFade();
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

  get isVisible(): boolean {
    return this.visible;
  }
}
