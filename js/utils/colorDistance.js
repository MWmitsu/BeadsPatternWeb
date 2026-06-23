// ============================================================
// 色の基本ユーティリティ: 距離 / 変換 / 明度 / 文字色
// ------------------------------------------------------------
// アプリ全体の基盤。外部依存を持たない(他utilからも安全にimportできるよう純粋関数のみ)。
// ============================================================

/** RGBユークリッド距離。仕様の distance 計算式そのまま。 */
export function colorDistance(r1, g1, b1, r2, g2, b2) {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

/** {r,g,b} 同士の距離 */
export function rgbDistance(a, b) {
  return colorDistance(a.r, a.g, a.b, b.r, b.g, b.b);
}

/** 0-255 に丸めてクランプ */
export function clamp255(v) {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

/** r,g,b → "#RRGGBB"(大文字) */
export function rgbToHex(r, g, b) {
  const h = (n) => clamp255(n).toString(16).padStart(2, '0').toUpperCase();
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** "#RRGGBB" / "#RGB" → {r,g,b}。不正な値は黒を返す。 */
export function hexToRgb(hex) {
  if (typeof hex !== 'string') return { r: 0, g: 0, b: 0 };
  let s = hex.trim().replace(/^#/, '');
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(s)) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(s.slice(0, 2), 16),
    g: parseInt(s.slice(2, 4), 16),
    b: parseInt(s.slice(4, 6), 16),
  };
}

/** 知覚的明度(0-255)。仕様: (r*299 + g*587 + b*114) / 1000 */
export function brightness(r, g, b) {
  return (r * 299 + g * 587 + b * 114) / 1000;
}

/** 背景RGBに対する見やすい文字色。明るい(>=128)→黒, 暗い→白。 */
export function textColorForRgb(r, g, b) {
  return brightness(r, g, b) >= 128 ? '#000000' : '#FFFFFF';
}

/** 背景HEXに対する文字色 */
export function textColorFor(hex) {
  const { r, g, b } = hexToRgb(hex);
  return textColorForRgb(r, g, b);
}

/** 有効な6桁/3桁HEXか(先頭#は任意) */
export function isValidHex(hex) {
  return typeof hex === 'string' && /^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(hex.trim());
}

/** 任意のHEX入力を "#RRGGBB"(大文字)へ正規化(不正なら黒) */
export function normalizeHex(hex) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r, g, b);
}
