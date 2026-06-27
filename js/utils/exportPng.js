// ============================================================
// PNG 書き出しユーティリティ
// ------------------------------------------------------------
// 図案を完成イメージ / 数字付き設計図として PNG ダウンロードする。
// 描画は renderPattern.js に一任し、ここでは canvas → Blob → ダウンロードのみ担う。
// ============================================================

import { renderPatternToCanvas } from '../lib/renderPattern.js';

/** ファイル名に使えない文字(\ / : * ? " < > |)を _ に置換する(空なら fallback)。 */
export function sanitizeName(s, fallback = 'beads') {
  return String(s || '').replace(/[\\/:*?"<>|]/g, '_').trim() || fallback;
}

/** Blob/File を a 要素経由でダウンロードする(主にPC用)。 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // 次のタイミングで URL を解放(クリック処理の完了を待つ)
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * canvas を PNG として保存する。
 * iPhone/iPad/Android など(タッチ主体の端末)では、OSの共有シート経由で
 * 「画像を保存」(カメラロールへ保存)できるよう navigator.share を使う。
 * PC など(マウス主体)はファイルとしてダウンロードする。
 * ※ navigator.share はユーザー操作内で呼ぶ必要があるため、ファイルは同期的に作る。
 * @param {HTMLCanvasElement} canvas
 * @param {string} filename 保存ファイル名(.png 込み)
 */
export function downloadCanvas(canvas, filename) {
  // 共有用にファイルを「同期的に」作る(toBlobのコールバックを待つとiOSで共有が拒否される)
  let file = null;
  try {
    const dataUrl = canvas.toDataURL('image/png');
    const bin = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    file = new File([arr], filename, { type: 'image/png' });
  } catch (_) {
    file = null;
  }

  const touchDevice =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(pointer: coarse)').matches;

  // タッチ端末 & ファイル共有対応 → 共有シート(「画像を保存」でカメラロールへ)
  if (file && touchDevice && navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
    navigator.share({ files: [file], title: filename }).catch((err) => {
      // キャンセル(AbortError)は無視。それ以外はダウンロードにフォールバック。
      if (!err || err.name !== 'AbortError') downloadBlob(file, filename);
    });
    return;
  }

  // PC など: ダウンロード
  if (file) {
    downloadBlob(file, filename);
    return;
  }
  // toDataURL に失敗した場合の保険(従来の toBlob 経由)
  canvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, filename);
  }, 'image/png');
}

/**
 * 完成イメージ(数字なし)を PNG 書き出しする。
 * @param {{colors: Array, cells: Array, width: number, height: number, title?: string}} pattern
 * @param {Object} [opts] cellSize / showGrid / backgroundColor などを上書き可能
 */
export function exportFinishedPng(pattern, opts = {}) {
  // 「背景＝透明として扱う」で空マスがある図案は、PNGも背景を透明にする
  const hasTransparentBg = (pattern.backgroundCount || 0) > 0;
  const canvas = renderPatternToCanvas(pattern, {
    ...opts,
    // 以下は完成イメージとして必ず適用する値(opts より優先)
    cellSize: opts.cellSize ?? 20,
    showGrid: opts.showGrid ?? false,
    showNumbers: false,
    backgroundColor: opts.backgroundColor ?? (hasTransparentBg ? 'transparent' : '#FFFFFF'),
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
