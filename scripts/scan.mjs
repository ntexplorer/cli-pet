#!/usr/bin/env node
// scan.mjs — pet.mjs 无头 UI 回归扫描器
// 驱动真实游戏跑一组场景(脚本化 state.json + 定时按键), 把 VT 流逐帧回放到虚拟网格,
// 检查三类问题:
//   1) 越界写入   — 文本超出终端宽度(真终端会折行/被 at() 静默丢弃)
//   2) 同帧同行互写 — 一帧内同一 cell 被两个面板写入不同文本("颗小"残片类 bug)
//   3) 关键元素缺失 — 稳态帧上应有 marker(按钮/标题/角标)没画出来
// 用法: node scripts/scan.mjs [--only=a,b]   退出码 0=全过 1=有问题
// 排查: 失败时看 build/scan/<场景名>.txt(稳态帧网格+问题清单)
// 注意: marker 为中文 — i18n 后需按语言补英文 marker
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const OUT = path.join(ROOT, 'build', 'scan')
const H = 3600_000, D = 86400_000

const args = process.argv.slice(2)
const onlyArg = args.find(a => a.startsWith('--only='))
const only = onlyArg ? onlyArg.slice(7).split(',') : null

// 显示宽度口径与 pet.mjs dispW 一致: ASCII/·=1, 其余(含 CJK/emoji)=2
const dispW = ch => { const c = ch.codePointAt(0); return (c < 0x80 || c === 0xb7) ? 1 : 2 }

// ---------- 场景 ----------
const now = Date.now()
// 通用活体存档: lastEventAt/lastBegAt/lastEggWiggle 压到当前时刻 → 压制随机小剧场/乞讨/蛋晃, 保证帧确定
const mk = over => ({
  version: 2, stage: 'alive', species: 'slime', name: '泡泡',
  bornAt: now - H, lastSeen: now, hatchedAt: now - H + 60_000, generation: 1,
  hunger: 75, thirst: 75, clean: 75, mood: 75, energy: 75, weight: 1.2, awake: true,
  dirtySince: 0, dyingSince: 0, diedAt: 0, deathCause: '',
  heartSince: 0, sickSince: 0, obeseSince: 0, exhaustSince: 0, careScore: 8,
  stats: { feed: 0, snack: 0, water: 0, bath: 0, play: 0, touch: 0, dose: 0, rps: 0, chat: 0 },
  achievements: [], memorial: [], log: [], lastAct: {}, named: true,
  lastEventAt: now, bubble: null, lastEggWiggle: now, askReset: false, lastBegAt: now,
  helpHinted: true, touchLog: [], rps: null, ...over,
})
const dragon = { species: 'dragon', name: '喷火娃', careScore: 55, weight: 2.4 }
const SCEN = [
  { name: 'eggselect-78', w: 78, over: { stage: 'eggSelect', species: null, name: null }, keys: [], mark: ['领养', '史莱姆'] },
  { name: 'eggselect-58', w: 58, over: { stage: 'eggSelect', species: null, name: null }, keys: [], mark: ['领养'] },
  // 蛋: bornAt 放到未来 → 场景内必然不孵化, 帧确定
  { name: 'egg-78', w: 78, over: { stage: 'egg', bornAt: now + 10_000 }, keys: [], mark: ['孵化'] },
  { name: 'baby-78', w: 78, over: { careScore: 0 }, keys: [], mark: ['幼年', '[f'] },
  { name: 'adult-78', w: 78, over: { careScore: 40 }, keys: [], mark: ['成年', '[f'] },
  { name: 'elder-78', w: 78, over: { bornAt: now - 22 * D, hatchedAt: now - 22 * D + H }, keys: [], mark: ['暮年'] },
  { name: 'lowstats-78', w: 78, over: { clean: 10, dirtySince: now - 300_000, energy: 20, hunger: 25, thirst: 25, mood: 20 }, keys: [], mark: ['病'] },
  { name: 'fat-78', w: 78, over: { weight: 2.2 }, keys: [], mark: ['超重'] },
  { name: 'dying-78', w: 78, over: { stage: 'dying', dyingSince: now, hunger: 0, thirst: 0, energy: 5, mood: 5 }, keys: [], mark: ['危急'] },
  { name: 'grave-78', w: 78, over: { stage: 'dead', diedAt: now - 121_000, deathCause: '寿终正寝', bornAt: now - 27 * D, hatchedAt: now - 26 * D, memorial: [{ name: '泡泡', species: 'slime', days: 26.9, cause: '寿终正寝', generation: 1 }] }, keys: [], mark: ['长眠', '迎接下一代'] },
  { name: 'stats-78', w: 78, over: { species: 'hamster', careScore: 40 }, keys: [[1200, '\t']], mark: ['数据面板', '成就'] },
  { name: 'help-78', w: 78, over: {}, keys: [[1200, '?']], mark: ['按键说明'] },
  // 改名/重置提示不走整帧重绘(render 循环挂起), 用原文流检索
  { name: 'rename-78', w: 78, over: { named: false }, keys: [[1200, 'n'], [2600, '\x1b']], mark: [], raw: ['新名字'] },
  { name: 'reset-78', w: 78, over: {}, keys: [[1200, 'r'], [2600, 'x']], mark: [], raw: ['确定重置'] },
  // rps 场景: 停在对局界面看稳态帧 — 不能按 q(会退出对局回主界面), 用 noQuit 硬杀+丢弃残帧
  { name: 'rps-idle-78', w: 78, over: dragon, keys: [[1400, 'g']], noQuit: true, ms: 3600, mark: ['三局两胜', '出招'] },
  { name: 'rps-idle-58', w: 58, over: dragon, keys: [[1400, 'g']], noQuit: true, ms: 3600, mark: ['三局两胜', '出招'] },
  { name: 'rps-reveal-78', w: 78, over: dragon, keys: [[1400, 'g'], [2600, '1']], noQuit: true, ms: 3000, mark: ['猜拳', 'VS'] },
  { name: 'rps-reveal-58', w: 58, over: dragon, keys: [[1400, 'g'], [2600, '1']], noQuit: true, ms: 3000, mark: ['猜拳', 'VS'] },
  { name: 'guard-40', w: 40, h: 20, over: {}, keys: [], mark: ['窗口太小'] },
  { name: 'adult-58', w: 58, over: { careScore: 40 }, keys: [], mark: ['[f', '饱腹'] },
  { name: 'adult-59', w: 59, over: { careScore: 40 }, keys: [], mark: ['[f'] },
  { name: 'adult-67', w: 67, over: { careScore: 40 }, keys: [], mark: ['[f'] },
  { name: 'adult-120', w: 120, over: { careScore: 40 }, keys: [], mark: ['[f'] },
]
const list = SCEN.filter(s => !only || only.includes(s.name))

