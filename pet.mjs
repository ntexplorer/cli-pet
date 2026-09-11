#!/usr/bin/env node
// CLI 挂机电子宠物 — 像素风、键盘+鼠标双操作、离线也成长/衰减
// 用法: pet   （数据存于同目录 state.json）
'use strict'
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const STATE_FILE = join(ROOT, 'state.json')

// ---------- ANSI ----------
const ESC = '\x1b['
const ansi = {
  hide: ESC + '?25l', show: ESC + '?25h',
  altOn: ESC + '?1049h', altOff: ESC + '?1049l',
  mouseOn: ESC + '?1000h' + ESC + '?1006h', mouseOff: ESC + '?1000l' + ESC + '?1006l',
  clear: ESC + '2J', home: ESC + 'H', clrEol: ESC + 'K',
  bell: '\x07',
}
const fg = (r, g, b) => `${ESC}38;2;${r};${g};${b}m`
const bg = (r, g, b) => `${ESC}48;2;${r};${g};${b}m`
const R = ESC + '0m'
const dim = ESC + '2m', bold = ESC + '1m'

// ---------- 配置 ----------
const SPECIES = {
  slime: { label: '果冻史莱姆', baseWeight: 1.2, color: [124, 252, 0] },
  hamster:{ label: '像素小仓鼠', baseWeight: 0.8, color: [210, 160, 90] },
  dragon:{ label: '小火龙',     baseWeight: 2.5, color: [255, 80, 60] },
}
// 每小时衰减 — 按 8h 工作日挂机调校: 每 35-45 分钟有一件事可做
const DECAY = { hunger: 15, thirst: 20, clean: 8, mood: 12, weight: 0.1 }
const SICK_AFTER_DIRTY_H = 2       // 洁净<15 持续 2h 生病
const DYING_GRACE_H = 4            // 饱腹&口渴双 0 → 弥留 4h(全衰竭压缩至 1h)
const MOURN_H = 2                  // 死亡后守灵
const OFFLINE_DECAY_CAP_H = 48     // 离线衰减封顶（离线不致死，数值另有托底）
const HATCH_MIN = 3                // 蛋孵化分钟
const GROW_CARE = 40               // 幼年→成年需要的照顾分
const ACTIONS = {
  feed:  { key: 'f', label: '喂食', },
  snack: { key: '1', label: '零食', },
  water: { key: 'w', label: '喂水', },
  bath:  { key: 'b', label: '洗澡', },
  play:  { key: 'p', label: '玩耍', },
  sleep: { key: 's', label: '睡觉', },
  touch: { key: 't', label: '摸摸', },
}
const ACHIEVEMENTS = [
  { id: 'feed50',  icon: '🍚', name: '干饭王',   desc: '喂食 50 次',   check: s => s.stats.feed >= 50,  prog: s => `${s.stats.feed}/50` },
  { id: 'water50', icon: '💧', name: '饮水机',   desc: '喂水 50 次',   check: s => s.stats.water >= 50, prog: s => `${s.stats.water}/50` },
  { id: 'bath20',  icon: '🛁', name: '泡泡浴',   desc: '洗澡 20 次',   check: s => s.stats.bath >= 20,  prog: s => `${s.stats.bath}/20` },
  { id: 'play30',  icon: '🎾', name: '玩伴',     desc: '玩耍 30 次',   check: s => s.stats.play >= 30,  prog: s => `${s.stats.play}/30` },
  { id: 'live3d',  icon: '🌱', name: '三日之约', desc: '存活 3 天',    check: s => livedDays(s) >= 3,   prog: s => `${livedDays(s).toFixed(1)}/3 天` },
  { id: 'live7d',  icon: '🌈', name: '一周你好', desc: '存活 7 天',    check: s => livedDays(s) >= 7,   prog: s => `${livedDays(s).toFixed(1)}/7 天` },
  { id: 'gen2',    icon: '👶', name: '生生不息', desc: '养到第 2 代',  check: s => s.generation >= 2,   prog: s => `第${s.generation}代` },
  { id: 'dose10',  icon: '💉', name: '良药苦口', desc: '吃药 10 次',   check: s => s.stats.dose >= 10,  prog: s => `${s.stats.dose}/10` },
]
function livedDays(s) { return (Date.now() - s.bornAt) / 86400000 }

