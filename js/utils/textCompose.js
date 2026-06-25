// ============================================================
// textCompose: 文字デザインを1枚の透明PNG（キャンバス）へラスタライズする純関数
// ------------------------------------------------------------
// プレビューと確定で同じこの関数を使う（真のWYSIWYG）。
// フォント・並べ方・字間/大きさ・縁取り・1文字ごとの色/大きさ/位置/書体を反映し、
// 全文字の外接矩形から最小キャンバスを作る。下流（pixelate→detectBeadPattern）は
// 従来どおりこの画像を読むだけ。
// ============================================================

import { getFont } from '../data/textFonts.js';

/** 基準フォントサイズ(px) */
const BASE = 120;
/** 1文字ナッジの1段あたり移動量(px)。ビーズ1マス分くらいの見た目移動。 */
const STEP = BASE * 0.28;

/**
 * 文字列を書記素（見た目の1文字）単位に分割する。
 * 絵文字・サロゲートペア・結合文字でも壊れないよう Intl.Segmenter 優先、無ければ Array.from。
 * @param {string} text
 * @returns {string[]}
 */
export function splitGraphemes(text) {
  if (!text) return [];
  try {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      const seg = new Intl.Segmenter('ja', { granularity: 'grapheme' });
      return Array.from(seg.segment(text), (s) => s.segment);
    }
  } catch (_) {
    /* フォールバックへ */
  }
  return Array.from(text);
}

/** ctx.font 文字列を組み立てる */
function fontString(fontKey, sizePx, boldGlobal) {
  const f = getFont(fontKey);
  const bold = boldGlobal || f.forceBold;
  return `${bold ? 'bold ' : ''}${Math.max(1, Math.round(sizePx))}px ${f.stack}`;
}

/** 1ナッジ段 = 何px か（呼び出し側がプレビュー補助に使えるよう公開） */
export const NUDGE_STEP = STEP;

/**
 * 並べ方ごとに各文字の基準中心 (cx,cy) を算出。
 * @param {string} arrange 'row'|'col'|'two'|'arch'|'wave'
 * @param {Array<{w:number,size:number}>} items 計測済み文字
 * @param {{spacing:number, curve:number, lineGap:number}} opts
 * @returns {Array<{cx:number,cy:number}>}
 */
function layout(arrange, items, opts) {
  const { spacing, curve, lineGap } = opts;
  const n = items.length;
  const pos = items.map(() => ({ cx: 0, cy: 0 }));
  if (n === 0) return pos;

  if (arrange === 'col') {
    // 縦一列・中央そろえ
    let totalH = 0;
    for (const it of items) totalH += it.size;
    totalH += spacing * (n - 1);
    let y = -totalH / 2;
    for (let i = 0; i < n; i++) {
      pos[i].cx = 0;
      pos[i].cy = y + items[i].size / 2;
      y += items[i].size + spacing;
    }
    return pos;
  }

  if (arrange === 'two') {
    // 中央で2分割して2行
    const half = Math.ceil(n / 2);
    const rows = [items.slice(0, half), items.slice(half)];
    const rowH = Math.max(...items.map((it) => it.size));
    const gapY = rowH * lineGap;
    let idx = 0;
    rows.forEach((row, r) => {
      const totalW = row.reduce((s, it) => s + it.w, 0) + spacing * Math.max(0, row.length - 1);
      let x = -totalW / 2;
      const baseY = (r - 0.5) * gapY; // 上段=マイナス, 下段=プラス
      for (let k = 0; k < row.length; k++) {
        pos[idx].cx = x + row[k].w / 2;
        pos[idx].cy = baseY;
        x += row[k].w + spacing;
        idx++;
      }
    });
    return pos;
  }

  // row / arch / wave は横一列を土台に y を変える
  const totalW = items.reduce((s, it) => s + it.w, 0) + spacing * (n - 1);
  let x = -totalW / 2;
  const mid = (n - 1) / 2;
  // 字間を強くつめると totalW が負へ振れうるので非負にクランプ（アーチが谷へ反転しない）
  const amp = Math.min(Math.max(totalW, 0) * 0.32, BASE * 2.2);
  for (let i = 0; i < n; i++) {
    const it = items[i];
    pos[i].cx = x + it.w / 2;
    let cy = 0;
    if (arrange === 'arch') {
      const t = mid > 0 ? (i - mid) / mid : 0;
      cy = -curve * amp * (1 - t * t); // 中央が上に持ち上がる山なり
    } else if (arrange === 'wave') {
      cy = curve * amp * 0.6 * Math.sin(i * 0.9);
    }
    pos[i].cy = cy;
    x += it.w + spacing;
  }
  return pos;
}

