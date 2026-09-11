# Contribute to cli-pet

Thanks for wanting to help! The whole game is one readable file (`pet.mjs`, ~1000 lines), zero dependencies by design — please help keep it that way.

## Dev loop

```bash
git clone https://github.com/ntexplorer/cli-pet.git
cd cli-pet
node pet.mjs          # play it
node pet.mjs --fast   # ×60 clock: hatch in 3 s, a full life in ~20 min
node --check pet.mjs  # syntax gate (also runs in CI)
```

`--fast` is your friend: it exists precisely so you can try every feature (hatching, sickness, death timers, elder stage, mourning, next generation) in minutes instead of days.

## Where things live in `pet.mjs`

Search for these — most contributions touch exactly one of them:

| You want to add… | Touch this | Size |
|---|---|---|
| A species (sprites, egg, colors) | `SPECIES` + `ART.<species>` (string arrays — one char = one pixel, palette key at the top) + `RPS_TEND` | ~25 lines, mostly art |
| An achievement | `ACHIEVEMENTS` (one line: id/icon/name/desc/check) | 1 line |
| Chat lines | `CHAT_POOL` / `CHAT_COND` | 1 line each |
| Balance tuning | `DECAY`, `ACTIONS`, `CD`, refusal thresholds | numbers |
| Small theater scenes | `maybeTheater` bubble pool | 1 line each |
| A mini-game | ask first in an issue, then `startRps`/`renderRps` is the pattern | ~80 lines |

## Guidelines

- **Zero dependencies, single file, no network.** If a feature needs a library, it's probably the wrong feature.
- **In-game text is Simplified Chinese** for now (i18n tracked in issues). New user-facing strings should be Chinese, concise, and cozy — this game's voice matters more than its numbers.
- **Windows-first testing**, but don't break POSIX terminals (no Windows-only APIs in the main path).
- **Balance changes need a story.** Every constant encodes a pacing decision (e.g. "something to do every 25–30 min"); explain yours in the PR.
- **UI changes should refresh the screenshots** — see below.

## Refreshing README screenshots

All screenshots and the demo screencast are generated from real runs (no mockups):

```bash
node scripts/capture.mjs    # drives pet.mjs through scripted scenes → build/demo.cast + build/seg-*.txt
node scripts/vt2html.mjs build/seg-2-main.txt build/html/main.html
# then screenshot build/html/*.html headless (Edge/Chrome --screenshot) into docs/assets/
```

`scripts/capture.mjs` backs up and restores your real `state.json` automatically.

## Commit style & PR checklist

Conventional commits (`feat(scope): …`, `fix(scope): …`, `docs: …`).

- [ ] `node --check pet.mjs` passes
- [ ] played a `--fast` run to see the change in context
- [ ] screenshots refreshed (if UI changed)
- [ ] README + README.zh-CN.md updated together (if user-facing)
