// SwSlideStack.jsx — Slide 02 (product matrix / the stack).
// All visible copy/data defaults live in `defaultProps`; layout/visibility
// props map 1:1 with `controls`.

import React from 'react';
import { swTheme, swCardPalette } from './swTheme.js';
import { SlideRoot, Bar, Footer, Hl, renderSwText } from './swBase.jsx';

const C = swTheme.color, F = swTheme.font, T = swTheme.type;

export const meta = { id: 'stack', index: 5, label: '产品矩阵 / The Stack' };

export const defaultProps = {
  accent: C.orange,
  cardCount: 4,
  columns: 2,
  focus: false,
  focusIndex: 1,
  showLede: true,
  showDeco: true,
  // —— content ——
  barMeta: '05 — The Stack',
  lede: '你只管[[写歌]]，发行 · 结算 · [[维权]]，[[声浪全包了]]。',
  cards: [
    { num: '01', cn: '一键发行', en: 'Release', body: '一次上传，自动分发到全球 30+ 流媒体平台，元数据与封面规格代为校验。', tag: '30+ 平台' },
    { num: '02', cn: '粉丝直连', en: 'Direct', body: '跳过算法与中间商，用专属页面与会员把听众沉淀为可经营的资产。', tag: '0 中间商' },
    { num: '03', cn: '收益透明', en: 'Ledger', body: '实时结算面板，按平台、地区、单曲拆解每一笔版税，路径可追溯。', tag: '72h 到账' },
    { num: '04', cn: '版权护盾', en: 'Shield', body: '作品自动登记存证，全网监测翻唱、采样与盗用，一键发起维权。', tag: '全网监测' },
  ],
  page: '05',
  total: '82',
};

export const controls = [
  { key: 'cardCount', label: '卡片数量', type: 'slider', def: 4, min: 2, max: 4, step: 1,
    desc: '展示的产品卡片数量' },
  { key: 'columns', label: '栏数', type: 'segment', def: 2,
    options: [{ value: 1, label: '1 栏' }, { value: 2, label: '2 栏' }], desc: '卡片网格的列数' },
  { key: 'focus', label: '重点强调', type: 'toggle', def: false, desc: '高亮某一张卡片，弱化其余' },
  { key: 'focusIndex', label: '强调第几个', type: 'slider', def: 1, min: 1, max: 4, step: 1,
    dependsOn: 'focus', desc: '被强调卡片的序号（1 起）' },
  { key: 'showLede', label: '显示导语', type: 'toggle', def: true, desc: '显示/隐藏顶部高亮短句' },
  { key: 'showDeco', label: '显示装饰', type: 'toggle', def: true, desc: '显示/隐藏卡片内的图形装饰' },
  { key: 'accent', label: '强调色', type: 'color', def: C.orange,
    options: [C.orange, C.purple, C.cyan, C.green], desc: '页脚等强调色' },
];

function Deco({ i, pal, compact = false }) {
  const wrap = compact
    ? { position: 'relative', width: 104, height: 74, justifySelf: 'center', alignSelf: 'center', opacity: 0.95, pointerEvents: 'none', zIndex: 1 }
    : { position: 'absolute', right: 30, bottom: 26, pointerEvents: 'none', zIndex: 0 };
  if (i === 1) {
    const d = compact ? [72, 46, 22] : [96, 62, 30];
    return (
      <div style={{ ...wrap, width: compact ? 88 : 96, height: compact ? 74 : 96 }}>
        <span style={{ position: 'absolute', right: 0, bottom: 0, width: d[0], height: d[0], borderRadius: '50%', background: pal.deco[0] }} />
        <span style={{ position: 'absolute', right: 0, bottom: 0, width: d[1], height: d[1], borderRadius: '50%', background: pal.deco[1] }} />
        <span style={{ position: 'absolute', right: 0, bottom: 0, width: d[2], height: d[2], borderRadius: '50%', background: pal.deco[2] }} />
      </div>
    );
  }
  if (i === 3) {
    return (
      <div style={{ ...wrap, width: compact ? 64 : 80, height: compact ? 70 : 92, background: pal.deco[0],
        clipPath: 'polygon(50% 0,100% 18%,100% 62%,50% 100%,0 62%,0 18%)' }} />
    );
  }
  const hs = compact ? [28, 52, 36, 64] : [34, 62, 44, 74];
  return (
    <div style={{ ...wrap, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: compact ? 7 : 8, height: compact ? 66 : 74 }}>
      {hs.map((h, k) => (
        <i key={k} style={{ width: compact ? 10 : 13, height: h, borderRadius: 4, display: 'block',
          background: k % 2 ? pal.deco[1] : pal.deco[0] }} />
      ))}
    </div>
  );
}

