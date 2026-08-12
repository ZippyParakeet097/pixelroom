# Man-Cave Portfolio — Project Plan

## How to use this document

This is the source of truth for building the initial version of this site. It's written for an agentic coding harness (Claude Code or similar) to work from directly. Follow the phases in order — each one should produce something runnable/demoable before moving to the next. Anywhere you see `[DECISION NEEDED]`, stop and surface the question rather than guessing.

---

## 1. Concept

A first-person "man-cave" style room, rendered in real 3D with a pixel-art post-process, viewed from a fixed isometric angle. The visitor cannot free-roam — the room has a small, fixed set of interactive hotspots. Clicking one dollies the camera in for a closer, more intimate framing and opens whatever that object does. An internal-monologue-style narrator delivers short lines via a typewriter-effect dialogue box with an Undertale-style blip sound, on page load and at key interaction beats. The tone is understated and a little wry, not a wall of exposition.

This is a personal portfolio site — the "content" behind each hotspot is résumé/project/about-me material, but the framing device is a room, not a website.

---

## 2. Tech stack

| Concern | Choice | Why |
|---|---|---|
| 3D rendering | React Three Fiber + `@react-three/drei` | Declarative scene graph fits a React background; drei collapses a lot of Three.js boilerplate (loaders, controls, helpers) |
| Language | TypeScript | Non-negotiable at this scope — camera state machine and hotspot config benefit heavily from types |
| Build tool | Vite | Standard pairing with R3F, fast iteration |
| Camera tweening | `@react-three/drei`'s `CameraControls`, or GSAP if finer easing control is needed | Discrete camera states (not free orbit), tweened between preset position/target pairs |
| App/UI state | Zustand | Lightweight, avoids React context re-render sprawl for camera state, active hotspot, open windows |
| OS chrome | `xp.css` (MIT licensed) | Pre-built Windows XP Luna-theme CSS — window chrome, buttons, title bars, tree views, terminal styling. Don't build this from scratch. |
| Audio | Web Audio API directly, or Howler.js if the raw API gets unwieldy | Needed for: dialogue blips, jukebox track playback, UI SFX |
| 3D model compression | Draco or meshopt via gltf-transform | Compress any glTF/GLB assets before shipping |
| Asset editing | Blender | For retexturing/recoloring sourced Kenney-style models to fit the room's palette |
| Hosting | Static host (Vercel/Netlify/Cloudflare Pages) | No backend required for v1 (see Non-Goals) |

---

## 3. Rendering approach — pixel art via pixelation post-process

**Decision: real 3D low-poly geometry, not 2D sprites.** This was chosen specifically because the camera needs to physically dolly toward objects, which a flat-sprite diorama can't do convincingly.

Technique:

1. Render the scene to an off-screen `WebGLRenderTarget` at a fraction of display resolution (e.g. 1/3 to 1/4).
2. Use `THREE.NearestFilter` for magnification when upscaling back to the canvas — this is what produces the crisp pixel edges, not blur-then-sharpen.
3. Skip MSAA/antialiasing entirely — the low-res render-to-texture step makes it irrelevant and it would only soften the pixel edges you want.
4. Textures on models should themselves be small and nearest-filtered, not high-res photographic textures being pixelated after the fact — the geometry, textures, AND the render pass should all agree on being low-fidelity.
5. Lighting: **bake it**. Use baked lighting/AO textures (bakedTexture-style workflow) rather than real-time dynamic shadows. This is both cheaper and matches the stylized-diorama look better than real-time shadow maps.

Do the Phase 0 tech spike (see roadmap) before committing to a full asset list — confirm the actual pixelation look (resolution divisor, filtering) reads the way it's supposed to before building 7 hotspots' worth of content around it.

---

## 4. Camera & interaction system

Core loop (applies to every hotspot):

```
Page load
  → intro narrator line (typewriter + blip)
  → Isometric room (camera home state, idle)
     → visitor hovers a hotspot → subtle highlight/outline (raycasting)
     → visitor clicks a hotspot → camera dollies to that hotspot's preset
       position/target (tweened, not instant) + narrator line plays
     → contextual UI opens (varies per hotspot — see Section 6)
     → Esc / close control → camera returns to isometric home state
```

Implementation notes:

- Hotspots are **data-driven**, not hardcoded per-object. Each hotspot needs: id, mesh reference, hover-highlight config, camera target `{position, lookAt}`, narrator line(s), and a reference to whatever component renders its interior UI.
- Raycasting against a small, explicit list of interactive meshes — don't raycast the whole scene graph.
- Camera transitions are tweens between named states, not free camera movement. There should be exactly one "home" state and N "focused" states, one per hotspot.
- The dialogue box is a persistent overlay component, not per-hotspot — it just receives whatever line is currently queued.

---

## 5. Hotspots (7 total)

