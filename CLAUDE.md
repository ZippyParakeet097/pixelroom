# pixelroom

## Comments: short. Non-negotiable.

Clipped fragments. Drop articles and connectives. **One or two lines, never a
paragraph.** Keep only the *why* behind a non-obvious number or choice:

```ts
// negative roll = sole faces camera
// 3.6 not 2.4: holds old peak now AMBIENT is lower
```

Not this:

```ts
/**
 * Rolled the other way the shoe presents its outer cheek, and a cheek is a
 * rectangle. Rolled this way it shows the camera its sole and its tread, which
 * is unmistakably a shoe and is the reason to have tipped one over at all.
 */
```

If the code already says it, say nothing.

**This repo's existing comments are long literary essays. Do not match them.**
That is the trap, and "matching the surrounding style" is not a valid reason to
write a paragraph. Leave old comments alone; new ones are short. This rule is
about write-token cost, so a long comment is a real cost, not a style quibble.

## Commands

- `npm run dev` — Vite dev server on :5173. Three.js takes ~20-30s to load in
  dev; the scene is genuinely blank until then.
- `npm run build` / `npm run typecheck`

## Layout

- `src/scene/` — the 3D room and the intro doorway. All art is generated at
  runtime (canvas textures, block geometry); no image assets for the scene.
- `src/ui/` — DOM overlays. The intro's neon sign and its moths live here, not
  in the scene, because they are screen-space.
