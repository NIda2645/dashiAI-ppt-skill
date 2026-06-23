import { Slide, Grain, Edge, Ghost, Rail, Corners, Wordmark, EmberText, ImageSlot, injectCSS, clampInt } from './ignBase.jsx';
import UnicornBackground, { UNICORN_BACKGROUND_CONTROL, createUnicornSceneControl } from '../../unicorn-background.jsx';

const CSS = `
.ign-ice{position:absolute;inset:0}
.ign-ice[data-tone="dark"]{--ice-fg:#14100C;--ice-fg2:rgba(22,17,13,0.80);--ice-fg3:rgba(22,17,13,0.60);
  --ice-line:rgba(22,17,13,0.28);--ice-stroke:#FFFFFF;--ice-pill:rgba(22,17,13,0.26)}
.ign-ice[data-tone="light"]{--ice-fg:#F4FAFF;--ice-fg2:rgba(244,250,255,0.82);--ice-fg3:rgba(244,250,255,0.64);
  --ice-line:rgba(244,250,255,0.32);--ice-stroke:#000000;--ice-pill:rgba(244,250,255,0.42)}
.ign-ice-img{position:absolute;inset:0;z-index:0}
.ign-ice-img .ign-imgslot{width:100%;height:100%;border-radius:0}
.ign-ice-img .ign-imgslot img,.ign-ice-img .ign-imgslot-ph{border-radius:0}
.ign-ice-scrim{position:absolute;inset:0;z-index:1;pointer-events:none}
.ign-ice[data-layout="bottomRight"] .ign-ice-scrim{
  background:linear-gradient(115deg,rgba(6,11,18,0) 46%,rgba(6,11,18,0.5) 100%),
   linear-gradient(0deg,rgba(6,11,18,0.55) 0%,rgba(6,11,18,0) 34%)}
.ign-ice[data-layout="bottomLeft"] .ign-ice-scrim,.ign-ice[data-layout="overlay"] .ign-ice-scrim{
  background:linear-gradient(245deg,rgba(6,11,18,0) 46%,rgba(6,11,18,0.5) 100%),
   linear-gradient(0deg,rgba(6,11,18,0.62) 0%,rgba(6,11,18,0) 38%)}
.ign-ice .ign-grain,.ign-ice .ign-edge{z-index:2}
.ign-ice .ign-ghost{z-index:1;color:var(--ice-line)}
.ign-ice .ign-rail-txt{color:var(--ice-fg3)}
.ign-ice .ign-corner{border-color:var(--ice-line)!important}
.ign-ice-head{position:absolute;left:128px;right:128px;top:56px;z-index:6;
  display:grid;grid-template-columns:1fr auto 1fr;align-items:center}
.ign-ice .ign-wm{color:var(--ice-fg)}
.ign-ice-status{justify-self:center;display:inline-flex;align-items:center;gap:12px;
  font-family:'Space Grotesk',sans-serif;font-size:24px;letter-spacing:0.18em;text-transform:uppercase;
  color:var(--ice-fg);border:1px solid var(--ice-pill);border-radius:999px;padding:10px 24px;white-space:nowrap}
.ign-ice-status .dot{width:8px;height:8px;border-radius:50%;background:var(--ign-c);
  box-shadow:0 0 10px rgba(226,42,12,0.6);animation:ign-ice-pulse 2.4s ease-in-out infinite}
@keyframes ign-ice-pulse{0%,100%{opacity:1}50%{opacity:0.32}}
.ign-ice-ix{justify-self:end;font-family:'Space Grotesk',sans-serif;font-size:24px;letter-spacing:0.24em;
  color:var(--ice-fg2);white-space:nowrap}
.ign-ice-ix b{color:var(--ign-c);font-weight:600}
.ign-ice-stats{position:absolute;top:110px;z-index:6;display:flex;align-items:baseline;gap:28px}
.ign-ice[data-layout="bottomRight"] .ign-ice-stats,.ign-ice[data-layout="overlay"] .ign-ice-stats{left:128px}
.ign-ice[data-layout="bottomLeft"] .ign-ice-stats{right:128px}
.ign-ice-stats .st{display:flex;align-items:baseline;gap:11px;white-space:nowrap}
.ign-ice-stats .v{font-family:'Space Grotesk',sans-serif;font-weight:600;font-size:34px;line-height:0.9;letter-spacing:-0.02em}
.ign-ice-stats .l{font-size:24px;font-weight:400;color:var(--ice-fg2)}
.ign-ice-stats .sep{width:1px;height:28px;background:var(--ice-line);transform:translateY(4px)}
.ign-ice-edge{position:absolute;top:0;bottom:0;z-index:6;display:flex;align-items:center;justify-content:center}
.ign-ice[data-layout="bottomLeft"] .ign-ice-edge{left:40px;right:auto}
.ign-ice[data-layout="bottomRight"] .ign-ice-edge,.ign-ice[data-layout="overlay"] .ign-ice-edge{right:40px;left:auto}
.ign-ice-edge span{writing-mode:vertical-rl;text-orientation:mixed;font-family:'Space Grotesk',sans-serif;
  font-size:24px;letter-spacing:0.34em;text-transform:uppercase;color:var(--ice-fg3);white-space:nowrap}
.ign-ice-lead{position:absolute;bottom:58px;z-index:6;width:780px}
.ign-ice[data-layout="bottomRight"] .ign-ice-lead{right:128px;text-align:right}
.ign-ice[data-layout="bottomLeft"] .ign-ice-lead{left:128px;text-align:left}
.ign-ice[data-layout="overlay"] .ign-ice-lead{left:128px;text-align:left;width:1180px;bottom:72px}
.ign-ice-h{font-size:88px;font-weight:900;line-height:0.96;letter-spacing:-0.04em;color:var(--ice-fg);
  font-family:'Noto Sans SC',sans-serif}
.ign-ice-h em{font-style:normal;font-weight:900;color:var(--ign-c)}
.ign-ice-h.stroke{-webkit-text-stroke:6px var(--ice-stroke);paint-order:stroke fill;
  text-shadow:0 2px 16px var(--ice-stroke),0 0 8px var(--ice-stroke)}
.ign-ice[data-tone="light"] .ign-ice-h{color:#FFFFFF}
.ign-ice-cta{margin-top:26px;display:inline-flex;align-items:center;gap:20px;
  font-family:'Space Grotesk',sans-serif;font-size:28px;font-weight:500;color:var(--ice-fg)}
.ign-ice-cta .ln{width:80px;height:1px;background:var(--ice-line)}
.ign-ice-cta .ar{font-size:38px;line-height:1;color:var(--ign-c)}
`;