// ---------- 像素美术 ----------
// 字符网格: . 透明, 其余查 PALETTE
const PAL = {
  G: [124, 252, 0], g: [60, 170, 20],          // 史莱姆绿/深绿
  H: [210, 160, 90], h: [160, 110, 50],          // 仓鼠金棕/深棕
  R: [255, 80, 60], r: [190, 40, 30],          // 龙红/深红
  W: [245, 245, 245], B: [30, 30, 30], M: [90, 40, 40], // 眼白/瞳/嘴
  F: [255, 215, 0], f: [255, 140, 0],          // 火焰黄/橙
  Y: [245, 225, 175],                          // 龙角骨质淡黄
  P: [255, 170, 200],                          // 粉(蛋/腮红)
  E: [240, 230, 140],                          // 蛋壳黄
  N: [120, 120, 130],                          // 石灰(墓碑)
  c: [185, 185, 195],                          // 裂纹灰(蛋)
  d: [125, 95, 60],                            // 脏斑棕(低洁净)
  m: [150, 80, 80],                            // 瘪嘴暗红(低饱腹)
  '-': [230, 230, 235],                        // 眯眼线(低精力)
}
const ART = {
  egg: {
    slime: [['...PPPP...','..PPGPPP..','.PPGPPPPG.','.PPPPPGPP.','.PGPPPPPP.','.PPPPGPPP.','..PPPPPP..','...PPPP...']],
    hamster:[['...HHHH...','..HHWWHH..','.HHWHHHWH.','.HHHHWWHH.','.HWHHHHHh.','.HHHHWHHH.','..HHHHHH..','...HHHH...']],
    dragon:[['....rr....','..RRRRRR..','.RrRRRRrR.','.RRrRRRRR.','.RRRRrRRr.','.RrRRRRrR.','..RRRRRR..','...RRRR...']],
  },
  // 每物种 { baby: [帧], adult: [帧] }, 帧 = 行字符串数组
  slime: {
    baby: [
      ['....GGGG....', '..GGGGGGGG..', '.GGWWGGWWGG.', 'GGGWBGGWBGGG', 'GGGGGGGGGGGG', 'GGGGGMMGGGGG', '.GGGGGGGGGG.', '..gggggggg..'],
      ['............', '..GGGGGGGG..', '.GGWWGGWWGG.', 'GGGWBGGWBGGG', 'GGGGGMMGGGGG', 'GGGGGGGGGGGG', 'GGGGGGGGGGGG', '.gggggggggg.'],
    ],
    adult: [
      ['....GGGG....', '..GGgGGgGG..', '.GGgGGGGgGG.', 'GGGWWGGWWGGG', 'GGGWBGGBWGGG', 'GGgGGGGGGgGG', 'GGGGGMMGGGGG', 'GGGGGGGGGGGG', '.GGgGGGGgGG.', '..gggggggg..'],
      ['............', '..GGgGGgGG..', '.GGgGGGGgGG.', 'GGGWWGGWWGGG', 'GGGWBGGBWGGG', 'GGGGGMMGGGGG', 'GGGGGGGGGGGG', 'GGgGGGGGGgGG', 'GGGGGGGGGGGG', '.gggggggggg.'],
    ],
  },
  hamster: {
    baby: [
      ['.HH......HH.','.HHHHHHHHHH.','HHHHHHHHHHHH','HHWWHHHHWWHH','HHHHHPPHHHHH','HHHHHHHHHHHH','.HHHHHHHHHH.','.WWWWWWWWWW.','..WW....WW..'],
      ['............','.HH......HH.','.HHHHHHHHHH.','hHWWHHHHWWhH','HHHHHPPHHHHH','HHHHHHHHHHHH','.HHHHHHHHHH.','.WWWWWWWWWW.','..WW....WW..'],
    ],
    adult: [
      ['.HHH......HHH.','.HHHHHHHHHHHH.','HHHHHHHHHHHHHH','HHhHHHHHHHHhHH','HHWWHHHHHHWWHH','HHHHHPPHHHHHHH','HHhHHHHHHHHhHH','.HHhHHHHHHhHH.','.HHHHHHHHHHHHh','..WWWWWWWWWW.h','..WWW....WWW..'],
      ['..............','.HHH......HHH.','.HHHHHHHHHHHH.','HHhHHHHHHHHhHH','HHWWHHHHHHWWHH','HHHHHPPHHHHHHH','HHhHHHHHHHHhHH','.HHhHHHHHHhHH.','.HHHHHHHHHHHH.','.HHHHHHHHHHHh.','..WWWWWWWWWW..'],
    ],
  },
  dragon: {
    baby: [
      ['....Y....', '....RRRR..', '..YRRRRRR.', '...RWRRWR.', '...RRmmRR.', '.F.RRRRRR.F', '.F.RRRRRR.F', '....RRRR...', '...RrrrR...'],
      ['....Y....', '....RRRR..', '..YRRRRRR.', '...RWRRWR.', '...RRmmRR.', '..FRRRRRRFF', '..FRRRRRRFF', '...fRRRRf..', '...RrrrR...'],
    ],
    adult: [
      ['..Y....Y..', '..YY..YY..', '.....RRRR.....', '....RRRRRR....', '....RWRRWR....', '....RRmmRR....', '.F..RRRRRR..F.', 'FF..RRRRRR..FF', 'FF.RRRRRRRR.FF', '.F.RrRRRRrR.F.', '...RRRRRRRR...', '..RrrrrrrrR...', '..rr.....rr...'],
      ['..Y....Y..', '..YY..YY..', '.....RRRR.....', '....RRRRRR....', '....RWRRWR....', '....RRmmRR....', 'FF..RRRRRR..FF', '.FF.RRRRRR.FF.', '..FRRRRRRRRF..', '..F.RrRRRRrR.F', '..f.RRRRRRR.f.', '..RrrrrrrrR...', '...rr....rr...'],
    ],
  },
}
const GRAVE = ['.NNNNNNN.', 'NWWWWWWWN', 'N.WB.BW.N', 'N...W...N', 'N..WWW..N', 'NNNNNNNNN']
const STAR_CHANCE_NIGHT = 5 // 夜晚星星颗数
const EGG_WIGGLES = ['（咔…咔…）', '（里面好像动了动）', '（蛋壳发出轻响）', '（晃了一下）', '（隐约听到细小的声音）']
function eggArt(sp, prog) { // 孵化进度 -> 蛋壳裂纹阶段图
  const base = ART.egg[sp][0]
  const lvl = prog >= 0.75 ? 2 : prog >= 0.4 ? 1 : 0
  const cracks = [[], [[2, 3], [4, 6]], [[1, 4], [2, 3], [3, 7], [4, 6], [5, 2]]]
  const g = base.map(r => r.split(''))
  for (const [r, c] of cracks[lvl]) if (g[r] && g[r][c] && g[r][c] !== '.') g[r][c] = 'c'
  return g.map(r => r.join(''))
}
// 低数值视觉层: 脏斑/眯眼/瘪嘴 叠加在宠物帧上(固定坐标防闪烁, 可多状态叠加)
const DIRT_SPOTS = [[1, 2], [3, 7], [4, 1], [5, 4], [2, 5], [5, 8]]
function moodOverlay(art) {
  if (S.stage !== 'alive' && S.stage !== 'dying') return art
  const g = art.map(r => r.split(''))
  if (S.clean < 40) DIRT_SPOTS.slice(0, S.clean < 20 ? 6 : 3).forEach(([r, c]) => {
    if (g[r] && g[r][c] && g[r][c] !== '.') g[r][c] = 'd'
  })
  if (S.energy < 30 && S.awake && frame % 4 < 2) { // 打瞌睡: 眼白每秒开合
    for (const row of g) for (let c = 0; c < row.length; c++) if (row[c] === 'W') row[c] = '-'
  }
  if (S.hunger < 30) { for (const row of g) for (let c = 0; c < row.length; c++) if (row[c] === 'M') row[c] = 'm' }
  return g.map(r => r.join(''))
}
function hatchProgress() { return Math.max(0, Math.min(1, (Date.now() - S.bornAt) / HATCH_MS)) }

// ---------- 状态 ----------
function defaultState() {
  return {
    version: 1,
    stage: 'eggSelect',        // eggSelect / egg / alive / dying / dead
    species: null, name: null,
    bornAt: 0, lastSeen: Date.now(), hatchedAt: 0,
    generation: 1,
    hunger: 80, thirst: 80, clean: 80, mood: 80, energy: 80,
    weight: 0, awake: true,
    dirtySince: 0, dyingSince: 0, diedAt: 0, deathCause: '',
    heartSince: 0, sickSince: 0, obeseSince: 0, exhaustSince: 0, // 四条异常死线计时(离线冻结)
    careScore: 0,
    stats: { feed: 0, snack: 0, water: 0, bath: 0, play: 0, touch: 0, dose: 0 },
    achievements: [],
    memorial: [],              // [{name,species,days,cause,generation}]
    log: [],                   // 最近事件 [{t,text}]
    lastAct: {}, named: false, lastEventAt: 0, bubble: null, lastEggWiggle: 0, askReset: false, lastBegAt: 0, // bubble {text, until}
  }
}
let S = defaultState()
function save() { S.lastSeen = Date.now(); writeFileSync(STATE_FILE, JSON.stringify(S)) }
function load() {
  try {
    const d = JSON.parse(readFileSync(STATE_FILE, 'utf8'))
    S = Object.assign(defaultState(), d)
    S.stats = Object.assign(defaultState().stats, d.stats || {})   // 深合并: 老存档升级不丢新字段(dose 等)
    S.lastAct = Object.assign({}, d.lastAct || {})
    // state 损坏防御: 有生命阶段却无有效物种 → 回到选蛋
    if (S.stage !== 'eggSelect' && S.stage !== 'dead' && !SPECIES[S.species]) S.stage = 'eggSelect'
    return true
  } catch { return false }
}

// ---------- 事件/气泡/提示 ----------
function log(text) {
  S.log.push({ t: Date.now(), text })
  if (S.log.length > 12) S.log.shift()
}
function bubble(text, sec = 8) { S.bubble = { text, until: Date.now() + sec * 1000 } }
function bell(n = 1) { for (let i = 0; i < n; i++) process.stdout.write(ansi.bell) }

