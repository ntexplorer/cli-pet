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

- **Three species** — slime / cat / dragon, each with distinct egg sprites, baby & adult pixel art (adult form unlocked through care)
- **Five stats** — hunger, thirst, cleanliness, mood, energy; they decay in real time, tuned for an 8-hour workday: something to do every 35–45 minutes
- **Full life arc** — egg (3 min hatch, with cracks & wiggles) → life → dying (12 h rescuable window) → grave → mourning → next generation, with a memorial wall and generation counter
- **Offline-friendly** — no background process; time passes via catch-up math on next launch, but your pet **never dies while you're away** (stats have an offline floor; dying clock freezes)
- **Needy visuals** — low stats show on the sprite: dirt spots when dirty, droopy mouth when hungry, drowsy blink when tired, desaturation when sad; pets actively beg (water bowl > food > play > bath priority)
- **Day/night ambience** — real-clock sky label (morning/day/dusk/night) and stars at night; sleepy 23:00–7:00
- **Keyboard + mouse** — single-key actions and SGR-1006 mouse clicks (buttons, click-the-pet-to-pet)
- **Adaptive layout** — auto-fits narrow panes (two-row buttons, hidden log column); `PET_WIDTH` env override
- **Weight system** — overfeed and it visibly gets wider (and mood-capped); 2 food types (meal vs snack)
- **7 achievements** — career-wide, survive across generations
- **Random theater** — little scene bubbles every 2–5 min when stats are healthy

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
| `1` | snack | hunger +8, mood +12, fatter |
| `w` | water | thirst +35 |
| `b` | bath | clean +45, cures sickness |
| `p` | play | mood +28, energy −15 |
| `s` | sleep toggle | recovers energy, hungers slower |
| `t` | pet it | mood +10 (60 s cooldown) — or click the pet |
| `n` | rename | up to 8 chars, CJK OK |
| `r` | reset | keeps memorial & achievements, `y` to confirm |
| `q` | quit | saves on exit |

## Mechanics

| Mechanic | Value |
|----------|-------|
| Decay (per hour) | thirst −20 · hunger −15 (−11 asleep) · mood −12 · clean −8 |
| Typical cadence | water ~every 1.7 h · feed ~2 h · play ~2.5 h · bath half-day |
| Sickness | clean < 15 for 2 h → appetite halved, mood capped; bath cures |
| Dying | hunger AND thirst both 0 → 12 h rescue window (feed + water) |
| Offline | stats floored (30/20), dying clock frozen — never dies away |
| Death → next egg | 2 h mourning → press `f` at the grave |

## FAQ

- **Where is my save?** `state.json` beside `pet.mjs`. It survives reinstalls; don't commit it.
- **Can I run two instances?** No — a PID lock refuses the second one to protect the save.
- **Pane too narrow?** Layout adapts automatically; force a width with `PET_WIDTH=60 pet`.
- **Does it phone home?** Never. No network, no telemetry.

## License

[MIT](LICENSE) © ntexplorer
