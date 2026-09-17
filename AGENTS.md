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
  （洗澡 clean+45 且 饱腹-6/口渴-6；玩耍 心情+28 但 精力-15/饱腹-4/口渴-6/洁净-5）
- 文案：ACHIEVEMENTS、CHAT_POOL/CHAT_COND、DEATHS、act() 内气泡
- 猜拳动画：rpsThrow 只算分并设 S.rps.reveal={me,pet,res,final,at}；三相位渲染在
  renderRps/renderRpsReveal（晃拳 0-1s→亮牌 1-2.8s→终局屏 2.8-4.8s）；相位推进挂在
  1s 逻辑 tick（真实时钟不随 --fast）；终局结算统一在 finishRps()；手势图 HAND_ART×
  drawHand()；揭示期锁出招（1/2/3 无效，仅 q）
- 渲染：render/renderEggSelect/renderRps/renderStats/renderHelp；排版必须用 dispW/sliceW
  （CJK 宽度安全），禁止裸 .length 布局；renderStats 头部逐段装填（预算不足整段丢弃，
  防"· 1"半截残片）；猜拳立绘顶行 5（art 5-16 恒让 hint row17）
- 存档字段名：bornAt/hatchedAt/diedAt/deathCause/lastSeen
  （曾因误写 born 导致"存活 20707 天"寿终 bug）

## 验证流程（提交前全过）
1. node --check pet.mjs
2. node scripts/scan.mjs —— 23 场景 VT 回归扫描（越界/同行互写/marker 缺失）全绿
3. node pet.mjs --fast 全流程玩一遍
4. PET_WIDTH=59 窄屏冒烟（59 列接近最小宽度红线，窄面板是常见形态）
5. UI 改动 → 重截截图（管线见下）；用多模态视觉审查子代理核对（主会话模型无图像输入，
   派 ui-reviewer 走查）

## 截图/动图管线
- scripts/capture.mjs：脚本化驱动真实运行（自动备份/恢复 state.json；段末先 'q' 优雅
  退出再兜底 kill；seg.rnd 固定 Math.random 确定性回放；seg.hard=硬杀截相位帧、
  cast: false=不进 demo.cast）
- scripts/vt2html.mjs：VT→HTML（CLI：in out [cols rows]）；Edge headless --screenshot 截 PNG
- scripts/make-demo.mjs：cast→确定性回放页→逐帧截图→ffmpeg 合 demo.gif
- scripts/scan.mjs：无头驱动+VT 回放虚拟网格+越界/同行互写/marker 检查；--only= 过滤；
  dump 到 build/scan/。盲区：像素画是彩色背景空格（丢色不可见），立绘行互踩只能靠截图
  视觉审查；i18n 后 marker 需补英文

## 已知坑位（2026-09-12 v0.2.0 开发期实测）
- 布局同行互写：at() 全清重绘看不见"行冲突"——窄屏按钮行上移后与 row21 日志行互踩出
  "颗小"残片；溢出扫描器测不到同行互写。挪行/新面板前先对行占用表（数值区 17-19/角标
  20/日志 21/按钮 22-24）
- Edge headless --screenshot：反斜杠 file URL 静默不生效（批量截图全空转），必须正斜杠
  file:///D:/... 且每张间隔 ≥500ms；验真用 git hash-object 对比 HEAD
- VT 流截末帧：kill 硬杀的最后一帧不完整 → 截图后视觉审查误报"UI 缺失"；驱动器应先
  stdin 写 'q' 优雅退出再兜底 kill
- ANSI 码不能进 sliceW：样式前缀计入宽度预算会把文案截空；截断只对可见文本做、样式外置
- PowerShell：`&&` 后不能跟 `foreach`/赋值语句（ParserError），用 `;` 分隔
- node -e 注入：`-e` 与脚本路径参数互斥（`node -e script.js` 把文件名当代码执行；
  尾随参数还会被 node 当选项吞掉报 bad option）——注入随机种子用
  `node -e "Math.random=()=>0.7;import('file:///.../pet.mjs')"`，别再带 --fast
- 中文经 pwsh 命令行传参会乱码：内容校验用 node -e + \u 转义（注意字形相近的码点，
  如 饿=\u997f、饱=\u9971，打错会静默搜空）
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
- v0.2.1 ✅（2026-09-17）：走测反馈修复
  - 洗澡代价：饱腹-6/口渴-6（热水澡符合直觉；CD 10 分钟、双 0 才致死，无死线压力）
  - 猜拳三相位揭示动画（晃拳→亮牌胜抬败暗→终局屏 2s）；顺带修 dragon 成年立绘与
    hint 行重叠、夜间星星打穿猜拳立绘、renderStats 头部"· 1"截断残段
  - scripts/scan.mjs 回归扫描器固化（23 场景）；素材全量重录（6 PNG + demo.gif）
- v0.3.0：i18n 英文（issue #1：MSG 目录 + t() + PET_LANG + L 键切换 + 首启按系统语言
  检测；deathCause 中文串→key 需 SAVE_VERSION 3 迁移；README.md 保持英文默认）
- v0.4.0：新物种 ×2

## 接续指引（2026-09-17 v0.2.1 收工交接）
- 现状：v0.2.1 已发版（洗澡代价+猜拳揭示动画+扫描器+素材重录）；素材经两轮多模态
  视觉审查放行
- 遗留 P2 打磨（视觉审查提出，未做）：选蛋界面下半屏留白、帮助面板底注空档（原有
  backlog）、help 键位列"1"字形 webfont 观感
- 其他终端接续：`git pull` → 读本文件 → `/start-day` 盘点 → 下一步 v0.3.0 i18n
  （注意：scan.mjs 的 marker 是中文，i18n 后要补英文对照）
