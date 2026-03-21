import type { Application } from "pixi.js";
import { eventBus } from "./EventBus.ts";

export class InputManager {
  public cursorX = 0;
  public cursorY = 0;

  constructor(app: Application) {
    app.stage.eventMode = "static";
    app.stage.hitArea = app.screen;

    app.stage.on("pointermove", (e) => {
      this.cursorX = e.globalX;
      this.cursorY = e.globalY;
    });

    eventBus.on("hotspot:hover:enter", () => {
      app.canvas.style.cursor = "pointer";
    });

    eventBus.on("hotspot:hover:leave", () => {
      app.canvas.style.cursor = "default";
    });
  }
}