| Hotspot | Purpose | Interior UI |
|---|---|---|
| PC | Portfolio core — résumé, terminal, mini-games | Faux XP desktop (Section 6) |
| Jukebox | Curated music player | Now-playing UI, track list, play/pause/skip |
| Bookshelf | Project case studies | One **shelf row** per project — spines in its colour, a named paper tag on the lip. Clicking a row leans the camera into it and opens that case study. No project list: the shelf is the menu |
| Corkboard | About-me / fun facts | Pinned notes/photos, lightweight |
| Window | Contact / socials | Simple panel — email, LinkedIn, GitHub, etc. Also the room's weather: scrolling rain, and lightning on a ~20s cycle. Curtained shut until the visitor first looks at it (once per session); while shut the flashes leak through the gap onto the floor. `?storm` puts the lightning on a 2s cycle for iterating |
| Whiteboard | Interactive scratchpad + easter-egg personality piece | See Section 7 |
| Easter-egg object | Pure personality, no functional content | TBD — arcade cabinet, pet, coffee mug, etc. |

`[DECISION NEEDED]`: exact content for bookshelf (which projects) and corkboard (which fun facts) is still open — placeholder/lorem content is fine for early phases, but flag before final content pass.

Note on asset sourcing: most of these hotspots map reasonably well to existing CC0 furniture/prop packs (Kenney's furniture and isometric kits are the first place to check). The **jukebox specifically probably won't exist as a ready-made asset** — plan on sourcing something close (a cabinet radio, an arcade-adjacent prop) and modifying it in Blender rather than expecting a direct match.

---

## 6. The PC — faux Windows XP desktop

Built with `xp.css` as the base chrome. Needs a small window-manager layer on top of it:

- Draggable windows with title bar, minimize/close controls, focus/z-order handling
- A taskbar showing open windows
- Desktop icons that launch apps

**Apps for v1:**

### Terminal.exe

A fake shell — doesn't need a real filesystem, just a command parser with a fixed set of recognized commands (`help`, `about`, `resume`, `projects`, `contact`, plus a few easter-egg commands). `[DECISION NEEDED]`: exact command list and easter-egg content — placeholder command set is fine to scaffold against.

### Resume.pdf

Either embeds an actual PDF or renders a styled HTML resume inside an xp.css window. Needs a real resume file/content before this is functionally complete — scaffold the viewer first, wire up real content when available.

### Snake.exe

Standard implementation: grid-based movement, direction input queue, food spawn, self-collision and wall-collision game over, score tracking. Low scope — a few hours of focused work.

### Contra.exe — arcade-scoped, NOT a full clone

**Deliberately scoped down for v1.** A single static screen (no scrolling, no level progression), one player sprite with run/jump/shoot, 2–3 enemy types spawning in timed waves, basic projectile collision, a simple health/lives counter. Target: a tight 60–90 second arcade loop that captures the *vibe* of Contra without needing a scrolling tilemap engine or real level design. Full run-and-gun with levels is explicitly out of scope for v1 — see Non-Goals.

---

## 7. Whiteboard — interactive marker tool

- **Base layer**: a pre-authored pixel-art texture showing "in-progress" scribbled notes — half-finished diagrams, a to-do list, personality doodles (e.g. a code snippet, a small sketch, an in-joke). This is static/baked content, authored once.
- **Marker tool**: on focus, an HTML `<canvas>` overlays the whiteboard's screen-space region. A "pick up marker" interaction enters draw mode; freehand strokes are captured on pointer move and rendered on top of the base layer. Include an eraser or a single "wipe board" action that clears drawings back to the original base layer (not a blank canvas).
- **Persistence: none.** Confirmed decision — drawings reset every visit. No `localStorage`, no backend, no cross-visitor sharing. This keeps the feature simple and avoids any content-moderation surface area.

---

## 8. Dialogue / narrator system

- Typewriter effect: reveal characters on an interval (not instant text).
- Blip sound: trigger every 2–3 characters, **not every character** — triggering per-character produces a machine-gun sound. Use 1–2 pitch-shifted variants of a single short blip and alternate/randomize slightly so it doesn't sound robotic.
- The dialogue box is a bottom-anchored overlay, RPG-style, that can be dismissed/advanced by click or a key press.

Illustrative example lines (placeholder tone/copy — replace with final voice before launch):

- On load: *"Where am I? ...huh. Is this what they call a 'man cave'?"*
- Hovering PC: *"A desktop PC hums patiently."*
- Clicking PC: *"You sit down. The monitor flickers to life."*
- Jukebox: *"A jukebox waits for someone with excellent taste."*
- Résumé download: *"Obtained: résumé.pdf"*

`[DECISION NEEDED]`: final narrator voice/tone (dry and deadpan vs. more playful) — the example lines above lean dry/deadpan, confirm before writing the full line set.

---

## 9. Performance budget

Non-negotiable given the stated requirement that load time/lagginess shouldn't ruin the experience:

- [ ] Baked lighting only — no real-time dynamic shadows
- [ ] All glTF/GLB models run through Draco or meshopt compression before shipping
- [ ] Textures kept small, power-of-two, nearest-filtered (no mipmapping blur)
- [ ] Code-split every PC app (Terminal, Resume, Snake, Contra) — none of them load until the visitor actually opens the PC and clicks that icon
- [ ] Jukebox track audio lazy-loaded, not bundled into initial payload
- [ ] Merge/instance repeated geometry where possible to keep draw calls low
- [ ] Target: initial payload for the room shell + hotspot geometry stays well under a few MB

---

## 10. Mobile / responsive stance

**Desktop-first, explicitly. Not responsive for v1.**

Implement a width-gated notice (e.g. below ~1024px viewport width): a simple static screen — "this one's built for a bigger screen" — with a **direct link to the résumé PDF**, so a recruiter skimming on a phone still gets the one thing they actually need, without ever needing to see the 3D room. Full mobile/touch support is a future-phase concern, not v1.

---

## 11. Suggested project structure

```
src/
  scene/            # room geometry, camera rig, lighting, pixelation post-process
  hotspots/         # hotspot config + per-hotspot logic (raycasting, camera targets)
  ui/
    dialogue/        # typewriter dialogue box + blip audio
    xp/              # window manager, taskbar, xp.css integration
  apps/
    terminal/
    resume/
    snake/
    contra/
  audio/             # jukebox player, SFX, blip system
public/
  assets/
    models/          # compressed glTF/GLB
    textures/
    audio/
docs/
  CREDITS.md          # track every sourced asset + its license/attribution requirement
```

---

## 12. Asset sourcing

Priority: human-made assets over AI-generated, editable to fit the room's needs.

- **Before modeling or generating anything from scratch, search online for an existing human-made open-source asset that already covers the need.** This applies at the start of every hotspot's asset work, not just once up front — check first, model/generate only if nothing usable turns up.
- **Kenney.nl** — first stop. CC0-licensed, includes dedicated furniture and isometric kits with both 3D models and matching sprite renders. No attribution required but good practice to credit anyway.
- **itch.io** — broader tag of isometric/pixel packs from individual artists. Some listings have started mixing in AI-generated submissions — check each pack's page/artist history rather than assuming everything tagged "pixel art" is hand-made.
- **GitHub/GitLab repos** are fair game too — if a repo (e.g. an open-source game, asset library, or model collection) contains something usable, clone it into a dedicated subfolder (e.g. `vendor/` or `third-party-assets/`) rather than copy-pasting individual files out of context. Keep the clone intact so its license file and provenance travel with it, and note in `docs/CREDITS.md` which repo it came from, its license, and exactly what was pulled/modified.
- Always check the license before use, even for repos that look obviously open — "on GitHub" doesn't automatically mean "free to reuse commercially." Skip anything without a clear license rather than assuming.
- Maintain `docs/CREDITS.md` from day one — track source, license, and any modifications made to each asset. Easier to do this as you go than to reconstruct it later.

---

## 13. Build phases

- [ ] **Phase 0 — Tech spike**: get one sourced Kenney (or similar) asset into the scene, confirm the pixelation post-process actually looks right (resolution divisor, filtering) before committing to a full asset list.
- [ ] **Phase 1 — Room + camera rig**: static isometric room, working camera dolly to at least one hotspot, no real content behind it yet.
- [ ] **Phase 2 — PC end to end**: xp.css shell, window manager, Terminal.exe + Resume.pdf functional. This is the "it's a real portfolio now" milestone.
- [ ] **Phase 3 — Dialogue + jukebox**: typewriter/blip system live across all existing hotspots, jukebox playing curated tracks.
- [ ] **Phase 4 — Remaining hotspots**: bookshelf, corkboard, window, whiteboard, easter-egg object.
- [ ] **Phase 5 — Games**: Snake.exe, then the arcade-scoped Contra.exe.
- [ ] **Phase 6 — Perf + polish pass**: baked lighting confirmed, asset compression audited, code-splitting verified, desktop-only gate implemented, full playtest.

---

## 14. Non-goals for v1 (explicit scope cuts)

- No free-roam/open-world camera — fixed hub-and-spoke hotspot model only
- No full Contra clone (scrolling, levels, tile-based enemy design) — arcade-scoped single screen only
- No backend of any kind — no shared/persistent whiteboard, no visitor data storage
- No mobile-optimized 3D experience — desktop-first with a graceful gate + resume fallback
- No AI-generated art assets as the primary source (human-made, edited as needed, is the priority)

---

## 15. Open decisions to resolve during/before content pass

- Final narrator voice/tone
- Terminal.exe command list and easter-egg content
- Bookshelf project list and corkboard content
- Easter-egg object choice
- Whiteboard base-layer doodle content
- Actual résumé content/format for Resume.pdf
- Jukebox track list (curated separately, licensing permitting for any non-original music)
