// ============================================================
// PNG 書き出しユーティリティ
// ------------------------------------------------------------
// 図案を完成イメージ / 数字付き設計図として PNG ダウンロードする。
// 描画は renderPattern.js に一任し、ここでは canvas → Blob → ダウンロードのみ担う。
// ============================================================

import { renderPatternToCanvas } from '../lib/renderPattern.js';

/** ファイル名に使えない文字(\ / : * ? " < > |)を _ に置換する */
function sanitizeName(s) {
  return String(s || '').replace(/[\\/:*?"<>|]/g, '_').trim() || 'beads';
}

/**
 * canvas を PNG として a 要素経由でダウンロードする。
 * @param {HTMLCanvasElement} canvas
 * @param {string} filename 保存ファイル名(.png 込み)
 */
export function downloadCanvas(canvas, filename) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // 次のタイミングで URL を解放(クリック処理の完了を待つ)
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }, 'image/png');
}

/**
 * 完成イメージ(数字なし)を PNG 書き出しする。
 * @param {{colors: Array, cells: Array, width: number, height: number, title?: string}} pattern
 * @param {Object} [opts] cellSize / showGrid / backgroundColor などを上書き可能
 */
export function exportFinishedPng(pattern, opts = {}) {
  const canvas = renderPatternToCanvas(pattern, {
    ...opts,
    // 以下は完成イメージとして必ず適用する値(opts より優先)
    cellSize: opts.cellSize ?? 20,
    showGrid: opts.showGrid ?? false,
    showNumbers: false,
  });
  const title = sanitizeName(pattern.title);
  downloadCanvas(canvas, `${title}_完成イメージ.png`);
}

/**
 * 数字付き設計図を PNG 書き出しする。
 * @param {{colors: Array, cells: Array, width: number, height: number, title?: string}} pattern
 * @param {Object} [opts] cellSize / backgroundColor などを上書き可能
 */
export function exportNumberedPng(pattern, opts = {}) {
  const canvas = renderPatternToCanvas(pattern, {
    ...opts,
    // 数字付き設計図ではセルサイズ既定24・グリッドと数字を必ず表示する(opts より優先)
    cellSize: opts.cellSize ?? 24,
    showNumbers: true,
    showGrid: true,
  });
  const title = sanitizeName(pattern.title);
  downloadCanvas(canvas, `${title}_設計図.png`);
}