// ---------- 时间引擎 ----------
const H = 3600000
// --fast[=N] 测试档: 游戏时间流速 ×N (默认 60) — 衰减/孵化/弥留/守灵/生病/冷却统一加速, 头部显示 ⏩ 角标
const _fa = process.argv.find(a => a === '--fast' || a.startsWith('--fast='))
const SCALE = _fa ? Math.max(1, parseInt(_fa.split('=')[1]) || 60) : 1
const HATCH_MS = HATCH_MIN * 60000 / SCALE
const GRACE_MS = DYING_GRACE_H * H / SCALE
const MOURN_MS = MOURN_H * H / SCALE
const SICK_MS = SICK_AFTER_DIRTY_H * H / SCALE
const DEATH_MS = 2 * H / SCALE   // 异常状态死线(心碎/病/肥胖/精竭): 2h
const LIFESPAN_DAYS = 30         // 寿终正寝(荣誉死法)
// 动作冷却(毫秒, 测试档同步加速); 配合阈值拒绝防狂点 — 数值健康时动作同样会被拒绝
const CD = { feed: 90e3, water: 90e3, snack: 300e3, bath: 600e3, play: 180e3, touch: 60e3, dose: 180e3 }
for (const _k in CD) CD[_k] /= SCALE
function dec(v, rate, h) { return Math.max(0, v - rate * h) }
function applyDecay(h) {
  if (S.stage !== 'alive' && S.stage !== 'dying') return
  const sleeping = isSleepTime() || !S.awake
  S.hunger = dec(S.hunger, sleeping ? DECAY.hunger - 4 : DECAY.hunger, h) // 睡着饿得慢 15→11/h
  S.thirst = dec(S.thirst, DECAY.thirst, h)
  S.clean = dec(S.clean, DECAY.clean, h)
  S.mood = dec(S.mood, DECAY.mood, h)
  S.weight = Math.max(0.2, S.weight - DECAY.weight * h)
  // 低指标拖累心情
  let extra = 0
  if (S.hunger < 30) extra += 4
  if (S.thirst < 30) extra += 4
  if (S.clean < 30) extra += 3
  if (extra) S.mood = dec(S.mood, extra, h)
  // 睡觉回精力(小睡 2h 满; 醒着自然恢复 4/h)
  // 精力: 睡 40/h 醒 4/h; 醒着归零后锁死(虚脱, 必须睡觉才能回) — 否则猝死死线永远无法触达
  if (sleeping) S.energy = Math.min(100, S.energy + 40 * h)
  else if (S.energy > 0) S.energy = Math.min(100, S.energy + 4 * h)
}
function moodCap() {
  const base = S.weight > fatLine() ? 75 : 100
  return isSick() ? Math.min(base, 60) : base
}
function fatLine() { return SPECIES[S.species]?.baseWeight * 1.5 || 3 }
function thinLine() { return SPECIES[S.species]?.baseWeight * 0.6 || 1 }
// 挂在 state 上的便捷方法用函数替代
function isSick() { return !!S.dirtySince && Date.now() - S.dirtySince > SICK_MS && S.clean < 15 }

// 离线补算: 挂机玩具语义 — 离线不致死, 数值托底; 只有开着 pane 时才会饿死
function catchUp() {
  if (S.stage === 'eggSelect' || !S.lastSeen) return
  const dt = Math.max(0, Date.now() - S.lastSeen)
  if (dt < 60000) return
  const decayH = Math.min((dt / H) * SCALE, OFFLINE_DECAY_CAP_H)
  const stage0 = S.stage
  applyDecay(decayH)
  // 离线托底: 五维/体重不因离线归零 (运行中的衰减照常致命); 弥留中则整体冻结(数值保持, 计时平移)
  if (stage0 === 'alive') {
    S.hunger = Math.max(S.hunger, 30); S.thirst = Math.max(S.thirst, 30); S.clean = Math.max(S.clean, 30)
    S.mood = Math.max(S.mood, 20); S.weight = Math.max(S.weight, thinLine())
  }
  // 弥留/生病/异常死线计时离线冻结: 倒计时只在开着时走
  if (stage0 === 'dying') S.dyingSince += dt
  if (S.dirtySince) S.dirtySince += dt
  for (const k of ['heartSince', 'sickSince', 'obeseSince', 'exhaustSince']) if (S[k]) S[k] += dt
  // 蛋孵化推进
  if (S.stage === 'egg') {
    const need = HATCH_MS
    if (Date.now() - S.bornAt >= need) hatch()
  }
  // 弥留判定
  recheckStage(0)
  if (dt > 30 * 60000) log(`离线 ${fmtDur(dt)}，回到了 ${S.name || '宠物'} 身边`)
  save()
}
// 死法图鉴(Dead Cells 式收集): cause 与 memorial 记录匹配
const DEATHS = [
  { icon: '🥀', name: '油尽灯枯', cause: '饥饿与干渴' },
  { icon: '💔', name: '心碎而亡', cause: '心碎而亡' },
  { icon: '🤒', name: '病入膏肓', cause: '病入膏肓' },
  { icon: '🍰', name: '撑死的',   cause: '撑死的' },
  { icon: '⚡', name: '意外猝死', cause: '意外猝死' },
  { icon: '⭐', name: '寿终正寝', cause: '寿终正寝' },
]
// 四条异常死线: 持续 2h 未解除 → 各自死法; 返回活跃死线角标(渲染用)
function deathTimers() {
  const now = Date.now(), out = []
  if (S.stage === 'dying') out.push({ icon: '🥀', left: S.dyingSince + (S.energy <= 5 && S.mood <= 5 ? GRACE_MS / 4 : GRACE_MS) - now, name: '弥留' })
  if (S.stage !== 'alive' && S.stage !== 'dying') return out
  if (S.heartSince) out.push({ icon: '💔', left: S.heartSince + DEATH_MS - now, name: '心碎' })
  if (S.sickSince) out.push({ icon: '🤒', left: S.sickSince + DEATH_MS - now, name: '重病' })
  if (S.obeseSince) out.push({ icon: '🍰', left: S.obeseSince + DEATH_MS - now, name: '肥胖' })
  if (S.exhaustSince) out.push({ icon: '⚡', left: S.exhaustSince + DEATH_MS - now, name: '精竭' })
  return out
}
function recheckStage(dt = 0) {
  const now = Date.now()
  if (S.stage === 'alive') {
    if (S.hunger <= 0 && S.thirst <= 0) {
      S.stage = 'dying'; S.dyingSince = now
      log(`${S.name} 饿晕过去了…（弥留 ${fmtDur(GRACE_MS)} 内喂食+喂水可救）`)
      bubble('（晕乎乎…好饿…好渴…）', 15); bell(3)
    } else {
      // 异常死线判定: 先到先死
      if (S.heartSince && now - S.heartSince >= DEATH_MS) return die('心碎而亡')
      if (S.sickSince && now - S.sickSince >= DEATH_MS) return die('病入膏肓')
      if (S.obeseSince && now - S.obeseSince >= DEATH_MS) return die('撑死的')
      if (S.exhaustSince && now - S.exhaustSince >= DEATH_MS) return die('意外猝死')
      if (livedDays(S) >= LIFESPAN_DAYS) return die('寿终正寝')
    }
  } else if (S.stage === 'dying') {
    const deadline = S.dyingSince + (S.energy <= 5 && S.mood <= 5 ? GRACE_MS / 4 : GRACE_MS) // 全衰竭 → 弥留压缩 1/4
    if (S.hunger > 10 && S.thirst > 10) {
      S.stage = 'alive'; S.dyingSince = 0
      log(`${S.name} 被从鬼门关拉了回来！`); bubble('呼…差点睡着就醒不来了…', 10)
    } else if (now >= deadline) {
      die('饥饿与干渴')
    }
  } else if (S.stage === 'dead' && Date.now() - S.diedAt >= MOURN_MS) {
    // 守灵结束 → 待重新孵蛋(由用户按键触发, 这里只解锁)
  }
}
function die(cause) {
  S.stage = 'dead'; S.diedAt = Date.now(); S.deathCause = cause
  const d = DEATHS.find(x => x.cause === cause)
  S.memorial.push({ name: S.name, species: S.species, days: +livedDays(S).toFixed(1), cause, generation: S.generation })
  log(`${S.name} 永远地离开了…${d ? d.icon + d.name : `（${cause}）`}${cause === '寿终正寝' ? '——圆满的一生' : ''}`); bell(5)
}
function hatch() {
  S.stage = 'alive'; S.hatchedAt = Date.now()
  S.weight = SPECIES[S.species].baseWeight * 0.8
  log(`蛋壳裂开——${S.name} 孵出来了！`); bubble('初次见面！', 8); bell(2)
  save()
}
function isSleepTime() { const h = new Date().getHours(); return h >= 23 || h < 7 }
function grownStage() { return S.careScore >= GROW_CARE ? 'adult' : 'baby' }

