// ============================================================
// BeadCanvas: 図案を <canvas> に描画する中核プレビューコンポーネント
// ------------------------------------------------------------
// drawPattern を使って pattern を描く。viewMode に応じて描画オプションを組み立て、
// pattern / 各オプション / cellSize の変化時に useEffect で再描画する。
// ズームUI(＋ / − / フィット)・図案サイズ表示・クリックによるセル選択を備える。
//   - 完成イメージ(finished):   グリッド/数字なし
//   - 数字付き設計図(numbers):  グリッド + 数字
//   - グリッド付き(grid):       グリッドのみ
//   - 色別ハイライト(highlight): highlightColorId 指定色を強調
//   - 元画像と比較(compare):     完成イメージ + 元画像を横並び
// ============================================================

import { html, useRef, useEffect } from '../lib/html.js';
import { drawPattern } from '../lib/renderPattern.js';

// ズームの下限・上限・刻み(1マスのpxサイズ)
const MIN_CELL_SIZE = 2;
const MAX_CELL_SIZE = 40;
const ZOOM_STEP = 2;

/**
 * viewMode と各 prop から drawPattern 用のオプションを組み立てる。
 * @param {string} viewMode
 * @param {{showGrid:boolean, showNumbers:boolean, highlightColorId:number|null}} flags
 * @returns {{showGrid:boolean, showNumbers:boolean, highlightColorId:number|null}}
 */
function buildDrawOpts(viewMode, flags) {
  const { showGrid, showNumbers, highlightColorId } = flags;
  switch (viewMode) {
    case 'finished':
      // 完成イメージはグリッドも数字も出さない
      return { showGrid: false, showNumbers: false, highlightColorId: null };
    case 'numbers':
      // 数字付き設計図はグリッド + 数字を常に表示
      return { showGrid: true, showNumbers: true, highlightColorId: null };
    case 'grid':
      // グリッドのみ(数字なし)
      return { showGrid: true, showNumbers: false, highlightColorId: null };
    case 'highlight':
      // 色別ハイライト。グリッド/数字は prop の指定を尊重しつつ強調色を渡す
      return { showGrid, showNumbers, highlightColorId };
    case 'compare':
      // 比較は完成イメージ相当(横並びの元画像と見比べる)
      return { showGrid: false, showNumbers: false, highlightColorId: null };
    default:
      // 不明なモードは prop をそのまま反映
      return { showGrid, showNumbers, highlightColorId: highlightColorId ?? null };
  }
}