// ---------- 驱动 ----------
function run(sc) {
  return new Promise(res => {
    fs.writeFileSync(path.join(ROOT, 'state.json'), JSON.stringify(mk(sc.over)))
    const p = spawn(process.execPath, ['pet.mjs', '--fast'], {
      cwd: ROOT,
      env: { ...process.env, PET_WIDTH: String(sc.w), PET_HEIGHT: String(sc.h || 25) },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let vt = '', err = ''
    p.stdout.on('data', d => { vt += d.toString('utf8') })
    p.stderr.on('data', d => { err += d.toString('utf8') })
    const settle = Math.max(1800, ...sc.keys.map(([t]) => t), sc.ms || 0) + 900
    for (const [t, k] of sc.keys) setTimeout(() => { try { p.stdin.write(k) } catch {} }, t)
    if (!sc.noQuit) setTimeout(() => { try { p.stdin.write('q') } catch {} }, settle) // 优雅退出优先, 硬杀末帧不完整
    const killT = setTimeout(() => { try { p.kill() } catch {} }, settle + 900)
    p.on('close', code => {
      clearTimeout(killT)
      try { fs.rmSync(path.join(ROOT, 'state.json.lock')) } catch {}
      res({ vt, err, code })
    })
  })
}

// ---------- VT 回放 ----------
// 单帧回放: 返回 {issues, lines(按显示宽度拼出的行文本)}
function replayFrame(chunk, cols, rows) {
  const grid = Array.from({ length: rows + 2 }, () => Array.from({ length: cols + 2 }, () => null))
  const issues = []
  let r = 1, c = 1
  const solid = t => t && t.ch && t.ch !== ' '
  const put = ch => {
    const w = dispW(ch)
    if (c > cols || c + w - 1 > cols) { issues.push(`overflow r${r} c${c} ${JSON.stringify(ch)}`); c += w; return }
    const cell = grid[r][c]
    if (cell) {
      // '·' 忽略: 夜空星星与 bar 空点属正常层叠, 免时间相关误报
      if (solid(cell) && ch !== ' ' && cell.ch !== ch && cell.ch !== '·' && ch !== '·')
        issues.push(`conflict r${r} c${c} ${JSON.stringify(cell.ch)} ← ${JSON.stringify(ch)}`)
      else if (cell.cont && ch !== ' ' && ch !== '·' && ch !== cell.cont)
        issues.push(`conflict(wide) r${r} c${c} ${JSON.stringify(cell.cont)} ← ${JSON.stringify(ch)}`)
    }
    grid[r][c] = { ch, w }
    for (let k = 1; k < w; k++) grid[r][c + k] = { cont: ch, ch: '' }
    c += w
  }
  let i = 0
  while (i < chunk.length) {
    if (chunk[i] === '\x1b') {
      if (chunk[i + 1] === '[') {
        let j = i + 2
        while (j < chunk.length && !/[A-Za-z]/.test(chunk[j])) j++
        const params = chunk.slice(i + 2, j), fin = chunk[j]
        if (fin === 'H') { const [pr, pc] = params.split(';'); r = Math.max(1, Math.min(+(pr || 1), rows)); c = Math.max(1, Math.min(+(pc || 1), cols)) }
        else if (fin === 'J') { if (!params || params === '2' || params === '0') for (const row of grid) row.fill(null) }
        else if (fin === 'K') { for (let x = c; x <= cols; x++) grid[r][x] = null }
        // m/h/l 等样式与模式序列: 网格不关心
        i = j + 1
      } else i += 2
      continue
    }
    const ch = chunk[i]
    if (ch === '\r') { c = 1; i++; continue }
    if (ch === '\n') { r = Math.min(r + 1, rows); i++; continue }
    if (ch < ' ') { i++; continue }
    const cp = chunk.codePointAt(i)
    put(String.fromCodePoint(cp))
    i += cp > 0xffff ? 2 : 1
  }
  const lines = []
  for (let y = 1; y <= rows; y++) {
    let line = ''
    // 续格(ch:'')拼零宽, 未写格才补空格 — 否则"领养"被拼成"领 养", 中文 marker 全误报
    for (let x = 1; x <= cols; x++) { const cell = grid[y][x]; line += cell ? (cell.ch || '') : ' ' }
    lines.push(line)
  }
  return { issues, lines }
}

// 全流分析: 按 ESC[2J 切帧(每帧 render 全清重绘), 末帧可能不完整 → 不计入
function analyze(vt, cols, rows) {
  const chunks = vt.split('\x1b[2J')
  const frames = []
  for (let k = 1; k < chunks.length; k++) {
    if (chunks[k].length <= 40) continue // 空帧(初始化/清屏残段)
    const f = replayFrame(chunks[k], cols, rows)
    frames.push(f)
  }
  const complete = frames.slice(0, -1)
  const last = complete[complete.length - 1] || frames[frames.length - 1] || { issues: [], lines: [] }
  return { frames, complete, last }
}

// ---------- 主流程 ----------
fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })
const hadSave = fs.existsSync(path.join(ROOT, 'state.json'))
const bak = path.join(OUT, 'state.json.userbak')
if (hadSave) fs.copyFileSync(path.join(ROOT, 'state.json'), bak)

