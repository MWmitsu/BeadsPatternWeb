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

/**
 * 分割印刷用: 指定区画(col,row から cols×rows マス)を、列番号・行番号の見出し付きで
 * 数字入りで描画した canvas を返す。区画ごとに紙へ印刷して貼り合わせる用途。
 * @param {{colors:Array,cells:Array,width:number,height:number}} pattern
 * @param {{col:number,row:number,cols:number,rows:number}} region 0始まりの開始位置とマス数
 * @param {{cellSize?:number, headerSize?:number}} [opts]
 * @returns {HTMLCanvasElement}
 */
export function renderNumberedTileCanvas(pattern, region, opts = {}) {
  const { colors, cells, width, height } = pattern;
  const cellSize = opts.cellSize ?? 26;
  const headW = opts.headerSize ?? Math.max(18, Math.round(cellSize * 0.8));
  const col0 = region.col;
  const row0 = region.row;
  const cols = Math.min(region.cols, width - col0);
  const rows = Math.min(region.rows, height - row0);

  const colorMap = new Map(colors.map((c) => [c.id, c]));
  const canvas = document.createElement('canvas');
  canvas.width = headW + cols * cellSize;
  canvas.height = headW + rows * cellSize;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 列番号・行番号の見出し(貼り合わせ時の位置合わせ用)
  ctx.fillStyle = '#555555';
  ctx.font = `${Math.max(8, Math.floor(headW * 0.5))}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let c = 0; c < cols; c++) {
    ctx.fillText(String(col0 + c + 1), headW + c * cellSize + cellSize / 2, headW / 2);
  }
  for (let r = 0; r < rows; r++) {
    ctx.fillText(String(row0 + r + 1), headW / 2, headW + r * cellSize + cellSize / 2);
  }

  // セル(色 + 番号)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = cells[(row0 + r) * width + (col0 + c)];
      if (!cell || cell.colorId === BACKGROUND_COLOR_ID) continue;
      const px = headW + c * cellSize;
      const py = headW + r * cellSize;
      const color = colorMap.get(cell.colorId);
      const hex = color ? color.hex : cell.hex || '#000000';
      ctx.fillStyle = hex;
      ctx.fillRect(px, py, cellSize, cellSize);
      const { r: rr, g: gg, b: bb } = hexToRgb(hex);
      ctx.fillStyle = textColorForRgb(rr, gg, bb);
      ctx.font = `${Math.max(8, Math.floor(cellSize * 0.5))}px system-ui, sans-serif`;
      ctx.fillText(String(cell.colorId), px + cellSize / 2, py + cellSize / 2 + 0.5);
    }
  }

  // グリッド(細) + 5マスごとの太線
  const gx0 = headW;
  const gy0 = headW;
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let c = 0; c <= cols; c++) { const gx = gx0 + c * cellSize + 0.5; ctx.moveTo(gx, gy0); ctx.lineTo(gx, canvas.height); }
  for (let r = 0; r <= rows; r++) { const gy = gy0 + r * cellSize + 0.5; ctx.moveTo(gx0, gy); ctx.lineTo(canvas.width, gy); }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let c = 0; c <= cols; c++) { if ((col0 + c) % 5 === 0) { const gx = gx0 + c * cellSize + 0.5; ctx.moveTo(gx, gy0); ctx.lineTo(gx, canvas.height); } }
  for (let r = 0; r <= rows; r++) { if ((row0 + r) % 5 === 0) { const gy = gy0 + r * cellSize + 0.5; ctx.moveTo(gx0, gy); ctx.lineTo(canvas.width, gy); } }
  ctx.stroke();

  // 区画の外周を太線で囲む(端数区画でも必ず枠が付き、貼り合わせの目印になる)
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 2;
  ctx.strokeRect(gx0 + 1, gy0 + 1, cols * cellSize - 1, rows * cellSize - 1);

  return canvas;
}

/**
 * 分割の概観図: 完成イメージに区画の境界線を引いた小さな canvas を返す。
 * @param {{colors:Array,cells:Array,width:number,height:number}} pattern
 * @param {number} tileW 1区画の横マス数
 * @param {number} tileH 1区画の縦マス数
 * @param {{cellSize?:number}} [opts]
 * @returns {HTMLCanvasElement}
 */
export function renderTileOverviewCanvas(pattern, tileW, tileH, opts = {}) {
  const { width, height } = pattern;
  const cellSize = opts.cellSize ?? Math.max(2, Math.floor(360 / Math.max(width, height)) || 2);
  const canvas = renderPatternToCanvas(pattern, { cellSize, showGrid: false, showNumbers: false });
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#d6336c';
  ctx.lineWidth = 2;
  for (let x = 0; x <= width; x += tileW) {
    ctx.beginPath(); ctx.moveTo(x * cellSize, 0); ctx.lineTo(x * cellSize, height * cellSize); ctx.stroke();
  }
  for (let y = 0; y <= height; y += tileH) {
    ctx.beginPath(); ctx.moveTo(0, y * cellSize); ctx.lineTo(width * cellSize, y * cellSize); ctx.stroke();
  }
  // 外周(画像の端=最終区画の外辺)も明示
  ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);
  return canvas;
}
