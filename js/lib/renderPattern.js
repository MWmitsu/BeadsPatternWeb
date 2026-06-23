// ============================================================
// 図案描画の中心関数(プレビュー BeadCanvas と PNG書き出し exportPng で共用)
// ------------------------------------------------------------
// 2D context にビーズ図案を描く唯一の実装。表示モードはオプションで切替える:
//   - 完成イメージ:   showNumbers=false, showGrid=false
//   - 数字付き設計図:  showNumbers=true
//   - グリッド付き:    showGrid=true
//   - 色別ハイライト:  highlightColorId に色IDを指定(他は薄く表示)
// ============================================================

import { textColorForRgb, hexToRgb } from '../utils/colorDistance.js';
import { BACKGROUND_COLOR_ID } from '../types.js';

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{colors: import('../types.js').BeadColor[], cells: import('../types.js').BeadCell[], width: number, height: number}} pattern
 * @param {Object} [opts]
 * @param {number}  [opts.cellSize=16]
 * @param {boolean} [opts.showGrid=false]
 * @param {boolean} [opts.showNumbers=false]
 * @param {number|null} [opts.highlightColorId=null] 指定色以外を薄く表示
 * @param {string}  [opts.backgroundColor='#FFFFFF'] 透明背景セル/余白の塗り
 * @param {string}  [opts.gridColor]
 * @param {string}  [opts.majorGridColor]
 * @param {number}  [opts.dimNonHighlight=0.1]
 */
export function drawPattern(ctx, pattern, opts = {}) {
  const { colors, cells, width, height } = pattern;
  const cellSize = opts.cellSize ?? 16;
  const showGrid = opts.showGrid ?? false;
  const showNumbers = opts.showNumbers ?? false;
  const highlightColorId = opts.highlightColorId ?? null;
  const backgroundColor = opts.backgroundColor ?? '#FFFFFF';
  const gridColor = opts.gridColor ?? 'rgba(0,0,0,0.16)';
  const majorGridColor = opts.majorGridColor ?? 'rgba(0,0,0,0.42)';
  const dim = opts.dimNonHighlight ?? 0.1;

  const colorMap = new Map(colors.map((c) => [c.id, c]));
  const W = width * cellSize;
  const H = height * cellSize;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, W, H);

  // --- セル塗り ---
  for (const cell of cells) {
    if (cell.colorId === BACKGROUND_COLOR_ID) continue; // 透明背景は塗らない
    const color = colorMap.get(cell.colorId);
    const hex = color ? color.hex : cell.hex || '#000000';
    const px = cell.x * cellSize;
    const py = cell.y * cellSize;

    const isDim = highlightColorId != null && cell.colorId !== highlightColorId;
    ctx.globalAlpha = isDim ? dim : 1;
    ctx.fillStyle = hex;
    ctx.fillRect(px, py, cellSize, cellSize);
    ctx.globalAlpha = 1;

    // --- 数字(明度に応じ黒/白) ---
    if (showNumbers && cellSize >= 9 && !isDim) {
      const { r, g, b } = hexToRgb(hex);
      ctx.fillStyle = textColorForRgb(r, g, b);
      ctx.font = `${Math.max(7, Math.floor(cellSize * 0.52))}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(cell.colorId), px + cellSize / 2, py + cellSize / 2 + 0.5);
    }
  }

  // --- グリッド線 ---
  if (showGrid && cellSize >= 4) {
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= width; x++) {
      const gx = Math.round(x * cellSize) + 0.5;
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, H);
    }
    for (let y = 0; y <= height; y++) {
      const gy = Math.round(y * cellSize) + 0.5;
      ctx.moveTo(0, gy);
      ctx.lineTo(W, gy);
    }
    ctx.stroke();

    // 10マスごとの太線(数えやすさのため)
    ctx.strokeStyle = majorGridColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = 0; x <= width; x += 10) {
      const gx = Math.round(x * cellSize) + 0.5;
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, H);
    }
    for (let y = 0; y <= height; y += 10) {
      const gy = Math.round(y * cellSize) + 0.5;
      ctx.moveTo(0, gy);
      ctx.lineTo(W, gy);
    }
    ctx.stroke();
  }
}

/**
 * pattern から書き出し用のオフスクリーン canvas を生成。
 * @returns {HTMLCanvasElement}
 */
export function renderPatternToCanvas(pattern, opts = {}) {
  let cellSize = opts.cellSize ?? 20;
  // 巨大な図案でも canvas がブラウザ上限(概ね1辺16384px)を超えないよう上限を設ける。
  // 超える場合は cellSize を自動的に切り下げる(印刷/PNG書き出しの失敗・白画像を防止)。
  const MAX_SIDE = 8192;
  const maxDim = Math.max(pattern.width, pattern.height) || 1;
  if (maxDim * cellSize > MAX_SIDE) {
    cellSize = Math.max(1, Math.floor(MAX_SIDE / maxDim));
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, pattern.width * cellSize);
  canvas.height = Math.max(1, pattern.height * cellSize);
  const ctx = canvas.getContext('2d');
  drawPattern(ctx, pattern, { ...opts, cellSize });
  return canvas;
}
