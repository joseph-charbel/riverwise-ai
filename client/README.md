# Riverwise Client

The Riverwise front-end is a 2D point-and-click exploration game built with [PixiJS 8](https://pixijs.com/) and TypeScript. It is entirely data-driven: every scene, hotspot, quiz question, and map node is declared in JSON config files — no scene logic is hardcoded. This makes it straightforward for educators and content authors to extend or replace the ecological content without modifying application code.

For the full-stack setup, see the [root README](../README.md).

---

## Tech stack

| Tool | Version | Role |
|------|---------|------|
| [Vite](https://vite.dev/) | 8 | Dev server, HMR, production bundler |
| TypeScript | 5.9 | Type safety across the entire codebase |
| [PixiJS](https://pixijs.com/) | 8.17 | WebGL 2D renderer — all sprites, animations, UI |
| LangChain / Groq | client-side stub | Currently unused directly; back-end handles all LLM calls |
| Nginx | alpine | Serves the production build and proxies `/api/` |

---

## Installation and development

```bash
cd client
npm install
npm run dev          # → http://localhost:5173
```

The dev server proxies all `/api/*` requests to `http://localhost:8000`, so the Python back-end must be running for info hotspots to fetch AI-enriched responses. The game is fully playable without the back-end — info panels fall back to their static body text if the API call fails.

### NPM scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `vite` | Start local dev server with hot module replacement |
| `build` | `tsc -b && vite build` | Type-check, then bundle for production into `dist/` |
| `preview` | `vite preview` | Preview the production build locally |

---

## Architecture overview

The engine initialises once and creates every subsystem. Subsystems communicate exclusively through the `EventBus` singleton — no module holds a direct reference to `SceneManager`, meaning navigation can be triggered from a hotspot, a map overlay click, or any future source without changing the receiving code.

```
main.ts
 └─ Engine.start()
     ├─ PixiJS Application (960 × 540, WebGL)
     │
     ├─ InfoPanel          zIndex 2000   floating info card
     ├─ GenieQuiz          zIndex 2500   modal quiz overlay
     │
     ├─ InputManager                     cursor tracking + CSS cursor swaps
     │
     ├─ SceneManager ──────listens: scene:load──▶ loadScene()
     │    └─ Scene (current)             stage index 0
     │         ├─ Sprite (background)
     │         └─ Hotspot[]  ──via HotspotFactory──▶ subclass per type
     │
     ├─ MapOverlay         zIndex 1000   full-screen map, toggled via M or button
     │    └─ node icons    ──emit: scene:load──▶ SceneManager
     │
     └─ LampButton         zIndex 999    persistent quiz trigger button
          └─ GenieQuiz.show()
```

---

## Key modules

### `src/Engine.ts`

The root orchestrator. Instantiated once in `main.ts`. Its `start()` method initialises the PixiJS `Application` at 960 × 540, constructs every subsystem, wires cross-system event listeners (e.g. `scene:complete → mapOverlay.setCompleted()`), and loads the first scene. It owns the PixiJS stage and is the only file that adds top-level containers to it.

### `src/core/SceneManager.ts`

Handles scene transitions. Listens for `scene:load` on the EventBus; on receipt it fades out the current scene (300 ms), destroys it, builds a new `Scene` from the matching config, fades it in, and emits `scene:ready`. A `transitioning` guard prevents re-entrant loads.

### `src/core/EventBus.ts`

A lightweight publish/subscribe singleton exported as `eventBus`. Every module imports this single instance. When `ENGINE_DEBUG` is `true`, all `emit` calls are logged to the console as `[EventBus] <event> <args>`.

### `src/core/InputManager.ts`

Sets the PixiJS stage as a static hit area and tracks cursor coordinates. Listens for `hotspot:hover:enter` and `hotspot:hover:leave` bus events to swap the browser cursor between `pointer` and `default`.

---

## Hotspot system

### Class hierarchy

```
Hotspot  (abstract base)
├── InfoHotspot
├── NavigationHotspot
├── AnimationHotspot       handles both one_shot_animation and loop_animation types
└── StateSwapHotspot
```

`HotspotFactory` (`src/objects/HotspotFactory.ts`) is the sole place that resolves a config `type` string to a concrete class. All hotspots are created through it.

### Hotspot types

| `type` | Class | Behaviour |
|--------|-------|-----------|
| `"navigation"` | `NavigationHotspot` | Emits `scene:load` with `target_node` on click |
| `"info"` | `InfoHotspot` | Opens `InfoPanel` with `title`/`body`; posts to `/api/dummy-invoke` to replace body with AI response; emits `info:viewed` |
| `"state_swap"` | `StateSwapHotspot` | Cycles through an array of image asset paths; persists `currentIndex` across clicks |
| `"one_shot_animation"` | `AnimationHotspot` | Plays a frame sequence once from the beginning on each click |
| `"loop_animation"` | `AnimationHotspot` | Toggles a looping frame sequence on/off; resets to frame 0 when stopped |

### Geometry shapes

Every hotspot config requires a `geometry` field. Three shapes are supported:

```ts
// Axis-aligned rectangle
{ "shape": "rect", "x": 700, "y": 180, "w": 100, "h": 160 }

// Circle
{ "shape": "circle", "x": 480, "y": 200, "r": 30 }

// Arbitrary polygon (flat array of x,y pairs)
{ "shape": "polygon", "points": [100, 200, 150, 180, 200, 220] }
```

All hotspots render a hover scale animation (lerp to 1.08×) and draw a coloured debug outline when `ENGINE_DEBUG` is `true`:

| Type | Debug colour |
|------|-------------|
| `InfoHotspot` | Yellow `#ffdd44` |
| `NavigationHotspot` | Green `#00ff88` |
| `AnimationHotspot` | Orange `#ff8800` |
| `StateSwapHotspot` | Blue `#4488ff` |

---

## UI components

| Component | File | zIndex | Purpose |
|-----------|------|--------|---------|
| `InfoPanel` | `src/ui/InfoPanel.ts` | 2000 | Floating card (420 × 260) displaying hotspot `title` and `body`. Initially shows "Loading..." body text; updates in-place once the API responds. Dismissed by clicking anywhere or navigating. |
| `GenieQuiz` | `src/ui/GenieQuiz.ts` | 2500 | Modal quiz panel (620 × 400) with multiple-choice questions. Wrong answers repeat the question; correct answers advance. Emits `scene:complete` and shows a completion screen after all questions pass. |
| `LampButton` | `src/ui/LampButton.ts` | 999 | Persistent bottom-right button. Becomes active (gold, pulsing) when all `info` hotspots in the current scene have been viewed. Clicking it opens `GenieQuiz`. |
| `MapOverlay` | `src/ui/MapOverlay.ts` | 1000 | Full-screen map toggled with the `M` key or the MAP button. Shows scene nodes as icon buttons; clicking one navigates to that scene. Completed nodes display their `icon_complete` asset. |

---

## Event reference

All communication between modules flows through the `eventBus` singleton. No module subscribes to events it doesn't need, and no module calls methods on another module directly except through explicit constructor injection (e.g. `InfoPanel` is passed into `Scene`).

| Event | Payload | Emitted by | Consumed by |
|-------|---------|------------|-------------|
| `scene:load` | `nodeId: string` | `NavigationHotspot`, `MapOverlay` | `SceneManager` |
| `scene:unload` | `nodeId: string` | `SceneManager` | — |
| `scene:ready` | `nodeId: string` | `SceneManager` | `LampButton` |
| `scene:complete` | `sceneId: string` | `GenieQuiz` | `Engine` → `MapOverlay.setCompleted()`, `LampButton` |
| `scene:infos:complete` | `sceneId: string` | `Scene` | `LampButton` |
| `info:viewed` | `{ sceneId, hotspotId }` | `InfoHotspot` | `Scene` (completion tracking) |
| `hotspot:hover:enter` | `hotspotId: string` | `Hotspot` base | `InputManager` |
| `hotspot:hover:leave` | `hotspotId: string` | `Hotspot` base | `InputManager` |
| `hotspot:click` | `hotspotId: string` | `Hotspot` base | — (debug logging only) |
| `map:open` | — | `MapOverlay` | — |
| `map:close` | — | `MapOverlay` | — |

---

## Config reference

### `src/config/scenes.json`

The main content file. An array of scene objects. The first entry is always the start scene. The full TypeScript schema lives in `src/types/schemas.ts`.

**Scene shape:**

```json
{
  "node_id": "town_center",
  "background_asset": "assets/backgrounds/bg_town.svg",
  "hotspots": [ ... ],
  "questions": [ ... ]
}
```

**Hotspot shape (all fields):**

```jsonc
// navigation
{ "id": "to_coffee_shop", "type": "navigation", "target_node": "coffee_shop",
  "geometry": { "shape": "rect", "x": 700, "y": 180, "w": 100, "h": 160 },
  "image_asset": "assets/sprites/door_cafe.svg" }

// info
{ "id": "info_bird", "type": "info",
  "title": "Native Kingfisher", "body": "...",
  "geometry": { "shape": "circle", "x": 620, "y": 120, "r": 28 },
  "image_asset": "assets/sprites/info_bird.svg" }

// state_swap
{ "id": "street_lamp", "type": "state_swap",
  "states": ["assets/sprites/lamp_off.svg", "assets/sprites/lamp_on.svg"],
  "current_state": 0, "sprite_x": 455, "sprite_y": 140,
  "geometry": { "shape": "circle", "x": 480, "y": 200, "r": 30 } }

// one_shot_animation / loop_animation
{ "id": "fish_jump", "type": "loop_animation",
  "frames": ["assets/sprites/fish_0.svg", "assets/sprites/fish_1.svg"],
  "frame_duration": 150, "sprite_x": 300, "sprite_y": 350,
  "geometry": { "shape": "rect", "x": 280, "y": 330, "w": 80, "h": 60 } }
```

**Quiz question shape:**

```json
{
  "question": "Why does the kingfisher indicate a healthy river?",
  "options": ["It eats plastic", "Clean, fish-rich water", "It nests underground", "It avoids sunlight"],
  "correct": 1
}
```

`correct` is a zero-based index into `options`.

### `src/config/map.json`

Describes the full-screen map overlay.

```json
{
  "background_asset": "assets/map/bg_map.svg",
  "nodes": [
    {
      "node_id": "town_center",
      "label": "Town Center",
      "x": 480, "y": 200,
      "icon_incomplete": "assets/map/town_incomplete.svg",
      "icon_complete": "assets/map/town_complete.svg"
    }
  ]
}
```

---

## Adding and updating content

### Add a new scene

1. **Create the background SVG** and place it in `client/public/assets/backgrounds/`.
2. **Add the scene entry** to `client/src/config/scenes.json`:

```json
{
  "node_id": "new_location",
  "background_asset": "assets/backgrounds/bg_new_location.svg",
  "hotspots": [],
  "questions": []
}
```

3. **Add a navigation hotspot** in at least one existing scene so players can reach it:

```json
{
  "id": "to_new_location",
  "type": "navigation",
  "target_node": "new_location",
  "geometry": { "shape": "rect", "x": 100, "y": 200, "w": 80, "h": 60 }
}
```

4. **Add a return hotspot** inside the new scene pointing back.
5. **Register the node on the map** in `client/src/config/map.json` with `icon_incomplete` and `icon_complete` assets in `client/public/assets/map/`.

### Add a hotspot to an existing scene

Find the scene in `scenes.json` by its `node_id` and append an entry to its `hotspots` array. Use the type reference above to pick the right fields. Hotspot `id` values must be unique within a scene.

For visible hotspots (navigation doors, info icons, lamps), provide an `image_asset` pointing to an SVG under `public/assets/sprites/`. The image is layered behind the hit area graphic.

### Update quiz questions

Find the scene in `scenes.json` and edit its `questions` array. Add, remove, or reorder entries freely. The quiz always starts from the first question. There is no minimum or maximum question count enforced — the engine iterates through however many are present.

### Add new assets

Place files under `client/public/` and reference them in JSON as relative paths from `public/` (e.g. `"assets/sprites/new_icon.svg"`). Assets are served statically and loaded at runtime via `Assets.load()` from PixiJS — no import statement required.

---

## Configuration

### `ENGINE_DEBUG`

Defined in `vite.config.ts` as a compile-time constant:

```ts
define: {
  ENGINE_DEBUG: JSON.stringify(true),
}
```

When `true`:
- Every hotspot renders a coloured debug outline showing its geometry.
- Every `eventBus.emit()` call logs `[EventBus] <event> <args>` to the browser console.

Set to `false` for production builds.

### Dev API proxy

The Vite dev server proxies `/api/*` to `http://localhost:8000`:

```ts
// vite.config.ts
server: {
  proxy: {
    '/api': 'http://localhost:8000',
  },
},
```

If the back-end runs on a different port during development, update this value.

---

## Production build and Docker

### Build manually

```bash
npm run build      # type-checks then bundles to dist/
```

The `dist/` directory contains a fully self-contained static site.

### Docker

The `Dockerfile` uses a two-stage build:

1. **Build stage** (`node:22-alpine`) — runs `npm ci` and `npm run build`.
2. **Serve stage** (`nginx:alpine`) — copies `dist/` into Nginx's HTML root and installs `nginx.conf`.

```bash
docker build -t riverwise-client .
docker run -p 3000:3000 riverwise-client
```

`nginx.conf` listens on port 3000, proxies all `/api/*` traffic to `http://server:8000` (resolved via Docker Compose service discovery), and serves `index.html` as the SPA fallback for all unmatched routes.

In production the client container is the only publicly exposed service. The FastAPI server should remain on an internal Docker network and be reachable only through Nginx.

---

## Design notes

The original technical design document is preserved at [`client/foundation.md`](foundation.md). It specifies the functional requirements (REQ-1.x through REQ-3.x) that the current implementation satisfies and explains the design decisions that preceded it — particularly the choice of a data-driven JSON config over scene subclasses, and the event-decoupled input/handler architecture.
