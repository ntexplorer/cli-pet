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
- 渲染：render/renderEggSelect/renderRps/renderStats；排版必须用 dispW/sliceW
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

## 发布
- 验证过 → push main → tag vX.Y.Z → GitHub Actions 自动建 Release（附 pet.mjs/双 README）
- CI：node --check + 无头启动冒烟（ubuntu/windows × node 18/20）

## 路线图
- v0.1.0 ✅（2026-09-11）
- v0.2.0（方案已批，待实现）：`?` 帮助界面（复用 stats 面板机械，Tab/? 关闭，
  孵化后一次性提示气泡）+ 存档迁移链（version→2 + MIGRATIONS）+ dogfood 修复
- v0.3.0：i18n 英文（issue #1：MSG 目录 + t() + PET_LANG）
- v0.4.0：新物种 ×2
