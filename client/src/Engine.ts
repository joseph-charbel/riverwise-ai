import { Application, Assets } from "pixi.js";
import type { SceneConfig, MapConfig, QuizQuestion, StudentConfig } from "./types/schemas.ts";
import { SceneManager } from "./core/SceneManager.ts";
import { InputManager } from "./core/InputManager.ts";
import { MapOverlay } from "./ui/MapOverlay.ts";
import { InfoPanel } from "./ui/InfoPanel.ts";
import { GenieQuiz } from "./ui/GenieQuiz.ts";
import { LampButton } from "./ui/LampButton.ts";
import { eventBus } from "./core/EventBus.ts";

/** Fixed design resolution; stage scales uniformly to fill the viewport. */
const DESIGN_W = 960;
const DESIGN_H = 540;

export class Engine {
  private app: Application;
  private sceneManager!: SceneManager;
  private inputManager!: InputManager;
  private mapOverlay!: MapOverlay;
  private infoPanel!: InfoPanel;
  private genieQuiz!: GenieQuiz;
  private lampButton!: LampButton;

  constructor() {
    this.app = new Application();
  }

  async start(
    container: HTMLElement,
    sceneConfigs: SceneConfig[],
    mapConfig: MapConfig,
    studentConfig: StudentConfig,
    genieLampFrames: string[],
    startScene?: string,
  ): Promise<void> {
    const dpr = Math.min(2, globalThis.devicePixelRatio ?? 1);
    await this.app.init({
      width: DESIGN_W,
      height: DESIGN_H,
      backgroundColor: 0x1a1a2e,
      resizeTo: undefined,
      resolution: dpr,
      autoDensity: true,
    });

    container.appendChild(this.app.canvas);
    this.app.stage.sortableChildren = true;

    // Build questions lookup map and info-hotspot count map
    const questionsMap = new Map<string, QuizQuestion[]>();
    const infoCountMap = new Map<string, number>();
    for (const sc of sceneConfigs) {
      if (sc.questions && sc.questions.length > 0) {
        questionsMap.set(sc.node_id, sc.questions);
      }
      infoCountMap.set(sc.node_id, sc.hotspots.filter((h) => h.type === "info").length);
    }

    const panelBgTexture = await Assets.load("assets/panel/panel-background.png");
    panelBgTexture.source.autoGenerateMipmaps = false;
    panelBgTexture.source.maxAnisotropy = 1;

    // Info panel
    this.infoPanel = new InfoPanel(panelBgTexture, studentConfig.translate_to_nepali ? "ne-NP" : "en-AU");
    this.app.stage.addChild(this.infoPanel.container);

    // Genie quiz (above info panel)
    this.genieQuiz = new GenieQuiz(panelBgTexture);
    this.app.stage.addChild(this.genieQuiz.container);

    // Dismiss info panel on scene navigation
    eventBus.on("scene:load", () => this.infoPanel.hide());

    // Scene manager
    this.inputManager = new InputManager(this.app);
    this.sceneManager = new SceneManager(this.app, sceneConfigs, this.infoPanel, studentConfig);

    // Map overlay + button
    this.mapOverlay = new MapOverlay(mapConfig, DESIGN_W, DESIGN_H);
    await this.mapOverlay.init();
    this.app.stage.addChild(this.mapOverlay.container);
    this.app.stage.addChild(this.mapOverlay.mapButton);

    // Lamp button (bottom-right) — no mipmaps + aniso off = sharper when scaled
    const genieLampTextures = await Promise.all(genieLampFrames.map((f) => Assets.load(f)));
    for (const t of genieLampTextures) {
      t.source.autoGenerateMipmaps = false;
      t.source.maxAnisotropy = 1;
    }
    this.lampButton = new LampButton(questionsMap, this.genieQuiz, DESIGN_W, DESIGN_H, genieLampTextures, infoCountMap);
    this.app.stage.addChild(this.lampButton.container);

    // When a scene is marked complete → update map icon
    eventBus.on("scene:complete", (sceneId: unknown) => {
      this.mapOverlay.setCompleted(sceneId as string, true);
    });

    // Load initial scene or open map for selection
    if (startScene) {
      await this.sceneManager.loadScene(startScene);
    } else {
      this.mapOverlay.open();
    }

    this.applyResponsiveLayout(container);
    const resizeObserver = new ResizeObserver(() => this.applyResponsiveLayout(container));
    resizeObserver.observe(container);

    void this.inputManager;
  }

  private applyResponsiveLayout(container: HTMLElement): void {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w === 0 || h === 0) return;
    const scale = Math.min(w / DESIGN_W, h / DESIGN_H);
    this.app.renderer.resize(w, h);
    this.app.stage.scale.set(scale);
    this.app.stage.position.set(
      Math.round((w - DESIGN_W * scale) / 2),
      Math.round((h - DESIGN_H * scale) / 2),
    );
  }
}