export const icebreakerDefaultProps = {
  surface: 'ink',
  backgroundMode: 'unicorn',
  unicornScene: 'tech',
  layout: 'bottomRight',
  textTone: 'light',
  images: [],
  showScrim: true,
  headlineStroke: true,
  showStatus: true,
  showStats: true,
  statCount: 3,
  showEdgeLabel: true,
  showCta: true,
  showGhostMark: false,
  showScaffold: true,
  imagePlaceholder: '满铺主图 · 16:9',
  deckLabel: 'EXPEDITION',
  deckYear: '2026',
  ghostMark: '破冰',
  statusText: '航道开辟中 · LIVE',
  stats: [
    { v: '+182%', l: '自然航道流量' },
    { v: '×3.8', l: '冰区市场转化' },
    { v: '14 天', l: '首航即见效' },
  ],
  edgeLabel: '78°13′N · 15°33′E — EXPEDITION 2026',
  headlineHtml: '别人停在浮冰区，<br>我们<em>开出航道</em>。',
  ctaText: '驶入难做的市场',
};

export const icebreakerControls = [
  UNICORN_BACKGROUND_CONTROL,
  createUnicornSceneControl('tech'),
  { key: 'layout', type: 'select', label: '排版布局', default: 'bottomRight',
    options: [{ value: 'bottomRight', label: '右下留白' }, { value: 'bottomLeft', label: '左下留白' }, { value: 'overlay', label: '满图叠加' }],
    desc: '根据图片的空白位置安排文字。' },
  { key: 'textTone', type: 'select', label: '文字色调', default: 'dark',
    options: [{ value: 'dark', label: '深色' }, { value: 'light', label: '浅色' }],
    desc: '按图片明暗选择深/浅文字。' },
  { key: 'showScrim', type: 'toggle', label: '压暗层', default: false, desc: '给文字区域增加渐变压暗。' },
  { key: 'headlineStroke', type: 'toggle', label: '标题描边', default: true, desc: '给大标题增加描边。' },
  { key: 'surface', type: 'select', label: '氛围基调', default: 'paper',
    options: [{ value: 'paper', label: '柔和' }, { value: 'ink', label: '冷冽' }, { value: 'ember', label: '暖烈' }],
    desc: '控制颗粒、暗角等氛围叠层。' },
  { key: 'showStatus', type: 'toggle', label: '状态胶囊', default: true, desc: '顶部状态胶囊。' },
  { key: 'showStats', type: 'toggle', label: '指标行', default: true, desc: '顶部横排指标。' },
  { key: 'statCount', type: 'slider', label: '指标数量', default: 3, min: 2, max: 3, step: 1, desc: '指标行数量。' },
  { key: 'showEdgeLabel', type: 'toggle', label: '侧边竖排标签', default: true, desc: '侧边坐标标签。' },
  { key: 'showCta', type: 'toggle', label: '排版式 CTA', default: true, desc: '标题下方行动语。' },
  { key: 'showGhostMark', type: 'toggle', label: '背景大字符', default: false, desc: '角落超大幽灵字符。' },
  { key: 'showScaffold', type: 'toggle', label: '边框骨架', default: true, desc: '侧边竖排标签与四角括线。' },
];