let pass = 0, fail = 0
try {
  for (const sc of list) {
    const { vt, err, code } = await run(sc)
    if (code === 1 && /已在运行/.test(err)) {
      console.error(`✖ ${sc.name}: pet 已在运行(单实例锁) — 退出扫描器, 请先关闭游戏实例`)
      process.exit(1)
    }
    const { frames, complete, last } = analyze(vt, sc.w, sc.h || 25)
    const problems = []
    // 1/2) 越界与互写: 统计完整帧(末帧除外); 改名/重置提示屏(raw 场景)是 at() 直写覆盖旧帧+clrEol 清尾,
    // 同帧"互写"属合法覆盖 → 豁免, 交给 raw marker + 视觉审查兜底
    const issueFrames = sc.raw ? [] : complete.filter(f => f.issues.length)
    for (const f of issueFrames) for (const q of f.issues.slice(0, 3)) problems.push(q)
    if (issueFrames.length) problems.push(`(${issueFrames.length}/${complete.length} 帧有问题)`)
    // 3) marker 缺失: 稳态帧(改名/重置类提示用原文流检索)
    for (const m of sc.mark || []) if (!last.lines.some(l => l.includes(m))) problems.push(`marker 缺失: ${m}`)
    for (const m of sc.raw || []) if (!vt.includes(m)) problems.push(`raw 缺失: ${m}`)
    if (!complete.length) problems.push('无完整帧(渲染未启动?)')
    // dump: 稳态帧 + 问题清单, 失败时人眼看
    fs.writeFileSync(path.join(OUT, `${sc.name}.txt`),
      `# ${sc.name}  frames=${frames.length} complete=${complete.length} exit=${code}\n` +
      (problems.length ? '# 问题:\n' + problems.map(p => '# ' + p).join('\n') + '\n' : '') +
      last.lines.join('\n') + '\n')
    const ok = !problems.length
    if (ok) { pass++; console.log(`  ok  ${sc.name}  (frames ${complete.length})`) }
    else { fail++; console.log(`FAIL  ${sc.name}`); for (const p of problems) console.log(`      - ${p}`) }
  }
} finally {
  if (hadSave) fs.copyFileSync(bak, path.join(ROOT, 'state.json'))
  else fs.rmSync(path.join(ROOT, 'state.json'), { force: true })
  try { fs.rmSync(path.join(ROOT, 'state.json.lock')) } catch {}
}
console.log(`\nscan: ${pass}/${pass + fail} 通过${fail ? '' : ' ✓'}${fail ? `  (${fail} 失败, 详见 build/scan/)}` : ''}`)
process.exit(fail ? 1 : 0)