/**
 * 文字デザインを透明（または白地）キャンバスへ描く。
 * @param {Array<{ch:string,color:string,fontKey:string,dx:number,dy:number,sizeMul:number}>} chars 継承解決済みの各文字
 * @param {{bold:boolean,arrange:string,letterSpacing:number,fontScale:number,lineGap:number,curve:number,whiteBg:boolean,outline:{on:boolean,color:string}}} global
 * @returns {{ canvas:HTMLCanvasElement, boxes:Array<{x:number,y:number,w:number,h:number}>, W:number, H:number } | null}
 */
export function renderCompositionToCanvas(chars, global) {
  const { bold, arrange, letterSpacing, fontScale, lineGap, curve, whiteBg, outline } = global;
  const list = (chars || []).filter((c) => c && c.ch && c.ch !== '\n');
  const n = list.length;
  if (n === 0) return null;

  const mctx = document.createElement('canvas').getContext('2d');
  // 各文字を計測（実フォント・実サイズで）
  const items = list.map((c) => {
    const size = BASE * fontScale * (c.sizeMul || 1);
    mctx.font = fontString(c.fontKey, size, bold);
    const w = Math.max(1, mctx.measureText(c.ch).width);
    return { ch: c.ch, color: c.color, fontKey: c.fontKey, dx: c.dx || 0, dy: c.dy || 0, size, w };
  });

  const spacing = BASE * fontScale * letterSpacing; // em基準の追加字間
  const positions = layout(arrange, items, { spacing, curve, lineGap });

  // 1文字ごとの位置ナッジを加算
  for (let i = 0; i < n; i++) {
    positions[i].cx += items[i].dx * STEP;
    positions[i].cy += items[i].dy * STEP;
  }

  const outlineW = outline && outline.on ? BASE * 0.12 : 0;

  // 外接矩形（縁取り幅も含めて算出し、見切れを防ぐ）
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const { w, size } = items[i];
    const { cx, cy } = positions[i];
    const hx = w / 2 + outlineW;
    minX = Math.min(minX, cx - hx);
    maxX = Math.max(maxX, cx + hx);
    minY = Math.min(minY, cy - (size * 0.62 + outlineW));
    maxY = Math.max(maxY, cy + (size * 0.42 + outlineW));
  }

  const padX = BASE * 0.28;
  const padY = BASE * 0.2;
  const W = Math.max(1, Math.ceil(maxX - minX + padX * 2));
  const H = Math.max(1, Math.ceil(maxY - minY + padY * 2));
  const offX = -minX + padX;
  const offY = -minY + padY;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (whiteBg) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
  } else {
    ctx.clearRect(0, 0, W, H);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const boxes = [];
  for (let i = 0; i < n; i++) {
    const it = items[i];
    const x = positions[i].cx + offX;
    const y = positions[i].cy + offY;
    ctx.font = fontString(it.fontKey, it.size, bold);
    if (outline && outline.on) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = outlineW;
      ctx.strokeStyle = outline.color || '#ffffff';
      ctx.strokeText(it.ch, x, y);
    }
    ctx.fillStyle = it.color || '#1f1f1f';
    ctx.fillText(it.ch, x, y);
    boxes.push({
      x: x - it.w / 2 - outlineW,
      y: y - (it.size * 0.62 + outlineW),
      w: it.w + outlineW * 2,
      h: it.size * 1.04 + outlineW * 2,
    });
  }

  return { canvas, boxes, W, H };
}
