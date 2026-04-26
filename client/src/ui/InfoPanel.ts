import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { TextToSpeechReader } from "../services/textToSpeech.ts";
import type { SpeechReaderState } from "../services/textToSpeech.ts";

const PANEL_W = 420;
const CANVAS_W = 960;
const CANVAS_H = 540;
const FADE_SPEED = 0.12;

const BODY_TOP = 68;
const BODY_TOP_WITH_AUDIO = 112;
const BOTTOM_PAD = 24;
const MIN_PANEL_H = 160;
const MAX_PANEL_H = 460;
const AUDIO_Y_OFFSET = 74;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export class InfoPanel {
  readonly container: Container;
  private visible = false;
  private targetAlpha = 0;
  private animFrameId = 0;
  private currentTitle = "";
  private currentBody = "";
  private speechState: SpeechReaderState = "idle";
  private voiceAvailable = false;
  private reader: TextToSpeechReader;

  constructor(speechLanguage = "en-AU") {
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
        wordWrapWidth: PANEL_W - 48,
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

    // Panel card
    const card = new Graphics();
    card.roundRect(x, y, PANEL_W, panelH, 12);
    card.fill({ color: 0xE6F4FF, alpha: 1 });
    card.setStrokeStyle({ width: 2, color: 0xD9F2FF });
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
        fontFamily: "Poppins, sans-serif",
        align: "center",
        fontSize: 20,
        fill: 0x1E88E5,
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
      this.drawAudioControls(x + 24, y + AUDIO_Y_OFFSET, PANEL_W - 48);
    }

    // Body text
    bodyText.position.set(x + 24, y + bodyTop);
    bodyText.eventMode = "none";
    this.container.addChild(bodyText);

    // Close button (top-right of card)
    const closeBtn = new Graphics();
    closeBtn.circle(0, 0, 14);
    closeBtn.fill({ color: 0xD9F2FF, alpha: 0.9 });
    closeBtn.setStrokeStyle({ width: 1.5, color: 0xE0A800 });
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
      style: new TextStyle({ fontFamily: "Poppins, sans-serif", fontSize: 13, fill: 0xE0A800 }),
    });
    xIcon.anchor.set(0.5);
    xIcon.position.set(x + PANEL_W - 20, y + 20);
    xIcon.eventMode = "none";
    this.container.addChild(xIcon);
  }

  private drawAudioControls(x: number, y: number, width: number): void {
    const isLoading = this.currentBody.trim().toLowerCase() === "loading...";
    const enabled = !isLoading;

    const playButton = this.drawAudioButton(x, y, enabled, () => this.toggleSpeech());
    this.drawPlayPauseIcon(playButton, this.speechState === "speaking");
    this.container.addChild(playButton);

    const stopButton = this.drawAudioButton(x + 38, y, enabled && this.speechState !== "idle", () => this.reader.stop());
    this.drawStopIcon(stopButton);
    this.container.addChild(stopButton);

    const label = new Text({
      text: this.audioStatusLabel(enabled, isLoading),
      style: new TextStyle({
        fontFamily: "Nunito, sans-serif",
        fontSize: 12,
        fill: enabled ? 0x2c638f : 0x7a8a96,
        fontWeight: "bold",
        wordWrap: true,
        wordWrapWidth: width - 86,
        lineHeight: 16,
      }),
    });
    label.anchor.set(0, 0.5);
    label.position.set(x + 82, y);
    label.eventMode = "none";
    this.container.addChild(label);
  }

  private drawAudioButton(x: number, y: number, enabled: boolean, onPress: () => void): Container {
    const button = new Container();
    button.position.set(x, y);
    button.alpha = enabled ? 1 : 0.42;

    const bg = new Graphics();
    bg.circle(0, 0, 15);
    bg.fill({ color: enabled ? 0xffffff : 0xd4e4ee, alpha: 0.95 });
    bg.setStrokeStyle({ width: 1.5, color: enabled ? 0x1e88e5 : 0x91a7b7 });
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

  private drawPlayPauseIcon(button: Container, isPause: boolean): void {
    const icon = new Graphics();
    icon.eventMode = "none";

    if (isPause) {
      icon.roundRect(-5, -7, 4, 14, 1);
      icon.roundRect(3, -7, 4, 14, 1);
      icon.fill({ color: 0x1e88e5 });
    } else {
      icon.poly([-4, -8, -4, 8, 8, 0]);
      icon.fill({ color: 0x1e88e5 });
    }

    button.addChild(icon);
  }

  private drawStopIcon(button: Container): void {
    const icon = new Graphics();
    icon.roundRect(-6, -6, 12, 12, 2);
    icon.fill({ color: 0xe0a800 });
    icon.eventMode = "none";
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

  private audioStatusLabel(enabled: boolean, isLoading: boolean): string {
    if (isLoading) return "Audio ready after content loads";
    if (!enabled) return "Read aloud";
    if (this.speechState === "speaking") return "Reading aloud";
    if (this.speechState === "paused") return "Paused";
    return "Read aloud";
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
