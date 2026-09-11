# cli-pet

A pixel-art virtual pet that lives in your terminal. Single-file, zero-dependency Node.js TUI — open a pane, hatch an egg, and check in on it while you work.

```
 ┌────────────────────────────────────────────┐
 │  小煤球 · 果冻史莱姆 · 幼年 · 世代 1        │
 │           ⠠⠞⠛⠛⠛⠛⠛⠛⠛⠛⠛⠛⠛⠛⠛          │
 │        ╭──────────────╮                   │
 │        │   ( • ‿ • )  │  「肚子咕噜叫…」    │
 │        ╰──────────────╯                   │
 │  饱腹 ▓▓▓░░░░  口渴 ▓▓▓▓▓░░               │
 │  洁净 ▓▓▓▓▓▓░  心情 ▓▓▓░░░               │
 │  [f 喂食][1 零食][w 喂水][b 洗澡][p 玩耍]   │
 └────────────────────────────────────────────┘
```

## Features

- **Three species** — slime / hamster / dragon, each with distinct egg sprites, baby & adult pixel art (adult form unlocked through care)
- **Five stats** — hunger, thirst, cleanliness, mood, energy; they decay in real time, tuned for an 8-hour workday: something to do every 35–45 minutes
- **Full life arc** — egg (3 min hatch, with cracks & wiggles) → life → dying (4 h rescuable window) → grave → mourning → next generation, with a memorial wall and generation counter
- **Six ways to go** — 🥀 starvation · 💔 broken heart · 🤒 untreated sickness · 🍰 overfeeding · ⚡ exhaustion · ⭐ old age (30 days, honorary). Unseen causes show as `???` in the death codex (Dead-Cells style); active death timers show a red countdown badge on screen
- **Interlocked needs** — pets refuse to play hungry/thirsty, won't eat with a dry throat (water first), can't sleep unless tired, won't nap at full energy; falling asleep anywhere requires actually sleeping it off
- **Medicine** — `d` gives medicine: hard-gated (only when sick), cures symptoms instantly but the dirt that caused it remains — bathe for a real cure; bitter meds cost mood & energy
- **Wandering** — pets stroll left/right on their own, turn to face their heading, and shiver in their final hours
- **Offline-friendly** — no background process; time passes via catch-up math on next launch, but your pet **never dies while you're away** (stats have an offline floor; dying clock freezes)
- **Needy visuals** — low stats show on the sprite: dirt spots when dirty, droopy mouth when hungry, drowsy blink when tired, desaturation when sad; pets actively beg (water bowl > food > play > bath priority)
- **Day/night ambience** — real-clock sky label (morning/day/dusk/night) and stars at night; sleepy 23:00–7:00
- **Keyboard + mouse** — single-key actions and SGR-1006 mouse clicks (buttons, click-the-pet-to-pet)
- **Adaptive layout** — auto-fits narrow panes (two-row buttons, hidden log column); `PET_WIDTH` env override
- **Weight system** — overfeed and it visibly gets wider (and mood-capped); 2 food types (meal vs snack)
- **Action feedback** — every action plays a 2 s particle animation (falling food, water drops, rising bubbles, hearts…)
- **Anti-spam actions** — pets refuse what they don't need (won't eat if not hungry) and each action has a cooldown shown live on its button
- **Stats dashboard** — press `Tab` (or click the corner badge) for career stats, achievement progress (e.g. 12/50), the memorial wall and full log
- **8 achievements** — career-wide, survive across generations
- **Random theater** — little scene bubbles every 2–5 min when stats are healthy
- **`--fast` test mode** — `pet --fast` (or `--fast=120`) speeds the whole clock up ×60 by default: hatch in 3 s, a full life in ~20 min. Great for trying every feature; keep a separate save from your real pet

## Install

Requires **Node.js ≥ 18** (native fetch not even needed — zero network, zero deps; the version floor is for tested behavior).

```powershell
# just run it
node pet.mjs

# or add to your PowerShell $PROFILE
function pet { node "$HOME\.config\cli-pet\pet.mjs" @args }
```

Your save lives next to the script as `state.json` (gitignored). Delete it to start over — or use the in-app `r` reset, which keeps achievements and the memorial wall.

## Controls

| Key | Action | Effect |
|----|--------|--------|
| `1` `2` `3` | pick egg | choose species |
| `f` | feed meal | hunger +32, weight +0.15 |
| `1` | snack | hunger +8, mood +12, fatter — way more tempting than meals (refused only above 85 hunger) |
| `w` | water | thirst +35 |
| `b` | bath | clean +45, cures sickness (root cure) |
| `d` | medicine | only when sick: instant cure, mood −20, energy −15 — dirt remains, re-sickens in 2 h unless bathed |
| `p` | play | mood +28, energy −15, clean −5 (playing gets dirty) — refused if hungry <20, thirsty <20, or dying |
| `s` | sleep toggle | recovers energy fast (40/h; 4/h while awake), hungers slower asleep — other actions refused while sleeping |
| `t` | pet it | mood +10 (60 s cooldown) — or click the pet |
| `Tab` | stats dashboard | career stats, achievement progress, memorial wall, full log |
| `n` | name (once) | up to 8 chars, CJK OK — the name sticks afterwards |
| `r` | reset | keeps memorial & achievements, `y` to confirm |
| `q` | quit | saves on exit |

## Mechanics

| Mechanic | Value |
|----------|-------|
| Decay (per hour) | thirst −20 · hunger −15 (−11 asleep) · mood −12 · clean −8 |
| Refusal thresholds | won't eat >65 hunger · drink >65 thirst · bathe >60 clean · play >90 mood |
| Cooldowns | feed/water 90 s · touch 60 s · play 3 min · snack 5 min · bath 10 min · medicine 3 min |
| Typical cadence | water ~every 1.7 h · feed ~2 h · play ~2.5 h · bath half-day |
| Sickness | clean < 15 for 2 h → appetite halved, mood capped; bath cures the root, medicine the symptom |
| Dying | hunger AND thirst both 0 → 4 h rescue window (feed + water); total collapse (energy & mood also 0) compresses it to 1 h |
| Death timers | each terminal state (mood 0 · sick · 1.6× obese · awake at 0 energy) kills after 2 h if untreated — red countdown badge warns you |
| Old age | survive 30 days → ⭐ honorary passing |
| Death codex | Tab → 6-entry gallery; unseen causes show `???` |
| Interlocks | play needs hunger ≥20 & thirst ≥20 · eating needs thirst ≥20 · sleep needs energy ≤95 · awake at 0 energy = exhausted (locked, must sleep) |
| Offline | stats floored (30/20), dying clock frozen — never dies away |
| Death → next egg | 2 h mourning → press `f` at the grave |

## FAQ

- **Where is my save?** `state.json` beside `pet.mjs`. It survives reinstalls; don't commit it.
- **Can I run two instances?** No — a PID lock refuses the second one to protect the save.
- **Pane too narrow?** Layout adapts automatically; force a width with `PET_WIDTH=60 pet`.
- **Does it phone home?** Never. No network, no telemetry.

## License

[MIT](LICENSE) © ntexplorer