// ---------- 动作 ----------
function clamp(v, a = 0, b = 100) { return Math.max(a, Math.min(b, v)) }
function act(kind) {
  if (S.stage === 'eggSelect') return
  if (S.stage === 'dead') { if (kind === 'feed' && Date.now() - S.diedAt >= MOURN_MS) newEgg(); return }
  if (S.stage === 'egg') { bubble('蛋在轻轻摇晃…还要一会儿'); return }
  // 睡着时除睡觉键外一律拒绝(防刷: 40/h 快速回精力的代价)
  if (!S.awake && kind !== 'sleepToggle') {
    if (kind === 'touch') bubble('（睡梦中翻了个身）')
    else bubble('睡得正香，别吵…')
    return
  }
  const cdLeft = k => CD[k] ? Math.ceil((CD[k] - (Date.now() - (S.lastAct[k] || 0))) / 1000) : 0
  const sick = isSick()
  switch (kind) {
    case 'feed': {
      if (cdLeft('feed') > 0) { bubble(`还想吃？消化一下（${cdLeft('feed')}s）`); break }
      if (S.hunger > 65) { bubble('还不饿~'); break }
      if (S.thirst < 20) { bubble('口太干了，先喝点水吧…'); break }
      const gain = sick ? 16 : 32
      S.hunger = clamp(S.hunger + gain); S.weight += 0.15; S.stats.feed++
      S.careScore++; S.lastAct.feed = Date.now()
      bubble(sick ? '没什么胃口…还是吃了' : '嗷呜嗷呜，好吃！'); break
    }
    case 'snack': {
      if (cdLeft('snack') > 0) { bubble(`零食刚吃过（${cdLeft('snack')}s）`); break }
      if (S.hunger > 65) { bubble('肚子不饿，不吃零食~'); break }
      S.hunger = clamp(S.hunger + 8); S.mood = clamp(S.mood + (sick ? 6 : 12)); S.weight += 0.25; S.stats.snack++
      S.careScore++; S.lastAct.snack = Date.now()
      bubble('零食！开心转圈！'); break
    }
    case 'water': {
      if (cdLeft('water') > 0) { bubble(`喝太快会呛到（${cdLeft('water')}s）`); break }
      if (S.thirst > 65) { bubble('现在不渴~'); break }
      S.thirst = clamp(S.thirst + 35); S.stats.water++; S.careScore++
      S.lastAct.water = Date.now(); bubble('咕咚咕咚~'); break
    }
    case 'bath': {
      if (cdLeft('bath') > 0) { bubble(`刚洗过澡，毛还没干（${cdLeft('bath')}s）`); break }
      if (S.clean > 60) { bubble('身上还挺干净的~'); break }
      S.clean = clamp(S.clean + 45)
      if (isSick()) { log(`${S.name} 洗掉了一身病气，痊愈了！`); bubble('洗完澡，病好啦！') }
      else bubble('泡泡好舒服~')
      S.dirtySince = 0; S.stats.bath++; S.careScore++; S.lastAct.bath = Date.now(); break
    }
    case 'play': {
      if (cdLeft('play') > 0) { bubble(`玩累了歇会儿（${cdLeft('play')}s）`); break }
      if (S.energy < 15) { bubble('太累了…想睡觉…'); break }
      if (S.mood > 90) { bubble('心情正好，不用哄~'); break }
      if (S.hunger < 20) { bubble('肚子空空的，玩不动…'); break }
      if (S.thirst < 20) { bubble('渴得口干舌燥，玩不动…'); break }
      if (S.stage === 'dying') { bubble('它连站都站不稳了…'); break }
      S.mood = clamp(S.mood + 28); S.energy = clamp(S.energy - 15)
      S.hunger = clamp(S.hunger - 4); S.thirst = clamp(S.thirst - 6)
      S.stats.play++; S.careScore += 2; S.lastAct.play = Date.now(); bubble('耶！再玩一次！'); break
    }
    case 'sleepToggle': {
      if (!S.awake) { S.awake = true; bubble('睡醒啦！'); break }
      if (S.energy > 95) { bubble('精神得很，睡不着～'); break }
      S.awake = false; bubble('Zzz…'); break
    }
    case 'dose': {
      if (cdLeft('dose') > 0) { bubble(`药劲还没过（${cdLeft('dose')}s）`); break }
      if (!isSick()) { bubble('它很健康，不需要吃药'); break }
      S.sickSince = 0; S.dirtySince = 0 // 重置病计时(治标: 脏没除, 2h 后会再病)
      S.mood = clamp(S.mood - 20); S.energy = clamp(S.energy - 15) // 苦药的代价
      S.stats.dose++; S.lastAct.dose = Date.now()
      log(`${S.name} 皱着眉把药吃了…病好啦（记得洗澡除根）`); bubble('苦…但病好了…', 10); break
    }
    case 'touch': {
      if (cdLeft('touch') > 0) { bubble('（被摸得毛都乱了…）'); break }
      S.lastAct.touch = Date.now(); S.mood = clamp(S.mood + 10); S.stats.touch++
      S.careScore++; bubble('呼噜呼噜…最喜欢你了'); break
    }
  }
  S.mood = Math.min(S.mood, moodCap())
  setFx(kind) // 动作特效(FX_DEF 无定义的动作自动跳过)
  checkAchievements(); recheckStage(); save()
}
function newEgg() {
  // 保留 memorial/generation+1, 其余重置为 eggSelect
  const memorial = S.memorial, gen = (S.generation || 1), ach = S.achievements, stats = S.stats
  S = defaultState()
  S.memorial = memorial; S.generation = gen + 1; S.stage = 'eggSelect'
  S.achievements = ach; S.stats = stats // 成就与动作计数为驯主生涯制, 跨代保留
  checkAchievements()
  save()
}
function checkAchievements() {
  for (const a of ACHIEVEMENTS) {
    if (!S.achievements.includes(a.id) && a.check(S)) {
      S.achievements.push(a.id)
      log(`解锁成就 ${a.icon} ${a.name}（${a.desc}）`); bell(2)
    }
  }
}

