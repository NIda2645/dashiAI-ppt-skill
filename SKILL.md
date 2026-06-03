---
name: dashi-ppt-skill
description: 根据用户目标组合登记组件,生成可离线打开和导出的静态 HTML 横向翻页 PPT。
---

# 大师的AI小灶-PPT Skill

生成一份**静态 HTML 横向翻页 PPT**。React 只作为生成层使用;最终交付是 `index.html` + `assets/vendor/gsap.min.js`,浏览器直接打开即可。

## 使用目标

当用户调用这个 skill 时,不要只套一个固定 demo。应先理解用户目标,再组合已登记组件:

1. 提炼用户目标: `title`、`goal`、`audience`、`owner`。
2. 生成 `randomSeed`,并随机化页面节奏、布局来源和内容切分方式。
3. 选择全局选项: `theme`。当前只支持 `dark` / `light`。
4. 从 `page01` 到 `page74`、`page76` 到 `page80` 的逻辑页池按信息角色组合页面,不要把不同来源布局当成互相隔离的套装。
5. 为每个逻辑页填写 props;用户要求 10 页时,JSON 写 10 个逻辑页,最终 HTML 就是 10 个逻辑页。
6. 需要预置媒体、图表、图标、文本覆盖时写入同级字段。
7. 渲染 HTML,把本地预览地址给用户。

## 生成方式

优先使用 JSON 计划文件:

```bash
npm run render:goal -- examples/goal-decks/annual-review.json output/my-deck/ppt/index.html
npm run validate:swiss -- output/my-deck/ppt/index.html
```

JSON 计划结构:

```json
{
  "title": "2026 年度经营复盘",
  "goal": "面向管理层汇报全年经营结果、关键风险和下一年动作",
  "audience": "管理层 / 业务负责人",
  "owner": "战略与经营团队",
  "randomSeed": "annual-review-20260601-a7k",
  "theme": "dark",
  "slides": [
    {"role": "cover", "props": {"titleTop": "2026", "titleAlt": "年度", "titleBottom": "经营复盘"}},
    {"role": "statement", "props": {"accent": "年度判断", "quote": ["今年最重要的变化，", "是增长从规模驱动转向质量驱动。"]}},
    {"role": "closing", "props": {"titleTop": "下一年", "titleAlt": "继续", "titleMiddle": "高质量", "titleBottom": "增长"}}
  ]
}
```

如果 `slides` 为空,`src/deckComposer.jsx` 会根据 `goal` 和 `randomSeed` 生成一套默认页序。用户有明确目标时,Agent 应主动写 `slides`,不要依赖默认页序。

当前完整跑通的链路是:用户自然语言需求 -> Agent 写 JSON 计划 -> `npm run render:goal` -> `npm run validate:swiss` -> 本地预览 HTML。仓库本身不内置 LLM 选页器;“理解用户并选布局”由调用 skill 的 Agent 完成。

## 页面角色

`role` 会映射到当前登记布局:

| role | layout | 用途 |
|---|---|---|
| `cover` | `page01` | 封面 |
| `statement` | `page02` | 核心判断 / 大引用 |
| `context` | `page03` | 图片 + 背景解释 |
| `process` | `page04` | 四步骤流程 |
| `breakdown` | `page05` | 图片 + 四点拆解 |
| `metrics` | `page06` | 图片 + 指标图表 |
| `transition` | `page07` | 全屏背景转场 |
| `result` | `page08` | 大数字 + 表格 |
| `risks` | `page09` | 三栏风险 |
| `observation` | `page10` | 观察结论 |
| `actions` | `page11` | 重点行动卡片 |
| `closing` | `page12` | 收尾页 |

也可以直接用 `layout`,例如 `{"layout":"page08","props":{...}}`。旧的 `bt08` 仍会作为别名映射到 `page08`。

把 `page01` 到 `page74`、`page76` 到 `page80` 看成统一布局池。旧的 `bt`、`report`、`xhs`、`xhs2`、`xhs3`、`style1`、`style2` key 只是兼容别名。自动填字段优先使用 `page01`-`page12` 这套稳定参数化布局;需要视觉变化时可直接指定其它 `pageXX`,但同一 deck 内最多混合 2-3 个视觉家族。

信息量选择建议:

- 1 个核心判断: `statement`
- 2-3 段背景或配图说明: `context`
- 4 个步骤或模块: `process` / `breakdown`
- 3-5 个指标或对比项: `metrics` / `result`
- 3 个风险、边界或反例: `risks`
- 4 个行动、应用或结论卡片: `actions`
- 纯转场或章节分隔: `transition`

## 全局选项

主题:

- `light`: 浅色背景
- `dark`: 深色背景

## 图片替换与最终交付

生成后的预览页支持点击图片占位符替换本地图片。控制面板里的 `导出 HTML` 会下载一个新的 `index.html`,其中包含:

- 用户替换后的图片 data URL
- 当前主题和支持的媒体、图表、图标状态

这份导出的 HTML 不需要服务器,可以作为最终交付页面。

## 约束

- 不要手写自由 HTML slide,只使用 `role`/`layout` + props。
- 不要临时发明 theme/layout key;需要新增能力时先登记。
- 不要每次都生成同一套页面顺序;使用 `randomSeed` 记录本次随机组合。
- 不要按来源套装整组使用布局;从统一布局池按信息角色组合。
- 输出后必须运行 `validate:swiss`。
- 改动展示 demo 后运行 `npm run showcase:update`。
