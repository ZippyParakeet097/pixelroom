# pixelroom

A portfolio arranged as a room. Real 3D low-poly geometry rendered through a
pixel-art post-process, viewed from a fixed isometric angle. Clicking an object
dollies the camera to it and opens whatever that object does.

Built to [`plan.md`](plan.md), which remains the spec. This file records what
actually got built, what deviates, and what is still open.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build to dist/
npm run typecheck
```

Desktop only by design (see §10 of the plan). Below 1024px the site serves a
static notice with a direct résumé link and never loads the 3D runtime.

---

## Status

| Phase | State |
|---|---|
| 0 — Pixelation spike | Done |
| 1 — Room + camera rig | Done |
| 2 — PC: XP shell, window manager, Terminal, Resume | Done |
| 3 — Dialogue + jukebox | Done |
| 4 — Remaining hotspots | Done |
| 5 — Snake.exe, Contra.exe | Done |
| 6 — Perf, mobile gate, polish | Done |

All seven hotspots are wired: **PC, jukebox, bookshelf, corkboard, window,
whiteboard, lava lamp.**

---

## How it works

**Pixelation** (`src/scene/PixelationPass.tsx`) renders the scene to an
off-screen target at 1/4 the CSS viewport size with `NearestFilter`
magnification and no MSAA, then blits it back through a shader that also
posterises the palette. The scene is only ever drawn at low resolution; only
the final fullscreen blit runs at device resolution, so pixel blocks land on
exact device pixels.

**Camera** (`src/scene/CameraRig.tsx`) tweens between named states. `focused`
in the room store fully determines the destination — home, or one of seven
presets — so the camera can never end up somewhere unnamed. The camera is
perspective at 32° rather than orthographic: an orthographic camera cannot
dolly visibly, and the dolly is the whole interaction.

**Hotspots** (`src/hotspots/`) are data. `hotspots.ts` holds id, label, camera
preset, narrator lines, highlight colour, and which panel to open. Adding one
means an entry there plus a furniture component.

**Two objects carry their UI on themselves, not over themselves.** Most
hotspots open a panel beside their object. The PC's XP desktop and the
jukebox's track list are instead pasted onto modelled glass —
`SurfaceProjector` projects a screen mesh's four corners into CSS pixels every
frame and publishes the rectangle through a plain keyed emitter
(`surfaceProjection.ts`, deliberately not a store — this updates in the render
loop and consumers want to write `style.transform`, not re-render). `PcPanel`
and `JukeboxPanel` position themselves there.

Both of those camera presets are calculated rather than eyeballed, because both
look straight down their screen's normal. That keeps the glass projecting to an
axis-aligned rectangle, so the overlay is a plain rect and pointer coordinates
inside it stay 1:1 with the mouse. Any tilt would keystone it and need a CSS
homography.

The corollary is that **anything modelled inside a projected rectangle stops
being clickable — or visible**, since the DOM layer covers it. Both objects
therefore put their physical controls outside the glass: the monitor's power
switch on the lower bezel, the jukebox's three transport keys on the bank under
its window. Those are real meshes with their own pick proxies, mounted only
while that hotspot is focused. The same rule is why the jukebox's record
mechanism has a window of its own in the crown rather than sharing the
selection window with the track list.

**Picking** — every static mesh sets `raycast={noRaycast}`, and each hotspot
contributes exactly one invisible `<PickProxy>` box. The pointer test walks
seven boxes rather than the whole scene graph. Run the app with `?debugPicks`
to draw those volumes as wireframes.

**Lighting is faked, not baked-from-file.** No light casts shadows and no
shadow map is ever allocated. Depth comes from face-angle falloff plus painted
contact-shadow quads under each object.

---

## Performance

Measured from `npm run build`:

| | raw | gzip |
|---|---|---|
| **Initial payload (all viewports)** | ~229 KB | **~74 KB** |
| 3D runtime (desktop only, lazy) | ~942 KB | ~258 KB |
| xp.css + fonts (only when the PC is opened) | ~259 KB | ~40 KB |

Everything past the entry chunk is lazy: the 3D scene, each hotspot panel, and
each XP app. A visitor on a phone downloads 74 KB and gets the résumé; a
visitor who only looks at the bookshelf never fetches xp.css or the games.

`vite.config.ts` deliberately sets **no** `manualChunks` — see the comment
there; hand-written vendor groups caused react-dom to be folded into the r3f
chunk, which put a `modulepreload` for all of three.js into `index.html`.

**If you change chunking, re-check that `dist/index.html` does not preload the
three chunk.**

---

## Deviations from the plan

1. **No sourced 3D models.** The plan's first stop (Kenney, CC0) was checked
   and is genuinely suitable, but its downloads are now behind a JS
   interstitial, and Blender — the plan's stated tool for recolouring sourced
   models to the room palette — was not available at the time. The room is
   built from procedural low-poly geometry instead. Fully reversible: each
   furniture component owns its own meshes plus one `<PickProxy>`, so any
   object can be swapped for a glTF load without touching the hotspot system.
   See [`docs/CREDITS.md`](docs/CREDITS.md).

   **Blender is now connected** (via an MCP server, driving a live instance —
   verified against an empty startup scene, nothing authored yet). That removes
   the reason this deviation exists, so sourced or hand-modelled furniture is
   back on the table whenever you want it. Nothing has been modelled yet and
   the room's *geometry* is still fully procedural.

   Its textures are no longer quite: the DOOM poster over the desk loads a
   48×71 PNG from `public/assets/textures` rather than being drawn to a canvas
   like every other texture in the room. It is the only such texture, it goes
   through the same nearest-filtered, no-mipmap path as the rest (see
   `imageTexture` in `src/scene/textures.ts`), and it carries a licence caveat —
   see [`docs/CREDITS.md`](docs/CREDITS.md).

   **The first object built since then was still built in code.** The jukebox
   was rebuilt after Blender became available — arched cabinet, lit pilasters,
   coin plate, and a working record mechanism behind the crown's glass — and
   staying procedural was a deliberate call rather than a default. The
   mechanism is driven from the same store the DOM track list writes to, so it
   is component work wherever the shell comes from; a glTF would have been the
   project's first binary geometry; and a replacement model would still have to
   land its screen plane on the numbers below. Blender remains the right tool
   for a *sourced* object, which is a different job.

   Two constraints to keep if any object gets replaced by a mesh. Each
   furniture component must still contribute exactly one `<PickProxy>` and set
   `raycast={noRaycast}` on everything else, or the pointer test stops being a
   seven-box walk. And the PC and the jukebox additionally own a *projected*
   rectangle — the monitor's glass and the jukebox's selection window — whose
   world-space position is read by the camera preset and the DOM overlay as
   well as by the mesh. Those two live in `src/scene/monitor.ts` and
   `src/scene/jukebox.ts`; a replacement model has to keep its screen plane on
   those numbers (or move them), or the overlay slides off the object.

2. **Jukebox music is synthesised, not streamed.** The plan left the track list
   open and flagged licensing as unresolved, so `src/audio/chiptune.ts` plays
   three original loops generated live. `TrackSource` keeps a `file` variant so
   real audio can be dropped in later.

   The jukebox also does not open a panel, which the plan assumed it would. It
   got the monitor's treatment instead: the selection window is modelled glass
   with the track list pasted onto it, and transport is three modelled keys on
   the cabinet. `src/scene/jukebox.ts` holds the cabinet's dimensions and the
   band of it the focused camera has to frame, the same way `monitor.ts` does
   for the CRT.

   That treatment costs the cabinet its own display, since the overlay covers
   whatever is modelled behind the glass — so the record mechanism got a second
   window. `JukeboxMechanism` puts a three-disc magazine, a rail-mounted gripper
   and a pickup arm behind an arch in the crown, above the overlay and clear of
   it.

   **Selecting a track starts a machine, not a track.** `useJukeboxStore` runs a
   timed cycle in the order a carousel machine actually works — the magazine
   indexes to the chosen record, *then* the gripper lifts it clear, traverses
   and sets it on the turntable, *then* the pickup drops — and audio begins at
   the end of it, about two seconds after the press. The store owns the phase
   and its durations; `JukeboxMechanism` tweens against the same `PHASE_MS` the
   store schedules on, so the move and the sound scoring it cannot drift apart.
   `trackIndex` only advances once the magazine is free to turn, which is why
   the panel highlights `queued` instead: the strip you pressed lights
   immediately, the wheel gets to it when the previous disc is back.

   The carousel is **horizontal** — a flat platter turning about a vertical
   axis, with the records standing on edge around its rim, seen from ten degrees
   below. It was a wheel in the plane of the glass first, which is wrong and
   made the machine look like a Ferris wheel.

   Two deliberate deviations remain. The gripper rides a rail rather than
   swinging on a pivot, because a pivoted arm long enough to reach both stations
   sweeps through the carousel and collides with the records still in it. And
   each record is mounted facing outward along its own radius, where a real
   magazine holds them in radial slots — that is what lets indexing swing the
   chosen label round to face the visitor, and it means the front record arrives
   at the gripper already upright and already facing front, so nothing has to be
   turned over on the way to the platter. Both faces carry a label, which a 45
   does anyway, and which matters here because a horizontal carousel always has
   two of its three records turned away.

   The selection window is deliberately **not** styled as a screen. It is a rack
   of printed title strips — cream cards, stamped code plates, one pilot lamp —
   because that is what the object in front of the visitor is, and because the
   monitor across the room already owns "lit screen" and does it properly. A
   second glowing panel on a wooden cabinet made the jukebox read as a kiosk.
   Its type is period (slab serif on the strips, engraved caps on the plates)
   but comes entirely from **system font stacks**: this site downloads no
   webfonts, and both stacks fall back through to the room's own monospace, so a
   machine with none of the named faces gets the previous layout rather than a
   default sans.

   The whole object answers the pointer in noise rather than tone — `sfx.ts` has
   a solenoid, a key clack, a latch, a stylus, a contact tick, a transport motor
   and a coin, all synthesised at runtime. The room's usual square-wave `hover`
   is right for a corkboard note and wrong for a machine made of springs, so the
   cabinet's keys and the title strips both use `tick` instead, and accepting a
   selection drops a coin down the chute.

   **A mechanical sound needs a bright transient or it does not exist.** The
   first key press was body and thump only — a 520Hz sweep over a 74Hz sine,
   everything under 500Hz — and it was inaudible on laptop speakers, which roll
   off exactly where it lived. `NoiseSpec.snap` adds the contact transient on
   top; that is what you actually hear when a switch closes, and the low end is
   what you would feel if you were in the room. Same reason the coin is three
   *inharmonic* partials per strike rather than one tone: harmonic ratios give
   you a bell, and only the inharmonic ones read as struck metal.

3. **Whiteboard drawings live in the DOM overlay only.** Per plan §7 the marker
   canvas overlays the focused view; strokes are not written back into the 3D
   texture, so stepping back shows the original board. Persistence is none, as
   specified.

---

## Content

All copy is real as of the content pass. Nothing in the UI is marked
placeholder any more. Four files hold everything a visitor reads:

| File | Feeds |
|---|---|
| `src/apps/resume/resumeData.ts` | Résumé viewer, terminal `about`/`resume`, mobile gate |
| `src/content/projects.ts` | Bookshelf rows, spine tags, terminal `projects` |
| `src/content/facts.ts` | Corkboard notes, terminal `facts` |
| `src/content/contact.ts` | Window panel, terminal `contact` |

Two constraints worth knowing before editing:

- **`Project.spine` must stay ≤ ~13 characters.** The shelf tag is a 168×24
  texture with the title at 13px bold monospace and the year right-aligned
  beside it; longer titles run underneath the year.
- **`FACTS` should stay an even count.** The corkboard is a two-column grid, so
  an odd number leaves the last row lopsided.

`public/assets/harshil-prakash-resume.pdf` is the real PDF and is served by the
download button in three places. **It has to be re-exported whenever
`resumeData.ts` changes**, or the download hands over a stale copy.

## Still open — needs your input

- **Project links.** `Project.links` is unset on all four case studies. The two
  client engagements have nothing public; PropertyCue could link the IEEE paper
  and Expense Management its repo, once you have the URLs.
- **Phone number.** Deliberately left off the site — it is in the PDF only. Add
  an entry to `CONTACT_LINKS` if you'd rather have it public.
- **Easter-egg object.** Built as a lava lamp on a side table. Swap by editing
  `LavaLamp` in `src/scene/furniture/WallFixtures.tsx` and the `lavalamp` entry
  in `hotspots.ts`.
- **`Contra.exe` naming.** Original code and art, but consider an original name
  before publishing under a real identity — see the trademark note in CREDITS.

---

## Controls

- Click an object to look closer · `Esc` steps back
- `M` mutes
- Terminal: `help`, `↑`/`↓` history, `Tab` completion
- Snake: arrows or WASD
- Contra: `←`/`→` move, `Z` jump, `X` shoot, `↑` aim up
