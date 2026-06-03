import { DEFAULT_THEME, slide } from './options.jsx';

export const ROLE_LAYOUTS = {
  cover: 'page01',
  statement: 'page02',
  context: 'page03',
  process: 'page04',
  breakdown: 'page05',
  metrics: 'page06',
  transition: 'page07',
  result: 'page08',
  risks: 'page09',
  observation: 'page10',
  actions: 'page11',
  closing: 'page12',
};

export function composeDeck(spec = {}) {
  const goal = spec.goal || spec.title || '主题汇报';
  const title = spec.title || goal;
  const sourceSlides = spec.slides?.length ? spec.slides : defaultSlides({ ...spec, goal, title, randomSeed: spec.randomSeed });
  const theme = normalizeTheme(spec.theme) || inferTheme(goal);
  const slides = sourceSlides
    .map(composeSlide);

  return {
    theme: theme || DEFAULT_THEME,
    title,
    text: spec.text || {},
    media: spec.media || {},
    chart: spec.chart || {},
    icon: spec.icon || {},
    shader: spec.shader || {},
    slides,
  };
}

function composeSlide(page) {
  if (typeof page === 'string') return slide(page, {});
  const layout = page.layout || ROLE_LAYOUTS[page.role];
  if (!layout) {
    throw new Error(`Unknown slide role "${page.role}". Use layout directly or choose one of: ${Object.keys(ROLE_LAYOUTS).join(', ')}`);
  }
  return {
    ...slide(layout, page.props || {}),
    id: page.id,
    key: page.key || page.slideKey,
    logicalIndex: page.logicalIndex,
    copy: page.copy,
    media: page.media,
    chart: page.chart,
    icon: page.icon,
    shader: page.shader,
  };
}

function normalizeTheme(theme) {
  if (theme === 'light' || theme === 'dark') return theme;
  return null;
}

function inferTheme(goal) {
  if (/(浅色|白底|明亮|教育|培训|品牌|发布|上市|营销|活动|多色|彩色|色彩丰富)/.test(goal)) return 'light';
  return 'dark';
}

function defaultSlides({ title, goal, audience = '目标受众', owner = '项目团队', randomSeed }) {
  const random = createRandom(randomSeed || `${title}|${goal}|${audience}|${owner}|${Date.now()}`);
  const pick = (items) => items[Math.floor(random() * items.length)];
  const contextSlide = pick([
    {
      role: 'context',
      props: {
        accent: '背景与现状',
        figureTitle: ['关键背景', '与当前状态'],
        title: ['先建立共识，', '再进入方案。'],
        body: [`围绕“${goal}”补充必要背景，说明为什么现在需要讨论这件事。`, '左侧图片位可由用户在预览页替换。'],
        captions: [['Context', '背景'], ['Signal', '信号'], ['Question', '问题']],
      },
    },
    {
      role: 'breakdown',
      props: {
        accent: '结构拆解',
        title: '把主题拆成四个可判断的部分。',
        items: [
          ['1.', '目标', '确认最终要解决的问题和验收口径。'],
          ['2.', '受众', `围绕${audience}组织信息层级。`],
          ['3.', '证据', '用数据、案例或现场材料支撑判断。'],
          ['4.', '动作', '把结论落到负责人和下一步。'],
        ],
      },
    },
  ]);
  const middleSlide = pick([
    {
      role: 'process',
      props: {
        accent: '推进路径',
        title: '用四步拆解目标。',
        stages: [
          ['STEP 01', '目标定义', '明确最终要达成什么。\n统一判断标准。'],
          ['STEP 02', '现状盘点', '整理已有基础和约束。\n识别关键缺口。'],
          ['STEP 03', '方案组合', '选择可执行动作。\n形成优先级。'],
          ['STEP 04', '交付结果', '沉淀呈现材料。\n进入评审或交付。'],
        ],
      },
    },
    {
      role: 'risks',
      props: {
        accent: '风险边界',
        title: '先把不确定性摆到台面上。',
        cases: [
          ['01', '信息过载', '内容堆叠过多，主判断被稀释。'],
          ['02', '证据不足', '结论缺少数据、案例或现场材料。'],
          ['03', '动作模糊', '没有明确 owner、时点和验收方式。'],
        ],
      },
    },
    {
      role: 'result',
      props: {
        accent: '结果摘要',
        percent: String(70 + Math.floor(random() * 25)),
        subtitle: '当前方案已经具备进入评审的基本结构。',
      },
    },
  ]);
  const evidenceSlide = pick([
    {
      role: 'metrics',
      props: {
        accent: '关键指标',
        title: '用指标支撑判断。',
        chartRows: [
          ['目标清晰度', 92, 'focus'],
          ['信息完整度', 78],
          ['执行确定性', 66],
          ['风险可控度', 58],
        ],
      },
    },
    {
      role: 'observation',
      props: {
        accent: '观察结论',
        titleTop: '最重要的不是更多信息',
        titleSuffix: '。',
        body: ['关键是把复杂内容压缩成清晰选择。', '让听众知道要判断什么、相信什么、下一步做什么。'],
      },
    },
  ]);
  const maybeTransition = random() > 0.55 ? [{
    role: 'transition',
    props: {
      eyebrow: 'SECTION',
      title: '进入行动层。',
    },
  }] : [];

  return [
    {
      role: 'cover',
      props: {
        titleTop: title.slice(0, 12),
        titleAlt: pick(['目标', '方案', '复盘', '提案']),
        titleBottom: pick(['呈现', '汇报', '简报', '说明']),
        captions: [['Goal', goal], ['Audience', audience], ['Owner', owner]],
      },
    },
    {
      role: 'statement',
      props: {
        accent: pick(['核心判断', '关键主张', '汇报结论']),
        quote: pick([
          [`${goal}`, '需要被压缩成一条清晰主线。'],
          ['先让听众理解为什么，', '再让他们相信怎么做。'],
          ['信息不是越多越好，', '关键是形成可执行判断。'],
        ]),
        body: [`面向${audience}，这份 deck 会优先呈现目标、依据、关键动作和下一步。`, '每一页只承载一个主要信息角色。'],
        strong: '目标、依据、关键动作和下一步',
      },
    },
    contextSlide,
    middleSlide,
    evidenceSlide,
    ...maybeTransition,
    {
      role: 'actions',
      props: {
        accent: '行动建议',
        title: '一个重点，三个支撑动作。',
        apps: [
          ['01', '先定主线', '把复杂目标压缩成一句可复述的核心判断。', true],
          ['02', '补齐证据', '为每个判断准备数据、案例或现场材料。'],
          ['03', '明确取舍', '删掉不服务主线的内容，避免页面失焦。'],
          ['04', '交付版本', '导出静态 HTML，作为最终可打开的呈现页面。'],
        ],
      },
    },
    {
      role: 'closing',
      props: {
        titleTop: pick(['最终', '下一步', '现在']),
        titleAlt: pick(['交付', '确认', '推进']),
        titleMiddle: pick(['静态', '可编辑', '可复用']),
        titleBottom: pick(['页面', '版本', '结果']),
        body: ['下一步可以替换图片、调整主题字体，', '再导出 index.html。'],
        inline: 'index.html',
      },
    },
  ];
}

function createRandom(seed) {
  let value = 2166136261;
  for (const char of String(seed)) {
    value ^= char.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return () => {
    value += 0x6D2B79F5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}
