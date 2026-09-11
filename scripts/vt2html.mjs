#!/usr/bin/env node
// vt2html.mjs — replays a raw VT stream into a screen buffer and emits a
// self-contained HTML page (for headless-browser screenshots).
// usage: node scripts/vt2html.mjs build/seg-2-main.txt docs/html/main.html [cols rows]
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const [,, inRel, outRel, colsArg = '80', rowsArg = '25'] = process.argv
const COLS = +colsArg, ROWS = +rowsArg

const vt = fs.readFileSync(path.join(ROOT, inRel), 'utf8')
const screen = Array.from({ length: ROWS + 2 }, () => Array.from({ length: COLS + 2 }, () => null))
let r = 1, c = 1, fg = null, bg = null, bold = false, dim = false

const cell = (ch, w) => ({ ch, w, fg, bg, bold, dim })
function put(ch) {
  const w = ch.charCodeAt(0) > 0x1100 && !/[0-9A-Za-z]/.test(ch) ? 2 : 1
  screen[r][c] = cell(ch, w)
  for (let k = 1; k < w && c + k <= COLS; k++) screen[r][c + k] = cell('', 0)
  c = Math.min(c + w, COLS + 1)
}
function sgr(params) {
  const p = params.split(';').map(Number)
  for (let i = 0; i < p.length; i++) {
    const n = p[i] || 0
    if (n === 0) { fg = bg = null; bold = dim = false }
    else if (n === 1) bold = true
    else if (n === 2) dim = true
    else if (n === 22) bold = dim = false
    else if (n === 39) fg = null
    else if (n === 49) bg = null
    else if (n === 38 && p[i + 1] === 2) { fg = `rgb(${p[i + 2]},${p[i + 3]},${p[i + 4]})`; i += 4 }
    else if (n === 48 && p[i + 1] === 2) { bg = `rgb(${p[i + 2]},${p[i + 3]},${p[i + 4]})`; i += 4 }
  }
}
let i = 0
while (i < vt.length) {
  if (vt[i] !== '\x1b') { const cp = vt.codePointAt(i); put(String.fromCodePoint(cp)); i += cp > 0xffff ? 2 : 1; continue }
  if (vt[i + 1] === '[') {
    let j = i + 2
    while (j < vt.length && !/[A-Za-z]/.test(vt[j])) j++
    const params = vt.slice(i + 2, j), fin = vt[j]
    if (fin === 'H') { const [pr, pc] = params.split(';'); r = Math.min(Math.max(+(pr || 1), 1), ROWS); c = Math.min(Math.max(+(pc || 1), 1), COLS) }
    else if (fin === 'J') { if ((params || '0') === '2' || params === '0') for (let y = 1; y <= ROWS; y++) for (let x = 1; x <= COLS; x++) screen[y][x] = null }
    else if (fin === 'K') { for (let x = c; x <= COLS; x++) screen[r][x] = null }
    else if (fin === 'm') sgr(params)
    i = j + 1
  } else i += 2
}
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
let body = ''
for (let y = 1; y <= ROWS; y++) {
  let line = ''
  for (let x = 1; x <= COLS; x++) {
    const cl = screen[y][x]
    if (!cl) { line += '<span class="e"> </span>'; continue }
    const st = [cl.fg ? `color:${cl.fg};` : '', cl.bg ? `background:${cl.bg};` : '', cl.bold ? 'font-weight:700;' : '', cl.dim ? 'opacity:.55;' : ''].join('')
    if (cl.w === 2) line += `<span class="w" style="${st}">${esc(cl.ch)}</span>`
    else if (cl.ch === ' ') line += `<span class="e" style="${st}"> </span>`
    else line += `<span style="${st}">${esc(cl.ch)}</span>`
  }
  body += `<div class="row">${line}</div>\n`
}
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;background:#0f1218;padding:18px 22px}
#t{display:inline-block;background:#0f1218;border:1px solid #232838;border-radius:8px;padding:16px 18px;box-shadow:0 8px 30px rgba(0,0,0,.5)}
.row{font:16px/1.32 ui-monospace,'Cascadia Mono','Cascadia Code',Consolas,'Microsoft YaHei UI',monospace;white-space:pre;height:22px;color:#dfe3ee}
.w{display:inline-block;width:2ch;text-align:center}
.e{display:inline-block;width:1ch}
</style></head><body><div id="t">${body}</div></body></html>`
fs.mkdirSync(path.dirname(path.join(ROOT, outRel)), { recursive: true })
fs.writeFileSync(path.join(ROOT, outRel), html)
console.log(`wrote ${outRel} (${Math.round(vt.length / 1024)}KB vt → ${Math.round(html.length / 1024)}KB html)`)
