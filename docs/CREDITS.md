# Credits & licences

Tracked from day one per plan §12. Every third-party dependency and every
asset in the shipped bundle is listed here with its licence and what was done
to it.

---

## Third-party code

| What | Version | Licence | Where | Modified? |
|---|---|---|---|---|
| [three.js](https://github.com/mrdoob/three.js) | ^0.185.1 | MIT | 3D renderer | No |
| [@react-three/fiber](https://github.com/pmndrs/react-three-fiber) | ^9.6.1 | MIT | React renderer for three | No |
| [@react-three/drei](https://github.com/pmndrs/drei) | ^10.7.7 | MIT | `Billboard` helper only | No |
| [zustand](https://github.com/pmndrs/zustand) | ^5.0.8 | MIT | App/room/window state | No |
| [React](https://react.dev) | ^19.2 | MIT | UI | No |
| [Vite](https://vite.dev) | ^7.1 | MIT | Build tooling (dev only) | No |
| [xp.css](https://github.com/botoxparty/XP.css) | ^0.2.6 | MIT — © 2020 Adam Hammad, Jordan Scales | Windows XP window chrome inside the PC hotspot | No. Imported unmodified and lazy-loaded so it only downloads when the PC is opened. Bundles its own `Pixelated MS Sans Serif` webfont. |

`xp.css` is the only dependency whose licence requires attribution in
distributed copies (MIT notice). Its licence text ships in `node_modules` and
is reproduced by the build in the vendor chunk's source map; the attribution
above satisfies the notice requirement for the site itself.

---

## Art assets

**There are no binary art assets in this project except the three listed under
"Sourced assets" below.** No models, no audio files. Everything else visual and
audible is generated at runtime from code in this repository:

| Asset | Where it's made | Notes |
|---|---|---|
| Room geometry & all furniture | `src/scene/furniture/*` | Low-poly primitives (boxes, cylinders, planes) composed in code |
| Wood / carpet / cork / book-spine textures | `src/scene/textures.ts` | Drawn to a 32–128px `<canvas>` with deterministic value noise, nearest-filtered |
| Whiteboard base-layer doodles | `src/scene/textures.ts` → `whiteboardBaseTexture()` | Hand-plotted 128×80 pixel art |
| Night sky / skyline through the window | `src/scene/textures.ts` → `nightSkyTexture()` | Procedural stars + skyline |
| Contact-shadow blob | `src/scene/palette.ts` | Radial gradient on a 64×64 canvas |
| UI sound effects & dialogue blips | `src/audio/sfx.ts` | Web Audio oscillators, synthesised per-event |
| Jukebox mechanism sounds | `src/audio/sfx.ts` | Generated at runtime — solenoid, key clack, latch, stylus, contact tick and transport motor from filtered white noise; the coin from inharmonic sine partials. No samples |
| Jukebox music (3 loops) | `src/audio/chiptune.ts` | Original chiptune sequences, synthesised live |
| `public/assets/resume.pdf` | Generated placeholder | **Replace with the real résumé.** |

All of the above is original work written for this project.

### Sourced assets

Three binary assets are not original work. All three were downloaded from the
rights holder's own site, resized, and shipped from `public/assets`.

| Asset | File | Source | Rights holder | What was done to it |
|---|---|---|---|---|
| DOOM (1993) cover art | `public/assets/textures/doom-poster.png` | [Wikipedia's cover-art file](https://en.wikipedia.org/wiki/File:Doom.jpg) | id Software / ZeniMax — **© and unlicensed, see below** | Downsampled 256×380 → 48×71, quantised to an indexed palette, blacks lifted |
| GitHub "Octocat" mark | `public/assets/icons/github-mark.png` | [github.com/logos](https://github.com/logos) | GitHub, Inc. (trademark) | Resized 560×560 → 64×64, otherwise unaltered |
| LinkedIn "in" bug | `public/assets/icons/linkedin-in-bug.png` | [brand.linkedin.com/downloads](https://brand.linkedin.com/downloads) | LinkedIn Corporation (trademark) | Resized 635×540 → 75×64, otherwise unaltered. ® symbol retained |

**The two logos are fine.** Both are used nominatively — to label a link to the
site owner's own profile on that service — which is the use both companies'
brand guidelines exist to permit. Neither is altered, recoloured, or placed
where it could imply endorsement, and each sits on a light field as its owner's
guidelines require.

**The DOOM poster is not licensed, and should be a deliberate decision rather
than an oversight.** The cover art is copyrighted by id Software; the file
sourced above is hosted on Wikipedia under a fair-use rationale that covers
Wikipedia's own use, not this one. In practice a 48×71 decorative poster on the
back wall of a personal portfolio is about as low-risk as unlicensed use gets —
it is not the subject of the page, it competes with nothing, and it is barely
legible — but it is unlicensed use, and "the room has a DOOM poster in it" is
not a defence anyone has to accept. Two clean ways out if that matters:

1. Draw an original poster in `textures.ts` the way every other texture in this
   room is drawn. At 48×71 the art is nearly abstract anyway, and an original
   hellscape would sit better with the rest of the room than a photograph does.
2. Swap in cover art that is actually free — a CC-licensed or public-domain
   game poster — and update this table.

### Why nothing else was sourced

Plan §12 says to check for existing human-made open-source assets before
modelling anything. That check was done and is recorded here:

- **Kenney.nl** (the plan's first stop) was checked. The furniture kit is
  confirmed **CC0**, which would be ideal. It was *not* used because:
  1. Downloads are now behind a JavaScript interstitial rather than a direct
     file URL, so the kit could not be fetched and licence-verified in place.
  2. Blender — the plan's stated tool for recolouring sourced models to the
     room palette (§2, §12) — was not available at the time, so imported
     models could not be brought into the room's colour world properly.
     **This one no longer holds:** Blender is now reachable over an MCP
     server and answers against a live instance. Reason 1 still stands, and
     reason 3 is a judgement call rather than a blocker.
  3. At a 1/4-resolution pixelation pass, box-composed furniture and
     detailed low-poly furniture resolve to nearly identical silhouettes,
     while procedural geometry costs zero bytes of download.

  One object has since been rebuilt with Blender available — the jukebox,
  including the record mechanism behind its crown — and it was still built in
  code. Its moving parts are driven from the app's own state, which is
  component work whatever the shell is made of, and a loaded model would have
  been this project's first binary geometry. That is a decision about *this*
  object rather than a standing answer: a sourced model still wants Blender
  for the recolouring pass.

- **itch.io** was not used: the plan flags AI-generated submissions mixed into
  pixel-art tags, and per-pack provenance could not be verified here.

**This is a deviation from the plan and is reversible.** `src/scene/furniture/`
is structured so any single object can be swapped for a loaded glTF without
touching the hotspot system: each furniture component renders its own meshes
plus one `<PickProxy>`, and nothing outside it depends on how the visuals are
produced. To swap in a sourced model, replace the component's meshes with a
`useGLTF` load, keep the `<PickProxy>` box, and add a row to this file.

---

## Fonts

No webfonts are downloaded by the site itself. The room UI uses a
`'Courier New', ui-monospace, monospace` stack.

The jukebox's selection window asks for period faces — `American Typewriter` /
`Rockwell` on the title strips, `Copperplate` on the nameplate and code plates —
but **only as system font stacks**, and both fall back through to the same
monospace as the rest of the room. Nothing is downloaded and nothing is
embedded; a machine without those faces installed gets the fallback, not a
missing-font layout.

The notes already on the whiteboard are handwriting, and ask for the marker-ish
faces each desktop platform ships: `Bradley Hand` / `Chalkboard SE` /
`Marker Felt` on macOS, `Segoe Print` / `Ink Free` on Windows, then
`Comic Sans MS`, then generic `cursive`, then the room's monospace. Same rule as
the jukebox — system stacks only, nothing downloaded. A machine with none of
them writes the board in Courier, which reads as a different hand rather than as
a broken page. `xp.css` inlines its own
`Pixelated MS Sans Serif` and `Perfect DOS VGA 437` faces as data URIs inside
its stylesheet, which loads only with the PC hotspot.

---

## Trademark note

"DOOM" is a trademark of id Software LLC; "GitHub" and the Octocat are
trademarks of GitHub, Inc.; "LinkedIn" and the "in" bug are trademarks of
LinkedIn Corporation. None of these companies is affiliated with or endorses
this site. See "Sourced assets" above for how each is used.

"Contra.exe" and the Windows XP visual style are pastiche. The game is an
original arcade-scoped implementation (plan §6/§14 — one screen, no scrolling,
no level progression) and shares no code, art, or level data with any Konami
title. If this site is ever published under a real name, consider renaming
`Contra.exe` to something original to avoid any trademark implication.
