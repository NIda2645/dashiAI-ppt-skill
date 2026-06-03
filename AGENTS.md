# Project Memory

## 布局组件组织

- 页面布局组件必须各自独立:一个布局一个 JSX 文件。当前黑科技技能分享布局放在 `src/components/blacktech/`。
- 当前已删除 `src/tokens/`、`designVariant`、字体、字号、字重、风格和开发者模式选项;不要再新增这些旧入口。
- 当前 `theme` 只保留 `dark` 和 `light`,用于选择浅色/深色预览基线;颜色细节留在各布局自身 CSS 中。
- `layout-sandbox` 分支已删除旧 layout preset;新布局从 `src/components/blacktech/` 和 `LAYOUT_OPTIONS` 继续添加。
- 可组合基础组件按职责放在 `src/components/shell/`、`text/`、`media/`、`metrics/`、`charts/`、`timelines/`、`cards/`、`decorations/`、`diagrams/`。具体 deck 风格目录只保留 layout preset。
- 对应布局目录的 `primitives.jsx` 只做兼容薄封装,优先复用上面的分类组件。
- 新增布局时,先新增独立组件文件,再从对应目录的 `index.jsx` 导出,最后登记到 `src/options.jsx` 的 `LAYOUT_OPTIONS`。
- 不要把多个页面布局重新合并到一个大组件文件里。
- 场景库主题及其 Aikido 源设计组件已删除;不要再登记或恢复 `scene` / `aikido` 主题和组件。
- 当前对外布局池只有 `page01` 到 `page74`、`page76` 到 `page80`。旧的 `bt`、`report`、`xhs`、`xhs2`、`xhs3`、`style1`、`style2` layout key 只能作为别名映射到对应逻辑页。
- 当前黑科技技能分享布局使用 `bt01` 到 `bt12`,输出 `data-layout="BT01"` 到 `BT12`。
- VM 文案 ID 必须稳定,不能依赖页码、排序或全局序号。文本覆盖统一使用 `text:<slideKey>:<slot>`;默认 `slideKey` 是 layout key,重复布局才追加页内出现序号。浏览器运行时也必须按页内计数生成文本 slot,确保拖拽排序、增删页面和导出 HTML/PDF/PPTX 后仍能命中。
- 每次提交前必须刷新全布局总览:`npm run showcase:update` 会检查 `all-layouts-showcase.jsx` 覆盖全部已登记布局,并重生成当前 demo HTML。
