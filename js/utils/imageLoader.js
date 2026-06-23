// ============================================================
// 画像ファイルの読み込みユーティリティ
// ------------------------------------------------------------
// ファイル選択/ドロップで受け取った File を HTMLImageElement や
// データURLへ変換する。対応形式は MIME か拡張子のどちらかで判定する
// (ブラウザによっては type が空になることがあるため拡張子も見る)。
// ============================================================

import { ACCEPTED_IMAGE_TYPES, ACCEPTED_IMAGE_EXT } from '../types.js';

/**
 * 対応している画像形式かどうかを判定する。
 * MIMEタイプが一致するか、ファイル名の拡張子が一致すれば true。
 * @param {File} file
 * @returns {boolean}
 */
function isAcceptedImage(file) {
  if (!file) return false;
  // MIME で判定
  if (file.type && ACCEPTED_IMAGE_TYPES.includes(file.type)) return true;
  // 拡張子で判定(末尾の .xxx を小文字化して比較)
  const name = (file.name || '').toLowerCase();
  const dot = name.lastIndexOf('.');
  if (dot >= 0) {
    const ext = name.slice(dot);
    if (ACCEPTED_IMAGE_EXT.includes(ext)) return true;
  }
  return false;
}

/**
 * 画像ファイルを HTMLImageElement として読み込む。
 * createObjectURL で一時URLを作り、読み込み完了/失敗時にいずれも revoke する。
 * @param {File} file
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!isAcceptedImage(file)) {
      reject(new Error('対応していない画像形式です(jpg/png/webp)'));
      return;
    }

    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      // 読み込めたら一時URLを解放してから解決する
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('画像の読み込みに失敗しました'));
    };

    img.src = url;
  });
}

/**
 * 画像ファイルをデータURL(Base64)文字列として読み込む。
 * サムネイル保存などに使う FileReader.readAsDataURL の Promise ラッパ。
 * @param {File} file
 * @returns {Promise<string>}
 */
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(/** @type {string} */ (reader.result));
    reader.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
    reader.readAsDataURL(file);
  });
}
