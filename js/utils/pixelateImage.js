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
 * @property {{sx:number,sy:number,sw:number,sh:number}} [srcRect] 元画像から使う範囲(px)。既定=全体
 * @property {{dx:number,dy:number,dw:number,dh:number}} [destRect] 縮小先キャンバス内の描画範囲(px)。既定=全体。余白は背景色になる
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

  // 元画像から使う範囲(src)と、縮小先キャンバス内の描画範囲(dest)。
  // crop時は src を絞り、contain時は dest を中央に収め余白を背景色にする。
  const iw = image.naturalWidth || image.width || w;
  const ih = image.naturalHeight || image.height || h;
  const src = opts.srcRect || { sx: 0, sy: 0, sw: iw, sh: ih };
  const dst = opts.destRect || { dx: 0, dy: 0, dw: w, dh: h };

  // 面積平均で一気に縮小すると、色の境界で隣り合う2色が混ざって中間色(にじみ)になり、
  // 「どっちつかずのあいまいな色」のマスができてしまう。
  // そこで一度 数倍(SS倍)の解像度へ縮小し、各マスを「多数決(最頻色)」で1色に決めて
  // 境界をくっきりさせる(ビーズはハッキリした色分けが望ましいため)。
  const SS = Math.max(2, Math.min(4, Math.ceil(560 / Math.max(w, h))));
  const iw2 = w * SS;
  const ih2 = h * SS;

  const inter = document.createElement('canvas');
  inter.width = iw2;
  inter.height = ih2;
  const ictx = inter.getContext('2d');
  // 背景を白扱いにする場合は、縮小描画の前にキャンバスを白で塗る(透明部分は白に)。
  if (opts.backgroundAsWhite) {
    ictx.fillStyle = '#FFFFFF';
    ictx.fillRect(0, 0, iw2, ih2);
  }
  // 平滑化はあえて切る。平滑化すると境界に「中間色のにじみ帯」が広がり、
  // 多数決をしても境界マスがその中間色に倒れてしまう。最近傍サンプルにすれば
  // 各サンプルは元の純色なので、多数決で「多い方の色」にくっきり決まる。
  ictx.imageSmoothingEnabled = false;
  ictx.drawImage(
    image,
    src.sx, src.sy, src.sw, src.sh,
    dst.dx * SS, dst.dy * SS, dst.dw * SS, dst.dh * SS
  );
  const hi = ictx.getImageData(0, 0, iw2, ih2).data;

  // 出力(w×h)を各マスの最頻色プーリングで作る
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(w, h);
  const data = imageData.data;
  poolDominantColor(hi, iw2, data, w, h, SS);

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

/**
 * 高解像度(SS倍)の RGBA データを、各マスの「最頻色」で w×h へ縮約する。
 * 近い色を粗いバケット(各色16階調・α8階調)でまとめて多数決し、
 * 勝ったバケットの平均色(実在する色)を採用する。これにより境界の中間色(にじみ)を抑え、
 * くっきりした色分けにする。面積平均と違い、境界マスは「多い方の色」に倒れる。
 * @param {Uint8ClampedArray} hi  高解像度RGBA(iw2×ih2)
 * @param {number} hiW  高解像度の幅(=w*SS)
 * @param {Uint8ClampedArray} dst 出力RGBA(w×h)
 * @param {number} w
 * @param {number} h
 * @param {number} SS スーパーサンプル倍率
 */
function poolDominantColor(hi, hiW, dst, w, h, SS) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const buckets = new Map();
      let best = null;
      for (let yy = 0; yy < SS; yy++) {
        const sy = y * SS + yy;
        let p = (sy * hiW + x * SS) * 4;
        for (let xx = 0; xx < SS; xx++) {
          const r = hi[p];
          const g = hi[p + 1];
          const b = hi[p + 2];
          const a = hi[p + 3];
          p += 4;
          const key = ((r >> 4) << 11) | ((g >> 4) << 7) | ((b >> 4) << 3) | (a >> 5);
          let e = buckets.get(key);
          if (!e) { e = { c: 0, r: 0, g: 0, b: 0, a: 0 }; buckets.set(key, e); }
          e.c++; e.r += r; e.g += g; e.b += b; e.a += a;
          if (!best || e.c > best.c) best = e;
        }
      }
      const dp = (y * w + x) * 4;
      dst[dp] = Math.round(best.r / best.c);
      dst[dp + 1] = Math.round(best.g / best.c);
      dst[dp + 2] = Math.round(best.b / best.c);
      dst[dp + 3] = Math.round(best.a / best.c);
    }
  }
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
