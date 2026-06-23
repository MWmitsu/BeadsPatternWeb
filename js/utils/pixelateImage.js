// ============================================================
// 画像の縮小(ピクセル化)とプリ処理
// ------------------------------------------------------------
// 元画像を指定したビーズ数(width×height)の小さなキャンバスへ縮小し、
// その ImageData を返す。色判定はこの ImageData を入力に行う想定。
// オプションで「背景を白扱い」「コントラスト補正」「輪郭強調」を適用する。
// ============================================================

import { brightness } from './colorDistance.js';

/**
 * @typedef {Object} PixelateOptions
 * @property {boolean} [backgroundAsWhite]  透明部分を先に白で塗りつぶすか
 * @property {boolean} [contrastCorrection] 128中心の簡易コントラスト強調
 * @property {boolean} [outlineEnhancement] 輝度エッジを暗くして輪郭を強調
 */

/** 透明判定のアルファしきい値(これ未満は背景=エッジ処理対象外) */
const EDGE_ALPHA_THRESHOLD = 16;

/**
 * 元画像を width×height へ縮小し、各種補正を適用した ImageData を返す。
 * @param {HTMLImageElement} image
 * @param {number} width   横ビーズ数(縮小後ピクセル幅)
 * @param {number} height  縦ビーズ数(縮小後ピクセル高さ)
 * @param {PixelateOptions} [options]
 * @returns {ImageData}
 */
export function pixelateToImageData(image, width, height, options) {
  const opts = options || {};
  const w = Math.max(1, Math.floor(width));
  const h = Math.max(1, Math.floor(height));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  // 背景を白扱いにする場合は、縮小描画の前にキャンバスを白で塗る。
  // こうすると透明部分は白に、半透明部分は白とブレンドされる。
  if (opts.backgroundAsWhite) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);
  }

  // 平滑化を有効にして縮小(縮小時のアンチエイリアスで色が均される)
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, w, h);

  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  // ---- コントラスト補正 ----------------------------------
  // 128 を中心に係数を掛けて明暗の差を広げる。0-255 にクランプ。
  if (opts.contrastCorrection) {
    const factor = 1.2;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = clampByte((data[i] - 128) * factor + 128);
      data[i + 1] = clampByte((data[i + 1] - 128) * factor + 128);
      data[i + 2] = clampByte((data[i + 2] - 128) * factor + 128);
      // alpha(data[i+3])はそのまま
    }
  }

  // ---- 輪郭強調 ------------------------------------------
  // 各画素の輝度に対し簡易 Sobel でエッジ強度を求め、エッジが強い画素を
  // 暗くして輪郭を浮き立たせる。背景(alpha低)は対象外。やりすぎないよう
  // 強度を抑え、暗くする倍率に下限を設ける。
  if (opts.outlineEnhancement) {
    applyOutlineEnhancement(data, w, h);
  }

  return imageData;
}

/** 0-255 に丸めてクランプ(このファイル内専用の軽量版) */
function clampByte(v) {
  if (v < 0) return 0;
  if (v > 255) return 255;
  return Math.round(v);
}

/**
 * 輝度の輪郭(エッジ)を検出し、エッジ画素を暗くして輪郭を強調する。
 * data は RGBA の Uint8ClampedArray。元の輝度配列を別に作ってから
 * 書き込むことで、処理の伝播(暗くした結果がさらにエッジを生む)を防ぐ。
 * @param {Uint8ClampedArray} data
 * @param {number} w
 * @param {number} h
 */
function applyOutlineEnhancement(data, w, h) {
  // 先に各画素の輝度を計算しておく(読み取り専用の元データとして使う)
  const lum = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      lum[y * w + x] = brightness(data[idx], data[idx + 1], data[idx + 2]);
    }
  }

  // エッジ強度に応じて画素を暗くする最大量と感度
  const MAX_DARKEN = 0.35; // これ以上は暗くしない(やりすぎ防止)
  const SENSITIVITY = 1 / 255; // エッジ強度を 0-1 へ正規化する目安

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      const idx = p * 4;

      // 背景(透明/半透明)はエッジ対象外
      if (data[idx + 3] < EDGE_ALPHA_THRESHOLD) continue;

      // 端の画素はクランプして近傍を参照する
      const xm = x > 0 ? x - 1 : x;
      const xp = x < w - 1 ? x + 1 : x;
      const ym = y > 0 ? y - 1 : y;
      const yp = y < h - 1 ? y + 1 : y;

      const tl = lum[ym * w + xm];
      const tc = lum[ym * w + x];
      const tr = lum[ym * w + xp];
      const ml = lum[y * w + xm];
      const mr = lum[y * w + xp];
      const bl = lum[yp * w + xm];
      const bc = lum[yp * w + x];
      const br = lum[yp * w + xp];

      // Sobel 横/縦
      const gx = (tr + 2 * mr + br) - (tl + 2 * ml + bl);
      const gy = (bl + 2 * bc + br) - (tl + 2 * tc + tr);
      const magnitude = Math.sqrt(gx * gx + gy * gy);

      // エッジ強度を 0-1 に正規化し、暗くする割合を決める
      let ratio = magnitude * SENSITIVITY;
      if (ratio > MAX_DARKEN) ratio = MAX_DARKEN;
      if (ratio <= 0) continue;

      const k = 1 - ratio; // 各チャンネルへ掛ける係数
      data[idx] = clampByte(data[idx] * k);
      data[idx + 1] = clampByte(data[idx + 1] * k);
      data[idx + 2] = clampByte(data[idx + 2] * k);
      // alpha はそのまま
    }
  }
}
