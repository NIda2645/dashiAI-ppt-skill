// @ts-check
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MEDIA_ARRAY_KEYS,
  createLazyLayoutContracts,
  explicitNumberBoundsForArrayKey,
  isContractContentArray,
  isMediaArrayKey,
  isNonContentContractValue,
  isPrivateDefaultRoundTrip,
  isPrunedContractOmit,
  isSerializedReactElementLike,
  normalizeSlidePropsForContract,
  numberBoundsForArrayItems,
  pruneContractValue,
  reactElementText,
  validateNumberBounds,
} from '../src/prop-contract-core.mjs';
import {
  normalizePublicControls,
  resolvePublicPropAliases,
  toPublicProps,
} from '../src/control-naming.mjs';
import {
  GENERATED_THEME_PACKS,
  GENERATED_THEME_PAGES,
} from '../src/components/themes/generated-metadata.js';
import {
  filterAcceptedThemePacks,
  filterAcceptedThemePages,
} from '../src/accepted-themes.mjs';
import { getDecorativeKeys } from '../src/components/themes/decorative-overrides.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const THEME_PACKS = filterAcceptedThemePacks(GENERATED_THEME_PACKS);
export const THEME_PAGES = filterAcceptedThemePages(GENERATED_THEME_PAGES);

const ROLE_KEYWORDS = {
  cover: ['cover', '封面', '首页'],
  statement: ['statement', 'summary', 'overview', 'manifesto', 'quote', '摘要', '主张', '观点', '结论'],
  breakdown: ['contents', 'agenda', 'index', 'directory', '目录', '结构', '纲目'],
  transition: ['section', 'chapter', 'divider', '章节', '序章', '篇章'],
  context: ['market', 'method', 'context', 'industry', '全景', '背景', '方法', '行业'],
  metrics: ['metric', 'stat', 'number', 'score', 'gauge', 'meter', '指标', '数字', '大势', '仪表'],
  trend: ['trend', 'timeline', 'curve', 'area', 'slope', 'stream', '走势', '趋势', '时间', '曲线', '季度'],
  comparison: ['compare', 'versus', 'matrix', 'quadrant', 'delta', 'dumbbell', '对比', '矩阵', '象限', '差距'],
  distribution: ['donut', 'treemap', 'heatmap', 'ranking', 'rank', 'waterfall', 'funnel', 'allocation', 'share', '分布', '占比', '排行', '瀑布', '漏斗'],
  relationship: ['chain', 'flow', 'sankey', 'network', 'orbit', 'ecosystem', 'map', '关系', '链', '流向', '生态', '网络'],
  case: ['case', 'spotlight', 'profile', 'story', '案例', '聚焦', '档案'],
  image: ['image', 'gallery', 'mosaic', 'photo', 'film', 'album', 'poster', 'showcase', '影像', '图景', '图集', '图片', '海报'],
  process: ['process', 'roadmap', 'journey', 'steps', 'gantt', '路径', '流程', '路线', '进程'],
  risks: ['risk', 'faq', 'checklist', '风险', '异议', '问答', '清单'],
  observation: ['quote', 'insight', 'takeaway', 'conclusion', 'statement', 'manifesto', '观点', '洞察', '要点', '结论'],
  ambient: ['ambient', 'atmosphere', 'background', 'immersive', 'poster', 'hero', '氛围', '背景', '沉浸', '海报'],
  actions: ['action', 'roadmap', 'plan', 'join', 'contact', 'next', '行动', '策略', '计划', '套餐'],
  result: ['result', 'outcome', 'score', 'closing', 'conclusion', '成果', '结果', '完成', '结论'],
  team: ['team', 'roster', 'testimonial', 'voice', '团队', '人物', '见证', '证言'],
  closing: ['closing', 'contact', 'join', 'end', 'colophon', '结语', '封底', '行动'],
};

const ROLE_ALIASES = {
  agenda: 'breakdown',
  summary: 'statement',
  insight: 'observation',
  quote: 'observation',
  content: 'content',
  body: 'content',
  main: 'content',
  inner: 'content',
  interior: 'content',
  '正文': 'content',
  '内容': 'content',
  '主体': 'content',
  '内页': 'content',
  chart: 'metrics',
  data: 'metrics',
  timeline: 'trend',
  compare: 'comparison',
  flow: 'process',
  roadmap: 'actions',
  visual: 'image',
  gallery: 'image',
  media: 'image',
  picture: 'image',
  photo: 'image',
  atmosphere: 'ambient',
  background: 'ambient',
  dynamic: 'ambient',
};

const contracts = createLazyLayoutContracts(THEME_PAGES);
const pagesByKey = new Map(THEME_PAGES.map(page => [page.key, page]));
const themePacksByKey = new Map(THEME_PACKS.map(theme => [theme.key, theme]));
let manifestCache;
const getManifest = () => (manifestCache ??= readManifest());
const HOST_MEDIA_ARRAY_THEMES = new Set(['theme03', 'theme04', 'theme05', 'theme06', 'theme07', 'theme08', 'theme09', 'theme10']);
export const NEUTRAL_PLACEHOLDERS = ['请输入文本', '请输入', '请输'];

export function parseArgs(argv) {
  const args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith('--')) {
      args._.push(item);
      continue;
    }
    const key = item.slice(2);
    const next = argv[index + 1];
    if (next == null || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return args;
}

export function compactJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/** @param {import('../src/types').ListLayoutsOptions} [options] */
export function listLayouts({
  theme,
  role,
  keyword,
  needsMedia = false,
  plannedImages = false,
  providedImages = false,
  providedMedia = false,
  imageGen = false,
  needsVisual = false,
  mediaCount = null,
  mediaKind = null,
  requireInitialMedia = false,
  limit = 12,
} = {}) {
  const requestedRole = role ? String(role).trim().toLowerCase() : '';
  const normalizedRole = requestedRole ? ROLE_ALIASES[requestedRole] || requestedRole : '';
  const keywords = normalizedRole ? ROLE_KEYWORDS[normalizedRole] || [normalizedRole] : [];
  const keywordText = String(keyword || '').trim().toLowerCase();
  const requestedMediaCount = getRequestedMediaCount({ plannedImages, providedImages, providedMedia, imageGen, needsVisual, mediaCount });
  const normalizedMediaKind = normalizeMediaKind(mediaKind);
  const needsInitialMedia = Boolean(requireInitialMedia || providedImages || providedMedia);
  const requiresMedia = needsMedia || requestedMediaCount > 0 || normalizedRole === 'image' || needsInitialMedia || Boolean(normalizedMediaKind);

  const rows = listLayoutsForMediaCount({ theme, normalizedRole, keywords, keywordText, requiresMedia, requestedMediaCount, normalizedMediaKind, needsInitialMedia });
  return rows.slice(0, Math.max(1, Math.min(50, Number(limit) || 12)));
}

function listLayoutsForMediaCount({ theme, normalizedRole, keywords, keywordText, requiresMedia, requestedMediaCount, normalizedMediaKind, needsInitialMedia }) {
  const rows = THEME_PAGES
    .filter(page => !theme || page.themeKey === theme)
    .filter(page => {
      if (!normalizedRole) return true;
      if (normalizedRole === 'cover') return isCoverCandidate(page.key);
      if (normalizedRole === 'content') return isBodyContentCandidate(page);
      if (normalizedRole === 'image') return inspectLayout(page.key, { compact: true })?.mediaSlots.some(slot => slot.canPresetMedia);
      if (normalizedRole === 'ambient') return hasAmbientBackground(page);
      return pageMatches(page, keywords);
    })
    .filter(page => !keywordText || pageSearchText(page).includes(keywordText))
    .map(page => compactLayoutCandidate(inspectLayout(page.key, { compact: true })))
    .filter(Boolean)
    .filter(row => !requiresMedia || mediaSlotsCanFit(row.mediaSlots, requestedMediaCount || 1, { requireInitialMedia: true, mediaKind: normalizedMediaKind }))
    .filter(row => !requestedMediaCount || mediaSlotsCanFit(row.mediaSlots, requestedMediaCount, { requireInitialMedia: true, mediaKind: normalizedMediaKind }))
    .filter(row => !normalizedMediaKind || mediaSlotsCanFit(row.mediaSlots, requestedMediaCount || 1, { requireInitialMedia: true, mediaKind: normalizedMediaKind }));

  return rows.sort((a, b) => scoreLayout(b, { normalizedRole, keywordText, requiresMedia, requestedMediaCount, normalizedMediaKind, needsInitialMedia }) - scoreLayout(a, { normalizedRole, keywordText, requiresMedia, requestedMediaCount, normalizedMediaKind, needsInitialMedia }));
}

function compactLayoutCandidate(row) {
  if (!row) return row;
  const {
    copyBudgets,
    propShapes,
    fieldContracts,
    copyRoles,
    countBindings,
    defaultVisibleCounts,
    fillPlan,
    lengthBindings,
    themeDisplayName,
    themeScenario,
    themeAudience,
    ...candidate
  } = row;
  const copyKeys = (row.copyKeys || []).slice(0, 6);
  return {
    ...candidate,
    themeDisplayName,
    copyKeys,
    copyBudgets: compactCopyBudgets(row.copyBudgets, copyKeys),
    arrayMeta: (row.arrayMeta || []).map(compactCandidateArrayMeta),
    mediaSlots: (row.mediaSlots || []).map(compactQueryMediaSlot),
  };
}

function compactCopyBudgets(copyBudgets = {}, copyKeys = []) {
  return Object.fromEntries((copyKeys || [])
    .map(key => [key, copyBudgets?.[key]])
    .filter(([, budget]) => budget?.maxChars)
    .map(([key, budget]) => [key, { maxChars: budget.maxChars }]));
}

function compactCandidateArrayMeta(meta) {
  return {
    key: meta.key,
    role: meta.role,
    defaultVisibleCount: meta.defaultVisibleCount,
    maxCount: meta.maxCount,
    countKey: meta.countKey,
    maxFromKey: meta.maxFromKey,
    maxFromKeyOffset: meta.maxFromKeyOffset,
    maxByKey: meta.maxByKey,
    maxByValue: meta.maxByValue,
  };
}

function compactQueryMediaSlot(slot) {
  return {
    role: slot.role,
    field: slot.field,
    fieldPath: slot.fieldPath,
    writableProp: slot.writableProp,
    countKey: slot.countKey,
    publicCountKey: slot.publicCountKey || slot.countKey,
    defaultVisibleCount: slot.defaultVisibleCount,
    max: slot.max,
    maxFromKey: slot.maxFromKey,
    maxFromKeyOffset: slot.maxFromKeyOffset,
    maxByKey: slot.maxByKey,
    maxByValue: slot.maxByValue,
    maxCount: slot.maxCount,
    acceptedKinds: slot.acceptedKinds,
    acceptedKindsSource: slot.acceptedKindsSource,
    initialSrcSupported: slot.initialSrcSupported,
    canPresetMedia: slot.canPresetMedia,
    presetProp: slot.presetProp,
    emptySlotBehavior: slot.emptySlotBehavior,
  };
}

function compactCandidateFillPlan(plan) {
  return {
    arrays: (plan.arrays || []).slice(0, 4).map(item => ({
      key: item.key,
      role: item.role,
      visibleCount: item.visibleCount,
      maxCount: item.maxCount,
      countKey: item.countKey,
      ...(item.itemShape === 'string' ? { itemShape: item.itemShape } : {}),
      ...(item.item?.maxChars ? { item: item.item } : {}),
      ...(item.nestedArrays && Object.keys(item.nestedArrays).length ? { nestedArrays: item.nestedArrays } : {}),
    })),
    media: (plan.media || []).slice(0, 2),
  };
}

function buildFillablePropShapes(defaultProps = {}, copyKeys = [], roots = []) {
  const rootFilter = roots?.length ? new Set(roots.map(rootPropKey)) : null;
  const shapes = {};
  const rootKeys = rootFilter ? [...rootFilter] : Object.keys(defaultProps || {});
  for (const root of rootKeys) {
    if (!Object.prototype.hasOwnProperty.call(defaultProps || {}, root)) continue;
    const shape = fillableValueShape(defaultProps[root], root);
    if (shape == null) continue;
    shapes[root] = shape;
  }
  for (const key of copyKeys || []) {
    const root = rootPropKey(key);
    if (rootFilter && !rootFilter.has(root)) continue;
    const type = simpleValueType(sampleValueForCopyPath(defaultProps, key));
    if (type === 'array' || type === 'object') continue;
    assignPropShape(shapes, String(key).split('.').filter(Boolean), type);
  }
  return shapes;
}

function fillableValueShape(value, pathName) {
  if (Array.isArray(value)) {
    const shape = fillPlanArrayValueShape(value, pathName);
    return shape.length ? shape : null;
  }
  if (isPlainObject(value)) {
    const shape = fillableObjectShape(value, pathName);
    return Object.keys(shape).length ? shape : null;
  }
  return isFillableCopyLeaf(pathName, value) ? simpleValueType(value) : null;
}

function sampleValueForCopyPath(defaultProps, pathName) {
  const value = valuesForPattern(defaultProps, pathName);
  return Array.isArray(value) ? value.find(item => item != null) : value;
}

function assignPropShape(target, parts, leafShape) {
  if (!parts.length) return;
  const [part, ...rest] = parts;
  const arrayPart = part.endsWith('[]');
  const key = arrayPart ? part.slice(0, -2) : part;
  if (!key) return;
  if (arrayPart) {
    if (!rest.length) {
      target[key] = mergePropShape(target[key], [leafShape]);
      return;
    }
    const current = Array.isArray(target[key]) && isPlainObject(target[key][0]) ? target[key][0] : {};
    target[key] = [current];
    assignPropShape(current, rest, leafShape);
    return;
  }
  if (!rest.length) {
    target[key] = mergePropShape(target[key], leafShape);
    return;
  }
  if (!isPlainObject(target[key])) target[key] = {};
  assignPropShape(target[key], rest, leafShape);
}

function mergePropShape(left, right) {
  if (left == null) return right;
  if (Array.isArray(left) && Array.isArray(right)) return [mergePropShape(left[0], right[0])];
  if (isPlainObject(left) && isPlainObject(right)) {
    const next = { ...left };
    for (const [key, value] of Object.entries(right)) next[key] = mergePropShape(next[key], value);
    return next;
  }
  return left;
}

