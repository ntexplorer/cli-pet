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
  （洗澡 clean+45 且 饱腹-6/口渴-6；玩耍 心情+28 但 精力-15/饱腹-4/口渴-6/洁净-5，且
  燃脂 -0.1/次 + 运动热度叠层）；生病两来源 sickType：dirty=洁净<25 持续 1h ·
  upset=饱腹≥40 仍投喂（喂食/零食共用 feedLog）滚动 1h 第 3 次（闹肚子仅吃药可治，dose 治一切）
- 死线：单零直死（thirstSince/hungerSince 归零起 2h →"饥饿与干渴"，zeroSince 起算响铃一次）+
  六条计时 heartSince/sickSince/obeseSince/exhaustSince/thirstSince/hungerSince；双 0 →
  弥留 DYING_GRACE_H=1h（全衰竭 ÷4）；弥留期死线照走取 min（参差双零不比单零死得慢）；
  五维血条 <25 变红（bar() 第 5 参 low，0 格时数字染红兜底）
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
2. node scripts/scan.mjs —— 27 场景 VT 回归扫描（越界/同行互写/marker 缺失）全绿
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
- （2026-09-21 追加）Edge --screenshot 输出路径必须绝对路径：相对路径静默不落盘、
  无任何报错——验真看 PNG LastWriteTime 是否为当前时刻，别信命令退出码
- （2026-09-21 追加）游玩副本 https 远端可能连不上（SSH 正常）：等价升级 =
  `git pull <开发仓路径> main` + `git fetch --tags <开发仓路径>`（同源同 SHA）
- （2026-09-21 追加）FX 粒子/浮动元素行守卫：clamp 到 ≥3 行而非 skip——skip 会把整个
  动画抹没（artTop=4 时 from:-4 算出 0-2 行全被跳过，GIF 里粒子直接消失）

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
- v0.2.2 ✅（2026-09-21）：第二轮走测修复
  - 撑死救赎：玩耍燃脂 -0.2/次 + 运动热度（10 分钟内连玩叠 1 层至多 3 层，体重衰减
    +0.1×层/h，停玩 20 分钟恢复，🔥 角标）；过胖死线首触气泡指引。死线数值未动
  - 生病重构（SAVE_VERSION 3，MIGRATIONS[2]: 旧 sickSince→dirty）：三来源=脏病
    （洁净 15→25、2h→1h 放宽）+ 着凉（洁净<30 每 h 20% 掷骰）+ 闹肚子（滚动 1h 第
    3 次零食，仅吃药可治）；dose 从"治标"改为"治一切"，README×2 同步
  - 猜拳比分防剧透（reveal 暂存 prev 比分，晃拳期冻结、亮牌同步）；主界面角标加
    文字标签（🏆 成就 · 🪦 纪念，热区宽度随文案）；FX 粒子行守卫 ≥3 行（修打穿
    标题"存活x天"）；比分冒号紧凑化（N:N）；scan 新增 sick-upset/obese-rescue 共 25 场景
- v0.2.3 ✅（2026-10-07）：第三轮走测修复
  - 渴死/饿死：口渴或饱腹单项归零起 2h 直死"饥饿与干渴"（原双 0 才进弥留、单渴归零无
    报警）；归零瞬间 zeroSince 响铃+气泡一次、💧/🍚 角标倒计时、五维血条 <25 变红
  - 弥留 4h→1h（全衰竭 ÷4=15min，消除"单零 2h 比双零 4h 死得慢"倒挂）
  - 删着凉（sickType 只剩 dirty/upset）：原洁净<30 掷骰窗口被洗澡习惯物理封死，玩家
    不可见；闹肚子 v2：feedLog 喂食/零食共用、饱腹≥40 才计数（救命/回应乞食豁免，
    修"归来连喂三口必病"），第 3 次必中
  - 燃脂 -0.2→-0.1/次（零食 +0.25 vs 燃脂 -0.1，贪嘴略胜懒惰；基础代谢 -0.1/h 不变）；
    scan 新增 zero-thirst；SAVE_VERSION 保持 3（新字段 defaultState 合并兜底）
  - 发版后对抗审查补修：参差双零倒挂（第二维归零落在首维 [1h,2h) 窗口时弥留 1h 使总命
    超单零 2h）→ recheckStage dying 分支死亡取 min(弥留期限, 最早死线)，死因随线；
    README×2 特性段"弥留 4 小时"残留改 1 小时；血条 0 格变红不可见 → 数字同步染红；
    scan 新增 stagger-zero（负向验证：旧代码 FAIL 确认场景真抓回归）共 27 场景