/**
 * 図案プレビュー本体。
 * @param {Object} props
 * @param {{colors:any[], cells:any[], width:number, height:number}|null} props.pattern
 * @param {'finished'|'numbers'|'grid'|'highlight'|'compare'} props.viewMode
 * @param {boolean} props.showGrid
 * @param {boolean} props.showNumbers
 * @param {number|null} props.highlightColorId
 * @param {string|null} props.originalUrl  compare用の元画像URL
 * @param {number} props.cellSize  1マスのpxサイズ(ズーム結果)
 * @param {(next:number)=>void} props.onCellSizeChange
 * @param {(x:number, y:number)=>void} props.onCellClick
 * @param {boolean} props.editingEnabled
 */
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
    onCellClick,
    editingEnabled = false,
    checkMode = false,
    doneSet = null,
    onToggleDone,
  } = props;

  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const interactive = editingEnabled || checkMode;

  // pattern / オプション / cellSize の変化時に再描画
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !pattern) return;

    const cs = Math.max(MIN_CELL_SIZE, cellSize);
    // 内部解像度は width*cellSize(CSS側で max-width:100% に縮小表示)
    canvas.width = Math.max(1, pattern.width * cs);
    canvas.height = Math.max(1, pattern.height * cs);

    const ctx = canvas.getContext('2d');
    const opts = buildDrawOpts(viewMode, { showGrid, showNumbers, highlightColorId });
    drawPattern(ctx, pattern, { ...opts, cellSize: cs, doneSet });
  }, [pattern, viewMode, showGrid, showNumbers, highlightColorId, cellSize, doneSet]);

  // ---- ズーム操作 ----
  const handleZoomIn = () => {
    if (!onCellSizeChange) return;
    onCellSizeChange(Math.min(MAX_CELL_SIZE, cellSize + ZOOM_STEP));
  };
  const handleZoomOut = () => {
    if (!onCellSizeChange) return;
    onCellSizeChange(Math.max(MIN_CELL_SIZE, cellSize - ZOOM_STEP));
  };
  // フィット: ステージ表示幅に図案の横マス数が収まる cellSize を算出
  const handleFit = () => {
    if (!onCellSizeChange || !pattern || !stageRef.current) return;
    const avail = stageRef.current.clientWidth - 8; // 余白ぶん控える
    const fit = Math.floor(avail / pattern.width);
    const next = Math.max(MIN_CELL_SIZE, Math.min(MAX_CELL_SIZE, fit));
    onCellSizeChange(next);
  };

  // ---- クリック → セル座標へ変換 ----
  const handleCanvasClick = (e) => {
    if (!pattern) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    // CSSで縮小表示されている場合があるため、内部解像度との比率で補正する
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const offsetX = (e.clientX - rect.left) * scaleX;
    const offsetY = (e.clientY - rect.top) * scaleY;
    const x = Math.floor(offsetX / cellSize);
    const y = Math.floor(offsetY / cellSize);
    if (x < 0 || y < 0 || x >= pattern.width || y >= pattern.height) return;
    if (checkMode) {
      if (onToggleDone) onToggleDone(x, y);
    } else if (onCellClick) {
      onCellClick(x, y);
    }
  };

  // ---- pattern 未読み込み: プレースホルダ ----
  if (!pattern) {
    return html`
      <div class="bead-canvas">
        <div class="bead-canvas__placeholder muted">
          画像を読み込んで変換してください
        </div>
      </div>
    `;
  }

  const totalPx = pattern.width * pattern.height;
  const isCompare = viewMode === 'compare';
  const canvasClass =
    'bead-canvas__canvas' +
    (interactive ? ' bead-canvas__canvas--editing' : '');

  return html`
    <div class="bead-canvas">
      <div class="bead-canvas__toolbar">
        <div class="bead-canvas__zoom">
          <button
            type="button"
            class="btn btn--ghost btn--sm bead-canvas__zoom-btn"
            onClick=${handleZoomOut}
            disabled=${cellSize <= MIN_CELL_SIZE}
            aria-label="縮小"
          >−</button>
          <span class="bead-canvas__zoom-value">${cellSize}px</span>
          <button
            type="button"
            class="btn btn--ghost btn--sm bead-canvas__zoom-btn"
            onClick=${handleZoomIn}
            disabled=${cellSize >= MAX_CELL_SIZE}
            aria-label="拡大"
          >＋</button>
          <button
            type="button"
            class="btn btn--ghost btn--sm bead-canvas__zoom-fit"
            onClick=${handleFit}
          >フィット</button>
        </div>
        <div class="bead-canvas__info muted">
          ${pattern.width} × ${pattern.height} マス（計 ${totalPx.toLocaleString()} マス）
        </div>
      </div>

      ${isCompare
        ? html`
            <div class="bead-canvas__compare" ref=${stageRef}>
              <div class="bead-canvas__compare-pane">
                <div class="bead-canvas__compare-label muted">完成イメージ</div>
                <canvas
                  ref=${canvasRef}
                  class=${canvasClass}
                  onClick=${interactive ? handleCanvasClick : null}
                ></canvas>
              </div>
              <div class="bead-canvas__compare-pane">
                <div class="bead-canvas__compare-label muted">元画像</div>
                ${originalUrl
                  ? html`<img
                      class="bead-canvas__compare-img"
                      src=${originalUrl}
                      alt="元画像"
                    />`
                  : html`<div class="bead-canvas__compare-empty muted">
                      元画像がありません
                    </div>`}
              </div>
            </div>
          `
        : html`
            <div class="bead-canvas__stage" ref=${stageRef}>
              <canvas
                ref=${canvasRef}
                class=${canvasClass}
                onClick=${interactive ? handleCanvasClick : null}
              ></canvas>
            </div>
          `}
    </div>
  `;
}
