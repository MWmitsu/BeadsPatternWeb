// ============================================================
// BeadCanvas: 図案を <canvas> に描画する中核プレビュー(iPad/タッチ対応)
// ------------------------------------------------------------
// - drawPattern で描画。viewMode で表示切替。Pointer Events で操作。
// - 編集ツール: ペン / 消しゴム(背景化) / スポイト(色抽出) / ぬりつぶし(バケツ)。
//   ドラッグはBresenham直線補間で抜けなし。Undo/Redo・左右上下ミラーに対応。
// - 作業チェック(消し込み)モードも同じドラッグ操作。
// - 全画面モード(CSSオーバーレイ)では複数ポインタを追跡し、
//   1本指=描画/作業・パン、2本指=ピンチズーム＆移動(CSS transform)。
//   ※ iPad Safari は要素フルスクリーンAPI非対応のため独自オーバーレイ。
// ============================================================

import { html, useRef, useEffect, useState } from '../lib/html.js';
import { drawPattern } from '../lib/renderPattern.js';

const MIN_CELL_SIZE = 2;
const MAX_CELL_SIZE = 48;
const ZOOM_STEP = 2;
const MIN_SCALE = 0.2;
const MAX_SCALE = 8;

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

const distOf = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const midOf = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const clampScale = (s) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, s));

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
    plateMask = null,
    round = false,
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
  const dragRef = useRef(null); // 描画/作業ドラッグ
  const pointersRef = useRef(new Map()); // pointerId -> {x,y}(画面座標)
  const gestureRef = useRef(null); // 2本指ジェスチャの開始状態
  const panRef = useRef(null); // 1本指パン
  const [fullscreen, setFullscreen] = useState(false);
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 }); // 全画面の表示変換

  const interactive = editingEnabled || checkMode;
  const pointerActive = interactive || fullscreen; // 全画面は非編集でもパン/ズーム可
  const doneCount = doneSet ? doneSet.size : 0;
  const donePct = totalBeads > 0 ? Math.round((doneCount / totalBeads) * 100) : 0;

  // canvas がブラウザ/iOS の上限(1辺・総面積)を超えないよう実効セルサイズを算出する。
  // 描画とタップ位置判定の両方で同じ値を使い、座標ズレを防ぐ。
  const effectiveCellSize = (() => {
    const base = Math.max(MIN_CELL_SIZE, cellSize);
    if (!pattern) return base;
    const MAX_SIDE = 8192;
    const MAX_AREA = 16000000; // iOS Safari の総面積上限(約16.7Mpx)より控えめに
    const maxDim = Math.max(pattern.width, pattern.height) || 1;
    let cs = Math.min(base, Math.floor(MAX_SIDE / maxDim) || base);
    const areaCap = Math.floor(Math.sqrt(MAX_AREA / ((pattern.width || 1) * (pattern.height || 1)))) || cs;
    return Math.max(1, Math.min(cs, areaCap));
  })();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !pattern) return;
    const cs = effectiveCellSize;
    canvas.width = Math.max(1, pattern.width * cs);
    canvas.height = Math.max(1, pattern.height * cs);
    const ctx = canvas.getContext('2d');
    const opts = buildDrawOpts(viewMode, { showGrid, showNumbers, highlightColorId });
    drawPattern(ctx, pattern, { ...opts, cellSize: cs, doneSet, plateMask, round });
  }, [pattern, viewMode, showGrid, showNumbers, highlightColorId, effectiveCellSize, doneSet, plateMask, round]);

  // ---- 表示変換(全画面) ----
  const viewportRect = () => (stageRef.current ? stageRef.current.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 });
  const resetView = () => setView({ scale: 1, tx: 0, ty: 0 });

  const clampCell = (v) => Math.max(MIN_CELL_SIZE, Math.min(MAX_CELL_SIZE, v));
  const doFit = () => {
    if (fullscreen) resetView();
    if (!onCellSizeChange || !pattern || !stageRef.current) return;
    const avail = stageRef.current.clientWidth - 12;
    onCellSizeChange(clampCell(Math.floor(avail / pattern.width)));
  };
  // 中心基準で view.scale を倍率変更
  const zoomBy = (factor) => {
    const vp = viewportRect();
    const cx = vp.width / 2;
    const cy = vp.height / 2;
    setView((v) => {
      const s1 = clampScale(v.scale * factor);
      const r = s1 / v.scale;
      return { scale: s1, tx: cx - r * (cx - v.tx), ty: cy - r * (cy - v.ty) };
    });
  };
  const zoomIn = () => {
    if (fullscreen) zoomBy(1.25);
    else onCellSizeChange && onCellSizeChange(clampCell(cellSize + ZOOM_STEP));
  };
  const zoomOut = () => {
    if (fullscreen) zoomBy(0.8);
    else onCellSizeChange && onCellSizeChange(clampCell(cellSize - ZOOM_STEP));
  };

  // 全画面に入ったら view をリセットして表示幅に合わせる
  useEffect(() => {
    resetView();
    if (!fullscreen) return;
    const id = setTimeout(doFit, 90);
    return () => clearTimeout(id);
    // eslint-disable-next-line
  }, [fullscreen]);

  // ---- ポインタ操作 ----
  const cellFromEvent = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || !pattern) return null;
    const rect = canvas.getBoundingClientRect(); // transform 後の矩形
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    const x = Math.floor(((e.clientX - rect.left) * sx) / effectiveCellSize);
    const y = Math.floor(((e.clientY - rect.top) * sy) / effectiveCellSize);
    if (x < 0 || y < 0 || x >= pattern.width || y >= pattern.height) return null;
    return { x, y };
  };

  const startGesture = () => {
    const pts = [...pointersRef.current.values()];
    if (pts.length < 2) return;
    dragRef.current = null; // 描画を中断
    panRef.current = null;
    gestureRef.current = {
      scale0: view.scale, tx0: view.tx, ty0: view.ty,
      mid0: midOf(pts[0], pts[1]), dist0: distOf(pts[0], pts[1]) || 1,
      vp: viewportRect(),
    };
  };
  const updateGesture = () => {
    const g = gestureRef.current;
    if (!g) return;
    const pts = [...pointersRef.current.values()];
    if (pts.length < 2) return;
    const m1 = midOf(pts[0], pts[1]);
    const d1 = distOf(pts[0], pts[1]);
    const s1 = clampScale(g.scale0 * (d1 / g.dist0));
    // 開始時の中点の下にあったコンテンツ点を、現在の中点へ合わせる
    const cx = (g.mid0.x - g.vp.left - g.tx0) / g.scale0;
    const cy = (g.mid0.y - g.vp.top - g.ty0) / g.scale0;
    setView({ scale: s1, tx: m1.x - g.vp.left - s1 * cx, ty: m1.y - g.vp.top - s1 * cy });
  };

  const onPointerDown = (e) => {
    if (!pattern) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (canvasRef.current.setPointerCapture) {
      try { canvasRef.current.setPointerCapture(e.pointerId); } catch (_) {}
    }
    // 全画面で2本指 → ピンチ/パン
    if (fullscreen && pointersRef.current.size >= 2) {
      e.preventDefault();
      startGesture();
      return;
    }
    // 1本指: 描画/作業 か、(全画面・非編集なら)パン
    if (interactive) {
      const cell = cellFromEvent(e);
      if (!cell) return;
      e.preventDefault();
      if (checkMode) {
        const idx = cell.y * pattern.width + cell.x;
        dragRef.current = { type: 'check', markDone: !(doneSet && doneSet.has(idx)), last: cell };
        onSetDone && onSetDone([cell], dragRef.current.markDone);
        return;
      }
      if (activeTool === 'eyedropper') { onEyedrop && onEyedrop(cell.x, cell.y); dragRef.current = null; return; }
      onStrokeBegin && onStrokeBegin();
      if (activeTool === 'bucket') { onBucket && onBucket(cell.x, cell.y); dragRef.current = null; return; }
      const erase = activeTool === 'eraser';
      dragRef.current = { type: 'draw', erase, last: cell };
      onDraw && onDraw([cell], erase);
    } else if (fullscreen) {
      e.preventDefault();
      panRef.current = { last: { x: e.clientX, y: e.clientY } };
    }
  };

  const onPointerMove = (e) => {
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    if (gestureRef.current) { updateGesture(); return; }
    const d = dragRef.current;
    if (d) {
      const cell = cellFromEvent(e);
      if (!cell) return;
      if (cell.x === d.last.x && cell.y === d.last.y) return;
      const line = lineCells(d.last, cell);
      if (d.type === 'check') onSetDone && onSetDone(line, d.markDone);
      else if (d.type === 'draw') onDraw && onDraw(line, d.erase);
      d.last = cell;
      return;
    }
    if (panRef.current) {
      const dx = e.clientX - panRef.current.last.x;
      const dy = e.clientY - panRef.current.last.y;
      panRef.current.last = { x: e.clientX, y: e.clientY };
      setView((v) => ({ ...v, tx: v.tx + dx, ty: v.ty + dy }));
    }
  };

  const onPointerUp = (e) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) gestureRef.current = null;
    if (pointersRef.current.size === 0) { dragRef.current = null; panRef.current = null; }
  };

  // ---- プレースホルダ ----
  if (!pattern) {
    return html`
      <div class="bead-canvas">
        <div class="bead-canvas__placeholder muted">
          画像を選んで「画像から変換」を押してください。
        </div>
      </div>
    `;
  }

  const totalCells = pattern.width * pattern.height;
  const isCompare = viewMode === 'compare';
  const curColor = editingEnabled ? pattern.colors.find((c) => c.id === editColorId) : null;
  const canvasClass = 'bead-canvas__canvas' + (interactive ? ' bead-canvas__canvas--editing' : '');
  const rootClass = 'bead-canvas' + (fullscreen ? ' bead-canvas--fullscreen' : '');
  const canvasStyle = fullscreen
    ? `transform: translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`
    : null;

  const canvasEl = html`
    <canvas
      ref=${canvasRef}
      class=${canvasClass}
      style=${canvasStyle}
      onPointerDown=${pointerActive ? onPointerDown : null}
      onPointerMove=${pointerActive ? onPointerMove : null}
      onPointerUp=${pointerActive ? onPointerUp : null}
      onPointerCancel=${pointerActive ? onPointerUp : null}
      onPointerLeave=${pointerActive ? onPointerUp : null}
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
            onClick=${zoomOut} disabled=${!fullscreen && cellSize <= MIN_CELL_SIZE} aria-label="縮小">−</button>
          <span class="bead-canvas__zoom-value">${fullscreen ? Math.round(view.scale * 100) + '%' : cellSize + 'px'}</span>
          <button type="button" class="btn btn--ghost btn--sm bead-canvas__zoom-btn"
            onClick=${zoomIn} disabled=${!fullscreen && cellSize >= MAX_CELL_SIZE} aria-label="拡大">＋</button>
          <button type="button" class="btn btn--ghost btn--sm bead-canvas__zoom-fit" onClick=${doFit}>フィット</button>
          <button type="button" class="btn btn--ghost btn--sm bead-canvas__full"
            onClick=${() => setFullscreen((v) => !v)}>${fullscreen ? '✕ 閉じる' : '⛶ 全画面'}</button>
          ${fullscreen && onToggleCheckMode
            ? html`<button type="button" class=${'btn btn--sm ' + (checkMode ? 'btn--primary' : 'btn--ghost')}
                onClick=${() => onToggleCheckMode()}>${checkMode ? 'チェック中' : 'チェック'}</button>`
            : null}
        </div>
        <div class="bead-canvas__info muted">
          ${checkMode
            ? html`<b>チェック中 ${doneCount} / ${totalBeads}（${donePct}%）</b>`
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
                title="左右反転" onClick=${() => onToggleMirrorX && onToggleMirrorX()}>⇆</button>
              <button type="button" class=${'btn btn--sm bead-canvas__mir ' + (mirrorY ? 'btn--primary' : 'btn--ghost')}
                title="上下反転" onClick=${() => onToggleMirrorY && onToggleMirrorY()}>⇅</button>
            </div>
          `
        : null}

      ${interactive || fullscreen
        ? html`<div class="bead-canvas__draghint muted">
            ${fullscreen ? '2本指で拡大・移動できます。' : '拡大は ＋ / − ボタン、または「⛶ 全画面」で2本指でできます。'}${
              checkMode
                ? '1本指のドラッグ（押したまま動かす）でまとめてチェック／解除できます。'
                : interactive
                ? activeTool === 'eyedropper'
                  ? 'マスをタップすると、その色を取り出せます。'
                  : activeTool === 'bucket'
                  ? 'タップすると、同じ色のつながった範囲をまとめて塗れます。'
                  : '1本指のドラッグ（押したまま動かす）でまとめて' + (activeTool === 'eraser' ? '消せます' : '塗れます') + '。'
                : '1本指のドラッグ（押したまま動かす）で移動できます。'
            }
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
