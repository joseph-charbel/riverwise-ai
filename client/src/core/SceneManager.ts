import type { Application } from "pixi.js";
import type { SceneConfig } from "../types/schemas.ts";
import type { InfoPanel } from "../ui/InfoPanel.ts";
import { Scene } from "../objects/Scene.ts";
import { eventBus } from "./EventBus.ts";

export class SceneManager {
  private scenes: Map<string, SceneConfig>;
  private currentScene: Scene | null = null;
  private transitioning = false;
  private app: Application;
  private infoPanel: InfoPanel;

  constructor(app: Application, sceneConfigs: SceneConfig[], infoPanel: InfoPanel) {
    this.app = app;
    this.infoPanel = infoPanel;
    this.scenes = new Map(sceneConfigs.map((s) => [s.node_id, s]));

    eventBus.on("scene:load", (nodeId: unknown) => {
      this.loadScene(nodeId as string);
    });
  }

  async loadScene(nodeId: string): Promise<void> {
    if (this.transitioning) return;

    const config = this.scenes.get(nodeId);
    if (!config) {
      console.error(`[SceneManager] Scene not found: ${nodeId}`);
      return;
    }

    this.transitioning = true;

    // Fade out current scene
    if (this.currentScene) {
      await this.fadeOut(this.currentScene);
      eventBus.emit("scene:unload", this.currentScene.nodeId);
      this.currentScene.destroy();
      this.currentScene = null;
    }

    // Build and fade in new scene
    const scene = new Scene(config, this.infoPanel);
    await scene.init();
    scene.container.alpha = 0;
    this.app.stage.addChildAt(scene.container, 0);

    await this.fadeIn(scene);
    this.currentScene = scene;
    this.transitioning = false;

    eventBus.emit("scene:ready", nodeId);
  }

  private fadeOut(scene: Scene): Promise<void> {
    return new Promise((resolve) => {
      const duration = 300; // ms
      const start = performance.now();
      const tick = () => {
        const elapsed = performance.now() - start;
        const t = Math.min(elapsed / duration, 1);
        scene.container.alpha = 1 - t;
        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          resolve();
        }
      };
      requestAnimationFrame(tick);
    });
  }

  private fadeIn(scene: Scene): Promise<void> {
    return new Promise((resolve) => {
      const duration = 300;
      const start = performance.now();
      const tick = () => {
        const elapsed = performance.now() - start;
        const t = Math.min(elapsed / duration, 1);
        scene.container.alpha = t;
        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          resolve();
        }
      };
      requestAnimationFrame(tick);
    });
  }

  get isTransitioning(): boolean {
    return this.transitioning;
  }
}
