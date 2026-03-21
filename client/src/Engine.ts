import { Application } from "pixi.js";
import type { SceneConfig, MapConfig, QuizQuestion } from "./types/schemas.ts";
import { SceneManager } from "./core/SceneManager.ts";
import { InputManager } from "./core/InputManager.ts";
import { MapOverlay } from "./ui/MapOverlay.ts";
import { InfoPanel } from "./ui/InfoPanel.ts";
import { GenieQuiz } from "./ui/GenieQuiz.ts";
import { LampButton } from "./ui/LampButton.ts";
import { eventBus } from "./core/EventBus.ts";

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
    startScene: string
  ): Promise<void> {
    await this.app.init({
      width: 960,
      height: 540,
      backgroundColor: 0x1a1a2e,
      resizeTo: undefined,
    });

    container.appendChild(this.app.canvas);
    this.app.stage.sortableChildren = true;

    // Build questions lookup map
    const questionsMap = new Map<string, QuizQuestion[]>();
    for (const sc of sceneConfigs) {
      if (sc.questions && sc.questions.length > 0) {
        questionsMap.set(sc.node_id, sc.questions);
      }
    }

    // Info panel
    this.infoPanel = new InfoPanel();
    this.app.stage.addChild(this.infoPanel.container);

    // Genie quiz (above info panel)
    this.genieQuiz = new GenieQuiz();
    this.app.stage.addChild(this.genieQuiz.container);

    // Dismiss info panel on scene navigation
    eventBus.on("scene:load", () => this.infoPanel.hide());

    // Scene manager
    this.inputManager = new InputManager(this.app);
    this.sceneManager = new SceneManager(this.app, sceneConfigs, this.infoPanel);

    // Map overlay + button
    this.mapOverlay = new MapOverlay(mapConfig, 960, 540);
    await this.mapOverlay.init();
    this.app.stage.addChild(this.mapOverlay.container);
    this.app.stage.addChild(this.mapOverlay.mapButton);

    // Lamp button (bottom-right)
    this.lampButton = new LampButton(questionsMap, this.genieQuiz, 960, 540);
    this.app.stage.addChild(this.lampButton.container);

    // When a scene is marked complete → update map icon
    eventBus.on("scene:complete", (sceneId: unknown) => {
      this.mapOverlay.setCompleted(sceneId as string, true);
    });

    // Load initial scene
    await this.sceneManager.loadScene(startScene);

    void this.inputManager;
  }
}