export default function SwSlideStack(props) {
  const p = { ...defaultProps, ...props };
  const accent = p.accent;
  const count = Math.max(2, Math.min(4, p.cardCount));
  const cols = p.columns === 1 ? 1 : 2;
  const singleColumn = cols === 1;
  const cards = (p.cards || []).slice(0, count);

  return (
    <SlideRoot bg={C.blush} color={C.ink}>
      <Bar meta={p.barMeta} accent={accent} />

      <div style={{ flex: 1, minHeight: 0, background: C.paper, borderRadius: 38, margin: '24px 0 22px',
        padding: singleColumn ? '34px 46px 40px' : '44px 52px 50px', display: 'flex', flexDirection: 'column' }}>
        {p.showLede && (
          <p style={{ textAlign: 'center', fontWeight: 900, fontSize: singleColumn ? 34 : 40, lineHeight: 1.28, letterSpacing: '-.5px',
            maxWidth: 1180, margin: singleColumn ? '0 auto 24px' : '0 auto 36px' }}>
            {renderSwText(p.lede, { hl: { tone: 'o' } })}
          </p>
        )}

        <div style={{ flex: 1, minHeight: 0, display: 'grid',
          gridTemplateColumns: 'repeat(' + cols + ',1fr)', gridAutoRows: '1fr', gap: singleColumn ? 14 : 22 }}>
          {cards.map((card, i) => {
            const pal = swCardPalette[i % swCardPalette.length];
            const dim = p.focus && (i + 1) !== p.focusIndex;
            return (
              <div key={card.num} style={{ borderRadius: singleColumn ? 22 : 26, padding: singleColumn ? '20px 28px' : '34px 38px',
                position: 'relative', overflow: 'hidden', display: singleColumn ? 'grid' : 'flex',
                gridTemplateColumns: singleColumn ? '88px 250px minmax(0,1fr) 108px 150px' : undefined,
                columnGap: singleColumn ? 24 : undefined, alignItems: singleColumn ? 'center' : undefined,
                flexDirection: singleColumn ? undefined : 'column', background: pal.bg, color: pal.body,
                opacity: dim ? 0.4 : 1, transform: p.focus && !dim ? 'scale(1)' : 'none',
                outline: p.focus && !dim ? '3px solid ' + accent : 'none', outlineOffset: -3, transition: 'opacity .2s' }}>
                <div style={{ position: 'relative', zIndex: 1, minWidth: 0, display: 'flex',
                  flexDirection: singleColumn ? 'column' : 'row', alignItems: singleColumn ? 'flex-start' : 'baseline',
                  justifyContent: singleColumn ? 'center' : 'space-between', gap: singleColumn ? 8 : undefined }}>
                  <span style={{ fontFamily: F.mono, fontWeight: 700, fontSize: singleColumn ? 22 : 25, color: pal.name }}>{card.num}</span>
                  <span style={{ fontFamily: F.mono, fontSize: singleColumn ? 18 : 24, letterSpacing: '.14em',
                    textTransform: 'uppercase', color: pal.sub }}>{card.en}</span>
                </div>
                <h3 style={{ position: 'relative', zIndex: 1, minWidth: 0, fontWeight: 900,
                  fontSize: singleColumn ? 36 : T.h3, lineHeight: 1.04, letterSpacing: '-.5px',
                  marginTop: singleColumn ? 0 : 18, color: pal.title }}>{card.cn}</h3>
                <p style={{ position: 'relative', zIndex: 1, minWidth: 0, fontSize: singleColumn ? 21 : 24,
                  lineHeight: singleColumn ? 1.38 : 1.6, marginTop: singleColumn ? 0 : 12,
                  maxWidth: singleColumn ? 'none' : '74%' }}>{card.body}</p>
                {p.showDeco && <Deco i={i} pal={pal} compact={singleColumn} />}
                <span style={{ position: 'relative', zIndex: 1, marginTop: singleColumn ? 0 : 'auto',
                  justifySelf: singleColumn ? 'end' : undefined, alignSelf: singleColumn ? 'center' : 'flex-start',
                  whiteSpace: 'nowrap', fontFamily: F.mono, fontWeight: 700, fontSize: singleColumn ? 20 : 24,
                  letterSpacing: '.04em', padding: singleColumn ? '8px 16px' : '9px 20px', borderRadius: 999,
                  background: pal.tagBg, color: pal.tagFg }}>{card.tag}</span>
              </div>
            );
          })}
        </div>
      </div>

      <Footer page={p.page} total={p.total} accent={accent} />
    </SlideRoot>
  );
}