export function inspectLayout(layout, { compact = false } = {}) {
  const record = getLayoutRecord(layout);
  if (!record) return null;
  const { page, contract, controls, countBindings, lengthBindings } = record;
  const defaultProps = effectiveInspectDefaultProps(record.defaultProps, page);
  const theme = getThemePackMetadata(page.themeKey);
  const controlKeys = controls.map(control => control.key).filter(Boolean);
  const publicControls = controls.map(publicControl);
  const publicControlKeys = publicControls.map(control => control.publicKey).filter(Boolean);
  const mediaSlots = getMediaSlots(record);
  const decorativeKeys = getDecorativeKeys(page.key);
  // copyKeyRoots:顶层文案根(对象 copy 仍是单键),用于 propShapes/copyBudgets 的递归。
  const copyKeyRoots = getCopyKeyRoots(defaultProps, controls, mediaSlots, decorativeKeys);
  // JAD-212:copyKeys 扁平化(对象 copy 展开成 copy.eyebrow / copy.points[].t),与扁平主题形态一致。
  const copyKeys = expandCopyKeys(defaultProps, copyKeyRoots);
  const arrayKeys = getArrayKeys(defaultProps, mediaSlots);
  const copyBudgets = getCopyBudgets(defaultProps, copyKeyRoots);
  // count 绑定解析到真实数组键(修正 items/stats/data 等静态错配)。
  const resolvedBindings = (countBindings || []).map(binding => ({ ...binding, arrays: resolveBindingArrays(binding, defaultProps, controls) }));
  // propShapes 提前算出,供 arrayMeta 过滤掉未进入可填契约的私有视觉字段(如颜色)。
  const propShapesForArrayMeta = buildFillablePropShapes(defaultProps, copyKeys, [...copyKeyRoots, ...arrayKeys]);
  // JAD-213:arrayMeta 含语义 role;JAD-212:覆盖 copy 内数组并匹配其 count 控件。
  const arrayMeta = buildArrayMeta(defaultProps, countBindings, controls, { withItemRoles: true, propShapes: propShapesForArrayMeta });
  const copyRoles = buildCopyRoles(copyKeys);
  const fieldContracts = buildFieldContracts({ copyKeys, copyRoles, arrayMeta, decorativeKeys, mediaSlots });
  const fillPlan = buildFillPlan({ copyKeys, copyBudgets, copyRoles, arrayMeta, mediaSlots, defaultProps, controls, countBindings, lengthBindings, numberBoundsConfig: contract?.numberBounds });
  const propShapes = propShapesForArrayMeta;
  // JAD-212:正文全由组件硬编码(count 指向的数组缺席且无可填正文)时标记 contentLocked。
  const contentLockedReason = detectContentLocked({ copyKeys, copyRoles, arrayMeta, resolvedBindings, defaultProps });
  const palette = paletteColorsForLayout(defaultProps);
  const defaultVisibleCounts = Object.fromEntries(countBindings
    .map(binding => [binding.publicKey || binding.key, defaultProps[binding.key] ?? controls.find(control => control.key === binding.key)?.default])
    .filter(([, value]) => value !== undefined));

  const base = {
    layout: page.key,
    theme: page.themeKey,
    themeDisplayName: themeDisplayName(theme, page.themeKey),
    themeScenario: theme?.scenario || null,
    themeAudience: theme?.audience || null,
    pageNumber: page.pageNumber,
    label: page.label,
    slot: page.slot,
    roles: inferRoles(page, mediaSlots),
    copyKeys,
    copyBudgets,
    copyRoles,
    fieldContracts,
    fillPlan,
    ...(decorativeKeys.length ? { decorativeKeys } : {}),
    ...(contentLockedReason ? { contentLocked: true, contentLockedReason } : {}),
    arrayKeys,
    arrayMeta,
    lengthBindings,
    ...(palette ? { paletteColors: palette } : {}),
    mediaSlots,
    countBindings: resolvedBindings,
    controls: publicControls,
    controlKeys,
    publicControlKeys,
    defaultVisibleCounts,
  };

  if (compact) {
    const compactArrayMeta = arrayMeta.map(({ itemRoles, ...rest }) => rest);
    return {
      layout: base.layout,
      theme: base.theme,
      themeDisplayName: base.themeDisplayName,
      themeScenario: base.themeScenario,
      themeAudience: base.themeAudience,
      pageNumber: base.pageNumber,
      label: base.label,
      slot: base.slot,
      roles: base.roles,
      copyKeys: base.copyKeys,
      copyBudgets: compactInspectCopyBudgets(base.copyBudgets),
      copyRoles: base.copyRoles,
      fieldContracts: base.fieldContracts.map(compactInspectFieldContract).filter(Boolean),
      fillPlan: base.fillPlan,
      ...(decorativeKeys.length ? { decorativeKeys } : {}),
      ...(contentLockedReason ? { contentLocked: true, contentLockedReason } : {}),
      arrayKeys: base.arrayKeys.slice(0, 8),
      arrayMeta: compactArrayMeta,
      lengthBindings: base.lengthBindings,
      ...(palette ? { paletteColors: palette } : {}),
      propShapes,
      mediaSlots: base.mediaSlots.map(compactMediaSlot),
      countBindings: base.countBindings.map(compactCountBinding),
      controls: base.controls,
      defaultVisibleCounts: base.defaultVisibleCounts,
    };
  }

  return {
    ...base,
    propShapes,
    allowedPropKeys: [...allowedPropKeySet(record, mediaSlots, decorativeKeys)].sort(),
    allowedPublicPropKeys: [...allowedPublicPropKeySet(record, mediaSlots, decorativeKeys)].sort(),
  };
}

function compactInspectCopyBudgets(copyBudgets = {}) {
  return Object.fromEntries(Object.entries(copyBudgets || {}).map(([key, budget]) => [
    key,
    budget?.maxChars ? { maxChars: budget.maxChars } : budget,
  ]));
}

function compactInspectFieldContract(contract) {
  if (!contract) return null;
  if (contract.role === 'eyebrow') return null;
  if (contract.role !== 'media') return contract;
  const {
    acceptedKinds,
    acceptedKindsSource,
    defaultCount,
    canPresetMedia,
    ...compact
  } = contract;
  return compact;
}

function effectiveInspectDefaultProps(defaultProps = {}, page = {}) {
  const flows = flowRowsFromMatrix(defaultProps);
  if (!flows) return defaultProps;
  return { ...defaultProps, flows };
}

function flowRowsFromMatrix(defaultProps = {}) {
  if (!Array.isArray(defaultProps.sources) || !Array.isArray(defaultProps.sectors) || !Array.isArray(defaultProps.matrix)) return null;
  if (!defaultProps.matrix.every(row => Array.isArray(row))) return null;
  const rows = [];
  defaultProps.matrix.forEach((row, sourceIndex) => {
    row.forEach((value, sectorIndex) => {
      const amount = Number(value);
      if (!Number.isFinite(amount) || amount <= 0) return;
      const source = defaultProps.sources[sourceIndex];
      const sector = defaultProps.sectors[sectorIndex];
      if (!source?.name || !sector?.name) return;
      rows.push({ from: source.name, to: sector.name, value: amount });
    });
  });
  return rows.length ? rows : null;
}

export function normalizeProps(layout, props = {}) {
  const record = getLayoutRecord(layout);
  if (!record) {
    return {
      props: props || {},
      warnings: [],
      errors: [`Unknown layout "${layout}"`],
    };
  }
  const aliasResult = resolvePublicPropAliases(props, record.controls);
  const unknownWarnings = unknownPropKeys(record, props).map(key => unknownPropWarning(record, key));
  const mediaSlots = getMediaSlots(record);
  try {
    const authoredShape = validateAuthoredFillableProps(aliasResult.props, record, mediaSlots);
    if (authoredShape.errors.length) {
      throw new Error(`Slide props mismatch for "${layout}": ${authoredShape.errors.join('; ')}`);
    }
    const warnings = [...unknownWarnings, ...authoredShape.warnings];
    const propsWithAuthoredMediaCounts = backfillMediaCountKeys(props, mediaSlots);
    const propsWithCountSafety = normalizeSlidePropsForContract(layout, propsWithAuthoredMediaCounts, record.contract);
    const propsWithDefaults = mergeDefaultArrayTails(propsWithCountSafety, record.defaultProps, aliasResult.props, record.countBindings);
    const mediaResult = normalizeMediaItems(propsWithDefaults, mediaSlots);
    const propsWithMedia = mediaResult.props;
    const placeholderErrors = visibleNeutralPlaceholderErrors(record, propsWithMedia, aliasResult.props);
    return {
      props: propsWithMedia,
      publicProps: toPublicProps(propsWithMedia, record.controls),
      appliedAliases: aliasResult.appliedAliases,
      warnings,
      errors: [...mediaResult.errors, ...placeholderErrors],
    };
  } catch (error) {
    return {
      props: props || {},
      publicProps: toPublicProps(props || {}, record.controls),
      appliedAliases: aliasResult.appliedAliases,
      warnings: unknownWarnings,
      errors: [publicErrorMessage(error.message, record.controls)],
    };
  }
}

function validateAuthoredFillableProps(props = {}, record, mediaSlots = getMediaSlots(record)) {
  const decorativeKeys = getDecorativeKeys(record.page.key);
  const copyKeyRoots = getCopyKeyRoots(record.defaultProps, record.controls, mediaSlots, decorativeKeys);
  const copyKeys = expandCopyKeys(record.defaultProps, copyKeyRoots);
  const arrayKeys = getArrayKeys(record.defaultProps, mediaSlots);
  const propShapes = buildFillablePropShapes(record.defaultProps, copyKeys, [...copyKeyRoots, ...arrayKeys]);
  const allowedNestedArrays = new Set(
    buildArrayMeta(record.defaultProps, record.countBindings, record.controls)
      .map(meta => meta.key)
      .filter(isNestedArrayPath),
  );
  const countBoundLengths = countBoundLengthsForProps(props, record.countBindings);
  const countBoundPaths = new Set((record.countBindings || []).flatMap(binding => binding.arrays || []));
  const nestedArrayLens = buildNestedArrayLensMap(record.defaultProps, allowedNestedArrays);
  const errors = [];
  const warnings = [];
  for (const [key, value] of Object.entries(props || {})) {
    if (!Object.prototype.hasOwnProperty.call(propShapes, key)) continue;
    if (isPrivateDefaultRoundTrip(value, record.defaultProps?.[key]) && !containsPrivatePosToneField(value)) continue;
    const explicitBoundsByField = explicitNumberBoundsForArrayKey(record.contract?.numberBounds, key);
    validateFillableValueShape(value, propShapes[key], `props.${key}`, errors, warnings, record.defaultProps?.[key], allowedNestedArrays, countBoundLengths, countBoundPaths, undefined, nestedArrayLens, explicitBoundsByField);
  }
  return { errors, warnings };
}

// 逐下标期望长度:与 inspect:layout 暴露的 fixedLength/fixedLengths 同一来源
// (arraysAtPath 按父级数组原始顺序取每项的嵌套数组长度),供报错时一次性列出。
function buildNestedArrayLensMap(defaultProps, allowedNestedArrays) {
  const map = new Map();
  for (const pathName of allowedNestedArrays) {
    if (isFreeListField(pathFieldName(pathName))) continue;
    const lens = arraysAtPath(defaultProps, pathName).map(item => (Array.isArray(item) ? item.length : 0));
    if (lens.length) map.set(pathName, lens);
  }
  return map;
}

function validateFillableValueShape(value, shape, field, errors, warnings = [], defaultValue = undefined, allowedNestedArrays = new Set(), countBoundLengths = new Map(), countBoundPaths = new Set(), numberBounds = new Map(), nestedArrayLens = new Map(), explicitBoundsByField = null) {
  if (!isPrivatePosToneField(pathFieldName(field)) && !Array.isArray(value) && !isPlainObject(value) && isPrivateDefaultRoundTrip(value, defaultValue)) return;
  if (Array.isArray(shape)) {
    if (!Array.isArray(value)) {
      errors.push(`${field}: expected array`);
      return;
    }
    const contractPath = contractPathForField(field);
    const countBound = countBoundLengths.get(contractPath);
    if (countBound != null && value.length < countBound.count) {
      // count 拖到比当前 authored 数组长不再是硬错误——渲染合成层会用该 layout 契约
      // defaultProps 里的同名数组补足到 count 再显示,这里只提醒生成侧最好把数组写全。
      warnings.push(`countBinding shortfall ${countBound.key}=${countBound.count}; ${String(field).replace(/^props\./, '')} has ${value.length} (渲染会用默认内容补足,建议补全数组)`);
    } else if (countBound != null && value.length > countBound.count) {
      errors.push(`countBinding mismatch ${countBound.key}=${countBound.count}; ${String(field).replace(/^props\./, '')} has ${value.length}`);
      return;
    }
    if (
      countBound == null
      && !countBoundPaths.has(contractPath)
      && allowedNestedArrays.has(contractPath)
      && Array.isArray(defaultValue)
      && value.length !== defaultValue.length
      && !isFreeListField(pathFieldName(field))
    ) {
      const lens = nestedArrayLens.get(contractPath);
      const lensText = lens && lens.length > 1 ? `; expected lengths by index: [${lens.join(', ')}]` : '';
      errors.push(`${String(field).replace(/^props\./, '')}: fixed nested array length ${value.length} does not match default ${defaultValue.length}${lensText}`);
      return;
    }
    if (
      allowedNestedArrays.has(contractPath)
      && Array.isArray(defaultValue)
      && value.length !== defaultValue.length
    ) {
      return;
    }
    const isTupleShape = shape.length > 1;
    if (isTupleShape && value.length !== shape.length) {
      errors.push(`${String(field).replace(/^props\./, '')}: expected tuple length ${shape.length}`);
      return;
    }
    const itemNumberBounds = Array.isArray(defaultValue) ? numberBoundsForArrayItems(defaultValue, explicitBoundsByField) : new Map();
    value.forEach((item, index) => {
      const itemShape = isTupleShape ? shape[index] : shape[0];
      validateFillableValueShape(
        item,
        itemShape,
        `${field}[${index}]`,
        errors,
        warnings,
        Array.isArray(defaultValue) ? defaultValue[index] : undefined,
        allowedNestedArrays,
        countBoundLengths,
        countBoundPaths,
        itemNumberBounds,
        nestedArrayLens,
      );
    });
    return;
  }
  if (isPlainObject(shape)) {
    if (!isPlainObject(value)) {
      errors.push(`${field}: expected object`);
      return;
    }
    const allowed = new Set(Object.keys(shape));
    for (const [key, item] of Object.entries(value || {})) {
      if (!allowed.has(key)) {
        if (!isPrivatePosToneField(key) && isPrivateDefaultRoundTrip(item, defaultValue?.[key])) continue;
        if (isAllowedNestedArrayField(field, key, item, defaultValue?.[key], allowedNestedArrays)) continue;
        errors.push(`${field}.${key}: unknown nested prop; expected ${formatExpectedKeys(allowed)}`);
        continue;
      }
      validateFillableValueShape(item, shape[key], `${field}.${key}`, errors, warnings, defaultValue?.[key], allowedNestedArrays, countBoundLengths, countBoundPaths, undefined, nestedArrayLens);
      const bounds = numberBounds.get(key);
      if (bounds) validateNumberBounds(item, bounds, `${field}.${key}`, bounds.explicit ? errors : warnings);
    }
    return;
  }
  if (shape === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) {
    errors.push(`${field}: expected number`);
    return;
  }
  if (shape === 'boolean' && typeof value !== 'boolean') {
    errors.push(`${field}: expected boolean`);
    return;
  }
  if (shape === 'string' && typeof value !== 'string') {
    errors.push(`${field}: expected string`);
  }
}

function containsPrivatePosToneField(value) {
  if (Array.isArray(value)) return value.some(containsPrivatePosToneField);
  if (!isPlainObject(value)) return false;
  return Object.entries(value).some(([key, item]) => isPrivatePosToneField(key) || containsPrivatePosToneField(item));
}

