import { Sprite, Assets } from "pixi.js";
import type { StateSwapHotspotConfig } from "../types/schemas.ts";
import { Hotspot } from "./Hotspot.ts";

export class StateSwapHotspot extends Hotspot {
  private states: string[];
  private currentIndex: number;
  private sprite: Sprite;

  constructor(config: StateSwapHotspotConfig) {
    super(config);
    this.states = config.states;
    this.currentIndex = config.current_state;

    this.sprite = new Sprite();
    this.sprite.position.set(config.sprite_x, config.sprite_y);
  }

  protected debugColor(): number {
    return 0x4488ff;
  }

  get displaySprite(): Sprite {
    return this.sprite;
  }

  async init(): Promise<void> {
    const texture = await Assets.load(this.states[this.currentIndex]!);
    this.sprite.texture = texture;
  }

  execute(): void {
    this.currentIndex = (this.currentIndex + 1) % this.states.length;
    const nextAsset = this.states[this.currentIndex]!;
    Assets.load(nextAsset).then((texture) => {
      this.sprite.texture = texture;
    });
  }

  override destroy(): void {
    this.sprite.destroy();
    super.destroy();
  }
}