// ---------- 随机小剧场 ----------
const THEATER = {
  common: ['（盯着你看了一会儿）', '（突然原地转了个圈）', '（哼起了不成调的小曲）', '（望着远处发呆）', '（打了个大大的哈欠）'],
  slime:  ['（Q弹Q弹地弹了两下）', '（把自己捏成了一个小方块又弹回来）', '（身上闪过一道彩虹光）'],
  hamster:['（把颊囊塞得满满的）', '（在木屑里刨了个洞）', '（偷偷藏起一颗粮）'],
  dragon: ['（鼻孔冒出两撮小火星）', '（对着影子练习喷火）', '（翅膀扑腾着原地起飞失败）'],
}
function maybeTheater() {
  if (S.stage !== 'alive') return
  if (S.bubble && Date.now() < S.bubble.until) return // 气泡在播时不打断(乞讨优先)
  if (Date.now() - S.lastEventAt < (2 + Math.random() * 3) * 60000) return
  S.lastEventAt = Date.now()
  const pool = [...(THEATER[S.species] || []), ...THEATER.common]
  bubble(pool[Math.floor(Math.random() * pool.length)], 10)
}

// ---------- 定向乞讨(低数值时优先于小剧场) ----------
const BEGS = [
  ['__sick', 0, ['（蔫蔫地看着药罐的方向…）', '（打了个喷嚏，晕乎乎的…）']], // 生病最优先
  ['thirst', 40, ['（推了推空空的水碗…）', '（眼巴巴地望着水碗的方向）']],
  ['hunger', 40, ['（盯着你手里的零食…）', '（肚子咕噜咕噜地叫）']],
  ['mood', 40, ['（把玩具叼到你面前…）', '（蔫蔫地趴着，提不起劲）']],
  ['clean', 40, ['（身上痒痒，蹭了蹭墙角…）', '（毛色暗淡，眼巴巴盼着洗澡）']],
]
function maybeBeg() { // 生病>口渴>饱腹>心情>洁净, 10 分钟节流
  if (S.stage !== 'alive') return false
  if (Date.now() - (S.lastBegAt || 0) < 10 * 60000) return false
  const want = BEGS.find(([k, low]) => (k === '__sick' ? isSick() : S[k] < low))
  if (!want) return false
  S.lastBegAt = Date.now()
  bubble(want[2][Math.floor(Math.random() * want[2].length)], 10)
  return true
}

// ---------- 渲染 ----------
let frame = 0
let PAGE = 'main' // main | stats (Tab 切换)
let wanderOff = 0, wanderTarget = 0, wanderNext = 0, wanderFace = 1 // 自主漫游(纯视觉, 不入存档)
let FX = null     // 动作特效 {kind, start:frame}
let TERM_W = Math.max(58, Math.min(+(process.env.PET_WIDTH || process.stdout.columns) || 78, 120))
if (process.stdout.on) process.stdout.on('resize', () => {
  TERM_W = Math.max(58, Math.min(+(process.env.PET_WIDTH || process.stdout.columns) || TERM_W, 120))
})
function at(row, col, text) { if (col > TERM_W - 1 || row > 24 || row < 1) return; process.stdout.write(`${ESC}${row};${col}H${text}`) } // 越界保护: 防换行炸屏
function renderStars() {
  const h = new Date().getHours()
  if (h >= 20 || h < 5) {
    for (let i = 0; i < STAR_CHANCE_NIGHT; i++) {
      const r = 3 + ((i * 7 + frame) % 6), c = 6 + ((i * 13) % (TERM_W - 12))
      at(r, c, fg(255, 255, 180) + '·' + R)
    }
  }
}
function drawArt(rows, top, left, padCols = 0) {
  const main = SPECIES[S.species]?.color || [200, 200, 200]
  const desat = (S.stage === 'alive' || S.stage === 'dying') ? (S.mood < 30 ? 0.5 : S.weight < thinLine() ? 0.2 : 0) : 0
  const mix = c => c.map(v => Math.round(v + (128 - v) * desat))
  for (let ri = 0; ri < rows.length; ri++) {
    const line = rows[ri]
    let out = ''
    for (let ci = 0; ci < line.length; ci++) {
      const ch = line[ci]
      if (ch === '.') { out += ' ' } // 透明留空(背景由整屏底色体现)
      else {
        const c = PAL[ch]
        out += c ? bg(...mix(c)) + ' ' + R : (bg(...mix(main)) + ' ' + R)
      }
    }
    // 胖: 两侧补主色列
    if (padCols > 0) {
      const pad = bg(...mix(main)) + ' '.repeat(padCols) + R
      out = pad + out + pad
    }
    at(top + ri, left, out + ansi.clrEol)
  }
}
function bar(label, v, color, extra = '') {
  const w = 14, filled = Math.round(v / 100 * w)
  return `${label} ${bg(...color)}${' '.repeat(filled)}${R}${dim}${'·'.repeat(w - filled)}${R} ${String(Math.round(v)).padStart(3)}${extra}`
}
const hotButtons = [] // {row, c0, c1, kind}
const KIND2KEY = { feed: 'f', snack: '1', water: 'w', bath: 'b', play: 'p', sleepToggle: 's', touch: 't', dose: 'd', rename: 'n', reset: 'r', quit: 'q', pickEgg1: '1', pickEgg2: '2', pickEgg3: '3', toggleStats: '\t' }
function buttonBar(row) {
  let defs = [
    ['f', '喂食', 'feed'], ['1', '零食', 'snack'], ['w', '喂水', 'water'], ['b', '洗澡', 'bath'],
    ['p', '玩耍', 'play'], ['s', '睡觉', 'sleepToggle'], ['t', '摸摸', 'touch'], ['d', '吃药', 'dose'], ['n', '起名', 'rename'],
    ['r', '重置', 'reset'], ['q', '退出', 'quit'],
  ]
  if (S.named) defs = defs.filter(d => d[2] !== 'rename') // 起名一次性, 定名后收起
  const gap = 1
  const totalW = defs.reduce((w, [k, label]) => w + `[${k} ${label}]`.length + 3 + gap, 0) // +3 冷却后缀余量
  const perRow = 3 + totalW > TERM_W ? 5 : defs.length // 窄屏折两行(前5后5)
  let col = 3, r = row
  defs.forEach(([k, label, kind], i) => {
    if (i === perRow) { col = 3; r = row + 1 }
    let text = `[${k} ${label}]`
    let style = bg(60, 70, 100) + fg(230, 230, 240) + bold
    if (CD[kind]) { // 冷却中: 置灰+倒计时
      const left = Math.ceil((CD[kind] - (Date.now() - (S.lastAct[kind] || 0))) / 1000)
      if (left > 0) { text = `[${k} ${label}·${left}s]`; style = dim + fg(110, 110, 120) }
    }
    at(r, col, style + text + R)
    hotButtons.push({ row: r, c0: col, c1: col + text.length - 1, kind })
    col += text.length + gap
  })
}
// 动作特效(FX): 每动作 2s 粒子动画, frame 驱动, 与气泡并存
const FX_DEF = {
  feed:  { color: [255, 190, 80],  chars: ['●', '●', '◍'], from: -3, dir: 1 },   // 食物色块落下
  snack: { color: [255, 230, 120], chars: ['✦', '✧', '✦'], from: -4, dir: 1 },   // 星星闪烁下落
  water: { color: [110, 190, 255], chars: ['❍', '◦', '❍'], from: -3, dir: 1 },   // 水滴落下
  bath:  { color: [220, 240, 255], chars: ['○', '°', '◦'], from: 1, dir: -1 },   // 泡泡上升
  play:  { color: [180, 140, 255], chars: ['!', '♦', '↑'], from: -2, dir: 1 },   // 跳动符号
  touch: { color: [255, 150, 170], chars: ['♥', '♡', '♥'], from: -4, dir: 1 },   // 爱心冒出
  dose:  { color: [120, 230, 140], chars: ['✚', '●', '✚'], from: -3, dir: 1 },   // 药丸绿十字落下
}
function setFx(kind) { if (FX_DEF[kind]) FX = { kind, start: frame } }
function renderFx(artTop, artLeft, artW) {
  if (!FX) return
  const f = frame - FX.start
  if (f > 4) { FX = null; return } // 2fps × 4+ 帧 ≈ 2s
  const d = FX_DEF[FX.kind]
  const ch = d.chars[f % d.chars.length]
  const drop = Math.min(f, 2) // 逐帧位移, 2 格封顶
  const cols = [artLeft + 2, artLeft + (artW >> 1), artLeft + Math.max(2, artW - 3)] // 三粒: 左中右
  cols.forEach((c, i) => {
    let row = artTop + d.from + (d.dir > 0 ? drop : -drop) // 落下↓ / 上升↑
    if (i === 1 && f % 2) return // 中粒闪烁
    at(Math.max(1, Math.min(23, row)), c, fg(...d.color) + ch + R)
  })
}