function isPrivatePosToneField(key) {
  return /^(pos|tone)$/i.test(String(key || ''));
}

// numberBoundsForArrayItems / validateNumberBounds live in src/prop-contract-core.mjs and are
// imported above -- this is the same derivation the render-time contract and the client-side
// editing runtime use, so inspect:layout / props:safe / validate:goal-spec never drift from
// what actually gets enforced (see explicitNumberBoundsForArrayKey for page-declared overrides).

function countBoundLengthsForProps(props = {}, countBindings = []) {
  const result = new Map();
  for (const binding of countBindings || []) {
    const rawCount = props?.[binding.key] ?? props?.[binding.publicKey];
    const count = numberOrNull(rawCount);
    if (count == null) continue;
    for (const arrayPath of binding.arrays || []) {
      if (isMediaArrayKey(String(arrayPath || '').split('.')[0].replace(/\[\]$/, ''))) continue;
      result.set(arrayPath, { count, key: binding.publicKey || binding.key });
    }
  }
  return result;
}

function isAllowedNestedArrayField(field, key, value, defaultValue, allowedNestedArrays) {
  if (!Array.isArray(value) || !Array.isArray(defaultValue)) return false;
  return allowedNestedArrays.has(contractPathForNestedField(field, key));
}

function contractPathForNestedField(field, key) {
  return `${contractPathForField(field)}.${key}`;
}

function contractPathForField(field) {
  return String(field || '').replace(/^props\./, '').replace(/\[\d+\]/g, '[]');
}

function formatExpectedKeys(keys) {
  return [...keys].join(', ');
}

function visibleNeutralPlaceholderErrors(record, props = {}, authoredProps = props) {
  const visibleProps = visiblePropsForRecord(record, props, authoredProps);
  const findings = collectNeutralPlaceholderFindings(visibleProps).slice(0, 8);
  if (!findings.length) return [];
  return [`中性占位文案仍在可见 props 中: ${findings.join(', ')}; 请补齐这些可见字段或降低对应 count`];
}

function visiblePropsForRecord(record, props = {}, authoredProps = props) {
  const bindings = visibleCountBindings(record);
  const arrayCounts = new Map();
  for (const binding of bindings) {
    const count = numberOrNull(props[binding.key] ?? props[binding.publicKey]);
    if (count == null) continue;
    for (const arrayKey of binding.arrays || []) arrayCounts.set(arrayKey, count);
  }
  const fallbackCount = fallbackVisibleCount(props, bindings, record.controls);
  return filterVisibleValue(props, '', arrayCounts, fallbackCount, authoredProps);
}

function visibleCountBindings(record) {
  const bindings = new Map();
  const add = binding => {
    if (!binding?.key && !binding?.publicKey) return;
    const key = binding.key || binding.publicKey;
    const current = bindings.get(key) || { ...binding, arrays: [] };
    current.arrays = [...new Set([...(current.arrays || []), ...(binding.arrays || [])])];
    bindings.set(key, current);
  };
  for (const binding of record.countBindings || []) {
    add({ ...binding, arrays: resolveBindingArrays(binding, record.defaultProps, record.controls) });
  }
  for (const meta of buildArrayMeta(record.defaultProps, record.countBindings, record.controls)) {
    if (!meta.countKey) continue;
    add({ key: meta.countKey, publicKey: meta.countKey, arrays: [meta.key] });
  }
  return [...bindings.values()];
}

function fallbackVisibleCount(props, bindings, controls = []) {
  const countKeys = new Set();
  for (const binding of bindings || []) {
    if (binding.key) countKeys.add(binding.key);
    if (binding.publicKey) countKeys.add(binding.publicKey);
  }
  for (const control of nonMediaCountControls(controls)) {
    if (control.key) countKeys.add(control.key);
    if (control.publicKey) countKeys.add(control.publicKey);
  }
  const counts = [...new Set([...countKeys]
    .map(key => numberOrNull(props[key]))
    .filter(value => value != null))];
  return counts.length === 1 ? counts[0] : null;
}

function filterVisibleValue(value, pathName, arrayCounts, fallbackCount, authoredValue = value) {
  if (Array.isArray(value)) {
    const key = lastPathKey(pathName);
    const explicitCount = arrayCounts.get(pathName) ?? arrayCounts.get(key);
    const authoredCount = Array.isArray(authoredValue) ? authoredValue.length : null;
    const limit = explicitCount ?? (shouldSliceByFallback(key, value, fallbackCount) ? fallbackCount : authoredCount);
    const visible = limit == null ? value : value.slice(0, limit);
    const itemPath = pathName ? `${pathName}[]` : '[]';
    return visible.map((item, index) => filterVisibleValue(item, itemPath, arrayCounts, fallbackCount, authoredValue?.[index]));
  }
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [
    childKey,
    filterVisibleValue(childValue, pathName ? `${pathName}.${childKey}` : childKey, arrayCounts, fallbackCount, authoredValue?.[childKey]),
  ]));
}

function lastPathKey(pathName) {
  return String(pathName || '')
    .split('.')
    .at(-1)
    ?.replace(/\[\]$/, '') || '';
}

function shouldSliceByFallback(key, value, fallbackCount) {
  if (fallbackCount == null || !Array.isArray(value) || value.length <= fallbackCount) return false;
  if (isMediaArrayKey(key)) return false;
  if (/^(items|cards|stats|data|captions|labels|callouts|features|tiles)$/i.test(String(key || ''))) return true;
  return value.slice(fallbackCount).some(containsNeutralPlaceholder);
}

function containsNeutralPlaceholder(item) {
  if (item == null) return false;
  if (typeof item === 'string') return NEUTRAL_PLACEHOLDERS.some(placeholder => item.includes(placeholder));
  if (typeof item !== 'object') return false;
  const text = JSON.stringify(item);
  return NEUTRAL_PLACEHOLDERS.some(placeholder => text.includes(placeholder));
}

function collectNeutralPlaceholderFindings(value, pathName = '') {
  if (typeof value === 'string') {
    return NEUTRAL_PLACEHOLDERS
      .filter(placeholder => value.includes(placeholder))
      .map(placeholder => `${pathName || '<root>'}=${placeholder}`);
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectNeutralPlaceholderFindings(item, `${pathName}[${index}]`));
  }
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, item]) => collectNeutralPlaceholderFindings(
    item,
    pathName ? `${pathName}.${key}` : key,
  ));
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : null;
}

function publicControl(control) {
  return {
    key: control.key,
    publicKey: control.publicKey || control.key,
    label: control.label || control.key,
    type: control.type,
    default: control.default,
    min: control.min,
    max: control.max,
    displayOffset: control.displayOffset,
    maxFromKey: control.maxFromKey,
    maxFromKeyOffset: control.maxFromKeyOffset,
    maxByKey: control.maxByKey,
    maxByValue: control.maxByValue,
    display: control.display,
  };
}

function compactMediaSlot(slot) {
  const canPresetMedia = slot.initialSrcSupported === true && Boolean(slot.fieldPath);
  return {
    role: slot.role,
    field: slot.field,
    fieldPath: slot.fieldPath,
    writableProp: slot.writableProp || (canPresetMedia ? slot.fieldPath : null),
    countKey: slot.countKey,
    publicCountKey: slot.publicCountKey || slot.countKey,
    defaultCount: slot.defaultCount,
    defaultVisibleCount: slot.defaultVisibleCount ?? slot.defaultCount,
    max: slot.max,
    maxFromKey: slot.maxFromKey,
    maxFromKeyOffset: slot.maxFromKeyOffset,
    maxByKey: slot.maxByKey,
    maxByValue: slot.maxByValue,
    maxCount: slot.maxCount ?? mediaSlotCapacity(slot),
    accepts: slot.accepts || slot.acceptedKinds,
    acceptedKinds: slot.acceptedKinds,
    acceptedKindsSource: slot.acceptedKindsSource,
    itemShape: slot.itemShape,
    valueShape: slot.valueShape,
    initialSrcSupported: slot.initialSrcSupported,
    writeMode: slot.writeMode,
    canPresetMedia,
    presetProp: canPresetMedia ? slot.fieldPath : null,
    emptySlotBehavior: slot.emptySlotBehavior,
    ...(slot.countOnly ? { countOnly: true } : {}),
    ...(slot.explicitMediaSlot ? { explicitMediaSlot: true } : {}),
  };
}

function compactCountBinding(binding) {
  return {
    key: binding.key,
    publicKey: binding.publicKey || binding.key,
    label: binding.label,
    arrays: binding.arrays,
    min: binding.min,
    max: binding.max,
    maxFromKey: binding.maxFromKey,
    maxFromKeyOffset: binding.maxFromKeyOffset,
    maxByKey: binding.maxByKey,
    maxByValue: binding.maxByValue,
  };
}

function publicErrorMessage(message, controls = []) {
  let next = String(message || '');
  for (const control of controls || []) {
    if (!control?.key || !control.publicKey || control.key === control.publicKey) continue;
    next = next.replaceAll(control.key, control.publicKey);
  }
  return appendNestedPropSuggestions(next);
}

function unknownPropWarning(record, key) {
  const suggestions = suggestPropAlternatives(record, key);
  const suffix = suggestions.length ? `; try ${suggestions.join(', ')}` : '; run inspect:layout for writable props';
  return `Unknown prop "${key}" for ${record.page.key}${suffix}`;
}

