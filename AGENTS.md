# AGENTS.md — cli-pet 开发指南（AI 协作会话请先读本文件）

## 项目铁律
- 单文件 pet.mjs、零依赖、零网络——任何功能不得引入库或联网
- 游戏内文案为简体中文（i18n 见 issue #1，v0.3 目标），语气"治愈不闹腾"
- README.md 与 README.zh-CN.md 必须同步修改
- Conventional commits；死亡判定/生病/离线托底数值是设计红线，改动需专门论证

## 数值设计哲学
- 25-30 分钟一件可做的事（工作日陪伴节奏）
- 离线安全：48h 衰减封顶、程序不跑不会死（尊重玩家的现实生活）
- 全生命周期：蛋→幼年→成年→暮年(21天)→六种死法；世代/成就/纪念墙跨代继承

## 代码地图（都在 pet.mjs）
- 物种/像素：SPECIES、ART.<species>（字符串数组=像素画，调色键见 PAL）、RPS_TEND
- 数值：DECAY（每小时衰减）、ACTIONS、CD（冷却，随 --fast 缩放）、拒绝阈值散在 act()
- 文案：ACHIEVEMENTS、CHAT_POOL/CHAT_COND、DEATHS、act() 内气泡
- 渲染：render/renderEggSelect/renderRps/renderStats/renderHelp；排版必须用 dispW/sliceW
  （CJK 宽度安全），禁止裸 .length 布局
- 存档字段名：bornAt/hatchedAt/diedAt/deathCause/lastSeen
  （曾因误写 born 导致"存活 20707 天"寿终 bug）

## 验证流程（提交前全过）
1. node --check pet.mjs
2. node pet.mjs --fast 全流程玩一遍
3. PET_WIDTH=59 窄屏冒烟（59 列接近最小宽度红线，窄面板是常见形态）
4. UI 改动 → 重截截图（管线见下）；可用多模态视觉审查核对

## 截图/动图管线
- scripts/capture.mjs：脚本化驱动真实运行（自动备份/恢复 state.json）
- scripts/vt2html.mjs：VT→HTML；Edge headless --screenshot 截 PNG
- scripts/make-demo.mjs：cast→确定性回放页→逐帧截图→ffmpeg 合 demo.gif

## 已知坑位（2026-09-12 v0.2.0 开发期实测）
- 布局同行互写：at() 全清重绘看不见"行冲突"——窄屏按钮行上移后与 row21 日志行互踩出
  "颗小"残片；溢出扫描器测不到同行互写。挪行/新面板前先对行占用表（数值区 17-19/角标
  20/日志 21/按钮 22-24）
- Edge headless --screenshot：反斜杠 file URL 静默不生效（批量截图全空转），必须正斜杠
  file:///D:/... 且每张间隔 ≥500ms；验真用 git hash-object 对比 HEAD
- VT 流截末帧：kill 硬杀的最后一帧不完整 → 截图后视觉审查误报"UI 缺失"；驱动器应先
  stdin 写 'q' 优雅退出再兜底 kill
- ANSI 码不能进 sliceW：样式前缀计入宽度预算会把文案截空；截断只对可见文本做、样式外置
- PowerShell：`&&` 后不能跟 `foreach` 语句块（ParserError），用 `;` 分隔
- 字符宽度口径：CJK=2/emoji=2（代理对按一码点）/U+00B7(·)=1，主流终端实测一致；
  冷门终端 East-Asian-Ambiguous 可能 ±1 格（按钮槽已留 +5 余量缓冲）

## 发布
- 验证过 → push main → tag vX.Y.Z → GitHub Actions 自动建 Release（附 pet.mjs/双 README）
- CI：node --check + 无头启动冒烟（ubuntu/windows × node 18/20）

## 路线图
- v0.1.0 ✅（2026-09-11）
- v0.2.0 ✅（2026-09-12）：
  - `?` 帮助界面、存档迁移链（SAVE_VERSION=2 + MIGRATIONS）、实测修复
    （G1–G10：宽屏截断/冷却抖动/改名误触/按钮越行/墓碑居中/热区宽度等）
  - 终端尺寸自适应：<58 列×25 行整屏守卫、<68 列窄档单字按钮（[f 饭]）、逐帧轮询兜底
  - 胖立绘重做：fatPlan 跨帧交集 + 主体色族门槛，边缘像素向外扩（三物种可见、中轴对称）
  - 后续改动存档结构时：SAVE_VERSION+1 并在 MIGRATIONS 挂增量函数
- v0.3.0：i18n 英文（issue #1：MSG 目录 + t() + PET_LANG）
- v0.4.0：新物种 ×2

## 接续指引（2026-09-12 收工交接）
- 现状：v0.2.0 已发版（tag + Release 产物齐、CI 绿）；用户次日起详细走测
- 其他终端接续：`git pull` → 读本文件 → `/start-day` 盘点 → 优先处理用户测试反馈
- 待办候选：v0.3.0 i18n（issue #1）；回归扫描器（19 场景 VT 溢出扫描，现为临时件
  `%TEMP%\opencode\scan.mjs`）视价值固化进 scripts/；可选打磨 P2（帮助面板底注、角标
  emoji 亮度）
