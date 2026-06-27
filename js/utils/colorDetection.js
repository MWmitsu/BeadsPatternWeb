// ============================================================
// 変換パイプライン本体: ImageData → ビーズ図案(DetectionResult)
// ------------------------------------------------------------
// 縮小済みImageDataを走査し、ヒストグラム集計 → 近似色統合 → 最大色数まで減色 →
// 各セル割当(任意でFloyd–Steinbergディザリング)→ 少数色統合 →
// パレット採番(count降順)→ cells生成、までを担う。
// 想定最大 ~200x200=40000px でも実用速度を保つよう重い二重ループを避ける。
// ============================================================

import {
  buildHistogram,
  mergeByDistance,
  reduceToMaxColors,
  nearestIndex,
} from './colorQuantize.js';
import { colorDistance, rgbToHex } from './colorDistance.js';
import { estimateColorName } from './colorName.js';
import { BACKGROUND_COLOR_ID, ALPHA_THRESHOLD } from '../types.js';

/**
 * 縮小済みImageDataからビーズ図案を検出する。
 * @param {ImageData} imageData width×height の縮小済み画像データ
 * @param {{
 *   maxColors:number,
 *   colorDistanceThreshold:number,
 *   mergeMinorColors:boolean,
 *   minorColorCountThreshold:number,
 *   dithering:boolean,
 *   backgroundAsWhite:boolean
 * }} settings
 * @returns {import('../types.js').DetectionResult}
 */