function render() {
  process.stdout.write(ansi.clear + ansi.home)
  renderStars()
  hotButtons.length = 0 // 统一在入口清空热区, buttonBar/各子渲染只注册

  if (S.stage === 'eggSelect') { renderEggSelect(); return }
  if (S.stage === 'dead') { renderGrave(); return }
  if (PAGE === 'stats') { renderStats(); return }

  // 头部
  const stageZh = { egg: '蛋·孵化中', alive: grownStage() === 'adult' ? '成年期' : '幼年期', dying: '!! 弥留 !!' }[S.stage]
  at(1, 2, bold + fg(255, 255, 255) + `${S.name || '?'}${R}${dim}  ${SPECIES[S.species]?.label || ''} · ${stageZh} · 第${S.generation}代 · 存活 ${livedDays(S).toFixed(1)} 天${R}`)
  const h = new Date().getHours()
  const dayTxt = ({ night: '夜 · 静悄悄', dawn: '晨 · 微光', day: '昼 · 明亮', dusk: '暮 · 橙红' }[h >= 23 || h < 5 ? 'night' : h < 8 ? 'dawn' : h < 17 ? 'day' : 'dusk'])
  const tag = SCALE > 1 ? fg(255, 220, 90) + `⏩x${SCALE} ` + R + dim : ''
  at(1, TERM_W - 14 - (SCALE > 1 ? 7 : 0), tag + dayTxt + R)

  // 宠物
  const artSet = ART[S.species]
  let art
  if (S.stage === 'egg') art = eggArt(S.species, hatchProgress())
  else {
    const stage = grownStage()
    const frames = artSet[stage]
    const sleeping = isSleepTime() || !S.awake // 与衰减侧判定一致
  const base = sleeping ? frames[0] : frames[frame % frames.length]
  art = moodOverlay(wanderFace < 0 ? base.map(r => [...r].reverse().join('')) : base) // 漫游朝向镜像
  // 漫游步进: 逐列滑向目标点
  if (S.awake && S.stage === 'alive' && wanderOff !== wanderTarget) {
    wanderFace = wanderTarget < wanderOff ? -1 : 1
    wanderOff += wanderFace
  }
  }
  const fat = S.weight > fatLine() ? 2 : 0
  const eggShake = S.stage === 'egg' && hatchProgress() >= 0.75 && frame % 2 ? 1 : 0 // 临孵摇晃
  const artTop = 4, artLeft = Math.max(4, Math.floor((TERM_W - (art[0].length + fat * 2)) / 2) + eggShake + wanderOff + (S.stage === 'dying' ? (frame % 2 ? 1 : -1) : 0))
  drawArt(art, artTop, artLeft, fat)
  // 状态符号
  const statusIcons = []
  if (S.stage === 'dying') statusIcons.push(bold + fg(255, 60, 60) + '!! 危急 !!' + R)
  if (isSick()) statusIcons.push(fg(150, 220, 130) + '病' + R)
  if (!S.awake) statusIcons.push(fg(170, 170, 255) + 'Zzz' + R)
  else if (S.mood < 30) statusIcons.push(fg(130, 130, 130) + '不开心' + R)
  else if (S.mood > 80) statusIcons.push(fg(255, 200, 80) + '开心' + R)
  // 死线倒计时角标(红色): 看到就知道还有多久救
  for (const t of deathTimers()) {
    if (t.left > 0) statusIcons.push(bold + fg(255, 60, 60) + `${t.icon}${fmtDur(t.left)}` + R)
  }
  at(artTop + art.length + 1, Math.floor(TERM_W / 2) - 10, statusIcons.join(' '))
  // 气泡
  if (S.bubble && Date.now() < S.bubble.until) {
    const text = S.bubble.text
    at(artTop - 1, Math.min(TERM_W - text.length - 4, artLeft + art[0].length + 2), fg(255, 255, 255) + `「${text}」` + R)
  } else S.bubble = null
  renderFx(artTop, artLeft, art[0].length)

  // 数值区(蛋期只显示孵化进度, 无五维/体重)
  const rowB = 17
  if (S.stage === 'egg') {
    const prog = hatchProgress()
    at(rowB, 3, bar('孵化', prog * 100, [170, 220, 140]) + dim + `  还需 ${fmtDur(HATCH_MS - (Date.now() - S.bornAt))}` + R)
  } else {
    const wt = S.weight.toFixed(1) + 'kg'
    const wtState = S.weight > fatLine() ? fg(255, 150, 90) + '超重' + R : S.weight < thinLine() ? fg(120, 180, 255) + '偏瘦' + R : '标准'
    at(rowB, 3, bar('饱腹', S.hunger, [230, 150, 60]) + '   ' + bar('口渴', S.thirst, [80, 170, 240]))
    at(rowB + 1, 3, bar('洁净', S.clean, [130, 220, 200]) + '   ' + bar('心情', Math.min(S.mood, moodCap()), [250, 130, 200]))
    at(rowB + 2, 3, bar('精力', S.energy, [180, 180, 120]) + `   体重 ${bold}${wt}${R} ${wtState}`)
  }

  // 成就/纪念收纳为角标(点击或 Tab 进数据面板) + 最新一条日志独占行(不再与数值区接壤)
  const gotN = ACHIEVEMENTS.filter(a => S.achievements.includes(a.id)).length
  at(rowB + 4, 3, dim + `🏆 ${gotN}/${ACHIEVEMENTS.length}   🕊 ${S.memorial.length}` + R)
  const lastLog = S.log[S.log.length - 1]
  if (lastLog) at(rowB + 5, 3, dim + lastLog.text.slice(0, TERM_W - 5) + R)

  buttonBar(23)
  hotButtons.push({ row: rowB + 4, c0: 3, c1: 12, kind: 'toggleStats' }) // 角标热区
}
function renderEggSelect() {
  at(2, 28, bold + fg(255, 255, 255) + '领养一只宠物吧（键盘 1/2/3 或点击）' + R)
  const opts = [['slime', '果冻史莱姆', 'Q弹 变色 小巧'], ['hamster', '像素小仓鼠', '颊囊 圆滚 藏粮'], ['dragon', '小火龙', '喷火 成长 帅气']]
  opts.forEach(([sp, name, desc], i) => {
    const left = 8 + i * 22
    at(5, left, bold + `${i + 1}. ${name}` + R)
    const egg = ART.egg[sp][0]
    drawArt(egg, 7, left + 5)
    at(14, left, dim + desc + R)
  })
  opts.forEach(([, ,], i) => {
    const left = 8 + i * 22
    for (let r = 5; r <= 13; r++) hotButtons.push({ row: r, c0: left, c1: left + 16, kind: 'pickEgg' + (i + 1) })
  })
}
function renderGrave() {
  const mournLeft = Math.max(0, MOURN_MS - (Date.now() - S.diedAt))
  drawArt(GRAVE, 5, Math.floor((TERM_W - 9) / 2))
  at(13, 24, bold + fg(200, 200, 210) + `${S.name} 在这里长眠` + R)
  const dIcon = DEATHS.find(x => x.cause === S.deathCause)
  at(14, 26, dim + `死因: ${dIcon ? dIcon.icon + ' ' + dIcon.name : S.deathCause} · 共存活 ${livedDays(S).toFixed(1)} 天` + R)
  if (mournLeft > 0) at(16, 24, fg(150, 150, 160) + `守灵中… ${fmtDur(mournLeft)} 后可重新孵蛋（按 f）` + R)
  else at(16, 22, fg(255, 200, 120) + '按 f 或点击 [f 喂食] 迎接下一代' + R)
  buttonBar(23)
}
// 数据面板(Tab): 生涯统计 + 成就进度 + 纪念墙 + 全量日志
function renderStats() {
  // 显示宽度感知截断(中文 2 cell): 防 60 列窄屏头部撞返回按钮/越界
  const dSlice = (s, budget) => { let w = 0, out = ''; for (const ch of s) { w += /[\x00-\x7f]/.test(ch) ? 1 : 2; if (w > budget) break; out += ch } return out }
  const spec = SPECIES[S.species]
  const back = '[Tab 返回主界面]'
  const backW = [...back].reduce((w, c) => w + (/[\x00-\x7f]/.test(c) ? 1 : 2), 0) // 显示宽度(CJK 2 cell)
  const backCol = TERM_W - backW - 1
  const headInfo = `  ${S.name} · ${spec?.label || ''} · 第${S.generation}代 · 存活 ${livedDays(S).toFixed(1)} 天 · ${S.weight.toFixed(1)}kg${SCALE > 1 ? ' · ⏩x' + SCALE : ''}`
  at(1, 2, bold + fg(255, 255, 255) + '📋 数据面板' + R + dim + dSlice(headInfo, backCol - 16) + R)
  at(1, backCol, bg(60, 70, 100) + fg(230, 230, 240) + back + R)
  hotButtons.push({ row: 1, c0: backCol, c1: backCol + back.length - 1, kind: 'toggleStats' })
  // 两栏布局: 左栏动作+成就, 右栏图鉴+纪念墙, 日志通栏底部; 窄屏(<66)单列+压缩摘要
  const twoCol = TERM_W >= 66
  // 生涯动作(2列×4行, 最长~40列, 不与右栏col44冲突)
  at(3, 3, dim + '— 生涯动作 —' + R)
  const acts = [['feed', '喂食'], ['snack', '零食'], ['water', '喂水'], ['bath', '洗澡'], ['play', '玩耍'], ['touch', '摸摸'], ['dose', '吃药']]
  acts.forEach(([k, label], i) => at(4 + Math.floor(i / 2), 3 + (i % 2) * 22, `${label} ${bold}${S.stats[k] || 0}${R}`))
  // 成就(含进度)
  at(9, 3, dim + `— 成就 ${S.achievements.length}/${ACHIEVEMENTS.length} —` + R)
  ACHIEVEMENTS.forEach((a, i) => {
    const got = S.achievements.includes(a.id)
    const txt = `${a.icon} ${a.name}  ${a.desc}${got ? '' : a.prog ? `  ${a.prog(S)}` : ''}`
    at(10 + i, 3, (got ? fg(255, 220, 120) : dim) + dSlice(txt, TERM_W - 5) + R)
  })
  if (twoCol) {
    // 右栏: 图鉴 rows 3-9 + 纪念墙 rows 11-14
    const dexCol = 44
    at(3, dexCol, dim + `— 死法图鉴 ${DEATHS.filter(d => S.memorial.some(m => m.cause === d.cause)).length}/${DEATHS.length} —` + R)
    DEATHS.forEach((d, i) => {
      const n = S.memorial.filter(m => m.cause === d.cause).length
      const got = n > 0
      at(4 + i, dexCol, (got ? (d.cause === '寿终正寝' ? fg(255, 220, 120) + bold : fg(220, 120, 120)) : dim) + `${got ? d.icon + ' ' + d.name + (n > 1 ? ` ×${n}` : '') : '???'}` + R)
    })
    at(11, dexCol, dim + `— 纪念墙 ${S.memorial.length} —` + R)
    S.memorial.slice(-3).reverse().forEach((m, i) => {
      const md = DEATHS.find(x => x.cause === m.cause)
      at(12 + i, dexCol, `${m.name}·存活${m.days}天·${md ? md.icon + md.name : m.cause}`)
    })
    // 日志(通栏底部)
    at(19, 3, dim + '— 日志 —' + R)
    S.log.slice().reverse().forEach((e, i) => { if (20 + i <= 22) at(20 + i, 3, dim + e.text.slice(0, TERM_W - 6) + R) })
  } else {
    // 窄屏单列: 图鉴压缩为一行 icon 摘要 + 纪念墙 2 条, 不显示日志(与主界面策略一致)
    const gotD = DEATHS.map(d => ({ d, n: S.memorial.filter(m => m.cause === d.cause).length }))
    const sum = gotD.map(({ d, n }) => n > 0 ? `${d.icon}${n > 1 ? n : ''}` : '❔').join(' ')
    at(19, 3, dim + `— 死法图鉴 ${gotD.filter(x => x.n > 0).length}/${DEATHS.length}: ${sum} —` + R)
    at(20, 3, dim + `— 纪念墙 ${S.memorial.length} —` + R)
    S.memorial.slice(-2).reverse().forEach((m, i) => {
      const md = DEATHS.find(x => x.cause === m.cause)
      at(21 + i, 3, dim + `${m.name}·${m.days}天·${md ? md.icon + md.name : m.cause}` + R)
    })
  }
}
function fmtDur(ms) {
  const m = Math.round(ms / 60000)
  if (m < 60) return `${m} 分钟`
  return `${Math.floor(m / 60)} 小时 ${m % 60} 分`
}

