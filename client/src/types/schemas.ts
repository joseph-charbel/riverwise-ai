export interface RectGeometry {
  shape: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CircleGeometry {
  shape: "circle";
  x: number;
  y: number;
  r: number;
}

export interface PolygonGeometry {
  shape: "polygon";
  points: number[];
}

export type HotspotGeometry = RectGeometry | CircleGeometry | PolygonGeometry;

export interface BaseHotspotConfig {
  id: string;
  geometry: HotspotGeometry;
  /** Optional image to render as the hotspot's visible sprite */
  image_asset?: string;
}

export interface NavigationHotspotConfig extends BaseHotspotConfig {
  type: "navigation";
  target_node: string;
}

export interface StateSwapHotspotConfig extends BaseHotspotConfig {
  type: "state_swap";
  states: string[];
  current_state: number;
  sprite_x: number;
  sprite_y: number;
}

export interface OneShotAnimationHotspotConfig extends BaseHotspotConfig {
  type: "one_shot_animation";
  frames: string[];
  frame_duration: number;
  sprite_x: number;
  sprite_y: number;
}

export interface LoopAnimationHotspotConfig extends BaseHotspotConfig {
  type: "loop_animation";
  frames: string[];
  frame_duration: number;
  sprite_x: number;
  sprite_y: number;
}

export interface InfoHotspotConfig extends BaseHotspotConfig {
  type: "info";
  title: string;
  body: string;
}

export type HotspotConfig =
  | NavigationHotspotConfig
  | StateSwapHotspotConfig
  | OneShotAnimationHotspotConfig
  | LoopAnimationHotspotConfig
  | InfoHotspotConfig;

export interface QuizQuestion {
  question: string;
  options: string[];
  correct: number;
}

export interface SceneConfig {
  node_id: string;
  background_asset: string;
  hotspots: HotspotConfig[];
  questions?: QuizQuestion[];
}

export interface MapNodeConfig {
  node_id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  icon_incomplete: string;
  icon_complete: string;
}

export interface MapConfig {
  background_asset: string;
  nodes: MapNodeConfig[];
}
