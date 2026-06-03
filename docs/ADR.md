# ADR

本文件由 `scripts/update-project-docs.mjs` 生成,记录当前项目已经采用的架构决策。

## ADR-001: 最终产物保持为静态 HTML

最终交付仍是 `index.html`、`assets/vendor/gsap.min.js` 和图片资源。React 只作为生成层使用,不进入浏览器运行时。

## ADR-002: 可变部分只保留必要登记项

当前生成入口只登记页面布局和浅色/深色主题。已删除 `designVariant`、字体、字号、字重、风格、开发者模式和场景库主题。Agent 不直接手写自由 HTML 页面。

## ADR-003: 模板负责浏览器运行时

`assets/template-swiss.html` 负责 CSS 视觉系统、Shader 背景、翻页、导航、预览控制器和 GSAP 动效入口。React 组件只生成注入到 `#deck` 内的 slide markup。

## ADR-004: 输出目录是生成物

`output/` 用于 demo、验证 deck 和截图产物,已加入 `.gitignore`,不作为源码提交。

## ADR-005: 提交前同步项目文档

`.githooks/pre-commit` 会运行 `scripts/update-project-docs.mjs`,并 stage `README.md`、`docs/ADR.md`、`docs/project-files.md`。

## ADR-006: 导入布局按页登记

`src/components/theme-pages/` 存放当前对外登记的 79 个逻辑页薄包装。`src/options.jsx` 当前只登记 `page01` 到 `page74`、`page76` 到 `page80`;旧的 `bt`、`report`、`xhs`、`xhs2`、`xhs3`、`style1`、`style2` layout key 只作为别名映射到对应逻辑页。

## ADR-007: 新布局继续按文件拆分

后续每个页面布局仍然独立成一个 JSX 文件。共享能力优先复用 `src/components/shell/`、`text/`、`media/`、`metrics/`、`charts/`、`timelines/`、`cards/`、`decorations/`、`diagrams/`。

## ADR-008: 提交前刷新全布局总览

`.githooks/pre-commit` 会运行 `npm run showcase:update`。showcase 需要同步覆盖全部已登记逻辑页,当前覆盖 79 个逻辑页。

## ADR-009: 旧布局参考资料保留为历史参考

原项目 Style A / Style B 的参考资料仍在 `references/`,用于追溯历史设计来源;不再保留内置浅色背景图片素材。

## ADR-010: 生成底座继续保留

`assets/template-swiss.html`、`src/renderDeck.jsx` 和基础组件目录继续保留,用于承载当前布局池和后续新布局。

## ADR-011: 颜色和字体细节回到布局自身

颜色、字体、字号和字重不再通过全局 token 或控制面板选择。后续新增主题如果拥有独立版式,应作为新的布局/主题实现明确登记,不要通过旧 token 系统改皮肤。

## ADR-012: demo 覆盖布局穷举和保留的运行时切换

`examples/component-decks/all-layouts-showcase.jsx` 当前按顺序渲染全部已登记布局。预览控制器只保留浅色/深色主题、Shader 背景、图表、动画和导出相关控制。

## ADR-013: 用户目标通过 JSON 计划组合组件

`src/deckComposer.jsx` 将用户目标 JSON 计划映射为已登记布局组件。`scripts/render-goal-deck.jsx` 负责把计划渲染为最终静态 HTML。Agent 调用 skill 时应优先生成目标计划,再运行 `npm run render:goal`。

## ADR-014: 场景库主题已删除

`scene` / `aikido` 主题入口和 Aikido 组件已删除。当前对外主题只有 `dark` 和 `light`;Shader 背景作为布局内部视觉能力保留。

## ADR-015: 预览页支持局部内容替换

静态预览页允许用户替换媒体、切换 Shader 背景、切换图表和切换图标。文本内容由生成期 ViewModel 写入,默认预览状态不提供页面内文字编辑。

## ADR-016: 文案与组合逻辑进入 ViewModel

`slide(layoutKey, props)` 不再直接返回 React element,而是返回 slide model。`src/view-model/` 负责把 deck model 解析为 slide view model、页面顺序和运行时状态。`src/renderDeck.jsx` 只消费 Deck ViewModel 渲染组件;浏览器端 `deck-view-model` 负责保存页面排序、媒体替换、Shader 背景和图表选择。

## ADR-017: VM 文案 key 不依赖页面顺序

文本覆盖统一使用 `text:<slideKey>:<slot>`。默认 `slideKey` 是 layout key,只有同一个 deck 内重复使用相同布局时才追加出现序号;运行时按单页局部序号生成 slot,不要使用全局递增序号或当前页码。这样拖拽排序、增删前置页面、导出 HTML/PDF/PPTX 时,文案仍能命中同一个布局页面。
