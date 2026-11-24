# Licence and credits: `nemo` style ("네모 친구")

- Pack: **Character Creation Asset Pack** by **nonemo**
- Source: https://nonemo.itch.io/character-creation-asset-pack (author page: https://nonemo.itch.io/)
- Downloaded 2026-11-24 (itch.io upload id 10480791). `raw/license.md` is the licence file shipped inside the pack, unmodified.
- Licence: **CC0 1.0** (public domain dedication) — https://creativecommons.org/publicdomain/zero/1.0/
  "You may use these graphics in personal and commercial projects. Credit (nonemo) would be nice but is not mandatory."

No attribution is required. We credit the author anyway (suggested line for `web/public/CREDITS.txt`):

> "네모 친구" (nemo) — Character Creation Asset Pack by nonemo (https://nonemo.itch.io/character-creation-asset-pack), CC0 1.0. Shapes were redrawn as canvas vectors, cut into a walking rig, recoloured and extended with our own parts.

## What is in `raw/`

Only the subset `build.py` reads (SVG sources; the pack's PNG exports are not needed), plus `sample.png` / `instruction.png`
(the pack's own assembly reference — the relative positions of head, body, arms and legs were measured from `sample.png`).

- `SVG/skin/tint_{1,2,3}/` head, cheeks, body, arm, leg · `SVG/hairs/front/*` (5 shapes × 9 colours) · `SVG/hairs/back/*` (3 × 9)
- `SVG/shirts/*`, `SVG/pants/*`, `SVG/sleeves/*` · `SVG/faces/{smile,cute,laughs}.svg` · `SVG/glasses/*.black.svg` · `SVG/beards/short.*.svg`

## What comes from the pack, what we added

The app does not ship any image from the pack: `build.py` copies path data, sizes and colours into
`web/src/guestbook/styles/nemo/data.ts`, and `index.ts` draws them with Canvas 2D. Every option carries a `pack` flag in the code.

From the pack (unchanged shapes and colours):

- Head, ears, cheeks, body, arm and leg shapes; sock and shoe bands; short and long sleeves
- Hair fronts `regular`, `chupchik`, `straight`, `elegant`, `curly`; hair backs `short`, `long`, `curly`
- Outfits "티셔츠와 바지", "티셔츠와 반바지" (tee + trousers / shorts), "원피스" (dress)
- Faces `smile`, `cute` (eyes), `laughs` (eyes only); round and square glasses; the short moustache
- 3 skin tones, 9 hair colours, 7 clothing colours and the trousers blue

Our additions (drawn for this project in the same flat, outline-less style — no third-party material):

- The whole walk rig: separate limbs, a side view (face shifted toward the walking direction, one ear, narrower torso, shoe toe),
  a back view (hair cap over the back of the head) and the walk poses. The pack only has a static front pose.
- Hair fronts `bangs`, `crop`, `sidepart`; hair backs `straightLong`, `bun`, `ponytail`, `twintails` (paths in `build.py`)
- Outfits: tuxedo, wedding dress (+ bouquet), blouse + skirt, overalls, hoodie, suit, knit + long skirt
- Accessories: ribbon, flower, baseball cap, bridal veil
- 3 extra skin tones, 3 extra hair colours (dark brown, light brown, pink), 4 extra clothing colours
  (yellow, pink, navy, beige); the "파랑" swatch reuses the pack's trousers blue

## Rebuilding

    python -I build.py                    # regenerates web/src/guestbook/styles/nemo/data.ts (standard library only)
    python -I build.py --preview          # also re-renders preview.png (needs web/node_modules, Chrome, pillow)
    python -I build.py --proof <folder>   # walk.png contact sheet + walk.gif
