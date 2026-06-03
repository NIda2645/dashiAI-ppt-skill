# 组件选项工作流

本项目采用选项注册表生成 PPT。目标是让 Agent 在明确边界内组合,而不是手写长 HTML。

## 注册表

页面版式登记在 `src/options.jsx`:

- `THEME_OPTIONS`: 只保留 `dark` / `light`,用于选择浅色或深色预览基线
- `LAYOUT_OPTIONS`: 页级版式,每页从中选一个

## Deck 配置

```jsx
import React from 'react';
import { slide } from '../../src/options.jsx';

export default {
  theme: 'dark',
  title: 'Deck 标题',
  slides: [
    slide('page01', {
      title: '封面标题',
      kicker: 'SECTION LABEL',
      lead: '一段副标题。',
    }),
    slide('page02', {
      page: '02 / 05',
      title: '正文标题',
      kicker: 'FLOW',
      nodes: [],
      metrics: [],
    }),
  ],
};
```

## 生成命令

```bash
npm run render:deck -- examples/component-decks/ai-ops-review.jsx output/ai-ops/ppt/index.html
npm run validate:swiss -- output/ai-ops/ppt/index.html
npm run showcase:update
```

## 新增选项

新增版式:

1. 按一个布局一个文件在对应组件目录写组件。
2. 组件输出合法 `data-layout`。
3. 从对应目录的 `index.jsx` 导出。
4. 在 `LAYOUT_OPTIONS` 登记 key。
5. 必要时更新 `scripts/validate-swiss-deck.mjs`。

新增基础组件:

1. 按职责放入 `src/components/shell/`、`text/`、`media/`、`metrics/`、`charts/`、`timelines/`、`cards/`、`decorations/` 或 `diagrams/`。
2. 从该目录 `index.jsx` 导出。
3. 布局 preset 通过对应目录的 `primitives.jsx` 或直接 import 复用,不要复制一份同类实现。

当前对外布局池只有 `page01` 到 `page74`、`page76` 到 `page80`。旧的 `bt`、`report`、`xhs`、`xhs2`、`xhs3`、`style1`、`style2` layout key 只作为兼容别名。

历史 Style A / Swiss 参考资料仍保留在 `references/`,只作为追溯来源。新增布局以当前 `pageXX` 登记方式为准;涉及图片或截图时读 `image-prompts.md` 和 `screenshot-framing.md`。

## Subagent 测试

测试不能只换颜色。每个 subagent 需要生成不同内容主题和页面组合:

- AI/技术复盘:偏流程、指标、风险、行动页
- 城市/生态报告:偏图片、地图感、观察、总结页
- 零售/消费简报:偏排行榜、指标、对比、应用页
- 全量布局回归:运行 `npm run showcase:update`,检查 `output/all-components-showcase/ppt/index.html` 覆盖全部已登记逻辑页

比较结果时看:

- 内容是否匹配所选版式
- 页面组合是否有节奏,而不是只是换色
