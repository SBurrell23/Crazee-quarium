# Crazee-quarium

A browser aquarium survival game in the spirit of PopCap's *Insaniquarium*: feed fish, grow
them, collect the coins they drop, spend the money on a bigger food chain and a better laser,
and fight off the aliens that keep raiding your tank. Twenty-one levels, twenty pets to hatch,
one very hungry boss at the bottom.

**Play it:** https://sburrell23.github.io/Crazee-quarium/

## How it plays

- **Click the water** to drop food - one piece per click. Guppies that eat grow through three
  sizes and drop progressively better coins.
- **Click coins** to bank them before they fade off the sea floor. A coin about to be lost
  turns red and pulses. Drag across a spill to sweep it up.
- **Click aliens** to hit them with your laser, which fires from an emitter above the tank.
  Upgrade it when they start arriving in pairs.
- **Buy all three egg pieces** to finish a level. The egg hatches into a pet that joins you for
  the rest of the game — you take three pets on every dive.
- If every fish dies and you cannot afford another, the tank is lost.

The cursor tells you what a click will do: a scatter of food over open water, a click hand over a
coin, a reticle over anything shootable. Holding the button keeps the laser firing but never
sprays food.

`I` (or the info button) opens a how-to-play panel with tips and your progress through the
ladder; `S` or `Esc` opens the sound panel; `Space`/`P` pauses; `M` mutes.

### The food chain

Each tank layers a new link on top of the last, so money comes from cycling the whole chain
rather than from one fish:

| Tank | Chain |
| --- | --- |
| Coral Cove | Guppies grow and drop coins. Carnivores eat small guppies and make diamonds. |
| Starlit Shelf | Guppies drop stars. Starcatchers walk the floor, swallow stars, make diamonds. |
| Beetle Trench | Guppycrunchers eat guppies and farm beetles. Beetlemunchers turn beetles into pearls. |
| The Abyss | Breeders restock guppies. Ultravores eat carnivores and leave gold bars. |
| The Maw | Everything at once, plus the thing that ate the last aquarium. |

### The aliens

Gnasher takes one fish and leaves. Maulrog never gets full. Snatcher steals coins. Bombardier digs
in on the floor and lobs missiles you have to shoot down. Psychosquid heals if you shoot it while
it glows blue. Cyclogolem is laser-proof — click its energy orbs to send them back. The Maw has
three phases and calls for help.

## Technical notes

Vanilla JavaScript, no build step, no dependencies, no frameworks.

- **Every pixel of art is generated on the canvas** at runtime — fish, aliens, pets, coins,
  plants, the sea floor, the UI, even the favicon. There are no image files and no emoji.
  Creatures are drawn in a unit space (body length 1.0, facing +x) so one call scales them
  anywhere (`js/art.js`).
- **Every sound effect is synthesised with the Web Audio API** — oscillators, filtered noise
  bursts and short envelopes, about thirty recipes in `js/audio.js`. The only audio assets are
  the two music tracks.
- **Music**: `assets/music/tidal-glass.mp3` loops throughout; `assets/music/end-game-music.mp3`
  plays over the win celebration and then fades back to the loop.
- **The sound panel is reachable from every screen** (gear icon, or `S`/`Esc`) with separate
  music and effects sliders plus a mute toggle. Volumes persist to `localStorage`.
- **Autosave**: progress, pets, loadout and an in-progress level snapshot are written to
  `localStorage` every few seconds and at every milestone, so a refresh drops you back into the
  same tank. Total save size is under 1 KB.
- **Cursors are drawn in code too** - three sprites rendered to canvas at boot and handed to CSS
  as data URLs, so the pointer art adds no files either.
- **Fish head for the nearest food**, re-picking every 0.15s. Where several fish are feeding they
  prefer a piece nobody else is going for, but always fall back to the plain nearest one, so no
  fish is ever left without a target while there is food in the water.
- **The info and sound panels are modal overlays** available from every screen; the tank freezes
  behind them and clicks cannot fall through to the water.
- **Responsive**: the canvas fills the window at device pixel ratio. Narrow viewports get a
  two-line HUD and a two-row shop; the layout is driven by the canvas's own box via a
  `ResizeObserver`, so it stays correct in iframes and after orientation changes.

### Layout

```
index.html          markup shell: one canvas, two <audio> elements
styles.css          the page is only a frame - the canvas fills it
js/util.js          math, colour, formatting, localStorage helpers
js/audio.js         Web Audio synthesis + music management
js/art.js           all procedural drawing
js/data.js          every tunable: fish, coins, aliens, pets, prices, the 21 levels
js/entities.js      fish, pets, aliens, coins, food, projectiles, particles
js/level.js         one tank: economy, spawning, shop, win/lose, world render
js/ui.js            immediate-mode canvas UI: widgets, HUD, shop, screens
js/game.js          screens, progression, autosave, the win sequence
js/main.js          canvas setup, input, frame loop
dev/playtest.js     playtest harness (not loaded by the game)
```

## Development

Serve the folder over HTTP and open it — there is nothing to build:

```bash
npx --yes serve .
```

### Playtesting

`dev/playtest.js` drives the real game loop faster than real time with a bot that plays like a
competent human: it collects coins, feeds the hungriest fish, shoots aliens, deflects orbs and
spends in a sensible order. It was used to verify that all 21 levels are completable and to tune
the economy. In the browser console:

```js
var s = document.createElement('script'); s.src = '/dev/playtest.js'; document.head.appendChild(s);
// then
CQTEST.wipe();                  // clear progress
CQTEST.playRange(0, 6, 420);    // play levels 1-1..2-2, 420s budget each
CQ.dev.state();                 // current snapshot
```

`CQ.dev` also exposes `goto(i)`, `money(n)`, `winLevel()`, `unlockAll()`, `spawnAlien(key)` and
`killAliens()` for poking at a level by hand.

## Credits

Built as an original remake — the mechanics are inspired by *Insaniquarium* (PopCap, 2001), but all
code, art and sound effects here are original and generated at runtime. Character names and designs
are this game's own. The two music tracks were supplied with the project.
