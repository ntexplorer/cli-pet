// Stage a demo fixture for VHS: backs up real save, writes a baby slime.
const fs = require('fs')
const path = require('path')
const dir = path.join(process.cwd())
const st = path.join(dir, 'state.json')
if (fs.existsSync(st)) fs.copyFileSync(st, st + '.demobak')
const now = Date.now(), D = 86400_000, H = 3600_000
const career = {
  version: 1, achievements: ['feed50', 'live3d', 'gen2'],
  memorial: [
    { name: '煤球一世', species: 'slime', days: 12.4, cause: '饿死的', generation: 1 },
    { name: '颊囊君', species: 'hamster', days: 20.1, cause: '心碎而亡', generation: 2 },
  ],
  generation: 3,
  stats: { feed: 30, snack: 5, water: 30, bath: 10, play: 10, touch: 50, dose: 0, rps: 6, chat: 3 },
}
const state = {
  ...career, stage: 'alive', species: 'slime', name: '小煤球', awake: true, named: true, careScore: 8,
  hunger: 45, thirst: 55, clean: 40, mood: 62, energy: 70, weight: 1.25,
  bornAt: now - 2 * D, hatchedAt: now - 2 * D + H, lastSeen: now, diedAt: 0, deathCause: '',
  log: [
    { t: now - 2 * D, s: '小煤球 破壳而出！' },
    { t: now - H, s: '洗了个泡泡浴~' },
  ],
}
fs.writeFileSync(st, JSON.stringify(state))
console.log('fixture staged')
