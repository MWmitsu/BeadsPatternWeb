// ============================================================
// BeadCanvas: 図案を <canvas> に描画する中核プレビュー(iPad/タッチ対応)
// ------------------------------------------------------------
// - drawPattern で描画。viewMode で表示切替。Pointer Events でドラッグ操作。
// - 編集ツール: ペン / 消しゴム(背景化) / スポイト(色抽出) / ぬりつぶし(バケツ)。
//   ドラッグはBresenham直線補間で抜けなし。Undo/Redo・左右上下ミラーに対応。
// - 作業チェック(消し込み)モードも同じドラッグ操作。
// - 全画面モード(CSSオーバーレイ。iPad Safariの要素フルスクリーンAPI非対応のため独自実装)。
// ============================================================

import { html, useRef, useEffect, useState } from '../lib/html.js';
import { drawPattern } from '../lib/renderPattern.js';

const MIN_CELL_SIZE = 2;
const MAX_CELL_SIZE = 48;
const ZOOM_STEP = 2;

const TOOLS = [
  { k: 'pen', label: 'ペン', icon: '✏️' },
  { k: 'eraser', label: '消しゴム', icon: '⌫' },
  { k: 'eyedropper', label: 'スポイト', icon: '💧' },
  { k: 'bucket', label: 'ぬりつぶし', icon: '🪣' },
];

function buildDrawOpts(viewMode, flags) {
  const { showGrid, showNumbers, highlightColorId } = flags;
  switch (viewMode) {
    case 'finished': return { showGrid: false, showNumbers: false, highlightColorId: null };
    case 'numbers': return { showGrid: true, showNumbers: true, highlightColorId: null };
    case 'grid': return { showGrid: true, showNumbers: false, highlightColorId: null };
    case 'highlight': return { showGrid, showNumbers, highlightColorId };
    case 'compare': return { showGrid: false, showNumbers: false, highlightColorId: null };
    default: return { showGrid, showNumbers, highlightColorId: highlightColorId ?? null };
  }
}

/** a(含まず) → b(含む) の間のセルを Bresenham 直線で列挙(速いドラッグの抜け防止) */
function lineCells(a, b) {
  const cells = [];
  let x0 = a.x;
  let y0 = a.y;
  const x1 = b.x;
  const y1 = b.y;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let guard = dx + dy + 2;
  while (guard-- > 0) {
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
    cells.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) break;
  }
  return cells;
}