export default function IcebreakerSlide(props) {
  injectCSS('ign-ice-css', CSS);
  const p = { ...icebreakerDefaultProps, ...props };
  const images = Array.isArray(p.images) ? p.images : [];
  const stats = (Array.isArray(p.stats) ? p.stats : []).slice(0, clampInt(p.statCount, 2, 3));
  const layout = ['bottomRight', 'bottomLeft', 'overlay'].includes(p.layout) ? p.layout : 'bottomRight';
  const tone = p.textTone === 'light' ? 'light' : 'dark';
  const useUnicorn = p.backgroundMode === 'unicorn';

  return (
    <Slide surface={p.surface}>
      <div className="ign-ice" data-layout={layout} data-tone={tone} style={{ position: 'absolute', inset: 0 }}>
        <div className="ign-ice-img">
          {useUnicorn
            ? <UnicornBackground scene={p.unicornScene} accent="var(--ign-a,#ffb168)" />
            : <ImageSlot src={images[0]} placeholder={p.imagePlaceholder} mode="fill" height="100%" radius={0} />}
        </div>
        {p.showScrim && <div className="ign-ice-scrim" />}
        <Grain /><Edge />
        {p.showGhostMark && <Ghost style={{ fontSize: 300, left: 70, top: 90 }}>{p.ghostMark}</Ghost>}
        {p.showScaffold && <Rail>Expedition — 破冰航道</Rail>}
        {p.showScaffold && <Corners />}

        <header className="ign-ice-head ign-a1">
          <Wordmark />
          {p.showStatus ? <span className="ign-ice-status"><span className="dot" />{p.statusText}</span> : <span />}
          <div className="ign-ice-ix">{p.deckLabel} · <b>{p.deckYear}</b></div>
        </header>

        {p.showStats && (
          <div className="ign-ice-stats ign-a2">
            {stats.map((s, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className="sep" />}
                <span className="st"><EmberText className="v">{s.v}</EmberText><span className="l">{s.l}</span></span>
              </React.Fragment>
            ))}
          </div>
        )}

        {p.showEdgeLabel && <div className="ign-ice-edge ign-a3"><span>{p.edgeLabel}</span></div>}

        <div className="ign-ice-lead ign-a1">
          <h1 className={`ign-ice-h${p.headlineStroke ? ' stroke' : ''}`} dangerouslySetInnerHTML={{ __html: p.headlineHtml }} />
          {p.showCta && <div className="ign-ice-cta">{p.ctaText}<span className="ln" /><span className="ar">→</span></div>}
        </div>
      </div>
    </Slide>
  );
}