function suggestPropAlternatives(record, key) {
  const candidates = topLevelPropCandidates(record);
  const scored = candidates
    .map(candidate => ({ candidate, score: propSuggestionScore(key, candidate) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.candidate.localeCompare(b.candidate))
    .map(item => item.candidate);
  return (scored.length ? scored : candidates).slice(0, 6);
}

function topLevelPropCandidates(record) {
  const details = inspectLayout(record.page.key, { compact: true });
  const allowed = allowedPropKeySet(record);
  const fromContracts = (details?.fieldContracts || [])
    .filter(item => item.role !== 'decorative')
    .map(item => rootPropKey(item.key))
    .filter(key => allowed.has(key));
  return [...new Set([
    ...fromContracts,
    ...[...allowed].filter(key => !String(key).startsWith('_')),
  ])];
}

function rootPropKey(pathName) {
  return String(pathName || '').split('.')[0].replace(/\[\].*$/, '').replace(/\[\]$/, '');
}

function propSuggestionScore(input, candidate) {
  const key = String(input || '').toLowerCase();
  const value = String(candidate || '').toLowerCase();
  if (!key || !value) return 0;
  if (key === value) return 100;
  if (value.includes(key) || key.includes(value)) return 80;
  const synonyms = propSynonyms(key);
  if (synonyms.includes(value)) return 70;
  return 0;
}

function propSynonyms(key) {
  if (/^(heading|headline|head|subject)$/.test(key)) return ['title'];
  if (/^(img|image|photo|picture|pic|asset|visual)$/.test(key)) return ['images', 'media', 'photos', 'picture'];
  if (/^(text|body|paragraph|copy|description|desc|summary)$/.test(key)) return ['lead', 'lede', 'desc', 'description', 'caption', 'paragraph'];
  if (/^(list|rows|cards|points|bullets)$/.test(key)) return ['items', 'cards', 'points', 'rows'];
  return [];
}

function appendNestedPropSuggestions(message) {
  return String(message || '').replace(
    /(props(?:\.[A-Za-z0-9_$-]+|\[\d+\])*)\.([A-Za-z0-9_$-]+): unknown nested prop; expected ([^;]+)/g,
    (match, parentPath, _badKey, expected) => {
      const keys = String(expected || '').split(',').map(item => item.trim()).filter(Boolean).slice(0, 5);
      if (!keys.length) return match;
      const parent = String(parentPath).replace(/\[\d+\]/g, '[]');
      return `${match}; try ${keys.map(key => `${parent}.${key}`).join(', ')}`;
    },
  );
}

export function getMediaSlotsForLayout(layout) {
  const record = getLayoutRecord(layout);
  return record ? getMediaSlots(record) : [];
}

export function mediaSlotsCanFit(slots = [], count = 1, { requireInitialMedia = false, mediaKind = null } = {}) {
  const requested = Math.max(1, Number(count) || 1);
  const normalizedKind = normalizeMediaKind(mediaKind);
  return slots.some(slot => {
    if (!isWritableMediaSlot(slot)) return false;
    if (requireInitialMedia && slot.initialSrcSupported !== true) return false;
    if (normalizedKind && !slotAcceptsKind(slot, normalizedKind)) return false;
    return mediaSlotCapacity(slot) >= requested;
  });
}

export function mediaSlotCapacity(slot) {
  const maxCount = Number(slot?.maxCount);
  if (Number.isFinite(maxCount) && maxCount > 0) return maxCount;
  const max = Number(slot?.max);
  if (Number.isFinite(max) && max > 0) return max;
  const defaultCount = Number(slot?.defaultCount);
  if (Number.isFinite(defaultCount) && defaultCount > 0) return defaultCount;
  return 1;
}

function mediaSlotMaxCount(max, defaultVisibleCount) {
  const explicit = max == null ? NaN : Number(max);
  if (Number.isFinite(explicit) && explicit >= 0) return explicit;
  const count = Number(defaultVisibleCount);
  if (Number.isFinite(count) && count > 0) return count;
  return 1;
}

export function getPreferredMediaSlot(layout, { kind = 'images', count = 1 } = {}) {
  const slots = getMediaSlotsForLayout(layout);
  if (!slots.length) return null;
  const requested = Math.max(1, Number(count) || 1);
  const requestedKind = kind === 'media' ? null : 'image';
  const preferredFields = kind === 'media' ? ['media', 'images'] : MEDIA_ARRAY_KEYS;
  return slots.find(slot => slot.initialSrcSupported === true && preferredFields.some(field => field.toLowerCase() === String(slot.field || '').toLowerCase()) && (!requestedKind || slotAcceptsKind(slot, requestedKind)) && mediaSlotCapacity(slot) >= requested)
    || slots.find(slot => slot.initialSrcSupported === true && (!requestedKind || slotAcceptsKind(slot, requestedKind)) && mediaSlotCapacity(slot) >= requested)
    || null;
}

export function getCopyBudgetsForLayout(layout) {
  const record = getLayoutRecord(layout);
  if (!record) return {};
  const mediaSlots = getMediaSlots(record);
  const decorativeKeys = getDecorativeKeys(record.page.key);
  const copyKeyRoots = getCopyKeyRoots(record.defaultProps, record.controls, mediaSlots, decorativeKeys);
  return getCopyBudgets(record.defaultProps, copyKeyRoots);
}

export function typedMediaItemForSource(source) {
  const src = String(source || '').trim();
  const kind = looksLikeVideoSrc(src) ? 'video' : 'image';
  return {
    src,
    kind,
    type: mimeForMediaSource(src, kind),
  };
}

export function isDeckLocalMediaSource(source) {
  const text = String(source || '').trim();
  if (!text || text.includes('\\') || path.posix.isAbsolute(text)) return false;
  if (path.posix.normalize(text) !== text) return false;
  if (!text.startsWith('assets/user-media/')) return false;
  const suffix = text.slice('assets/user-media/'.length);
  if (!suffix) return false;
  return suffix.split('/').every(part => part && part !== '.' && part !== '..');
}

function mergeDefaultArrayTails(props, defaults, authoredProps = props, countBindings = []) {
  const next = { ...(props || {}) };
  for (const [key, value] of Object.entries(props || {})) {
    if (!Array.isArray(value) || !Array.isArray(defaults?.[key])) continue;
    if (isMediaArrayKey(key)) continue;
    const explicitCount = explicitCountForArrayKey(authoredProps, key, countBindings);
    const authoredLength = Array.isArray(authoredProps?.[key]) ? authoredProps[key].length : explicitCount ?? value.length;
    next[key] = value.slice(0, authoredLength);
  }
  return next;
}

function explicitCountForArrayKey(props = {}, arrayKey, countBindings = []) {
  for (const binding of countBindings || []) {
    if (!(binding.arrays || []).includes(arrayKey)) continue;
    const count = numberOrNull(props?.[binding.key] ?? props?.[binding.publicKey]);
    if (count != null) return count;
  }
  return null;
}

function normalizeMediaItems(props, mediaSlots = []) {
  const next = { ...(props || {}) };
  const errors = [];
  for (const slot of mediaSlots || []) {
    if (!slot?.field || !Array.isArray(next[slot.field])) continue;
    next[slot.field] = next[slot.field].map(normalizeMediaItem);
    const count = next[slot.field].length;
    const capacity = mediaSlotCapacity(slot);
    if (count > capacity) {
      errors.push(`props.${slot.field}: too many media items (${count} > ${capacity}); keep within media slot capacity`);
    }
    const explicitCount = mediaSlotExplicitCount(next, slot);
    if (explicitCount != null && count > explicitCount) {
      errors.push(`props.${slot.field}: too many media items (${count} > ${explicitCount}); keep within ${slot.publicCountKey || slot.countKey}`);
    }
  }
  return { props: next, errors };
}

function backfillMediaCountKeys(props, mediaSlots = []) {
  let next = props || {};
  for (const slot of mediaSlots || []) {
    if (!slot?.field || !slot.countKey || !Array.isArray(next[slot.field])) continue;
    if (mediaSlotExplicitCount(next, slot) != null) continue;
    if (next === props) next = { ...(props || {}) };
    next[slot.countKey] = next[slot.field].length;
  }
  return next;
}

function mediaSlotExplicitCount(props, slot) {
  for (const key of [slot.countKey, slot.publicCountKey].filter(Boolean)) {
    if (!Object.prototype.hasOwnProperty.call(props || {}, key)) continue;
    const count = numberOrNull(props[key]);
    if (count != null) return count;
  }
  return null;
}

function normalizeMediaItem(item) {
  if (typeof item === 'string') {
    const src = item.trim();
    return looksLikeVideoSrc(src) ? typedMediaItemForSource(src) : item;
  }
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
  if (typeof item.src !== 'string' || !item.src.trim()) return item;
  const src = item.src.trim();
  const kind = normalizeMediaKind(item.kind) || (looksLikeVideoSrc(src) ? 'video' : '');
  if (kind !== 'video') return item;
  return {
    ...item,
    src,
    kind: 'video',
    type: item.type || mimeForMediaSource(src, 'video'),
  };
}

export function getLayoutRecord(layout) {
  const page = pagesByKey.get(layout);
  if (!page) return null;
  const baseContract = contracts.get(layout);
  const manifestLayout = getManifest().layouts?.[layout] || {};
  const controls = normalizePublicControls(manifestLayout.controls || baseContract?.controls || [], { layout, themeKey: page.themeKey });
  const rawCountBindings = mergeCountBindings(manifestLayout.countBindings, baseContract?.countBindings);
  const countBindings = resolveCountBindings(rawCountBindings, baseContract?.defaultProps || {}, controls);
  const lengthBindings = mergeLengthBindings(manifestLayout.lengthBindings, baseContract?.lengthBindings);
  const contract = {
    ...(baseContract || {}),
    controls,
    countBindings,
    lengthBindings,
  };
  return {
    page,
    contract,
    controls,
    countBindings,
    lengthBindings,
    defaultProps: baseContract?.defaultProps || {},
  };
}

function mergeCountBindings(primary = [], fallback = []) {
  const result = [];
  const seen = new Set();
  for (const binding of [...(primary || []), ...(fallback || [])]) {
    if (!binding?.key || seen.has(binding.key)) continue;
    seen.add(binding.key);
    result.push(binding);
  }
  return result;
}

function resolveCountBindings(bindings = [], defaultProps = {}, controls = []) {
  return (bindings || []).map(binding => {
    const control = (controls || []).find(item => item.key === binding.key || item.publicKey === binding.publicKey);
    return {
      ...binding,
      publicKey: control?.publicKey || binding.publicKey,
      maxFromKey: binding.maxFromKey ?? control?.maxFromKey,
      maxFromKeyOffset: binding.maxFromKeyOffset ?? control?.maxFromKeyOffset,
      maxByKey: binding.maxByKey ?? control?.maxByKey,
      maxByValue: binding.maxByValue ?? control?.maxByValue,
      arrays: resolveBindingArrays(binding, defaultProps, controls),
    };
  });
}

function mergeLengthBindings(primary = [], fallback = []) {
  const result = [];
  const seen = new Set();
  for (const binding of [...(primary || []), ...(fallback || [])]) {
    if (!binding?.dependent || !binding?.anchor) continue;
    const key = `${binding.relation || 'same-length'}:${binding.dependent}:${binding.anchor}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(binding);
  }
  return result;
}

export function getThemePackMetadata(themeKey) {
  return themePacksByKey.get(themeKey) || null;
}

export function layoutExists(layout) {
  return pagesByKey.has(layout);
}

function themeDisplayName(theme, fallback) {
  return theme?.displayName || theme?.label || theme?.name || fallback;
}

export function isCoverCandidate(layout) {
  return /^theme\d+_page00[1-5]$/.test(layout);
}

export function isCoverLikeLayout(layout) {
  const record = getLayoutRecord(layout);
  if (!record) return false;
  const slot = String(record.page.slot || '').toLowerCase();
  const label = String(record.page.label || '').toLowerCase();
  return slot.startsWith('cover') || label.startsWith('封面') || /^cover/.test(label);
}

function isBodyContentCandidate(page) {
  return !isCoverCandidate(page.key)
    && !isCoverLikeLayout(page.key)
    && !isClosingLikePage(page);
}

function isClosingLikePage(page) {
  const slot = String(page.slot || '').toLowerCase();
  const label = String(page.label || '').toLowerCase();
  const text = `${slot} ${label}`;
  return /(^|[\s_-])(closing|contact|join|end|endcap|colophon|appendix)([\s_-]|$)/.test(text)
    || label.startsWith('封底')
    || label.startsWith('结语')
    || label.startsWith('致谢')
    || label.startsWith('谢谢');
}

export function getAllowedPropKeys(layout) {
  const record = getLayoutRecord(layout);
  if (!record) return new Set();
  return allowedPropKeySet(record);
}

export function unknownPropKeys(record, props = {}) {
  const allowed = allowedPropKeySet(record);
  return Object.keys(props || {}).filter(key => !allowed.has(key));
}

function allowedPropKeySet(record, mediaSlots = getMediaSlots(record), decorativeKeys = getDecorativeKeys(record.page.key)) {
  const defaultProps = record.defaultProps || {};
  const controls = record.controls || [];
  const controlKeys = controls.map(control => control.key).filter(Boolean);
  const mediaFields = mediaSlots.map(slot => slot.field).filter(Boolean);
  return new Set([
    ...getCopyKeyRoots(defaultProps, controls, mediaSlots, decorativeKeys),
    ...getArrayKeys(defaultProps, mediaSlots),
    ...controlKeys,
    ...controls.map(control => control.publicKey).filter(Boolean),
    ...mediaFields,
  ]);
}

function allowedPublicPropKeySet(record, mediaSlots = getMediaSlots(record), decorativeKeys = getDecorativeKeys(record.page.key)) {
  const controls = record.controls || [];
  const keyToAlias = new Map(controls.map(control => [control.key, control.publicKey || control.key]).filter(([key]) => key));
  return new Set([...allowedPropKeySet(record, mediaSlots, decorativeKeys)].map(key => keyToAlias.get(key) || key));
}

// 顶层文案根:对象 copy 仍是单根(copy),内部路径由 expandCopyKeys/collectCopyBudgets 递归。
function getCopyKeyRoots(defaultProps, controls, mediaSlots, decorativeKeys = []) {
  const controlKeys = new Set(controls.map(control => control.key));
  const mediaFields = new Set(mediaSlots.map(slot => slot.field));
  const decorative = new Set(decorativeKeys);
  return Object.entries(defaultProps || {})
    .filter(([key, value]) => {
      if ((controlKeys.has(key) && key !== 'copy') || mediaFields.has(key) || decorative.has(key) || isMediaArrayKey(key)) return false;
      const pruned = pruneContractValue(value, key);
      return !isPrunedContractOmit(pruned) && pruned !== null && isCopyValue(pruned) && hasFillableCopyLeaf(pruned, key);
    })
    .map(([key]) => key);
}

// JAD-212:把文案根扁平化为可填路径。对象 copy 展开成 copy.eyebrow / copy.points[].t,
// 顶层数组展开成 items[].label,与扁平主题(theme01)形态一致。
function expandCopyKeys(defaultProps, copyKeyRoots) {
  const keys = [];
  for (const root of copyKeyRoots) collectCopyPaths(defaultProps?.[root], root, keys);
  return [...new Set(keys)];
}

function collectCopyPaths(value, pathName, out) {
  value = pruneContractValue(value, pathName);
  if (isPrunedContractOmit(value)) return;
  if (typeof value === 'string' || typeof value === 'number' || isSerializedReactElementLike(value)) {
    if (isFillableCopyLeaf(pathName, value)) out.push(pathName);
    return;
  }
  if (Array.isArray(value)) {
    const shape = value.find(isPlainObject);
    if (shape) {
      for (const [key, item] of Object.entries(shape)) collectCopyPaths(item, `${pathName}[].${key}`, out);
      return;
    }
    if (value.some(item => (typeof item === 'string' || typeof item === 'number') && isFillableCopyLeaf(`${pathName}[]`, item))) out.push(`${pathName}[]`);
    return;
  }
  if (!isPlainObject(value)) return;
  for (const [key, item] of Object.entries(value)) collectCopyPaths(item, `${pathName}.${key}`, out);
}

function getArrayKeys(defaultProps, mediaSlots) {
  const mediaFields = new Set(mediaSlots.map(slot => slot.field));
  return Object.entries(defaultProps || {})
    .filter(([key, value]) => Array.isArray(value) && !mediaFields.has(key) && !isMediaArrayKey(key) && isContractContentArray(key, value))
    .map(([key]) => key);
}

function isColorString(value) {
  if (typeof value !== 'string') return false;
  const text = value.trim();
  return /^#[0-9a-fA-F]{3,8}$/.test(text) || /^(rgb|rgba|hsl|hsla)\(/i.test(text);
}

function isColorArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every(isColorString);
}

function isVisualConfigValue(pathName, value) {
  if (isVisualConfigLeaf(pathName, value)) return true;
  if (Array.isArray(value)) return isVisualConfigArray(pathName, value);
  if (!isPlainObject(value)) return false;
  const entries = Object.entries(value || {});
  const numericGroups = entries.filter(([key]) => isNumericPathSegment(key));
  return numericGroups.length > 0
    && numericGroups.length === entries.length
    && numericGroups.every(([key, item]) => isVisualConfigValue(`${pathName}.${key}`, item));
}

function isVisualConfigArray(pathName, value) {
  if (!Array.isArray(value) || !value.length) return false;
  if (isColorArray(value)) return true;
  const field = arrayFieldName(pathName);
  if (value.every(item => typeof item === 'number' && Number.isFinite(item))) return isVisualArrayField(field);
  const objects = value.filter(isPlainObject);
  if (!objects.length || objects.length !== value.filter(item => item != null).length) return false;
  const scalarFields = objects.flatMap(item => scalarObjectEntries(item).map(([key, itemValue]) => [key, itemValue]));
  if (!scalarFields.some(([key, itemValue]) => isVisualConfigLeaf(key, itemValue))) return false;
  return scalarFields.every(([key, itemValue]) => (
    isVisualConfigLeaf(key, itemValue) || isVisualDecorationLabelField(pathFieldName(key))
  ));
}

function scalarObjectEntries(value, prefix = '') {
  if (!isPlainObject(value)) return [];
  const rows = [];
  for (const [key, item] of Object.entries(value)) {
    const pathName = prefix ? `${prefix}.${key}` : key;
    if (Array.isArray(item)) continue;
    if (isPlainObject(item)) {
      rows.push(...scalarObjectEntries(item, pathName));
      continue;
    }
    rows.push([pathName, item]);
  }
  return rows;
}

function isVisualConfigLeaf(pathName, value) {
  const field = pathFieldName(pathName);
  if (isColorString(value)) return true;
  if (typeof value === 'number' && Number.isFinite(value)) return isVisualNumericField(field);
  if (typeof value === 'string' && isVisualStyleField(field) && (isTokenLike(value) || isCssVarLike(value))) return true;
  return false;
}

function isVisualNumericField(field) {
  return /^(x|y|l|t|r|w|h|cx|cy|dx|dy|box|width|height|left|top|right|bottom|ratio|rotate|rotation|angle|tilt|scale|sr|opacity|radius|z|zindex)$/i.test(String(field || ''));
}

function isVisualArrayField(field) {
  return /^(tilts?|rotations?|angles?|offsets?|positions?|coords?|coordinates?)$/i.test(String(field || ''));
}

function isVisualStyleField(field) {
  return /^(c|color|colour|accent|fill|stroke|background|bg|tint|hex|tone|subcolor)$/i.test(String(field || ''));
}

function isVisualDecorationLabelField(field) {
  return /^(ph|placeholder|label|sub|caption|cap)$/i.test(String(field || ''));
}

function isCssVarLike(value) {
  return /^var\(--[A-Za-z0-9_-]+\)$/.test(String(value || '').trim());
}

// defaultProps 中实际承载内容的数组键(排除媒体数组与纯色板数组)。
function contentArrayKeys(defaultProps = {}) {
  return Object.keys(defaultProps || {})
    .filter(key => Array.isArray(defaultProps[key]) && !isMediaArrayKey(key) && isContractContentArray(key, defaultProps[key]));
}

function arrayHeadExists(defaultProps, pathName) {
  return Array.isArray(valueAtPath(defaultProps, pathName));
}

// 把 count 控件解析到 defaultProps 里真实存在的数组键;命不中时只保留可由命名或长度证明的数组。
function resolveBindingArrays(binding, defaultProps = {}, controls = []) {
  const explicit = explicitCountArraysForBinding(binding, controls);
  if (explicit.length) {
    const kept = explicit.filter(pathName => isExplicitBindableCountArray(defaultProps, pathName));
    if (kept.length) return [...new Set(kept)];
    return [];
  }
  if (isMediaCountBinding(binding)) {
    const declaredMedia = [
      ...(Array.isArray(binding?.arrays) ? binding.arrays : []),
    ].filter(pathName => isMediaArrayPath(pathName) && arrayHeadExists(defaultProps, pathName));
    if (declaredMedia.length) return narrowCountBindingArrays(binding, [...new Set(declaredMedia)]);

    const mediaArrays = Object.keys(defaultProps || {}).filter(key => Array.isArray(defaultProps[key]) && isMediaArrayKey(key));
    const preferred = preferredMediaBindingArray(binding, mediaArrays);
    if (preferred) return [preferred];
  }
  const declared = Array.isArray(binding?.arrays) ? binding.arrays : [];
  if (Array.isArray(binding?.arrays) && !declared.length) return [];
  const kept = declared.filter(pathName => isBindableCountArray(defaultProps, pathName));
  if (kept.length && isVisualSlotCountBinding(binding, controls)) {
    const mediaArrays = Object.keys(defaultProps || {}).filter(key => Array.isArray(defaultProps[key]) && isMediaArrayKey(key));
    if (mediaArrays.length) return [...new Set([...kept, ...mediaArrays])];
  }
  if (kept.length) return narrowCountBindingArrays(binding, kept);
  const paths = discoverContentArrayPaths(defaultProps);
  const byField = declared
    .flatMap(pathName => paths.filter(candidate => arrayFieldName(candidate) === arrayFieldName(pathName)));
  if (byField.length) return [...new Set(byField)];
  const content = contentArrayKeys(defaultProps);
  if (!content.length) return [];
  const max = Number(binding?.max);
  const byMax = Number.isFinite(max) ? content.filter(key => defaultProps[key].length === max) : [];
  if (byMax.length === 1) return byMax;
  const fallbackDefault = Number(defaultProps[binding?.key]);
  const byDefault = Number.isFinite(fallbackDefault) ? content.filter(key => defaultProps[key].length === fallbackDefault) : [];
  if (byDefault.length === 1) return byDefault;
  return [];
}

function isBindableCountArray(defaultProps, pathName) {
  if (!arrayHeadExists(defaultProps, pathName)) return false;
  if (isMediaArrayPath(pathName)) return true;
  return isContractContentArray(pathName, valueAtPath(defaultProps, pathName));
}

function isExplicitBindableCountArray(defaultProps, pathName) {
  if (!arrayHeadExists(defaultProps, pathName)) return false;
  if (isBindableCountArray(defaultProps, pathName)) return true;
  const value = valueAtPath(defaultProps, pathName);
  return Array.isArray(value) && value.length > 0 && value.every(item => typeof item === 'number' && Number.isFinite(item));
}

function explicitCountArraysForBinding(binding, controls = []) {
  const control = (controls || []).find(item => (
    item?.key && (item.key === binding?.key || item.key === binding?.publicKey)
  ) || (
    item?.publicKey && (item.publicKey === binding?.key || item.publicKey === binding?.publicKey)
  ));
  const value = control?.countArrays;
  if (typeof value === 'string' && value) return [value];
  if (Array.isArray(value)) return value.filter(item => typeof item === 'string' && item);
  return [];
}

function isMediaArrayPath(pathName) {
  const root = String(pathName || '').split('.')[0].replace(/\[\]$/, '');
  return isMediaArrayKey(root) || isMediaArrayKey(arrayFieldName(pathName));
}

function isMediaCountBinding(binding) {
  const text = `${binding?.key || ''} ${binding?.publicKey || ''} ${binding?.label || ''}`;
  return isMediaCountText(text)
    && /(count|数量)/i.test(text);
}

function isMediaCountText(text) {
  return /image|media|photo|picture|video|logo|slot|图片|图像|视频|媒体|照片|徽标|标志|槽/i.test(String(text || ''));
}

function isVisualSlotCountBinding(binding, controls = []) {
  const control = (controls || []).find(item => (
    item?.key && (item.key === binding?.key || item.key === binding?.publicKey)
  ) || (
    item?.publicKey && (item.publicKey === binding?.key || item.publicKey === binding?.publicKey)
  ));
  const text = `${binding?.key || ''} ${binding?.publicKey || ''} ${binding?.label || ''} ${control?.label || ''}`;
  return /(count|数量)$/i.test(String(binding?.key || control?.key || ''))
    && /(frame|image|media|photo|picture|slot|gallery|画框|画格|图片|图像|媒体|照片|相册)/i.test(text);
}

function preferredMediaBindingArray(binding, mediaArrays = []) {
  if (!mediaArrays.length) return null;
  const stem = normalizeName(String(binding?.publicKey || binding?.key || '').replace(/Count$/i, ''));
  const exact = mediaArrays.find(key => normalizeName(key).startsWith(stem));
  return exact || mediaArrays[0];
}

function narrowCountBindingArrays(binding, arrays) {
  if (!arrays.length) return arrays;
  const scored = arrays.map(pathName => ({ pathName, score: countArrayNameScore(binding?.key, pathName) }));
  const best = Math.max(...scored.map(item => item.score));
  if (best <= 0) return arrays;
  return scored.filter(item => item.score === best).map(item => item.pathName);
}

function countArrayNameScore(countKey, pathName) {
  const stem = normalizeName(String(countKey || '').replace(/Count$/i, ''));
  if (!stem) return 0;
  const aliases = countStemAliases(stem);
  const field = normalizeName(arrayFieldName(pathName));
  if (aliases.has(field)) return 3;
  const full = normalizeName(pathName);
  if (aliases.has(full)) return 2;
  return 0;
}

function countStemAliases(stem) {
  const aliases = {
    column: ['column', 'columns', 'coldata', 'colsdata', 'columndata', 'columnsdata'],
    col: ['column', 'columns', 'col', 'cols', 'coldata', 'colsdata'],
    row: ['row', 'rows', 'rowdata', 'rowsdata'],
  }[stem] || [];
  return new Set([stem, pluralize(stem), ...aliases].map(normalizeName));
}

function pluralize(value) {
  if (!value) return value;
  if (value.endsWith('y')) return `${value.slice(0, -1)}ies`;
  if (value.endsWith('s')) return value;
  return `${value}s`;
}

function normalizeName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function paletteColorsForLayout(defaultProps = {}) {
  for (const [key, value] of Object.entries(defaultProps || {})) {
    if (isColorArray(value)) return { key, colors: value.slice(0, 8) };
  }
  return null;
}

// allowedKeys: null = no extra filtering (legacy callers); a Set (possibly
// empty) restricts which color-like keys are allowed to surface, so callers
// that know the field's public propShape can suppress private visual colors.
function arrayItemColors(items = [], allowedKeys = null) {
  const colors = [];
  for (const item of items) {
    if (!isPlainObject(item)) continue;
    for (const [key, value] of Object.entries(item)) {
      if (allowedKeys && !allowedKeys.has(key)) continue;
      if (/colou?r|tone|accent|fill|tint|hex|swatch/i.test(key) && isColorString(value)) colors.push(value);
    }
  }
  return colors;
}

// 文案槽角色:eyebrow(短标签)/ title(标题)/ paragraph(段落)/ metric(数字)/ serial(序号)。
function copyRoleForField(pathName) {
  return {
    metric: 'metric',
    serial: 'serial',
    tagline: 'eyebrow',
    display: 'title',
    brief: 'paragraph',
    body: 'paragraph',
    compact: 'eyebrow',
  }[inferCopyDensity(pathName)] || 'eyebrow';
}

function buildCopyRoles(copyKeys = []) {
  const roles = {};
  // 扁平 copyKeys 已含 copy.eyebrow / items[].label 形态;数组路径(以 [] 结尾)按字段角色判定,不当 eyebrow 标题。
  for (const key of copyKeys) roles[key] = copyRoleForField(key);
  return roles;
}

function buildFieldContracts({ copyKeys = [], copyRoles = {}, arrayMeta = [], decorativeKeys = [], mediaSlots = [] } = {}) {
  const rows = [];
  for (const key of copyKeys || []) {
    rows.push({
      key,
      role: normalizeFieldContractRole(copyRoles[key]),
    });
  }
  for (const meta of arrayMeta || []) {
    rows.push({
      key: meta.key,
      role: meta.role,
      defaultCount: meta.defaultCount,
      defaultVisibleCount: meta.defaultVisibleCount,
      maxCount: meta.maxCount,
      countKey: meta.countKey,
    });
  }
  for (const key of decorativeKeys || []) {
    rows.push({
      key,
      role: 'decorative',
      writable: false,
      businessContent: false,
    });
  }
  for (const slot of mediaSlots || []) {
    rows.push({
      key: slot.field || slot.countKey,
      role: 'media',
      writableProp: slot.writableProp || slot.presetProp || null,
      accepts: slot.accepts || slot.acceptedKinds || [],
      acceptedKinds: slot.acceptedKinds || slot.accepts || [],
      acceptedKindsSource: slot.acceptedKindsSource || null,
      defaultCount: slot.defaultCount,
      defaultVisibleCount: slot.defaultVisibleCount ?? slot.defaultCount,
      maxCount: slot.maxCount ?? mediaSlotCapacity(slot),
      countKey: slot.publicCountKey || slot.countKey || null,
      maxFromKey: slot.maxFromKey,
      maxFromKeyOffset: slot.maxFromKeyOffset,
      maxByKey: slot.maxByKey,
      maxByValue: slot.maxByValue,
      canPresetMedia: slot.canPresetMedia === true,
    });
  }
  return dedupeFieldContracts(rows.filter(item => item.key));
}

function normalizeFieldContractRole(role) {
  return role === 'paragraph' ? 'body' : role;
}

function dedupeFieldContracts(rows) {
  const result = [];
  const seen = new Set();
  for (const row of rows) {
    const id = `${row.key}:${row.role}`;
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(row);
  }
  return result;
}

function buildFillPlan({ copyKeys = [], copyBudgets = {}, copyRoles = {}, arrayMeta = [], mediaSlots = [], defaultProps = {}, controls = [], countBindings = [], lengthBindings = [], numberBoundsConfig = {} } = {}) {
  return {
    text: buildFillPlanText(copyKeys, copyBudgets, copyRoles, defaultProps),
    arrays: buildFillPlanArrays(arrayMeta, copyBudgets, copyRoles, defaultProps, controls, countBindings, lengthBindings, numberBoundsConfig),
    media: buildFillPlanMedia(mediaSlots),
  };
}

function buildFillPlanText(copyKeys, copyBudgets, copyRoles, defaultProps) {
  return (copyKeys || [])
    .filter(key => !String(key).includes('[]'))
    .map(key => ({
      key,
      role: normalizeFieldContractRole(copyRoles[key]),
      type: simpleValueType(valueAtPath(defaultProps, key)),
      ...(copyBudgets[key]?.maxChars ? { maxChars: copyBudgets[key].maxChars } : {}),
    }))
    .filter(item => item.type !== 'object' && item.type !== 'array');
}

function buildFillPlanArrays(arrayMeta, copyBudgets, copyRoles, defaultProps, controls, countBindings, lengthBindings, numberBoundsConfig = {}) {
  const resolvedBindings = (countBindings || []).map(binding => ({ ...binding, arrays: resolveBindingArrays(binding, defaultProps, controls) }));
  return (arrayMeta || [])
    .map(meta => {
      const items = itemsForArrayPath(defaultProps, meta.key);
      const fieldItems = items;
      const explicitBoundsByField = explicitNumberBoundsForArrayKey(numberBoundsConfig, meta.key);
      const itemFields = fillPlanItemFields(meta.key, fieldItems.length ? fieldItems : items, copyBudgets, copyRoles, explicitBoundsByField);
      const nestedArrays = fillPlanNestedArrays(meta.key, items, copyBudgets, copyRoles, defaultProps, controls, resolvedBindings, lengthBindings);
      const itemShape = fillPlanArrayItemShape(items, meta.key);
      const itemBudget = fillPlanStringArrayItem(meta.key, itemShape, copyBudgets, copyRoles);
      const numericRange = isNestedArrayPath(meta.key) ? numericRangeForValues(valuesForPattern(defaultProps, meta.key)) : null;
      const lengthBinding = lengthBindingForPath(meta.key, lengthBindings);
      const fixedLength = fixedLengthForArrayPath(defaultProps, meta.key);
      return {
        key: meta.key,
        role: meta.role,
        visibleCount: meta.defaultVisibleCount,
        maxCount: meta.maxCount,
        countKey: meta.countKey,
        ...(lengthBinding ? fillPlanLengthBinding(lengthBinding) : {}),
        ...(!meta.countKey && !lengthBinding && fixedLength ? fixedLength : {}),
        ...(itemShape ? { itemShape } : {}),
        ...(itemBudget ? { item: itemBudget } : {}),
        ...(numericRange ? { numericRange } : {}),
        ...(Object.keys(itemFields).length ? { itemFields } : {}),
        ...(Object.keys(nestedArrays).length ? { nestedArrays } : {}),
      };
    })
    .filter(item => item.itemShape || item.itemFields || item.nestedArrays);
}

function fillPlanStringArrayItem(arrayKey, itemShape, copyBudgets, copyRoles) {
  if (itemShape !== 'string') return null;
  const itemKey = `${arrayKey}[]`;
  const budget = copyBudgets[itemKey];
  if (!budget?.maxChars) return null;
  return {
    role: normalizeFieldContractRole(copyRoles[itemKey] || copyRoleForField(itemKey)),
    maxChars: budget.maxChars,
  };
}

function itemsForArrayPath(defaultProps, pathName) {
  if (isNestedArrayPath(pathName)) return arraysAtPath(defaultProps, pathName).flatMap(item => item);
  return Array.isArray(valueAtPath(defaultProps, pathName)) ? valueAtPath(defaultProps, pathName) : [];
}

function buildFillPlanMedia(mediaSlots = []) {
  return (mediaSlots || [])
    .filter(slot => slot.field && slot.canPresetMedia === true)
    .map(slot => ({
      key: slot.field,
      write: slot.writableProp || slot.presetProp || `props.${slot.field}`,
      visibleCount: slot.defaultVisibleCount ?? slot.defaultCount,
      maxCount: slot.maxCount ?? mediaSlotCapacity(slot),
      countKey: slot.publicCountKey || slot.countKey || null,
      maxFromKey: slot.maxFromKey,
      maxFromKeyOffset: slot.maxFromKeyOffset,
      maxByKey: slot.maxByKey,
      maxByValue: slot.maxByValue,
      accepts: slot.accepts || slot.acceptedKinds || [],
      acceptedKindsSource: slot.acceptedKindsSource || null,
      itemShape: slot.itemShape,
    }));
}

function fillPlanItemFields(arrayKey, items, copyBudgets, copyRoles, explicitBoundsByField = null) {
  const prunedItems = pruneContractItems(items, arrayKey);
  const shape = prunedItems.find(isPlainObject);
  if (!shape) return {};
  // 与 validateFillableValueShape 校验时同一推导(numberBoundsForArrayItems,来自
  // src/prop-contract-core.mjs,单一实现):只有数组项的直接标量字段(无点号的顶层 key)
  // 才会被数值上下限拦截,深一层嵌套字段目前不在校验范围内,因此这里也只对顶层字段算
  // numericBounds,避免暴露一个实际并不会被拦的假契约。
  const itemNumberBounds = numberBoundsForArrayItems(items.filter(isPlainObject), explicitBoundsByField);
  const fields = {};
  function collect(value, fieldPath) {
    if (Array.isArray(value)) return;
    if (isPlainObject(value)) {
      for (const [field, child] of Object.entries(value)) collect(child, `${fieldPath}.${field}`);
      return;
    }
    const pathName = `${arrayKey}[].${fieldPath}`;
    if (!isFillableCopyLeaf(pathName, value)) return;
    const bounds = fieldPath.includes('.') ? null : itemNumberBounds.get(fieldPath);
    fields[fieldPath] = {
      role: normalizeFieldContractRole(copyRoles[pathName] || copyRoleForField(pathName)),
      type: simpleValueType(value),
      ...(simpleValueType(value) === 'number' ? { numericRange: numericRangeForValues(items.map(item => valueAtPath(item, fieldPath))) } : {}),
      // numericBounds:props:safe/validate:goal-spec/render 实际执行数值上下限校验时的同一
      // 推导(numberBoundsForArrayItems)。enforced:false 表示这是从默认示例数据反推的提示性
      // 范围,不是硬限制——真实业务数值可以超出;enforced:true(显式声明或识别出的几何/坐标
      // 形状)才会被拦截。semantics 标注该字段更像比例(normalized,0-1)还是屏幕坐标
      // (coordinate),帮助判断该填比例还是真实值。
      ...(bounds ? { numericBounds: roundNumberBounds(bounds) } : {}),
      ...(copyBudgets[pathName]?.maxChars ? { maxChars: copyBudgets[pathName].maxChars } : {}),
    };
  }
  for (const [field, value] of Object.entries(shape)) collect(value, field);
  return fields;
}

function roundNumberBounds(bounds) {
  return {
    min: roundBoundNumber(bounds.min),
    max: roundBoundNumber(bounds.max),
    enforced: bounds.explicit === true,
    ...(bounds.semantics ? { semantics: bounds.semantics } : {}),
  };
}

function roundBoundNumber(value) {
  return Number.isInteger(value) ? value : Number(value.toFixed(2));
}

function fillPlanNestedArrays(arrayKey, items, copyBudgets, copyRoles, defaultProps, controls, resolvedBindings, lengthBindings) {
  const shape = pruneContractItems(items, arrayKey).find(isPlainObject);
  if (!shape) return {};
  const nested = {};
  for (const [field, value] of Object.entries(shape)) {
    const pathName = `${arrayKey}[].${field}`;
    if (!Array.isArray(value) || isMediaArrayKey(field) || !isContractContentArray(pathName, value)) continue;
    const countMeta = countMetaForNestedArray(pathName, field, value, defaultProps, controls, resolvedBindings);
    const defaultArrays = arraysAtPath(defaultProps, pathName);
    const numericRange = numericRangeForValues(defaultArrays);
    const lengthBinding = lengthBindingForPath(pathName, lengthBindings);
    const fixedLength = fixedLengthForNestedArray(items, field);
    nested[field] = {
      visibleCount: countMeta.visibleCount,
      maxCount: countMeta.maxCount,
      countKey: countMeta.countKey,
      ...(lengthBinding ? fillPlanLengthBinding(lengthBinding) : {}),
      ...(!countMeta.countKey && !lengthBinding && fixedLength ? fixedLength : {}),
      ...(numericRange ? { numericRange } : {}),
      itemShape: fillPlanArrayItemShape(value, pathName) || 'string',
    };
    const nestedItems = defaultArrays.flatMap(item => item);
    const nestedFields = fillPlanItemFields(pathName, nestedItems.length ? nestedItems : value, copyBudgets, copyRoles);
    if (Object.keys(nestedFields).length) nested[field].itemFields = nestedFields;
    const budget = copyBudgets[`${pathName}[]`];
    const role = copyRoles[`${pathName}[]`];
    if (role || budget?.maxChars) {
      nested[field].item = {
        role: normalizeFieldContractRole(role || copyRoleForField(`${pathName}[]`)),
        ...(budget?.maxChars ? { maxChars: budget.maxChars } : {}),
      };
    }
  }
  return nested;
}

// 与 validateFillableValueShape 的定长嵌套数组判定同口径:只要不是自由列表字段
// (isFreeListField),该嵌套数组在鉴权时就必须逐下标匹配默认长度——不限于数值内容
// (如 quadrants[].dirs 是字符串数组,仍会被拦)。之前这里额外要求数值内容
// (isFixedCapacityArray) 会漏报字符串类的定长嵌套数组,导致契约不透明。
function lengthLockedArrayLens(field, arrays = []) {
  if (isFreeListField(field)) return null;
  const lengths = arrays.filter(Array.isArray).map(value => value.length);
  if (!lengths.length) return null;
  const unique = new Set(lengths);
  return unique.size === 1 ? { fixedLength: lengths[0] } : { fixedLengths: lengths };
}

function fixedLengthForNestedArray(items, field) {
  const arrays = (items || [])
    .map(item => item?.[field])
    .filter(Array.isArray);
  return lengthLockedArrayLens(field, arrays);
}

function fixedLengthForArrayPath(defaultProps, pathName) {
  if (!String(pathName || '').includes('[].')) return null;
  const arrays = arraysAtPath(defaultProps, pathName);
  return lengthLockedArrayLens(arrayFieldName(pathName), arrays);
}

function isFreeListField(field) {
  return /^(tags?|chips?|bullets?|labels?)$/i.test(String(field || ''));
}

function isFixedCapacityArray(field, arrays = []) {
  if (isFreeListField(field)) return false;
  return arrays.some(array => Array.isArray(array) && array.some(isFixedCapacityArrayItem));
}

function isFixedCapacityArrayItem(item) {
  if (typeof item === 'number' && Number.isFinite(item)) return true;
  if (Array.isArray(item)) return item.some(isFixedCapacityArrayItem);
  if (!isPlainObject(item)) return false;
  return Object.values(item).some(value => typeof value === 'number' && Number.isFinite(value));
}

function arraysAtPath(source, pathName) {
  const parts = String(pathName || '').split('.').filter(Boolean);
  return arraysAtPathParts([source], parts);
}

function arraysAtPathParts(values, parts) {
  if (!parts.length) return values.filter(Array.isArray);
  const [part, ...rest] = parts;
  const isArrayPart = part.endsWith('[]');
  const key = isArrayPart ? part.slice(0, -2) : part;
  const next = [];
  for (const value of values) {
    if (value == null) continue;
    const child = key ? value[key] : value;
    if (isArrayPart) {
      if (Array.isArray(child)) next.push(...child);
    } else {
      next.push(child);
    }
  }
  return arraysAtPathParts(next, rest);
}

function lengthBindingForPath(pathName, lengthBindings = []) {
  return (lengthBindings || []).find(binding => binding?.dependent === pathName && binding.relation === 'same-length') || null;
}

function fillPlanLengthBinding(binding) {
  return {
    sameLengthAs: binding.anchor,
    ...(binding.countKey ? { sameLengthCountKey: binding.countKey } : {}),
  };
}

function countMetaForNestedArray(pathName, field, items, defaultProps, controls, resolvedBindings = []) {
  const bound = countMetaForArray(pathName, resolvedBindings);
  if (bound.countKey) {
    return {
      countKey: bound.countKey,
      visibleCount: defaultVisibleCountForArray(bound.countKey, items, controls, defaultProps),
      maxCount: maxCountForArray(bound.max, items),
    };
  }
  const control = countControlForArrayField(field, controls);
  const value = control ? defaultProps?.[control.key] ?? control.default : null;
  const visibleCount = control ? numberOrNull(value) ?? items.length : items.length;
  const maxCount = control || isFixedCapacityArray(field, [items]) ? maxCountForArray(control?.max, items) : undefined;
  return {
    countKey: control?.publicKey || control?.key || null,
    visibleCount,
    maxCount,
  };
}

function countControlForArrayField(field, controls = []) {
  const base = singularFieldName(field);
  const candidates = new Set([
    ...(base ? [`${base}Count`, `${base}Total`] : []),
    `${field}Count`,
  ].map(item => item.toLowerCase()));
  return nonMediaCountControls(controls).find(control => {
    const keys = [control.key, control.publicKey].filter(Boolean).map(item => String(item).toLowerCase());
    return keys.some(key => candidates.has(key));
  }) || null;
}

function singularFieldName(field) {
  const value = String(field || '').toLowerCase();
  if (value.length <= 1) return value;
  if (value.endsWith('ies')) return `${value.slice(0, -3)}y`;
  if (value.endsWith('s')) return value.slice(0, -1);
  return value;
}

function fillPlanArrayItemShape(items, pathName = '') {
  const prunedItems = pruneContractItems(items, pathName);
  if (!prunedItems.length) return null;
  const object = prunedItems.find(isPlainObject);
  if (object) {
    const shape = {};
    for (const [key, value] of Object.entries(object)) {
      const childPath = pathName ? `${pathName}[].${key}` : key;
      if (Array.isArray(value)) {
        if (!isMediaArrayKey(key) && isContractContentArray(childPath, value)) {
          const childShape = fillPlanArrayValueShape(value, childPath);
          if (childShape.length) shape[key] = childShape;
        }
        continue;
      }
      if (isPlainObject(value)) {
        const childShape = fillableObjectShape(value, childPath);
        if (Object.keys(childShape).length) shape[key] = childShape;
        continue;
      }
      if (isFillableCopyLeaf(childPath, value)) shape[key] = simpleValueType(value);
    }
    return Object.keys(shape).length ? shape : null;
  }
  const tuple = fillPlanTupleShapeForArrayItems(prunedItems);
  if (tuple) return tuple;
  return simpleValueType(prunedItems.find(item => item != null));
}

function fillableObjectShape(value, pathName = '') {
  if (!isPlainObject(value)) return {};
  const shape = {};
  for (const [key, item] of Object.entries(value)) {
    const childPath = pathName ? `${pathName}.${key}` : key;
    if (Array.isArray(item)) {
      if (!isMediaArrayKey(key) && isContractContentArray(childPath, item)) {
        const childShape = fillPlanArrayValueShape(item, childPath);
        if (childShape.length) shape[key] = childShape;
      }
      continue;
    }
    if (isPlainObject(item)) {
      const childShape = fillableObjectShape(item, childPath);
      if (Object.keys(childShape).length) shape[key] = childShape;
      continue;
    }
    if (isFillableCopyLeaf(childPath, item)) shape[key] = simpleValueType(item);
  }
  return shape;
}

function fillPlanArrayValueShape(items, pathName = '') {
  const itemShape = fillPlanArrayItemShape(items, pathName);
  return itemShape == null ? [] : [itemShape];
}

function pruneContractItems(items, pathName = '') {
  if (!Array.isArray(items)) return [];
  return items
    .map(item => pruneContractValue(item, `${pathName}[]`))
    .filter(item => !isPrunedContractOmit(item));
}

function fillPlanTupleShapeForArrayItems(items) {
  const arrays = (items || []).filter(Array.isArray);
  if (!arrays.length) return null;
  const fixedLength = arrays.every(item => item.length === arrays[0].length) ? arrays[0].length : null;
  const length = fixedLength ?? Math.max(...arrays.map(item => item.length));
  return Array.from({ length }, (_, index) => fillPlanTupleItemShape(arrays.map(item => item[index]).filter(item => item !== undefined)));
}

function fillPlanTupleItemShape(values) {
  const objects = values.filter(isPlainObject);
  if (objects.length) {
    return Object.fromEntries(Object.entries(objects[0]).map(([key, value]) => [
      key,
      Array.isArray(value) ? fillPlanArrayValueShape(value) : simpleValueType(value),
    ]));
  }
  const arrays = values.filter(Array.isArray);
  if (arrays.length) return fillPlanTupleShapeForArrayItems(arrays);
  return simpleValueType(values.find(item => item != null));
}

function simpleValueType(value) {
  if (isSerializedReactElementLike(value)) return 'string';
  if (Array.isArray(value)) return 'array';
  if (value == null) return 'string';
  if (typeof value === 'object') return 'object';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'string';
}

function arrayItemRoles(items = [], arrayKey) {
  const shape = pruneContractItems(items, arrayKey).find(isPlainObject);
  if (!shape) return undefined;
  const roles = {};
  for (const field of Object.keys(shape)) {
    const value = shape[field];
    if (Array.isArray(value) || isPlainObject(value)) continue;
    if (!isFillableCopyLeaf(`${arrayKey}[].${field}`, value)) continue;
    roles[field] = copyRoleForField(`${arrayKey}[].${field}`);
  }
  return Object.keys(roles).length ? roles : undefined;
}

// JAD-213:数组语义角色枚举。启发式:字段名 → itemShape 兜底(value/unit→metric)→ misc。
const ARRAY_ROLE_KEYWORDS = {
  metric: ['stats', 'stat', 'data', 'metrics', 'metric', 'dials', 'dialsdata', 'dial', 'gauges', 'gauge', 'kpis', 'kpi', 'scores', 'numbers', 'meters'],
  distribution: ['shares', 'share', 'splits', 'split', 'regions', 'region', 'allocations', 'allocation', 'breakdowns', 'breakdown', 'parts', 'part'],
  chapter: ['chapters', 'chapter', 'sections', 'agenda', 'contents', 'toc'],
  step: ['steps', 'step', 'phases', 'phase', 'stages', 'stage', 'milestones', 'rounds', 'timeline', 'events'],
  quadrant: ['quadrants', 'quadrant'],
  media: ['photos', 'images', 'media', 'logos', 'thumbs', 'gallery', 'pictures'],
  'list-item': ['items', 'item', 'list', 'lists', 'cards', 'card', 'tiles', 'tile', 'chips', 'points', 'bullets', 'rows', 'features', 'principles', 'takeaways', 'callouts', 'segments', 'plans'],
};

const METRIC_FIELD_RE = /^(value|val|amount|amt|funding|fund|funds|budget|spend|investment|capital|revenue|sales|cost|price|arr|mrr|gmv|share|pct|percent|percentage|ratio|rate|portion|weight|num|number|score|index|rank|total|metric)$/;
const DISTRIBUTION_METRIC_FIELD_RE = /^(share|pct|percent|percentage|ratio|portion|weight)$/;
const LABEL_FIELD_RE = /^(unit|label|dim|name|cap|caption|note|title|category|en)$/;

function arrayFieldName(pathName) {
  return String(pathName || '').split('.').at(-1).replace(/\[\]$/, '').toLowerCase();
}

function isNestedArrayPath(pathName) {
  return String(pathName || '').includes('[].');
}

function arrayRole(pathName, items = []) {
  const field = arrayFieldName(pathName);
  for (const [role, keywords] of Object.entries(ARRAY_ROLE_KEYWORDS)) {
    if (keywords.includes(field)) return role;
  }
  // itemShape 兜底:含 share/funding/value 等数值字段 + 标签字段 → metric/distribution。
  const shape = items.find(isPlainObject);
  if (shape) {
    const entries = Object.entries(shape).map(([key, value]) => [normalizeName(key), value]);
    const metricFields = entries.filter(([key, value]) => typeof value === 'number' && isMetricFieldName(key));
    if (metricFields.length && entries.some(([key]) => LABEL_FIELD_RE.test(key))) {
      return metricFields.some(([key]) => isDistributionMetricFieldName(key)) ? 'distribution' : 'metric';
    }
  }
  return 'misc';
}

function isMetricFieldName(field) {
  return METRIC_FIELD_RE.test(normalizeName(field));
}

function isDistributionMetricFieldName(field) {
  return DISTRIBUTION_METRIC_FIELD_RE.test(normalizeName(field));
}

// 非媒体的数量控件(供 copy 内/无声明数组按长度匹配 count 控件)。
function nonMediaCountControls(controls = []) {
  return (controls || []).filter(control => {
    const key = String(control.key || '');
    const type = String(control.type || '').toLowerCase();
    if (!/count$/i.test(key)) return false;
    if (!['number', 'range', 'slider'].includes(type)) return false;
    return !isMediaCountControl(control);
  });
}

// JAD-212:数组路径(顶层或 copy 内)→ count 控件。只能来自已解析 countBindings。
function countMetaForArray(pathName, resolvedBindings) {
  const binding = (resolvedBindings || []).find(item => (item.arrays || []).includes(pathName));
  if (binding) {
    return {
      countKey: binding.publicKey || binding.key,
      min: binding.min ?? null,
      max: binding.max ?? null,
      maxFromKey: binding.maxFromKey,
      maxFromKeyOffset: binding.maxFromKeyOffset,
      maxByKey: binding.maxByKey,
      maxByValue: binding.maxByValue,
    };
  }
  return { countKey: null, min: null, max: null };
}

function defaultVisibleCountForArray(countKey, items, controls = [], defaultProps = {}) {
  if (!countKey) return items.length;
  const control = (controls || []).find(item => item.key === countKey || item.publicKey === countKey);
  const value = control ? defaultProps?.[control.key] ?? control.default : null;
  const count = Number(value);
  return Number.isFinite(count) ? count : items.length;
}

function maxCountForArray(max, items) {
  const count = max == null ? NaN : Number(max);
  return Number.isFinite(count) && count >= 0 ? count : items.length;
}

// 承载内容的数组路径:顶层数组 + copy 等对象内的一层嵌套数组(排除媒体/纯色板)。
function discoverContentArrayPaths(defaultProps = {}) {
  const out = [];
  for (const [key, value] of Object.entries(defaultProps || {})) {
    if (Array.isArray(value)) {
      if (!isMediaArrayKey(key) && isContractContentArray(key, value)) out.push(key);
      for (const pathName of nestedArrayPaths(value, key)) out.push(pathName);
      continue;
    }
    if (!isPlainObject(value)) continue;
    for (const [nestedKey, nestedValue] of Object.entries(value)) {
      if (isNumericPathSegment(nestedKey)) continue;
      const pathName = `${key}.${nestedKey}`;
      if (Array.isArray(nestedValue) && !isMediaArrayKey(nestedKey) && isContractContentArray(pathName, nestedValue)) {
        out.push(`${key}.${nestedKey}`);
      }
      if (Array.isArray(nestedValue)) {
        for (const pathName of nestedArrayPaths(nestedValue, `${key}.${nestedKey}`)) out.push(pathName);
      }
    }
  }
  return [...new Set(out)];
}

function nestedArrayPaths(items, prefix) {
  const out = [];
  for (const item of items || []) {
    if (!isPlainObject(item)) continue;
    for (const [key, value] of Object.entries(item)) {
      if (!Array.isArray(value)) continue;
      const pathName = `${prefix}[].${key}`;
      if (!isMediaArrayKey(key) && isContractContentArray(pathName, value)) out.push(pathName);
      for (const nestedPathName of nestedArrayPaths(value, pathName)) out.push(nestedPathName);
    }
  }
  return out;
}

function isNumericPathSegment(value) {
  return /^\d+$/.test(String(value || ''));
}

function valueAtPath(defaultProps, pathName) {
  let current = defaultProps;
  for (const segment of String(pathName || '').split('.')) {
    if (current == null) return undefined;
    if (Array.isArray(current)) {
      const arrayKey = segment.endsWith('[]') ? segment.slice(0, -2) : segment;
      const values = current.map(item => arrayKey ? item?.[arrayKey] : item).filter(item => item !== undefined);
      current = segment.endsWith('[]') ? values.find(Array.isArray) : values.find(item => item !== undefined);
      continue;
    }
    if (segment.endsWith('[]')) {
      const array = current[segment.slice(0, -2)];
      if (!Array.isArray(array)) return undefined;
      current = array;
      continue;
    }
    current = current[segment];
  }
  return current;
}

function valuesForPattern(source, pathName) {
  const parts = String(pathName || '').split('.').filter(Boolean);
  return valuesForPatternParts([source], parts);
}

function valuesForPatternParts(values, parts) {
  if (!parts.length) return values.length === 1 ? values[0] : values;
  const [part, ...rest] = parts;
  const isArrayPart = part.endsWith('[]');
  const key = isArrayPart ? part.slice(0, -2) : part;
  const next = [];
  for (const value of values) {
    if (value == null) continue;
    const child = key ? value[key] : value;
    if (isArrayPart) {
      if (Array.isArray(child)) next.push(...child);
    } else {
      next.push(child);
    }
  }
  return valuesForPatternParts(next, rest);
}

function numericRangeForValues(value) {
  const numbers = collectNumbers(value);
  if (!numbers.length) return null;
  return { observedMin: Math.min(...numbers), observedMax: Math.max(...numbers) };
}

function collectNumbers(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return [value];
  if (Array.isArray(value)) return value.flatMap(collectNumbers);
  if (isPlainObject(value)) return Object.values(value).flatMap(collectNumbers);
  return [];
}

// 每个内容数组的填充元数据:默认条目数、绑定的 count 控件、范围、默认配色、语义角色、字段角色。
function buildArrayMeta(defaultProps = {}, countBindings = [], controls = [], { withItemRoles = false, propShapes = null } = {}) {
  const paths = discoverContentArrayPaths(defaultProps);
  const resolvedBindings = (countBindings || []).map(binding => ({ ...binding, arrays: resolveBindingArrays(binding, defaultProps, controls) }));
  return paths.slice(0, 8).map(pathName => {
    const items = Array.isArray(valueAtPath(defaultProps, pathName)) ? valueAtPath(defaultProps, pathName) : [];
    const { countKey, min, max, maxFromKey, maxFromKeyOffset, maxByKey, maxByValue } = countMetaForArray(pathName, resolvedBindings);
    const defaultVisibleCount = defaultVisibleCountForArray(countKey, items, controls, defaultProps);
    const nested = isNestedArrayPath(pathName);
    const fixedCapacity = nested && isFixedCapacityArray(arrayFieldName(pathName), [items]);
    const maxCount = countKey || !nested || fixedCapacity ? maxCountForArray(max, items) : undefined;
    // Only surface a color as an inspect-facing default when the array's
    // item shape actually keeps that field in the fillable propShapes --
    // otherwise it is a private visual field the contract layer already
    // excludes from authoring, and arrayMeta should not leak it back out.
    const shapeArray = propShapes ? valueAtPath(propShapes, pathName) : undefined;
    const itemShape = Array.isArray(shapeArray) ? shapeArray[0] : undefined;
    const publicColorKeys = isPlainObject(itemShape)
      ? new Set(Object.keys(itemShape).filter(key => /colou?r|tone|accent|fill|tint|hex|swatch/i.test(key)))
      : null;
    const colors = [...new Set(arrayItemColors(items, publicColorKeys))];
    const meta = {
      key: pathName,
      role: arrayRole(pathName, items),
      defaultCount: items.length,
      defaultVisibleCount,
      countKey,
      min,
      max,
      maxFromKey,
      maxFromKeyOffset,
      maxByKey,
      maxByValue,
      maxCount,
    };
    if (colors.length) meta.defaultColors = colors.slice(0, 8);
    if (withItemRoles) {
      const itemRoles = arrayItemRoles(items, pathName);
      if (itemRoles) meta.itemRoles = itemRoles;
    }
    return meta;
  });
}

// JAD-212:正文是否完全由组件硬编码不可填。
// 条件:存在指向数组的 count 控件,但其数组在 defaultProps/copy 全部缺席,
// 且无可发现的内容数组,且剩余 copyKeys 仅 eyebrow/serial 类(无 title/paragraph/metric 正文)。
function detectContentLocked({ copyKeys, copyRoles, arrayMeta, resolvedBindings, defaultProps }) {
  if (arrayMeta.length) return null;
  const countTowardAbsent = (resolvedBindings || []).filter(binding => {
    const arrays = binding.arrays || [];
    return arrays.length && arrays.every(pathName => valueAtPath(defaultProps, pathName.split('[')[0]) === undefined);
  });
  if (!countTowardAbsent.length) return null;
  const hasBodyCopy = (copyKeys || []).some(key => !['eyebrow', 'serial'].includes(copyRoles[key]));
  if (hasBodyCopy) return null;
  const arr = countTowardAbsent.map(binding => (binding.arrays || []).join('/')).join(', ');
  return `正文数组(${arr})由组件硬编码,不在 props/copy 中,正文不可由 props 定制;只能改 count 控件数量`;
}


function getCopyBudgets(defaultProps, copyKeys) {
  const budgets = {};
  for (const key of copyKeys) {
    collectCopyBudgets(defaultProps?.[key], key, budgets);
  }
  return budgets;
}

function collectCopyBudgets(value, pathName, budgets) {
  value = pruneContractValue(value, pathName);
  if (isPrunedContractOmit(value)) return;
  if (typeof value === 'string' || typeof value === 'number') {
    if (isFillableCopyLeaf(pathName, value)) setCopyBudget(budgets, pathName, copyBudget(pathName, value));
    return;
  }
  if (isSerializedReactElementLike(value)) {
    if (isFillableCopyLeaf(pathName, value)) setCopyBudget(budgets, pathName, copyBudget(pathName, reactElementText(value)));
    return;
  }
  if (Array.isArray(value)) {
    value.slice(0, 4).forEach(item => collectCopyBudgets(item, `${pathName}[]`, budgets));
    return;
  }
  if (!isPlainObject(value)) return;
  for (const [key, item] of Object.entries(value)) {
    collectCopyBudgets(item, `${pathName}.${key}`, budgets);
  }
}

function setCopyBudget(budgets, key, budget) {
  if (!budget) return;
  const existing = budgets[key];
  if (!existing || budget.maxChars < existing.maxChars) budgets[key] = budget;
}

export function copyBudget(pathName, value) {
  const density = inferCopyDensity(pathName);
  const length = charLength(value);
  const floor = { body: 18, serial: 4, tagline: 8 }[density] ?? 6;
  const base = Math.max(length, floor);
  const maxChars = {
    // serial/序号槽:物理可容字符极少(如 80px mono 大序号),收紧到 6–8。
    serial: Math.min(8, Math.max(6, Math.ceil(base * 1.2))),
    metric: Math.max(8, Math.min(16, Math.ceil(base * 1.4))),
    // 刊头 mono 标语(panelEn 等):单行不换行,约束在 ~14。
    tagline: Math.min(14, Math.max(12, Math.ceil(base * 1.1))),
    display: Math.max(18, Math.min(36, Math.ceil(base * 1.8))),
    compact: Math.max(18, Math.min(42, Math.ceil(base * 1.8))),
    brief: Math.max(36, Math.min(80, Math.ceil(base * 1.6))),
    body: Math.max(36, Math.min(120, Math.ceil(base * 2.2))),
  }[density];
  return { density, maxChars };
}

export function inferCopyDensity(pathName) {
  const normalized = String(pathName || '').toLowerCase();
  const field = normalized.split('.').at(-1)?.replace(/\[\]/g, '') || normalized;
  const nested = normalized.includes('.') || normalized.includes('[]');
  // 序号 / 刊号槽:物理容量极小,先于 metric 命中,避免被当成普通数字放宽到 16。
  if (!nested && /^(panelindex|panelno|panelnum|vol|volume|issueno|serialno|partno)$/.test(field)) return 'serial';
  if (!nested && /^(panelen|panelsub|paneltag)$/.test(field)) return 'tagline';
  if (isMetricFieldName(field)) return 'metric';
  if (!nested && /^(title|titletop|titlebottom|headline|headlinehl|headlinetail|statement|quote|word|brand|kicker)$/.test(field)) return 'display';
  if (/^(lead|subtitle|sub|desc|description|summary|note|caption|detail|footnote|intro|insight|excerpt|takeaway|reason|conclusion)$/.test(field)) return 'brief';
  if (/^(body|copy|paragraph)$/.test(field)) return 'body';
  if (/^(title|headline|label|name|kicker|tag|chip|pill|category)$/.test(field)) return 'compact';
  return 'compact';
}

function charLength(value) {
  return Array.from(String(value ?? '')).length;
}

function hasFillableCopyLeaf(value, pathName) {
  value = pruneContractValue(value, pathName);
  if (isPrunedContractOmit(value)) return false;
  if (typeof value === 'string' || typeof value === 'number' || isSerializedReactElementLike(value)) {
    return isFillableCopyLeaf(pathName, value);
  }
  if (Array.isArray(value)) {
    return value.some(item => hasFillableCopyLeaf(item, `${pathName}[]`));
  }
  if (!isPlainObject(value)) return false;
  return Object.entries(value).some(([key, item]) => hasFillableCopyLeaf(item, `${pathName}.${key}`));
}

function isFillableCopyLeaf(pathName, value) {
  const field = pathFieldName(pathName);
  if (/axesData\[\]\.id$/i.test(String(pathName || '')) && typeof value === 'string') return true;
  if (isNonContentContractValue(pathName, value)) return false;
  if (isColorString(value) && /^(c|color|colour|accent|fill|stroke|background|bg|tint|hex)$/i.test(field)) return false;
  if (/^(id|key|type|kind|mode|variant|style|layout|align|side|position|fit|icon|href|url|src|className)$/i.test(field)) return false;
  if (/^(theme|tone|q)$/i.test(field) && isTokenLike(value)) return false;
  return true;
}

function pathFieldName(pathName) {
  return String(pathName || '').split('.').pop()?.replace(/\[\]$/, '') || '';
}

function isTokenLike(value) {
  if (typeof value !== 'string') return false;
  const text = value.trim();
  return /^[A-Za-z0-9_-]{1,24}$/.test(text);
}

function isCopyValue(value) {
  if (value == null) return false;
  if (['string', 'number'].includes(typeof value)) return true;
  if (Array.isArray(value)) return value.length > 0 && value.every(item => item == null || ['string', 'number'].includes(typeof item) || isPlainObject(item));
  return isPlainObject(value);
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function getMediaSlots(record) {
  const { controls, countBindings, defaultProps } = record;
  const slots = [];
  const explicitMediaSlotControls = (controls || []).filter(control => Array.isArray(control.mediaSlots) && control.mediaSlots.length);
  for (const control of explicitMediaSlotControls) {
    for (const spec of control.mediaSlots) {
      slots.push(explicitMediaSlot(spec, control, defaultProps, record));
    }
  }
  const explicitCountKeys = new Set(explicitMediaSlotControls.map(control => control.key).filter(Boolean));
  for (const binding of countBindings || []) {
    const mediaArrays = (binding.arrays || []).filter(isMediaArrayKey);
    for (const field of mediaArrays) {
      slots.push(mediaSlot(field, binding.key, controls, defaultProps, binding, record, { writeMode: 'initialProps' }));
    }
  }
  for (const control of controls || []) {
    if (!isWritableMediaControl(control)) continue;
    const field = isMediaArrayKey(control.key) ? control.key : firstMediaArray(defaultProps) || control.key;
    slots.push(mediaSlot(field, control.countKey, controls, defaultProps, control, record, { writeMode: 'initialProps' }));
  }
  for (const field of Object.keys(defaultProps || {}).filter(key => Array.isArray(defaultProps[key]) && isMediaArrayKey(key) && defaultArraySupportsInitialMedia(defaultProps[key]))) {
    const countControl = mediaCountControlForArrayField(field, controls);
    slots.push(mediaSlot(field, countControl?.key, controls, defaultProps, countControl || {}, record, { writeMode: 'initialProps' }));
  }
  for (const control of controls || []) {
    if (explicitCountKeys.has(control.key)) continue;
    if (!isMediaCountControl(control)) continue;
    for (const field of hostMediaFields(record, control)) {
      slots.push(mediaSlot(field, control.key, controls, defaultProps, control, record, { writeMode: 'initialProps' }));
    }
  }
  return annotateMediaSlotSemantics(dedupeSlots(slots), record);
}

function annotateMediaSlotSemantics(slots, record) {
  const bindingsByKey = new Map();
  for (const binding of record.countBindings || []) {
    if (binding.key) bindingsByKey.set(binding.key, binding);
    if (binding.publicKey) bindingsByKey.set(binding.publicKey, binding);
  }
  return slots.map(slot => {
    if (!slot.countKey || !slot.field) return slot;
    const binding = bindingsByKey.get(slot.countKey) || bindingsByKey.get(slot.publicCountKey);
    if (binding?.arrays?.includes(slot.field)) return slot;
    if (slot.explicit || !Array.isArray(record.defaultProps?.[slot.field]) || !isMediaCountBinding({ ...(binding || {}), key: slot.countKey, publicKey: slot.publicCountKey, label: slot.label })) {
      return { ...slot, explicitMediaSlot: true };
    }
    return slot;
  });
}

function explicitMediaSlot(spec, control, defaultProps, record) {
  const field = spec.field || spec.key;
  const writeMode = spec.writeMode || 'initialProps';
  const inferredCountKey = Object.prototype.hasOwnProperty.call(spec, 'countKey')
    ? spec.countKey
    : (isMediaCountControl(control) ? control.key : null);
  const slot = mediaSlot(field, inferredCountKey, [control], defaultProps, { ...control, ...spec }, record, { writeMode });
  return {
    ...slot,
    explicit: true,
    fieldPath: spec.fieldPath || slot.fieldPath,
    writableProp: spec.writableProp ?? slot.writableProp,
    countKey: inferredCountKey || null,
    publicCountKey: inferredCountKey ? slot.publicCountKey : null,
    maxCount: spec.maxCount ?? slot.maxCount,
    initialSrcSupported: spec.initialSrcSupported ?? slot.initialSrcSupported,
    canPresetMedia: spec.canPresetMedia ?? slot.canPresetMedia,
    presetProp: spec.presetProp ?? slot.presetProp,
  };
}

function mediaSlot(field, countKey, controls, defaultProps, source, record, { writeMode = 'initialProps' } = {}) {
  const countControl = controls.find(control => control.key === countKey);
  const fieldControl = controls.find(control => control.key === field);
  const defaultCount = countKey ? defaultProps[countKey] ?? countControl?.default : Array.isArray(defaultProps[field]) ? defaultProps[field].length : undefined;
  const max = source.max ?? countControl?.max ?? null;
  const defaultVisibleCount = defaultCount ?? null;
  const maxCount = mediaSlotMaxCount(max, defaultVisibleCount);
  const accepted = acceptedMediaKinds(record, field, fieldControl, source);
  const acceptedKinds = accepted.kinds;
  const itemShape = acceptedKinds.includes('video') ? 'string | {src,kind,type}' : 'string | {src}';
  return {
    role: 'media',
    field,
    fieldPath: `props.${field}`,
    writableProp: writeMode === 'initialProps' ? `props.${field}` : null,
    countKey: countKey || fieldControl?.countKey || null,
    publicCountKey: countControl?.publicKey || countKey || fieldControl?.countKey || null,
    defaultCount: defaultCount ?? null,
    defaultVisibleCount,
    min: source.min ?? countControl?.min ?? null,
    max,
    maxFromKey: source.maxFromKey ?? countControl?.maxFromKey,
    maxFromKeyOffset: source.maxFromKeyOffset ?? countControl?.maxFromKeyOffset,
    maxByKey: source.maxByKey ?? countControl?.maxByKey,
    maxByValue: source.maxByValue ?? countControl?.maxByValue,
    maxCount,
    controlKey: fieldControl?.key || null,
    publicControlKey: fieldControl?.publicKey || fieldControl?.key || null,
    label: fieldControl?.label || countControl?.label || null,
    accepts: acceptedKinds,
    acceptedKinds,
    acceptedKindsSource: accepted.source,
    itemShape,
    valueShape: `Array<${itemShape}>`,
    initialSrcSupported: writeMode === 'initialProps',
    runtimeReplaceable: true,
    writeMode,
    canPresetMedia: writeMode === 'initialProps',
    presetProp: writeMode === 'initialProps' ? `props.${field}` : null,
    emptySlotBehavior: countKey ? 'hiddenByCount' : 'placeholder',
  };
}

function dedupeSlots(slots) {
  const byField = new Map();
  const countOnly = [];
  for (const slot of slots) {
    if (!slot.field) {
      countOnly.push(slot);
      continue;
    }
    const existing = byField.get(slot.field);
    if (!existing || slotRank(slot) > slotRank(existing)) byField.set(slot.field, slot);
  }
  const writableCountKeys = new Set([...byField.values()].map(slot => slot.countKey).filter(Boolean));
  return [
    ...byField.values(),
    ...countOnly.filter(slot => !writableCountKeys.has(slot.countKey)),
  ];
}

function slotRank(slot) {
  let rank = 0;
  if (slot.initialSrcSupported) rank += 10;
  if (slot.explicit) rank += 5;
  if (slot.countKey) rank += 2;
  if (slot.controlKey) rank += 1;
  return rank;
}

function firstMediaArray(defaultProps = {}) {
  return Object.keys(defaultProps).find(key => Array.isArray(defaultProps[key]) && isMediaArrayKey(key) && defaultArraySupportsInitialMedia(defaultProps[key]));
}

function isWritableMediaControl(control) {
  const type = String(control.type || '').toLowerCase();
  const key = String(control.key || '').toLowerCase();
  if (['images', 'image', 'media', 'picture'].includes(type)) return true;
  if (isMediaArrayKey(key)) return true;
  return false;
}

function isMediaCountControl(control) {
  const type = String(control.type || '').toLowerCase();
  const key = String(control.key || '');
  const label = String(control.label || '');
  const desc = String(control.desc || control.description || '');
  if (!/(count|数量)$/i.test(key)) return false;
  if (!['number', 'range', 'slider'].includes(type)) return false;
  return isMediaCountText(`${key} ${label} ${desc}`);
}

function mediaCountControlForArrayField(field, controls = []) {
  const candidates = (controls || []).filter(isMediaCountControl);
  const visualSlotCandidates = (controls || []).filter(isVisualSlotCountControl);
  if (!candidates.length && visualSlotCandidates.length === 1) return visualSlotCandidates[0];
  if (!candidates.length) return null;
  const base = singularFieldName(field);
  const exactKeys = new Set([
    ...(base ? [`${base}Count`, `${base}Total`] : []),
    `${field}Count`,
  ].map(item => item.toLowerCase()));
  const exact = candidates.find(control => {
    const keys = [control.key, control.publicKey].filter(Boolean).map(item => String(item).toLowerCase());
    return keys.some(key => exactKeys.has(key));
  });
  if (exact) return exact;
  const scored = candidates
    .map(control => ({ control, score: countArrayNameScore(control.publicKey || control.key, field) }))
    .filter(item => item.score > 0);
  if (scored.length) {
    const best = Math.max(...scored.map(item => item.score));
    return scored.find(item => item.score === best)?.control || null;
  }
  return candidates.length === 1 ? candidates[0] : null;
}

function isVisualSlotCountControl(control) {
  const type = String(control?.type || '').toLowerCase();
  const key = String(control?.key || '');
  const text = `${key} ${control?.publicKey || ''} ${control?.label || ''} ${control?.desc || control?.description || ''}`;
  return /(count|数量)$/i.test(key)
    && ['number', 'range', 'slider'].includes(type)
    && /(frame|image|media|photo|picture|slot|gallery|画框|画格|图片|图像|媒体|照片|相册)/i.test(text);
}

function defaultArraySupportsInitialMedia(value) {
  if (!Array.isArray(value)) return false;
  if (!value.length) return true;
  return value.some(item => typeof item === 'string' || mediaObjectHasSource(item));
}

function mediaObjectHasSource(value) {
  return isPlainObject(value) && ['src', 'url', 'u', 'href'].some(key => typeof value[key] === 'string' && value[key]);
}

function acceptedMediaKinds(record, field, fieldControl, source = {}) {
  const explicit = normalizeAcceptedKinds(source.acceptedKinds || source.accepts || fieldControl?.acceptedKinds || fieldControl?.accepts);
  if (explicit.length) return { kinds: explicit, source: source.acceptedKinds || source.accepts ? 'slotContract' : 'controlContract' };
  const key = String(field || '').toLowerCase();
  if (/videos?/.test(key)) return { kinds: ['video'], source: 'fieldName' };
  if (isMediaArrayKey(key)) return { kinds: ['image', 'video'], source: 'mediaArrayField' };
  return { kinds: ['image'], source: 'fieldName' };
}

function normalizeAcceptedKinds(value) {
  const items = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,\s|]+/) : [];
  return [...new Set(items.map(normalizeMediaKind).filter(kind => kind === 'image' || kind === 'video'))];
}

function hostMediaFields(record, control) {
  if (!HOST_MEDIA_ARRAY_THEMES.has(record?.page?.themeKey)) return [];
  const kinds = acceptedMediaKinds(record, firstMediaArray(record?.defaultProps || {}) || 'images', null, control).kinds;
  if (!kinds.includes('image')) return [];
  const fields = ['images'];
  if (hasRealMediaField(record, 'media')) fields.push('media');
  return fields;
}

function hasRealMediaField(record, field) {
  return Array.isArray(record?.defaultProps?.[field])
    || (record?.controls || []).some(control => control.key === field && isWritableMediaControl(control));
}

function normalizeMediaKind(kind) {
  const value = String(kind || '').trim().toLowerCase();
  if (!value) return null;
  if (['image', 'images', 'photo', 'photos', 'picture', 'pictures'].includes(value)) return 'image';
  if (['video', 'videos', 'movie', 'movies'].includes(value)) return 'video';
  if (['mixed', 'media', 'any'].includes(value)) return 'mixed';
  return value;
}

function looksLikeVideoSrc(src) {
  return /\.(mp4|m4v|mov|webm|ogv)(?:[?#].*)?$/i.test(String(src || '').trim())
    || String(src || '').startsWith('data:video/');
}

function mimeForMediaSource(src, kind) {
  const ext = path.extname(String(src || '').split(/[?#]/)[0]).toLowerCase();
  return {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.m4v': 'video/mp4',
    '.mov': 'video/quicktime',
    '.webm': 'video/webm',
    '.ogv': 'video/ogg',
  }[ext] || (kind === 'video' ? 'video/mp4' : 'image/*');
}

function slotAcceptsKind(slot, kind) {
  const normalized = normalizeMediaKind(kind);
  if (!normalized) return true;
  const kinds = slot.acceptedKinds || [];
  if (normalized === 'mixed') return kinds.includes('image') && kinds.includes('video');
  return kinds.includes(normalized);
}

function isWritableMediaSlot(slot) {
  return slot?.role === 'media'
    && slot.canPresetMedia === true
    && slot.initialSrcSupported === true
    && Boolean(slot.writableProp || slot.fieldPath || slot.presetProp);
}

function inferRoles(page, mediaSlots = []) {
  return Object.entries(ROLE_KEYWORDS)
    .filter(([role, keywords]) => {
      if (role === 'cover') return isCoverCandidate(page.key);
      if (role === 'image') return mediaSlots.length > 0;
      if (role === 'ambient') return hasAmbientBackground(page);
      return pageMatches(page, keywords);
    })
    .map(([role]) => role)
    .slice(0, 6);
}

function hasAmbientBackground(page) {
  const props = page?.defaultProps || {};
  return props.backgroundMode === 'unicorn' || typeof props.unicornScene === 'string';
}

function pageMatches(page, keywords) {
  const text = pageSearchText(page);
  return keywords.some(keyword => text.includes(keyword.toLowerCase()));
}

function pageSearchText(page) {
  return `${page.key} ${page.slot || ''} ${page.label || ''}`.toLowerCase();
}

/** @param {import('../src/types').CompactLayoutCandidate} layout */
export function scoreLayout(layout, { normalizedRole, keywordText, requiresMedia, requestedMediaCount, normalizedMediaKind, needsInitialMedia }) {
  let score = 0;
  if (normalizedRole && layout.roles.includes(normalizedRole)) score += 20;
  if (keywordText && `${layout.label} ${layout.slot}`.toLowerCase().includes(keywordText)) score += 10;
  if (requiresMedia && layout.mediaSlots.some(isWritableMediaSlot)) score += 8;
  if (needsInitialMedia && layout.mediaSlots.some(slot => isWritableMediaSlot(slot) && slot.initialSrcSupported)) score += 6;
  if (normalizedMediaKind && layout.mediaSlots.some(slot => isWritableMediaSlot(slot) && slotAcceptsKind(slot, normalizedMediaKind))) score += 4;
  if (requestedMediaCount && layout.mediaSlots.some(slot => isWritableMediaSlot(slot) && Number(slot.defaultCount) === requestedMediaCount)) score += 3;
  score -= (Number(layout.pageNumber) || 0) / 1000;
  return score;
}

function getRequestedMediaCount({ plannedImages, providedImages, providedMedia, imageGen, needsVisual, mediaCount }) {
  const explicit = Number(mediaCount);
  if (Number.isFinite(explicit) && explicit > 0) return Math.round(explicit);
  const provided = mediaIntentCount(providedImages) || mediaIntentCount(providedMedia);
  if (provided) return provided;
  const planned = mediaIntentCount(plannedImages);
  if (planned) return planned;
  if (imageGen || needsVisual) return 1;
  return 0;
}

function mediaIntentCount(value) {
  if (Array.isArray(value)) return value.length;
  if (value === true) return 1;
  const number = Number(value);
  if (Number.isFinite(number) && number > 0) return Math.round(number);
  return 0;
}

function readManifest() {
  const file = path.join(ROOT, 'layout-manifest.json');
  if (!existsSync(file)) return { layouts: {} };
  return JSON.parse(readFileSync(file, 'utf8'));
}