export function BeadCanvas(props) {
  const {
    pattern,
    viewMode = 'finished',
    showGrid = false,
    showNumbers = false,
    highlightColorId = null,
    originalUrl = null,
    cellSize = 16,
    onCellSizeChange,
    editingEnabled = false,
    editColorId = null,
    activeTool = 'pen',
    onSetTool,
    onStrokeBegin,
    onDraw,
    onBucket,
    onEyedrop,
    canUndo = false,
    canRedo = false,
    onUndo,
    onRedo,
    mirrorX = false,
    mirrorY = false,
    onToggleMirrorX,
    onToggleMirrorY,
    checkMode = false,
    doneSet = null,
    totalBeads = 0,
    onSetDone,
    onToggleCheckMode,
  } = props;

  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const dragRef = useRef(null);
  const [fullscreen, setFullscreen] = useState(false);

  const interactive = editingEnabled || checkMode;
  const doneCount = doneSet ? doneSet.size : 0;
  const donePct = totalBeads > 0 ? Math.round((doneCount / totalBeads) * 100) : 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !pattern) return;
    const cs = Math.max(MIN_CELL_SIZE, cellSize);
    canvas.width = Math.max(1, pattern.width * cs);
    canvas.height = Math.max(1, pattern.height * cs);
    const ctx = canvas.getContext('2d');
    const opts = buildDrawOpts(viewMode, { showGrid, showNumbers, highlightColorId });
    drawPattern(ctx, pattern, { ...opts, cellSize: cs, doneSet });
  }, [pattern, viewMode, showGrid, showNumbers, highlightColorId, cellSize, doneSet]);

  // ---- ズーム ----
  const clampCell = (v) => Math.max(MIN_CELL_SIZE, Math.min(MAX_CELL_SIZE, v));
  const zoomIn = () => onCellSizeChange && onCellSizeChange(clampCell(cellSize + ZOOM_STEP));
  const zoomOut = () => onCellSizeChange && onCellSizeChange(clampCell(cellSize - ZOOM_STEP));
  const doFit = () => {
    if (!onCellSizeChange || !pattern || !stageRef.current) return;
    const avail = stageRef.current.clientWidth - 12;
    onCellSizeChange(clampCell(Math.floor(avail / pattern.width)));
  };
  useEffect(() => {
    if (!fullscreen) return;
    const id = setTimeout(doFit, 90);
    return () => clearTimeout(id);
    // eslint-disable-next-line
  }, [fullscreen]);

  // ---- ポインタ操作 ----
  const cellFromEvent = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || !pattern) return null;
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    const x = Math.floor(((e.clientX - rect.left) * sx) / cellSize);
    const y = Math.floor(((e.clientY - rect.top) * sy) / cellSize);
    if (x < 0 || y < 0 || x >= pattern.width || y >= pattern.height) return null;
    return { x, y };
  };

  const onPointerDown = (e) => {
    if (!interactive || !pattern) return;
    const cell = cellFromEvent(e);
    if (!cell) return;
    e.preventDefault();
    if (canvasRef.current.setPointerCapture) {
      try { canvasRef.current.setPointerCapture(e.pointerId); } catch (_) {}
    }
    if (checkMode) {
      const idx = cell.y * pattern.width + cell.x;
      dragRef.current = { type: 'check', markDone: !(doneSet && doneSet.has(idx)), last: cell };
      onSetDone && onSetDone([cell], dragRef.current.markDone);
      return;
    }
    // 描画ツール
    if (activeTool === 'eyedropper') {
      onEyedrop && onEyedrop(cell.x, cell.y);
      dragRef.current = null;
      return;
    }
    onStrokeBegin && onStrokeBegin();
    if (activeTool === 'bucket') {
      onBucket && onBucket(cell.x, cell.y);
      dragRef.current = null;
      return;
    }
    const erase = activeTool === 'eraser';
    dragRef.current = { type: 'draw', erase, last: cell };
    onDraw && onDraw([cell], erase);
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const cell = cellFromEvent(e);
    if (!cell) return;
    if (cell.x === d.last.x && cell.y === d.last.y) return;
    const line = lineCells(d.last, cell);
    if (d.type === 'check') onSetDone && onSetDone(line, d.markDone);
    else if (d.type === 'draw') onDraw && onDraw(line, d.erase);
    d.last = cell;
  };

  const endDrag = () => { dragRef.current = null; };

  // ---- プレースホルダ ----
  if (!pattern) {
    return html`
      <div class="bead-canvas">
        <div class="bead-canvas__placeholder muted">
          画像を選んで〔画像から変換〕を押してください
        </div>
      </div>
    `;
  }

  const totalCells = pattern.width * pattern.height;
  const isCompare = viewMode === 'compare';
  const curColor = editingEnabled ? pattern.colors.find((c) => c.id === editColorId) : null;
  const canvasClass = 'bead-canvas__canvas' + (interactive ? ' bead-canvas__canvas--editing' : '');
  const rootClass = 'bead-canvas' + (fullscreen ? ' bead-canvas--fullscreen' : '');

  const canvasEl = html`
    <canvas
      ref=${canvasRef}
      class=${canvasClass}
      onPointerDown=${interactive ? onPointerDown : null}
      onPointerMove=${interactive ? onPointerMove : null}
      onPointerUp=${interactive ? endDrag : null}
      onPointerCancel=${interactive ? endDrag : null}
      onPointerLeave=${interactive ? endDrag : null}
    ></canvas>
  `;

  return html`
    <div class=${rootClass}>
      <div class="bead-canvas__toolbar">
        <div class="bead-canvas__zoom">
          <button type="button" class="btn btn--ghost btn--sm bead-canvas__zoom-btn"
            onClick=${onUndo} disabled=${!canUndo} aria-label="取り消し" title="取り消し (Ctrl+Z)">↩︎</button>
          <button type="button" class="btn btn--ghost btn--sm bead-canvas__zoom-btn"
            onClick=${onRedo} disabled=${!canRedo} aria-label="やり直し" title="やり直し (Ctrl+Y)">↪︎</button>
          <span class="bead-canvas__sep"></span>
          <button type="button" class="btn btn--ghost btn--sm bead-canvas__zoom-btn"
            onClick=${zoomOut} disabled=${cellSize <= MIN_CELL_SIZE} aria-label="縮小">−</button>
          <span class="bead-canvas__zoom-value">${cellSize}px</span>
          <button type="button" class="btn btn--ghost btn--sm bead-canvas__zoom-btn"
            onClick=${zoomIn} disabled=${cellSize >= MAX_CELL_SIZE} aria-label="拡大">＋</button>
          <button type="button" class="btn btn--ghost btn--sm bead-canvas__zoom-fit" onClick=${doFit}>フィット</button>
          <button type="button" class="btn btn--ghost btn--sm bead-canvas__full"
            onClick=${() => setFullscreen((v) => !v)}>${fullscreen ? '✕ 閉じる' : '⛶ 全画面'}</button>
          ${fullscreen && onToggleCheckMode
            ? html`<button type="button" class=${'btn btn--sm ' + (checkMode ? 'btn--primary' : 'btn--ghost')}
                onClick=${() => onToggleCheckMode()}>${checkMode ? '作業中' : '作業'}</button>`
            : null}
        </div>
        <div class="bead-canvas__info muted">
          ${checkMode
            ? html`<b>作業 ${doneCount} / ${totalBeads}（${donePct}%）</b>`
            : html`${pattern.width} × ${pattern.height} マス（計 ${totalCells.toLocaleString()} マス）`}
        </div>
      </div>

      ${editingEnabled && !checkMode
        ? html`
            <div class="bead-canvas__tools">
              ${TOOLS.map(
                (t) => html`
                  <button type="button" key=${t.k}
                    class=${'btn btn--sm bead-canvas__tool ' + (activeTool === t.k ? 'btn--primary' : 'btn--ghost')}
                    title=${t.label}
                    onClick=${() => onSetTool && onSetTool(t.k)}>${t.icon}<span class="bead-canvas__tool-label"> ${t.label}</span></button>
                `
              )}
              <span class="bead-canvas__sep"></span>
              ${curColor
                ? html`<span class="bead-canvas__curcolor swatch" style=${`background:${curColor.hex}`} title=${`現在の色 ${curColor.name || curColor.hex}`}></span>`
                : null}
              <button type="button" class=${'btn btn--sm bead-canvas__mir ' + (mirrorX ? 'btn--primary' : 'btn--ghost')}
                title="左右ミラー" onClick=${() => onToggleMirrorX && onToggleMirrorX()}>⇆</button>
              <button type="button" class=${'btn btn--sm bead-canvas__mir ' + (mirrorY ? 'btn--primary' : 'btn--ghost')}
                title="上下ミラー" onClick=${() => onToggleMirrorY && onToggleMirrorY()}>⇅</button>
            </div>
          `
        : null}

      ${interactive
        ? html`<div class="bead-canvas__draghint muted">
            ${checkMode
              ? 'ドラッグでまとめてチェック／解除できます。'
              : activeTool === 'eyedropper'
              ? 'マスをタップでその色を取得します。'
              : activeTool === 'bucket'
              ? 'タップで同じ色のつながった範囲を塗りつぶします。'
              : 'ドラッグでまとめて' + (activeTool === 'eraser' ? '消せます' : '塗れます') + '。'}
          </div>`
        : null}

      ${isCompare
        ? html`
            <div class="bead-canvas__compare" ref=${stageRef}>
              <div class="bead-canvas__compare-pane">
                <div class="bead-canvas__compare-label muted">完成イメージ</div>
                ${canvasEl}
              </div>
              <div class="bead-canvas__compare-pane">
                <div class="bead-canvas__compare-label muted">元画像</div>
                ${originalUrl
                  ? html`<img class="bead-canvas__compare-img" src=${originalUrl} alt="元画像" />`
                  : html`<div class="bead-canvas__compare-empty muted">元画像がありません</div>`}
              </div>
            </div>
          `
        : html`<div class="bead-canvas__stage" ref=${stageRef}>${canvasEl}</div>`}
    </div>
  `;
}
