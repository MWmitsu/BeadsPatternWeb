// ============================================================
// 簡易的な日本語色名の推定
// ------------------------------------------------------------
// 画像から抽出した各色に、人が読んで分かりやすい日本語の色名を付ける。
// RGB を HSL に変換し、色相・彩度・明度のヒューリスティックで判定する。
// 返り値は必ず COLOR_NAMES のいずれか(迷ったら 'その他')。
// ============================================================

import { hexToRgb } from './colorDistance.js';

/**
 * RGB(0-255) → HSL。h は 0-360(度)、s/l は 0-1。
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {{ h: number, s: number, l: number }}
 */
function rgbToHsl(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  // 明度(0-1)
  const l = (max + min) / 2;

  // 無彩色(delta=0)は色相・彩度なし
  if (delta === 0) {
    return { h: 0, s: 0, l };
  }

  // 彩度(0-1)
  const s = delta / (1 - Math.abs(2 * l - 1));

  // 色相(0-360)
  let h;
  if (max === rn) {
    h = ((gn - bn) / delta) % 6;
  } else if (max === gn) {
    h = (bn - rn) / delta + 2;
  } else {
    h = (rn - gn) / delta + 4;
  }
  h *= 60;
  if (h < 0) h += 360;

  return { h, s, l };
}

/**
 * 色相(度)がレンジ内かを判定。start>end の場合は 0度をまたぐ帯として扱う。
 * @param {number} h
 * @param {number} start
 * @param {number} end
 * @returns {boolean}
 */
function inHue(h, start, end) {
  if (start <= end) return h >= start && h < end;
  // 350-10 のように0をまたぐ帯
  return h >= start || h < end;
}

/**
 * RGB から日本語色名を推定する。
 * 返り値は必ず COLOR_NAMES のいずれか。
 * @param {number} r 0-255
 * @param {number} g 0-255
 * @param {number} b 0-255
 * @returns {string}
 */
export function estimateColorName(r, g, b) {
  const { h, s, l } = rgbToHsl(r, g, b);

  // --- 低彩度(無彩色寄り): 明度で 黒 / 灰色 / 白 ---
  if (s < 0.12) {
    if (l < 0.22) return '黒';
    if (l > 0.85) return '白';
    return '灰色';
  }

  // --- 暖色帯(色相およそ15-45度)の特例: 肌色 / ベージュ / 茶色 ---
  // この帯はオレンジ寄りだが、明度・彩度しだいで肌色やベージュ、茶色になる。
  if (inHue(h, 15, 45)) {
    // 明度が低〜中で彩度がある → 茶色
    if (l < 0.45) return '茶色';
    // 高明度・中彩度 → 肌色(彩度高め) / ベージュ(彩度低め)
    if (l >= 0.6) {
      return s < 0.4 ? 'ベージュ' : '肌色';
    }
    // 中明度の暖色はオレンジへ
    return 'オレンジ';
  }

  // 暖色のごく低色相(赤寄り)で明度が低い場合も茶色に寄せる
  if (inHue(h, 5, 15) && l < 0.35) return '茶色';

  // --- 色相帯ごとの基本色 ---
  if (inHue(h, 350, 10)) {
    // 赤帯。高明度・低めの彩度ならピンク寄りに。
    return l > 0.7 ? 'ピンク' : '赤';
  }
  if (inHue(h, 10, 40)) return 'オレンジ';
  if (inHue(h, 40, 65)) return '黄';
  if (inHue(h, 65, 160)) return '緑';
  if (inHue(h, 160, 200)) return '水色';
  if (inHue(h, 200, 250)) return '青';
  if (inHue(h, 250, 300)) return '紫';
  if (inHue(h, 300, 350)) {
    // 赤紫帯。高明度ならピンク、暗ければ紫寄り。
    return l > 0.45 ? 'ピンク' : '紫';
  }

  // どの条件にも当てはまらない場合
  return 'その他';
}

/**
 * HEX から日本語色名を推定する(estimateColorName に委譲)。
 * @param {string} hex "#RRGGBB" など
 * @returns {string}
 */
export function estimateColorNameFromHex(hex) {
  const { r, g, b } = hexToRgb(hex);
  return estimateColorName(r, g, b);
}
