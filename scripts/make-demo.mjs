#!/usr/bin/env node
// make-demo.mjs — turns build/demo.cast into an animated GIF via a deterministic
// HTML player (timers virtualized by Edge --virtual-time-budget) + ffmpeg.
// usage: node scripts/make-demo.mjs [--step 0.5] [--fps 10] [--speed 1.0]
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? +process.argv[i + 1] : d }
const STEP = arg('--step', 0.5), FPS = arg('--fps', 10), SPEED = arg('--speed', 1.0)
const COLS = 80, ROWS = 25

const castLines = fs.readFileSync(path.join(ROOT, 'build/demo.cast'), 'utf8').trim().split('\n')
const events = castLines.slice(1).map(l => { const [t, , b64] = JSON.parse(l); return { t, s: Buffer.from(b64, 'base64').toString('utf8') } })
const total = events.at(-1).t
console.log(`cast: ${events.length} events, ${total.toFixed(1)}s`)

const player = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;background:#0f1218;padding:18px 22px}
#t{display:inline-block;background:#0f1218;border:1px solid #232838;border-radius:8px;padding:16px 18px;box-shadow:0 8px 30px rgba(0,0,0,.5)}
.row{font:16px/1.32 ui-monospace,'Cascadia Mono','Cascadia Code',Consolas,'Microsoft YaHei UI',monospace;white-space:pre;height:22px;color:#dfe3ee}
.w{display:inline-block;width:2ch;text-align:center}
.e{display:inline-block;width:1ch}
</style></head><body><div id="t"></div>
<script>
const COLS=${COLS}, ROWS=${ROWS}, SPEED=${SPEED}
const events=${JSON.stringify(events.map(e => [e.t, e.s]))}
const screen=Array.from({length:ROWS+2},()=>Array.from({length:COLS+2},()=>null))
let r=1,c=1,fg=null,bg=null,bold=false,dim=false
const cell=(ch,w)=>({ch,w,fg,bg,bold,dim})
function put(ch){const w=ch.charCodeAt(0)>0x1100&&!/[0-9A-Za-z]/.test(ch)?2:1;screen[r][c]=cell(ch,w);for(let k=1;k<w&&c+k<=COLS;k++)screen[r][c+k]=cell('',0);c=Math.min(c+w,COLS+1)}
function sgr(params){const p=params.split(';').map(Number);for(let i=0;i<p.length;i++){const n=p[i]||0;
if(n===0){fg=bg=null;bold=dim=false}else if(n===1)bold=true;else if(n===2)dim=true;else if(n===22)bold=dim=false;
else if(n===39)fg=null;else if(n===49)bg=null;else if(n===38&&p[i+1]===2){fg='rgb('+p[i+2]+','+p[i+3]+','+p[i+4]+')';i+=4}else if(n===48&&p[i+1]===2){bg='rgb('+p[i+2]+','+p[i+3]+','+p[i+4]+')';i+=4}}}
function feed(vt){let i=0;while(i<vt.length){
if(vt[i]!=='\\x1b'){const cp=vt.codePointAt(i);put(String.fromCodePoint(cp));i+=cp>0xffff?2:1;continue}
if(vt[i+1]==='['){let j=i+2;while(j<vt.length&&!/[A-Za-z]/.test(vt[j]))j++;const params=vt.slice(i+2,j),fin=vt[j];
if(fin==='H'){const[pr,pc]=params.split(';');r=Math.min(Math.max(+(pr||1),1),ROWS);c=Math.min(Math.max(+(pc||1),1),COLS)}
else if(fin==='J'){for(let y=1;y<=ROWS;y++)for(let x=1;x<=COLS;x++)screen[y][x]=null}
else if(fin==='K'){for(let x=c;x<=COLS;x++)screen[r][x]=null}
else if(fin==='m')sgr(params);i=j+1}else i+=2}}
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
function render(){let body='';for(let y=1;y<=ROWS;y++){let line='';
for(let x=1;x<=COLS;x++){const cl=screen[y][x];if(!cl){line+='<span class="e"> </span>';continue}
const st=(cl.fg?'color:'+cl.fg+';':'')+(cl.bg?'background:'+cl.bg+';':'')+(cl.bold?'font-weight:700;':'')+(cl.dim?'opacity:.55;':'')
if(cl.w===2)line+='<span class="w" style="'+st+'">'+esc(cl.ch)+'</span>'
else if(cl.ch===' ')line+='<span class="e" style="'+st+'"> </span>'
else line+='<span style="'+st+'">'+esc(cl.ch)+'</span>'}
body+='<div class="row">'+line+'</div>'}
document.getElementById('t').innerHTML=body}
for(const [t,s] of events)setTimeout(()=>{feed(s);render()},Math.round(t*1000/SPEED))
render()
<\/script></body></html>`

fs.mkdirSync(path.join(ROOT, 'build/gif-frames'), { recursive: true })
fs.writeFileSync(path.join(ROOT, 'build/player.html'), player)
console.log('wrote build/player.html')

const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const framesDir = path.join(ROOT, 'build/gif-frames')
for (const f of fs.readdirSync(framesDir)) fs.unlinkSync(path.join(framesDir, f))
let n = 0
for (let t = 0; t <= total + 0.01; t += STEP) {
  n++
  const out = path.join(framesDir, 'f' + String(n).padStart(3, '0') + '.png')
  execFileSync(edge, ['--headless=new', '--disable-gpu', '--hide-scrollbars',
    `--screenshot=${out}`, '--window-size=860,640', `--virtual-time-budget=${Math.round(t * 1000 + 400)}`,
    'file:///' + path.join(ROOT, 'build/player.html').replaceAll('\\', '/')], { stdio: 'ignore' })
  process.stdout.write(`\rframe ${n}/${Math.floor(total / STEP) + 1} @${t.toFixed(1)}s`)
}
console.log(`\n${n} frames captured`)
execFileSync('ffmpeg', ['-y', '-framerate', String(FPS), '-i', path.join(framesDir, 'f%03d.png'),
  '-vf', 'split[s0][s1];[s0]palettegen=max_colors=48:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle',
  path.join(ROOT, 'docs/assets/demo.gif')], { stdio: 'inherit' })
console.log('wrote docs/assets/demo.gif')
