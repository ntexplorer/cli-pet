#!/usr/bin/env node
// capture.mjs — drives pet.mjs through scripted scenarios (fixtures + timed keys),
// records the VT byte stream, and emits:
//   build/demo.cast          asciinema v2 cast (all segments, continuous timeline)
//   build/seg-<n>-<name>.txt raw VT stream per segment (for vt2html.mjs)
// Your real state.json is backed up to build/state.json.userbak and restored at the end.
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const BUILD = path.join(ROOT, 'build')
const H = 3600_000, D = 86400_000

fs.mkdirSync(BUILD, { recursive: true })
const hadSave = fs.existsSync(path.join(ROOT, 'state.json'))
if (hadSave) fs.copyFileSync(path.join(ROOT, 'state.json'), path.join(BUILD, 'state.json.userbak'))

const now = Date.now()
const career = {
  generation: 3,
  stats: { feed: 31, snack: 6, water: 28, bath: 9, play: 12, touch: 47, dose: 1, rps: 6, chat: 8 },
  achievements: ['feed50', 'live3d', 'gen2'],
  touchLog: [], lastAct: {},
  log: [
    { t: now - 2 * D + 3600_000, text: '蛋壳裂开——果冻史莱姆 孵出来了！' },
    { t: now - 1 * D, text: '定名为 小煤球' },
    { t: now - 6 * 3600_000, text: '玩得很开心，滚来滚去' },
    { t: now - 1800_000, text: '洗了个香喷喷的澡' },
  ],
  memorial: [
    { name: '煤球一世', species: 'slime', days: 11, cause: '饥饿与干渴', generation: 1 },
    { name: '颊囊君', species: 'hamster', days: 8, cause: '心碎而亡', generation: 2 },
  ],
}
const alive = over => ({
  ...career, stage: 'alive', awake: true, named: true, careScore: 8,
  hunger: 45, thirst: 55, clean: 40, mood: 62, energy: 70, weight: 1.25,
  bornAt: now - 2 * D, hatchedAt: now - 2 * D + 3600_000, lastSeen: now, diedAt: 0, deathCause: '', ...over,
})

const SEGMENTS = [
  { name: 'egg-select', ms: 6500, keys: [], state: { version: 1, stage: 'eggSelect' } },
  {
    name: 'main', ms: 12500,
    keys: [[2200, 't'], [5200, 'f'], [8600, 'b']],
    state: alive({ species: 'slime', name: '小煤球', clean: 38 }),
  },
  {
    name: 'rps', ms: 9000,
    keys: [[1800, 'g'], [4200, '1']],
    state: alive({ species: 'dragon', name: '喷火娃', careScore: 55, mood: 58, energy: 66, weight: 2.4 }),
  },
  {
    name: 'stats', ms: 5000,
    keys: [[2000, '\t']],
    state: alive({ species: 'hamster', name: '颊囊君', hunger: 30, thirst: 40, mood: 55 }),
  },
  {
    name: 'grave', ms: 5000, keys: [],
    state: { ...career, version: 1, stage: 'dead', named: true, species: 'slime', name: '小煤球', bornAt: now - 27 * D, hatchedAt: now - 26 * D, diedAt: now - 3 * H, deathCause: '寿终正寝', lastSeen: now },
  },
  {
    name: 'help', ms: 5000,
    keys: [[1500, '?']],
    state: alive({ species: 'slime', name: '小煤球', hunger: 30, thirst: 40, mood: 55 }),
  },
]

function runSegment(seg, idx) {
  return new Promise(resolve => {
    fs.writeFileSync(path.join(ROOT, 'state.json'), JSON.stringify(seg.state))
    const p = spawn(process.execPath, ['pet.mjs'], {
      cwd: ROOT,
      env: { ...process.env, PET_WIDTH: '80' },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    const t0 = Date.now()
    const events = []
    p.stdout.on('data', d => events.push([Date.now() - t0, d.toString('utf8')]))
    p.stderr.on('data', d => events.push([Date.now() - t0, d.toString('utf8')]))
    for (const [at, key] of seg.keys) setTimeout(() => { try { p.stdin.write(key) } catch {} }, at)
    setTimeout(() => {
      p.kill()
      setTimeout(() => {
        try { fs.rmSync(path.join(ROOT, 'state.json.lock')) } catch {}
        resolve(events)
      }, 250)
    }, seg.ms)
  })
}

const cast = [{ version: 2, width: 80, height: 25, timestamp: Math.floor(now / 1000), env: { TERM: 'xterm-256color', SHELL: 'pwsh' } }]
let tCursor = 0
for (let i = 0; i < SEGMENTS.length; i++) {
  const seg = SEGMENTS[i]
  console.log(`segment ${i + 1}/${SEGMENTS.length}: ${seg.name} (${seg.ms}ms)`)
  const events = await runSegment(seg, i)
  fs.writeFileSync(path.join(BUILD, `seg-${i + 1}-${seg.name}.txt`), events.map(([, s]) => s).join(''))
  for (const [dt, s] of events) cast.push([+(tCursor + dt / 1000).toFixed(3), 'o', Buffer.from(s, 'utf8').toString('base64')])
  tCursor += seg.ms / 1000 + 0.9
}
fs.writeFileSync(path.join(BUILD, 'demo.cast'), cast.map(l => JSON.stringify(l)).join('\n') + '\n')
if (hadSave) fs.copyFileSync(path.join(BUILD, 'state.json.userbak'), path.join(ROOT, 'state.json'))
else fs.rmSync(path.join(ROOT, 'state.json'), { force: true })
try { fs.rmSync(path.join(ROOT, 'state.json.lock')) } catch {}
console.log(`done: build/demo.cast (${tCursor.toFixed(1)}s), ${SEGMENTS.length} segments, real save restored=${hadSave}`)