export function detectBeadPattern(imageData, settings) {
  const { width, height, data } = imageData;
  const {
    maxColors,
    colorDistanceThreshold,
    mergeMinorColors,
    minorColorCountThreshold,
    dithering,
    backgroundAsWhite,
  } = settings;

  const cellCount = width * height;

  // --- (1) 各ピクセル走査。背景判定とワーキング用RGBバッファを用意 ---
  // isBg[i]: 透明背景セルか(backgroundAsWhite=true のときは常に false)
  const isBg = new Uint8Array(cellCount);
  // ワーキングRGB(ディザリングで誤差を加算するため Float32 を使う)
  const wr = new Float32Array(cellCount);
  const wg = new Float32Array(cellCount);
  const wb = new Float32Array(cellCount);

  /** @type {Array<{r:number,g:number,b:number}>} 非背景セルのサンプル */
  const samples = [];
  let backgroundCount = 0;

  for (let i = 0; i < cellCount; i++) {
    const p = i * 4;
    const a = data[p + 3];
    if (a < ALPHA_THRESHOLD) {
      if (backgroundAsWhite) {
        // 透明を白ビーズ扱い
        wr[i] = 255; wg[i] = 255; wb[i] = 255;
        samples.push({ r: 255, g: 255, b: 255 });
      } else {
        // 背景(ビーズ無し)
        isBg[i] = 1;
        backgroundCount++;
      }
    } else {
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      wr[i] = r; wg[i] = g; wb[i] = b;
      samples.push({ r, g, b });
    }
  }

  // 非背景セルが1つも無い特殊ケース(全透明 & backgroundAsWhite=false)
  if (samples.length === 0) {
    const cells = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        cells.push({ x, y, colorId: BACKGROUND_COLOR_ID, hex: '' });
      }
    }
    return { width, height, colors: [], cells, totalBeads: 0, backgroundCount };
  }

  // --- (2)(3) ヒストグラム → 近似色統合 → 最大色数まで減色 = パレット重心群 ---
  const hist = buildHistogram(samples);
  const merged = mergeByDistance(hist, colorDistanceThreshold);
  const centroids = reduceToMaxColors(merged, maxColors);
  // パレットは {r,g,b}(整数化)で保持
  let palette = centroids.map((c) => ({
    r: Math.round(c.r),
    g: Math.round(c.g),
    b: Math.round(c.b),
  }));

  // --- (4) 各非背景セルを最近傍パレットへ割当 ---
  // assigned[i]: パレットindex(背景セルは -1)
  const assigned = new Int32Array(cellCount).fill(-1);

  if (dithering) {
    // Floyd–Steinberg を行優先で適用。背景セルは誤差を伝播せずスキップ。
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (isBg[i]) continue;

        const idx = nearestIndex(wr[i], wg[i], wb[i], palette);
        assigned[i] = idx;
        const p = palette[idx];

        // 量子化誤差(現在のワーキング値 - 選ばれたパレット色)
        const er = wr[i] - p.r;
        const eg = wg[i] - p.g;
        const eb = wb[i] - p.b;

        // 近傍へ誤差を拡散(背景でないセルにのみ加算)
        diffuse(wr, wg, wb, isBg, width, height, x + 1, y, er, eg, eb, 7 / 16);
        diffuse(wr, wg, wb, isBg, width, height, x - 1, y + 1, er, eg, eb, 3 / 16);
        diffuse(wr, wg, wb, isBg, width, height, x, y + 1, er, eg, eb, 5 / 16);
        diffuse(wr, wg, wb, isBg, width, height, x + 1, y + 1, er, eg, eb, 1 / 16);
      }
    }
  } else {
    // 同じRGBは結果も同じなので、色→パレットindex をキャッシュして線形探索を省く。
    // (ディザリング時は誤差で値が毎回変わるためキャッシュしない)
    const idxCache = new Map();
    for (let i = 0; i < cellCount; i++) {
      if (isBg[i]) continue;
      const r = wr[i] | 0, g = wg[i] | 0, b = wb[i] | 0;
      const key = (r << 16) | (g << 8) | b;
      let idx = idxCache.get(key);
      if (idx === undefined) {
        idx = nearestIndex(wr[i], wg[i], wb[i], palette);
        idxCache.set(key, idx);
      }
      assigned[i] = idx;
    }
  }

  // パレット各色の使用数を集計
  let counts = new Array(palette.length).fill(0);
  for (let i = 0; i < cellCount; i++) {
    const idx = assigned[i];
    if (idx >= 0) counts[idx]++;
  }

  // --- (5) 少数色統合: count<=しきい値 の色を最小から他最近傍色へ再割当 ---
  if (mergeMinorColors && palette.length > 1) {
    // 「生存」フラグと、生存色への再マップを管理
    let alive = palette.map(() => true);

    // 少数色を count昇順で処理(最小から)。最低1色は残す。
    const order = palette
      .map((_, i) => i)
      .filter((i) => counts[i] <= minorColorCountThreshold)
      .sort((a, b) => counts[a] - counts[b]);

    let aliveTotal = palette.length;
    for (const minor of order) {
      if (aliveTotal <= 1) break;        // 最低1色は残す
      if (!alive[minor]) continue;
      // 統合中に他色を吸収してしきい値を超えて育った色は、もう少数色ではないので対象外にする
      if (counts[minor] > minorColorCountThreshold) continue;

      // 生存している他色の中で最近傍を探す
      let target = -1;
      let bestDist = Infinity;
      for (let j = 0; j < palette.length; j++) {
        if (j === minor || !alive[j]) continue;
        const d = colorDistance(
          palette[minor].r, palette[minor].g, palette[minor].b,
          palette[j].r, palette[j].g, palette[j].b,
        );
        if (d < bestDist) { bestDist = d; target = j; }
      }
      if (target === -1) continue;

      // minor の全セルを target へ付け替え
      for (let i = 0; i < cellCount; i++) {
        if (assigned[i] === minor) assigned[i] = target;
      }
      counts[target] += counts[minor];
      counts[minor] = 0;
      alive[minor] = false;
      aliveTotal--;
    }

    // 生存色だけに圧縮し、assigned を新indexへ付け替え
    const remap = new Array(palette.length).fill(-1);
    const newPalette = [];
    const newCounts = [];
    for (let j = 0; j < palette.length; j++) {
      if (alive[j]) {
        remap[j] = newPalette.length;
        newPalette.push(palette[j]);
        newCounts.push(counts[j]);
      }
    }
    for (let i = 0; i < cellCount; i++) {
      const idx = assigned[i];
      if (idx >= 0) assigned[i] = remap[idx];
    }
    palette = newPalette;
    counts = newCounts;
  } else {
    // count=0 の未使用色は除去(reduce後に未使用が出るケースに備える)
    const remap = new Array(palette.length).fill(-1);
    const newPalette = [];
    const newCounts = [];
    for (let j = 0; j < palette.length; j++) {
      if (counts[j] > 0) {
        remap[j] = newPalette.length;
        newPalette.push(palette[j]);
        newCounts.push(counts[j]);
      }
    }
    for (let i = 0; i < cellCount; i++) {
      const idx = assigned[i];
      if (idx >= 0) assigned[i] = remap[idx];
    }
    palette = newPalette;
    counts = newCounts;
  }

  const totalBeads = cellCount - backgroundCount;

  // --- (6) パレットを count降順で id=1..N 採番、hex/name/ratio を付与 ---
  // 旧index → 採番後index の対応を作るため、count降順に並べ替え
  const orderByCount = palette
    .map((_, i) => i)
    .sort((a, b) => counts[b] - counts[a]);

  const oldToNew = new Array(palette.length).fill(-1);
  /** @type {import('../types.js').BeadColor[]} */
  const colors = [];
  orderByCount.forEach((oldIdx, rank) => {
    oldToNew[oldIdx] = rank;
    const c = palette[oldIdx];
    const count = counts[oldIdx];
    const hex = rgbToHex(c.r, c.g, c.b);
    colors.push({
      id: rank + 1,
      hex,
      rgb: { r: c.r, g: c.g, b: c.b },
      name: estimateColorName(c.r, c.g, c.b),
      count,
      ratio: totalBeads > 0 ? Math.round((count / totalBeads) * 1000) / 10 : 0,
    });
  });

  // --- (7) cells[] を row-major で生成 ---
  /** @type {import('../types.js').BeadCell[]} */
  const cells = new Array(cellCount);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (isBg[i]) {
        cells[i] = { x, y, colorId: BACKGROUND_COLOR_ID, hex: '' };
      } else {
        const newIdx = oldToNew[assigned[i]];
        const color = colors[newIdx];
        cells[i] = { x, y, colorId: color.id, hex: color.hex };
      }
    }
  }

  // --- (8) 結果を返す ---
  return { width, height, colors, cells, totalBeads, backgroundCount };
}

