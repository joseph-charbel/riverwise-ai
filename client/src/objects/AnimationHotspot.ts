import { AnimatedSprite, Assets, Texture } from "pixi.js";
import type {
  OneShotAnimationHotspotConfig,
  LoopAnimationHotspotConfig,
} from "../types/schemas.ts";
import { Hotspot } from "./Hotspot.ts";

export class AnimationHotspot extends Hotspot {
  private frames: string[];
  private frameDuration: number;
  private looping: boolean;
  private animSprite: AnimatedSprite | null = null;
  private spriteX: number;
  private spriteY: number;

  constructor(
    config: OneShotAnimationHotspotConfig | LoopAnimationHotspotConfig
  ) {
    super(config);
    this.frames = config.frames;
    this.frameDuration = config.frame_duration;
    this.looping = config.type === "loop_animation";
    this.spriteX = config.sprite_x;
    this.spriteY = config.sprite_y;
  }

  protected debugColor(): number {
    return 0xff8800;
  }

  get displaySprite(): AnimatedSprite | null {
    return this.animSprite;
  }

  async init(): Promise<void> {
    const textures: Texture[] = [];
    for (const frame of this.frames) {
      const tex = await Assets.load(frame);
      textures.push(tex);
    }
    this.animSprite = new AnimatedSprite(textures);
    this.animSprite.position.set(this.spriteX, this.spriteY);
    this.animSprite.animationSpeed = 1000 / (this.frameDuration * 60); // convert ms to ticker speed
    this.animSprite.loop = this.looping;
    this.animSprite.stop();
  }

  execute(): void {
    if (!this.animSprite) return;

    if (this.looping) {
      if (this.animSprite.playing) {
        this.animSprite.stop();
        this.animSprite.gotoAndStop(0);
      } else {
        this.animSprite.play();
      }
    } else {
      this.animSprite.gotoAndStop(0);
      this.animSprite.loop = false;
      this.animSprite.play();
    }
  }

  override destroy(): void {
    this.animSprite?.destroy();
    super.destroy();
  }
}
