// ============================================================
// 減色アルゴリズム(純粋関数のみ・DOM不使用)
// ------------------------------------------------------------
// ヒストグラム集計 → 近似色統合 → 最大色数までの凝集型クラスタリング、
// および最近傍パレット探索を提供する。
// すべて副作用なしの純粋関数で、colorDetection.js のパイプラインから利用される。
// ============================================================

import { colorDistance } from './colorDistance.js';

/**
 * 同一RGBのサンプルを集計してヒストグラムを作る。
 * @param {Array<{r:number,g:number,b:number}>} samples
 * @returns {Array<{r:number,g:number,b:number,count:number}>} 出現順を保った集計結果
 */
export function buildHistogram(samples) {
  /** @type {Map<number, {r:number,g:number,b:number,count:number}>} */
  const map = new Map();
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    // r,g,b は 0-255 前提。ビットシフトで一意キー化(高速)。
    const key = ((s.r & 0xff) << 16) | ((s.g & 0xff) << 8) | (s.b & 0xff);
    const hit = map.get(key);
    if (hit) {
      hit.count++;
    } else {
      map.set(key, { r: s.r, g: s.g, b: s.b, count: 1 });
    }
  }
  return Array.from(map.values());
}

/**
 * 近似色を距離しきい値で統合する。
 * count降順に走査し、既存クラスタ重心との距離 <= threshold なら
 * count加重平均でそのクラスタへ統合、無ければ新規クラスタを作る。
 * @param {Array<{r:number,g:number,b:number,count:number}>} entries
 * @param {number} threshold RGB距離しきい値
 * @returns {Array<{r:number,g:number,b:number,count:number}>}
 */
export function mergeByDistance(entries, threshold) {
  // 元配列を壊さないようコピーしてから count降順ソート。
  const sorted = entries.slice().sort((a, b) => b.count - a.count);
  /** @type {Array<{r:number,g:number,b:number,count:number}>} */
  const clusters = [];

  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i];
    let best = -1;
    let bestDist = Infinity;
    for (let c = 0; c < clusters.length; c++) {
      const cl = clusters[c];
      const d = colorDistance(e.r, e.g, e.b, cl.r, cl.g, cl.b);
      if (d <= threshold && d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    if (best === -1) {
      // 新規クラスタ(重心は自身のRGB)
      clusters.push({ r: e.r, g: e.g, b: e.b, count: e.count });
    } else {
      // count加重平均で重心を更新
      const cl = clusters[best];
      const total = cl.count + e.count;
      cl.r = (cl.r * cl.count + e.r * e.count) / total;
      cl.g = (cl.g * cl.count + e.g * e.count) / total;
      cl.b = (cl.b * cl.count + e.b * e.count) / total;
      cl.count = total;
    }
  }
  return clusters;
}

/**
 * 2クラスタを count加重平均で統合した新クラスタを返す。
 * @param {{r:number,g:number,b:number,count:number}} a
 * @param {{r:number,g:number,b:number,count:number}} b
 * @returns {{r:number,g:number,b:number,count:number}}
 */
function mergeTwo(a, b) {
  const total = a.count + b.count;
  return {
    r: (a.r * a.count + b.r * b.count) / total,
    g: (a.g * a.count + b.g * b.count) / total,
    b: (a.b * a.count + b.b * b.count) / total,
    count: total,
  };
}

/**
 * 凝集型クラスタリングで最大色数まで減らす。
 * 長さ > maxColors の間、最近接2クラスタを count加重平均で統合する。
 * 性能ガード: entries.length > 256 のときは count上位256を残し、
 * 残りは最近傍クラスタへ畳んでから凝集する(O(n^2)の爆発を防止)。
 * @param {Array<{r:number,g:number,b:number,count:number}>} entries
 * @param {number} maxColors 1以上
 * @returns {Array<{r:number,g:number,b:number,count:number}>}
 */
export function reduceToMaxColors(entries, maxColors) {
  const limit = Math.max(1, maxColors | 0);

  // 作業用にディープコピー(呼び出し側の配列を壊さない)
  let work = entries.map((e) => ({ r: e.r, g: e.g, b: e.b, count: e.count }));

  if (work.length <= limit) return work;

  // --- 性能ガード: 多すぎる場合は上位256へ事前集約 ---
  const GUARD = 256;
  if (work.length > GUARD) {
    work.sort((a, b) => b.count - a.count);
    const kept = work.slice(0, GUARD);
    const rest = work.slice(GUARD);
    // 残りを最近傍の kept クラスタへ加重平均で畳み込む
    for (let i = 0; i < rest.length; i++) {
      const e = rest[i];
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let k = 0; k < kept.length; k++) {
        const d = colorDistance(e.r, e.g, e.b, kept[k].r, kept[k].g, kept[k].b);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = k;
        }
      }
      kept[bestIdx] = mergeTwo(kept[bestIdx], e);
    }
    work = kept;
  }

  // --- 凝集型: 最近接2クラスタを繰り返し統合 ---
  while (work.length > limit) {
    let aIdx = 0;
    let bIdx = 1;
    let bestDist = Infinity;
    for (let i = 0; i < work.length; i++) {
      for (let j = i + 1; j < work.length; j++) {
        const d = colorDistance(
          work[i].r, work[i].g, work[i].b,
          work[j].r, work[j].g, work[j].b,
        );
        if (d < bestDist) {
          bestDist = d;
          aIdx = i;
          bIdx = j;
        }
      }
    }
    const merged = mergeTwo(work[aIdx], work[bIdx]);
    // 後ろのindexから消すことで前のindexがずれないようにする
    work.splice(bIdx, 1);
    work.splice(aIdx, 1);
    work.push(merged);
  }
  return work;
}

/**
 * パレット内で (r,g,b) に最も近い色のindexを返す。
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @param {Array<{r:number,g:number,b:number}>} palette
 * @returns {number} 最近傍index(paletteが空なら -1)
 */
export function nearestIndex(r, g, b, palette) {
  let bestIdx = -1;
  let bestDist = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const p = palette[i];
    const d = colorDistance(r, g, b, p.r, p.g, p.b);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}