/**
 * Floyd–Steinberg の誤差拡散ヘルパー。
 * (x,y) が範囲内かつ背景でないセルにのみ係数付きで誤差を加算する。
 * @private
 */
function diffuse(wr, wg, wb, isBg, width, height, x, y, er, eg, eb, factor) {
  if (x < 0 || x >= width || y < 0 || y >= height) return;
  const i = y * width + x;
  if (isBg[i]) return;
  wr[i] += er * factor;
  wg[i] += eg * factor;
  wb[i] += eb * factor;
}

/**
 * 手動編集/統合後の再集計。
 * cells の colorId 出現数を数え、count=0 の色を除去、count降順で id=1..N 再採番、
 * 旧id→新id で cells.colorId を書き換える(背景0は維持)。hex/name は保持し ratio を再計算。
 * @param {import('../types.js').BeadCell[]} cells
 * @param {import('../types.js').BeadColor[]} colors
 * @returns {{ cells: import('../types.js').BeadCell[], colors: import('../types.js').BeadColor[], totalBeads: number }}
 */
export function recountColors(cells, colors) {
  // 各色IDの出現数を集計
  /** @type {Map<number, number>} */
  const countById = new Map();
  let totalBeads = 0;
  for (let i = 0; i < cells.length; i++) {
    const id = cells[i].colorId;
    if (id === BACKGROUND_COLOR_ID) continue;
    totalBeads++;
    countById.set(id, (countById.get(id) || 0) + 1);
  }

  // count>0 の色だけ残し、count降順に並べる
  const survivors = colors
    .filter((c) => (countById.get(c.id) || 0) > 0)
    .map((c) => ({ color: c, count: countById.get(c.id) || 0 }))
    .sort((a, b) => b.count - a.count);

  // 旧id → 新id の対応を作りつつ、新パレットを構築
  /** @type {Map<number, number>} */
  const oldToNew = new Map();
  /** @type {import('../types.js').BeadColor[]} */
  const newColors = survivors.map((s, idx) => {
    const newId = idx + 1;
    oldToNew.set(s.color.id, newId);
    return {
      ...s.color,
      id: newId,
      count: s.count,
      ratio: totalBeads > 0 ? Math.round((s.count / totalBeads) * 1000) / 10 : 0,
    };
  });

  // cells の colorId を書き換え(背景は維持)
  const newCells = cells.map((cell) => {
    if (cell.colorId === BACKGROUND_COLOR_ID) return cell;
    const newId = oldToNew.get(cell.colorId);
    // 対応が無い(count=0扱いになった)場合は背景化はせず、安全のため背景へ寄せない:
    // 通常 count>0 のものだけ生存するので必ず対応がある。万一無ければそのまま返す。
    return newId == null ? cell : { ...cell, colorId: newId };
  });

  return { cells: newCells, colors: newColors, totalBeads };
}