- v0.3.0：互动版（走测反馈"机制单薄，尤其互动"）：性格系统（黏人/活泼/贪吃三维由
  累计 stats÷存活天数派生，影响乞讨节流/RPS_TEND/摸摸反应/闲聊选池，跨代 ±15 漂移）·
  生物钟问候（13-14 午睡窗困倦气泡、22:30 睡前剧场池、每日首启晨间问候、归来按时长
  分档）· 画布生活感（投喂掉碎屑/便便实体至多 2、每实体洁净衰减 +3/h、洗澡顺带清扫）·
  离线小日记（归来 >30min 按时长分档"你不在时它做了什么"）· 家庭树页（renderStats
  世代链+死法图鉴对照）——每机制一个 feat(pet)+scan 场景；超时砍序：家庭树→日记
- v0.4.0：i18n 英文（issue #1：MSG 目录 + t() + PET_LANG + L 键切换 + 首启按系统语言
  检测；deathCause 中文串→key 需 SAVE_VERSION 4 迁移——3 已被 v0.2.2 sickType 占用；
  README.md 保持英文默认）；
  同版附带：版本号显示（VERSION 常量 + `--version` 打印即退 + 帮助面板角落显示，
  非交互 shell 误跑不再挂起）+ 双 clone 游玩 ritual 文档化（README×2：日常玩用
  独立 clone/发布件，升级=git pull；--save/--test 已论证不做，双 clone 即隔离）
- v0.5.0：新物种 ×2

## 接续指引（2026-10-07 v0.2.3 收工交接）
- 现状：v0.2.3 已实施完毕+发版后对抗审查补修（渴/饿单零死线、删着凉、闹肚子 v2
  饱腹≥40 计数、燃脂 -0.1、血条 <25 变红含 0 值数字染红、弥留 1h、参差双零取 min；
  pet.mjs/README×2/scan 27 场景/本文件同步）。SAVE_VERSION
  保持 3——feedLog/thirstSince/hungerSince 走 defaultState 合并兜底，旧档无感
- v0.3.0 互动版已批准（方案见路线图），5 机制各自独立提交（feat(pet)），scan 每机制
  加场景；性格系统的派生数据先只做展示（stats 页），行为影响逐步接入
- 走测观测项：零食是玩耍外主要心情渠道（+12、CD 5min），滚动 1h 第 3 次必病+吃药
  -20 心情，高频玩家可能陷入"病-药"循环——v0.3.0 期间观测发病率，超标再调
  （候选：病中零食心情收益减半/闹肚子只惩罚连续第 3 次）
- i18n 顺延为 v0.4.0：deathCause 迁移用 SAVE_VERSION 4（3 已占用）；v0.2.3 新增文案
  （渴/饿归零气泡、闹肚子新文案）连同 v0.2.2 的（燃脂/运动热度/角标标签）一起纳入清单
- 遗留 P2 打磨（视觉审查提出，未做）：选蛋界面下半屏留白、帮助面板底注空档、help
  键位列"1"字形 webfont 观感、墓碑态仍渲染全部互动按钮（应置灰/隐藏，仅 [f] 有效）
- 其他终端接续：`git pull` → 读本文件 → `/start-day` 盘点 → 下一步 v0.3.0 互动版
  （注意：scan.mjs 的 marker 是中文，i18n 后要补英文对照）
