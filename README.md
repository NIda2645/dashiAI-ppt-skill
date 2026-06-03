# Dashi PPT Skill

一个用**登记选项 + React 组件生成层**生成静态 HTML 横向翻页 PPT 的本地 skill。

最终产物仍是普通静态文件:

```text
output/my-deck/ppt/
├── index.html
├── assets/vendor/gsap.min.js
└── images/
```

浏览器直接打开 `index.html` 即可演示。React 不进入最终运行时。

## 核心思路

当前只保留两个可变入口:

- `theme`: `dark` 或 `light`
- 每一页: 从页面版式选项中选一个

页面版式登记在 [src/options.jsx](/Users/jadon7/Documents/SynologyDrive/code/项目研究/guizang-ppt-skill-main/src/options.jsx)。当前对外只有 `page01` 到 `page74`、`page76` 到 `page80` 这 79 个逻辑页。旧的 `bt`、`report`、`xhs`、`xhs2`、`xhs3`、`style1`、`style2` key 只是兼容别名,不再增加额外页面。

## 快速开始

```bash
npm install
npm run render:demo
npm run validate:swiss -- output/component-demo/ppt/index.html
```

渲染全部已登记布局总览:

```bash
npm run showcase:update
```

渲染指定 deck:

```bash
npm run render:deck -- examples/component-decks/all-layouts-showcase.jsx output/all-layouts/ppt/index.html
```

按用户目标渲染组件组合 deck:

```bash
npm run render:goal -- examples/goal-decks/annual-review.json output/goal-demo/ppt/index.html
```

渲染当前默认 demo:

```bash
npm run render:examples
```

## 示例 Deck

| 文件 | 内容主题 | 选项特点 |
|---|---|---|
| `examples/goal-decks/annual-review.json` | 年度经营复盘目标计划 | 由 `render:goal` 根据 role/layout + props 组合组件 |
| `examples/component-decks/all-layouts-showcase.jsx` | 全部布局总览 | 顺序展示当前全部已登记布局 |
| `examples/goal-decks/portfolio.json` | 个人作品集 | 由 `render:goal` 根据用户目标组合组件 |

## 当前选项

主题:

- `light`: 浅色背景
- `dark`: 深色背景

页面版式:

- `page01` 到 `page74`、`page76` 到 `page80`: 当前完整逻辑页组件池

兼容别名:

- `bt01` 到 `bt12`、`rp01` 等旧 layout key 会映射到对应 `pageXX`

## 项目结构

```text
assets/
  unicorn/
  template-swiss.html
src/
  options.jsx
  renderDeck.jsx
  components/
    theme-pages/
    shell/
    text/
    media/
    metrics/
    charts/
    timelines/
    cards/
    decorations/
    diagrams/
    blacktech/
    report/
    xhs/
    xhs2/
    xhs3/
    style1/
    style2/
scripts/
  render-deck.jsx
  validate-swiss-deck.mjs
examples/component-decks/
references/
  component-workflow.md
  themes.md
  layouts.md
  themes-swiss.md
  swiss-layout-lock.md
  layouts-swiss.md
  swiss-map-component.md
  image-prompts.md
  screenshot-framing.md
  checklist.md
```

## 验证方式

```bash
npm test
npm run render:goal -- examples/goal-decks/annual-review.json output/goal-demo/ppt/index.html
npm run validate:swiss -- output/goal-demo/ppt/index.html
```

多个 subagent 做测试时,不要只换配色。每个测试 deck 应该换内容主题、风格要求和页面组合,再比较呈现结果。

<!-- project-docs:start -->
## 项目文档

以下文档由 `npm run docs:update` 同步,提交前也会由 `.githooks/pre-commit` 自动更新。

提交前 hook 还会运行 `npm run showcase:update`,确保 `all-layouts-showcase.jsx` 覆盖当前全部已登记布局,并刷新 `output/all-components-showcase/ppt/index.html`。

- [ADR](docs/ADR.md): 当前架构决策记录
- [项目文件作用说明](docs/project-files.md): 当前 272 个源码文件的主要作用
<!-- project-docs:end -->
