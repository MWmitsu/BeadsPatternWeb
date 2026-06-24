// ============================================================
// 検出色 → ビーズ色 の最近傍マッチ / パレットスナップ
// ------------------------------------------------------------
// 検出された任意のRGB色を、実在するビーズ商品の色パレット(code/name/hex)へ
// RGB距離で最近傍スナップする。図案全体のスナップでは、検出色は数十色しか無いため
// 「色→ビーズ」の対応はその色数分だけ計算してMapに保持し、cells(最大~40000)は
// 1パスで付け替えることで二重ループを避ける。
// ============================================================

import { colorDistance, hexToRgb } from './colorDistance.js';
import { recountColors } from './colorDetection.js';
import { BACKGROUND_COLOR_ID } from '../types.js';

/**
 * hex に最も近いビーズ色のindexを返す(RGB距離)。
 * @param {string} hex 検出色 "#RRGGBB"
 * @param {Array<{code:string,name:string,hex:string}>} paletteColors ビーズ色パレット
 * @returns {number} 最近傍index。paletteColors が空なら -1。
 */
export function nearestBeadIndex(hex, paletteColors) {
  if (!paletteColors || paletteColors.length === 0) return -1;
  const { r, g, b } = hexToRgb(hex);
  let bestIdx = -1;
  let bestDist = Infinity;
  for (let i = 0; i < paletteColors.length; i++) {
    const pr = hexToRgb(paletteColors[i].hex);
    const d = colorDistance(r, g, b, pr.r, pr.g, pr.b);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * hex に最も近いビーズ色とその距離を返す。
 * @param {string} hex 検出色 "#RRGGBB"
 * @param {Array<{code:string,name:string,hex:string}>} paletteColors ビーズ色パレット
 * @returns {{ code:string, name:string, hex:string, distance:number } | null}
 *          最近傍が無い(パレット空)なら null。
 */
export function matchToPalette(hex, paletteColors) {
  const idx = nearestBeadIndex(hex, paletteColors);
  if (idx < 0) return null;
  const bead = paletteColors[idx];
  const a = hexToRgb(hex);
  const pr = hexToRgb(bead.hex);
  const distance = colorDistance(a.r, a.g, a.b, pr.r, pr.g, pr.b);
  return { code: bead.code, name: bead.name, hex: bead.hex, distance };
}

/**
 * 図案全体を、実在ビーズ色パレットへスナップする。
 * 手順:
 *   (1) 検出色 colors 各idの最近傍ビーズindexを求める(色数分のみ計算)。
 *   (2) 実際に使われたビーズだけを新パレット化(temp colors)。
 *   (3) cells の colorId をビーズベースの tempId へ付け替え(背景は維持、hexはビーズhexへ更新)。
 *   (4) recountColors で再集計して返す(code は spread で保持される)。
 * @param {import('../types.js').BeadCell[]} cells グリッド(最大 ~40000)
 * @param {import('../types.js').BeadColor[]} colors 検出色パレット(数十色想定)
 * @param {Array<{code:string,name:string,hex:string}>} paletteColors ビーズ色パレット
 * @returns {{ cells: import('../types.js').BeadCell[], colors: import('../types.js').BeadColor[], totalBeads: number }}
 */
export function snapPatternToPalette(cells, colors, paletteColors) {
  // パレットが空、または検出色が無い場合はそのまま再集計だけ行って返す。
  if (!paletteColors || paletteColors.length === 0 || !colors || colors.length === 0) {
    return recountColors(cells, colors || []);
  }

  // --- (1) 検出色id → 最近傍ビーズindex を求める(色数分のみ) ---
  /** @type {Map<number, number>} 検出色id → ビーズindex */
  const colorIdToBeadIdx = new Map();
  for (const c of colors) {
    colorIdToBeadIdx.set(c.id, nearestBeadIndex(c.hex, paletteColors));
  }

  // --- (2) 実際に使われたビーズだけを新パレット化 ---
  // 検出色id → 新tempId / ビーズindex → 新tempId の両方を管理する。
  /** @type {Map<number, number>} ビーズindex → tempId */
  const beadIdxToTempId = new Map();
  /** @type {import('../types.js').BeadColor[]} */
  const tempColors = [];
  /** @type {Map<number, {tempId:number, hex:string}>} 検出色id → 付け替え先 */
  const colorIdToTarget = new Map();

  for (const c of colors) {
    const beadIdx = colorIdToBeadIdx.get(c.id);
    if (beadIdx < 0) {
      // パレットが空でない限り起こらないが、安全のため検出色をそのまま使う扱いにはせずスキップ。
      continue;
    }
    let tempId = beadIdxToTempId.get(beadIdx);
    if (tempId === undefined) {
      const bead = paletteColors[beadIdx];
      tempId = tempColors.length + 1; // 1始まり(背景0と衝突しない)
      beadIdxToTempId.set(beadIdx, tempId);
      tempColors.push({
        id: tempId,
        hex: bead.hex,
        name: bead.name,
        code: bead.code,
        rgb: hexToRgb(bead.hex),
        count: 0,
        ratio: 0,
      });
    }
    colorIdToTarget.set(c.id, { tempId, hex: paletteColors[beadIdx].hex });
  }

  // --- (3) cells を1パスで付け替え(背景は BACKGROUND_COLOR_ID のまま) ---
  const newCells = cells.map((cell) => {
    if (cell.colorId === BACKGROUND_COLOR_ID) return cell;
    const target = colorIdToTarget.get(cell.colorId);
    // 対応が無い(検出色に存在しないid)場合は安全のためそのまま返す。
    if (target === undefined) return cell;
    return { ...cell, colorId: target.tempId, hex: target.hex };
  });

  // --- (4) 再集計(code は ...spread で保持される) ---
  return recountColors(newCells, tempColors);
}
