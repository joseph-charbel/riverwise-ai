import { Container, Graphics, Sprite, Text, TextStyle, type Texture } from "pixi.js";
import { TextToSpeechReader } from "../services/textToSpeech.ts";
import type { SpeechReaderState } from "../services/textToSpeech.ts";

const PANEL_W = 480;
const CANVAS_W = 960;
const CANVAS_H = 540;
const FADE_SPEED = 0.12;

const BODY_TOP = 68;
const BODY_TOP_WITH_AUDIO = 112;
const BOTTOM_PAD = 56;
const MIN_PANEL_H = 160;
const MAX_PANEL_H = 460;
const AUDIO_Y_OFFSET = 74;
const AUDIO_BLUE = 0x2f80ed;
const AUDIO_MUTED_BLUE = 0xa9cfee;
const AUDIO_ACTIVE_GOLD = 0xffc857;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export class InfoPanel {
  readonly container: Container;
  private readonly panelTexture: Texture;
  private visible = false;
  private targetAlpha = 0;
  private animFrameId = 0;
  private currentTitle = "";
  private currentBody = "";
  private speechState: SpeechReaderState = "idle";
  private audioProgress = 0;
  private voiceAvailable = false;
  private reader: TextToSpeechReader;

  constructor(panelTexture: Texture, speechLanguage = "en-AU") {
    this.panelTexture = panelTexture;
    this.reader = new TextToSpeechReader(speechLanguage);
    this.voiceAvailable = this.reader.hasVoiceForLanguage;
    this.reader.onChange((state) => {
      this.speechState = state;
      if (this.visible) {
        this.redraw(this.currentTitle, this.currentBody);
      }
    });
    this.reader.onVoiceAvailabilityChange((available) => {
      this.voiceAvailable = available;
      if (!available) {
        this.reader.stop();
      }
      if (this.visible) {
        this.redraw(this.currentTitle, this.currentBody);
      }
    });
    this.reader.onProgress((progress) => {
      this.audioProgress = progress;
      if (this.visible) {
        this.redraw(this.currentTitle, this.currentBody);
      }
    });

    this.container = new Container();
    this.container.zIndex = 2000;
    this.container.visible = false;
    this.container.alpha = 0;
    this.container.eventMode = "static";
  }

  show(title: string, body: string): void {
    this.currentTitle = title;
    this.currentBody = body;
    this.reader.stop();
    this.redraw(title, body);
    this.container.visible = true;
    this.visible = true;
    this.targetAlpha = 1;
    this.startFade();
  }

  updateBody(newBody: string): void {
    if (!this.visible) return;
    this.currentBody = newBody;
    this.reader.stop();
    this.redraw(this.currentTitle, newBody);
  }

  hide(): void {
    if (!this.visible) return;
    this.reader.stop();
    this.visible = false;
    this.targetAlpha = 0;
    this.startFade();
  }

  private redraw(title: string, body: string): void {
    this.container.removeChildren();

    const x = (CANVAS_W - PANEL_W) / 2;

    // Create body text first so we can measure its height
    const bodyText = new Text({
      text: body,
      style: new TextStyle({
        fontFamily: "Nunito, sans-serif",
        fontSize: 14, 
        fill: 0x2C3E50,
        wordWrap: true,
        wordWrapWidth: PANEL_W - 60,
        lineHeight: 22,
      }),
    });
    // Force Pixi to compute text layout so height is accurate
    bodyText.getBounds();

    const hasAudioControls = this.shouldShowAudioControls();
    const bodyTop = hasAudioControls ? BODY_TOP_WITH_AUDIO : BODY_TOP;
    const panelH = clamp(bodyTop + bodyText.height + BOTTOM_PAD, MIN_PANEL_H, MAX_PANEL_H);
    const y = (CANVAS_H - panelH) / 2;

    // Backdrop blocker (full-screen, transparent — eats clicks behind the panel)
    const blocker = new Graphics();
    blocker.rect(0, 0, CANVAS_W, CANVAS_H);
    blocker.fill({ color: 0x000000, alpha: 0.01 });
    blocker.eventMode = "static";
    blocker.on("pointerdown", () => this.hide());
    this.container.addChild(blocker);

    // Soft shadow behind the panel (rgba(0,0,0,0.1))
    const cardShadow = new Graphics();
    cardShadow.roundRect(x + 2, y + 4, PANEL_W, panelH, 12);
    cardShadow.fill({ color: 0x000000, alpha: 0.2 });
    this.container.addChild(cardShadow);

    const cardSprite = new Sprite(this.panelTexture);
    cardSprite.position.set(x, y);
    cardSprite.width = PANEL_W;
    cardSprite.height = panelH;
    cardSprite.eventMode = "none";
    this.container.addChild(cardSprite);

    // Title
    const titleText = new Text({
      text: title,
      style: new TextStyle({
        fontFamily: "Poppins, sans-serif",
        align: "center",
        fontSize: 20,
        fill: 0x0D47A1,
        fontWeight: "bold",
      }),
    });

    titleText.anchor.set(0.5, 0);
    titleText.position.set(x + PANEL_W / 2, y + 22);
    titleText.eventMode = "none";
    this.container.addChild(titleText);

    // Divider
    const divider = new Graphics();
    divider.moveTo(x + 24, y + 56);
    divider.lineTo(x + PANEL_W - 24, y + 56);
    divider.setStrokeStyle({ width: 1, color: 0xE0A800 });
    divider.stroke();
    divider.eventMode = "none";
    this.container.addChild(divider);

    if (hasAudioControls) {
      this.drawAudioControls(x + 48, y + AUDIO_Y_OFFSET + 12);
    }

    // Body text
    bodyText.position.set(x + 30, y + bodyTop);
    bodyText.eventMode = "none";
    this.container.addChild(bodyText);

        // Close button (top-right of card)
    const closeBtn = new Graphics();
    closeBtn.circle(0, 0, 14);
    closeBtn.fill({ color: 0xD9F2FF, alpha: 0.9 });
    closeBtn.setStrokeStyle({ width: 1.5, color: 0xE0A800 });
    closeBtn.stroke();
    closeBtn.position.set(x + PANEL_W - 28, y + 28);
    closeBtn.eventMode = "static";
    closeBtn.cursor = "pointer";
    closeBtn.on("pointerdown", () => this.hide());
    closeBtn.on("pointerover", () => closeBtn.scale.set(1.15));
    closeBtn.on("pointerout", () => closeBtn.scale.set(1));
    this.container.addChild(closeBtn);

    const xIcon = new Text({
      text: "✕",
      style: new TextStyle({ fontFamily: "Poppins, sans-serif", fontSize: 13, fill: 0xE0A800 }),
    });
    xIcon.anchor.set(0.5);
    xIcon.position.set(x + PANEL_W - 28, y + 28);
    xIcon.eventMode = "none";
    this.container.addChild(xIcon);
  }

  private drawAudioControls(x: number, y: number): void {
    const isLoading = this.currentBody.trim().toLowerCase() === "loading...";
    const enabled = !isLoading;
    const isActive = this.speechState === "speaking";

    const audioButton = this.drawAudioButton(x, y, enabled, isActive, () => this.toggleSpeech());
    this.drawAudioIcon(audioButton, isActive);
    this.container.addChild(audioButton);

    this.drawVoiceLines(x + 26, y, enabled ? this.audioProgress : 0);
  }

  private drawVoiceLines(x: number, y: number, progress: number): void {
    const barHeights = [2, 2, 2, 7, 17, 24, 24, 18, 9, 12, 22, 10, 14, 15, 15, 15, 13, 20, 23, 9, 17, 14, 12, 6, 2, 2, 2];
    const barW = 3;
    const gap = 4;
    const clampedProgress = clamp(progress, 0, 1);

    barHeights.forEach((height, index) => {
      const barX = x + index * (barW + gap);
      const barY = y - height / 2;
      const segmentStart = index / barHeights.length;
      const segmentEnd = (index + 1) / barHeights.length;
      const fillAmount = clamp((clampedProgress - segmentStart) / (segmentEnd - segmentStart), 0, 1);

      const mutedBar = new Graphics();
      mutedBar.roundRect(barX, barY, barW, height, barW / 2);
      mutedBar.fill({ color: AUDIO_MUTED_BLUE, alpha: 0.65 });
      mutedBar.eventMode = "none";
      this.container.addChild(mutedBar);

      if (fillAmount <= 0) return;

      const activeBar = new Graphics();
      activeBar.roundRect(barX, barY, barW * fillAmount, height, Math.min(barW * fillAmount, barW) / 2);
      activeBar.fill({ color: AUDIO_BLUE, alpha: 1 });
      activeBar.eventMode = "none";
      this.container.addChild(activeBar);
    });
  }

  private drawAudioButton(x: number, y: number, enabled: boolean, active: boolean, onPress: () => void): Container {
    const button = new Container();
    button.position.set(x, y);
    button.alpha = enabled ? 1 : 0.42;

    const bg = new Graphics();

    bg.circle(0, 0, 14);
    bg.fill({ color: active ? AUDIO_ACTIVE_GOLD : enabled ? AUDIO_BLUE : 0xd9e9ff, alpha: 1 });

    bg.setStrokeStyle({ width: 2, color: active ? 0xe0a800 : enabled ? 0x5dbbff : 0x91a7b7 });
    bg.stroke();

    bg.eventMode = "static";
    bg.cursor = enabled ? "pointer" : "default";

    if (enabled) {
      bg.on("pointerdown", onPress);
      bg.on("pointerover", () => button.scale.set(1.08));
      bg.on("pointerout", () => button.scale.set(1));
    }

    button.addChild(bg);
    return button;
  }

  private drawAudioIcon(button: Container, active: boolean): void {
    const icon = new Graphics();
    icon.eventMode = "none";

    if (active) {
      icon.roundRect(-4, -4, 8, 8, 2);
      icon.fill({ color: 0x0d1b3d });
    } else {
      icon.poly([-4, -6, -4, 6, 7, 0]);
      icon.fill({ color: 0xffffff });
    }

    button.addChild(icon);
  }

  private toggleSpeech(): void {
    if (!this.shouldShowAudioControls() || this.currentBody.trim().toLowerCase() === "loading...") return;

    if (this.speechState === "speaking") {
      this.reader.pause();
      return;
    }

    if (this.speechState === "paused") {
      this.reader.resume();
      return;
    }

    this.reader.speak(`${this.currentTitle}. ${this.currentBody}`);
  }

  private shouldShowAudioControls(): boolean {
    return this.reader.isSupported && this.voiceAvailable;
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