// ---------- 输入 ----------
function setupInput(onAction, onQuit, onRename) {
  if (process.stdin.isTTY) process.stdin.setRawMode(true)
  process.stdin.resume()
  let buf = ''
  process.stdin.on('data', d => {
    buf += d.toString('utf8') // utf8: 中文输入(改名)与 ASCII 控制序列兼得
    // SGR 鼠标: ESC [ < r ; c M/m
    while (buf.length) {
      const m = buf.match(/^\x1b\[<(\d+);(\d+);(\d+)([Mm])/)
      if (m) {
        buf = buf.slice(m[0].length)
        if (m[4] === 'M') { const hit = hitTest(+m[3], +m[2]); if (hit) { const key = KIND2KEY[hit]; if (key) dispatch(key) } }
        continue
      }
      const ch = buf[0]
      buf = buf.slice(1)
      if (ch === '\x03') { cleanup(); process.exit(0) }
      else if (ch === '\x1b') { buf = ''; continue } // 其他转义序列丢弃(简化)
      dispatch(ch)
    }
  })
  function dispatch(k) {
    if (S.askReset) { // 重置确认优先拦截
      if (/^y(es)?$/i.test(k)) doReset()
      else { S.askReset = false; render() }
      return
    }
    if (k.length === 1 && k >= '1' && k <= '3' && S.stage === 'eggSelect') { pickEgg(+k); return }
    if (k === '\t') { // 数据面板切换(选蛋/墓碑界面不适用)
      if (S.stage !== 'eggSelect' && S.stage !== 'dead') { PAGE = PAGE === 'main' ? 'stats' : 'main'; render() }
      return
    }
    if (S.stage === 'eggSelect') { if (k === 'q') onQuit(); return }
    if (k === 'q') { onQuit() }
    else if (k === 'n') { if (S.named) bubble('名字定下来了，不换啦'); else onRename() }
    else if (k === 'r') {
      if (S.stage === 'dead' || S.stage === 'eggSelect') return // 这两个界面无需重置
      S.askReset = true
      at(22, 3, fg(255, 150, 90) + '确定重置当前宠物？纪念墙与成就保留（y 确认 / 其他键取消）' + R + ansi.clrEol)
    }
    else if (k === 'f') onAction('feed')
    else if (k === '1') onAction('snack')
    else if (k === 'w') onAction('water')
    else if (k === 'b') onAction('bath')
    else if (k === 'p') onAction('play')
    else if (k === 's') onAction('sleepToggle')
    else if (k === 't') onAction('touch')
    else if (k === 'd') onAction('dose')
  }
}
function hitTest(row, col) {
  for (const b of hotButtons) if (row === b.row && col >= b.c0 && col <= b.c1) return b.kind
  if (PAGE === 'stats') return null // 数据面板只有返回按钮可点
  // 点宠物 = 摸摸
  if ((S.stage === 'alive' || S.stage === 'dying' || S.stage === 'egg') && row >= 4 && row <= 14 && col >= 10 && col <= 68) return 'touch'
  if (S.stage === 'dead') {
    const left = 3, hit = hotButtons.find(b => b.kind === 'feed')
    if (hit && row === hit.row && col >= hit.c0 && col <= hit.c1) return 'feed'
  }
  return null
}
function pickEgg(n) {
  const map = { 1: 'slime', 2: 'hamster', 3: 'dragon' }
  const sp = map[n]
  if (!sp) return
  S.species = sp; S.stage = 'egg'; S.bornAt = Date.now(); S.name = SPECIES[sp].label
  S.weight = SPECIES[sp].baseWeight * 0.5
  log(`收下了一颗${SPECIES[sp].label}蛋`); bubble('（蛋里传来轻微的动静）', 6)
  save()
}

function doReset() { // 保留驯主生涯(纪念墙/成就/计数/世代), 重养当前宠物
  const keep = { memorial: S.memorial, achievements: S.achievements, stats: S.stats, generation: S.generation }
  S = Object.assign(defaultState(), keep)
  log('重置：重新开始（纪念墙与成就保留）')
  save(); render()
}

// ---------- 主流程 ----------
let running = true
function cleanup() {
  save()
  process.stdout.write(ansi.mouseOff + ansi.show + ansi.altOff)
  if (process.stdin.isTTY) { try { process.stdin.setRawMode(false) } catch {} }
  process.stdin.pause()
}
function renameFlow() {
  // 退出 raw 行内输入模式: 简化实现 — 用 Buffer 逐键收集
  S.renaming = true
  let input = ''
  at(20, 3, fg(255, 255, 0) + `新名字（输入后回车，Esc 取消）: ${input}` + R + ansi.clrEol)
  const onData = d => {
    for (const ch of d.toString('utf8')) {
      if (ch === '\r' || ch === '\n') {
        process.stdin.removeListener('data', onData)
        if (input.trim()) { S.name = input.trim().slice(0, 8); S.named = true; log(`定名为 ${S.name}`) }
        S.renaming = false; save(); render()
        return
      } else if (ch === '\x1b') {
        process.stdin.removeListener('data', onData)
        S.renaming = false; render()
        return
      } else if (ch === '\x7f') {
        input = input.slice(0, -1)
        at(20, 3, fg(255, 255, 0) + `新名字（输入后回车，Esc 取消）: ${input}` + R + ansi.clrEol)
      } else if (/^[\x20-\x7e\u4e00-\u9fa5]$/.test(ch)) {
        input += ch
        at(20, 3, fg(255, 255, 0) + `新名字（输入后回车，Esc 取消）: ${input}` + R + ansi.clrEol)
      }
    }
  }
  process.stdin.on('data', onData)
}

// 单实例锁: 双开会导致 state.json 互相覆盖
const LOCK_FILE = STATE_FILE + '.lock'
try {
  const pid = +readFileSync(LOCK_FILE, 'utf8')
  if (pid) {
    try { process.kill(pid, 0); console.error('pet 已在运行（单实例限制，双开会互相覆盖存档）'); process.exit(1) }
    catch {} // 锁持有进程已死 → 抢锁
  }
} catch {} // 无锁文件
writeFileSync(LOCK_FILE, String(process.pid))
process.on('exit', () => { try { unlinkSync(LOCK_FILE) } catch {} })

const had = load()
if (had) catchUp()

process.stdout.write(ansi.altOn + ansi.clear + ansi.hide + ansi.mouseOn)
setupInput(
  kind => { if (!S.renaming) { act(kind); render() } },
  () => { cleanup(); process.exit(0) },
  () => { if (S.stage === 'alive') renameFlow() },
)
// 主循环: 渲染 500ms / 逻辑 1s / 自动存档 30s
setInterval(() => { if (S.renaming || S.askReset) return; frame++; render() }, 500)
setInterval(() => {
  if (S.renaming) return
  if (S.stage === 'alive' || S.stage === 'dying') {
    applyDecay(SCALE / 3600)
    if (S.clean < 15) { if (!S.dirtySince) S.dirtySince = Date.now() }
    else S.dirtySince = 0
    // 自主漫游: 每 8-20s(游戏时)换个目标点
    if (S.stage === 'alive' && S.awake && Date.now() > wanderNext) {
      wanderTarget = Math.round((Math.random() * 2 - 1) * 6)
      if (wanderTarget === wanderOff) wanderTarget = wanderOff + (Math.random() < 0.5 ? -2 : 2)
      wanderNext = Date.now() + (8 + Math.random() * 12) * 1000 / SCALE
    }
    if (S.stage === 'alive') { // 异常死线计时维护(离线冻结, 弥留期暂停)
      S.heartSince = S.mood <= 0 ? (S.heartSince || Date.now()) : 0
      S.sickSince = isSick() ? (S.sickSince || Date.now()) : 0
      S.obeseSince = S.weight >= fatLine() * 1.6 ? (S.obeseSince || Date.now()) : 0
      S.exhaustSince = (S.awake && S.energy <= 0) ? (S.exhaustSince || Date.now()) : 0
    }
      recheckStage(0); if (!maybeBeg()) maybeTheater(); checkAchievements()
  } else if (S.stage === 'egg') {
    if (Date.now() - S.bornAt >= HATCH_MS) hatch()
    else if (Date.now() - (S.lastEggWiggle || 0) > 40000 / SCALE) {
      S.lastEggWiggle = Date.now()
      bubble(EGG_WIGGLES[(Math.random() * EGG_WIGGLES.length) | 0], 5); save()
    }
  }
}, 1000)
setInterval(() => { if (!S.renaming) save() }, 30000)
process.on('SIGINT', () => { cleanup(); process.exit(0) })
process.on('exit', () => { try { save() } catch {} })

render()
