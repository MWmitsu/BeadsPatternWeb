// ============================================================
// shareCodec: 図案を URL ハッシュへ可逆エンコード(サーバ不要の共有用)
// ------------------------------------------------------------
// 外部依存なし。ブラウザの btoa / atob / encodeURIComponent などのみ使用。
// location.hash = '#d=...' を想定し、本体文字列(キー '#d=' を含まない)を扱う。
//
// コンパクト形 payload:
//   { v:1, w, h, t:title, c:[ '#' を除いた大文字HEX ... ], g:[値,連続数, ...] }
//   - grid は RLE(連長圧縮)で [colorId, runLength, ...] の数値配列に圧縮。
//   - JSON 化 → UTF-8 安全に base64url 化(btoa(unescape(encodeURIComponent(json)))
//     してから + → -, / → _, = 除去)。
// 可逆性(encode → decode で一致)を最優先とする。
// ============================================================

/** location.hash で用いるキー('#d=...' を想定) */
export const SHARE_HASH_KEY = 'd';

// ---- base64url ヘルパ ----------------------------------------

/**
 * UTF-8 文字列を base64url へ。
 * btoa は Latin1 しか扱えないため encodeURIComponent + unescape で
 * 各バイトを Latin1 文字列へ変換してから base64 化し、URL 安全文字へ置換する。
 * @param {string} str
 * @returns {string}
 */
function toBase64Url(str) {
  const b64 = btoa(unescape(encodeURIComponent(str)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * base64url を UTF-8 文字列へ復元(toBase64Url の逆)。
 * URL 安全文字を戻し、4の倍数長になるよう '=' を補ってから atob する。
 * @param {string} b64url
 * @returns {string}
 */
function fromBase64Url(b64url) {
  let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  // base64 は4文字単位。不足分を '=' で補う。
  const pad = b64.length % 4;
  if (pad === 2) b64 += '==';
  else if (pad === 3) b64 += '=';
  else if (pad === 1) throw new Error('invalid base64url length');
  return decodeURIComponent(escape(atob(b64)));
}

// ---- RLE(連長圧縮) ----------------------------------------

/**
 * 数値配列を RLE へ。[v,v,v,w] → [v,3,w,1]
 * @param {number[]} arr
 * @returns {number[]} [値, 連続数, 値, 連続数, ...]
 */
function rleEncode(arr) {
  const out = [];
  if (!arr || arr.length === 0) return out;
  let prev = arr[0];
  let run = 1;
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] === prev) {
      run++;
    } else {
      out.push(prev, run);
      prev = arr[i];
      run = 1;
    }
  }
  out.push(prev, run);
  return out;
}

/**
 * RLE を数値配列へ展開(rleEncode の逆)。[v,3,w,1] → [v,v,v,w]
 * @param {number[]} rle
 * @returns {number[]}
 */
function rleDecode(rle) {
  const out = [];
  if (!Array.isArray(rle)) return out;
  // 不正/破損リンクで巨大な連長が来てもフリーズ・OOMしないよう総展開長に上限を設ける。
  // 図案は最大400×400=160000マスなので、それを超える展開は破棄する。
  const MAX = 160000;
  let total = 0;
  for (let i = 0; i + 1 < rle.length; i += 2) {
    const value = rle[i];
    const run = rle[i + 1];
    if (!Number.isInteger(run) || run < 0 || run > MAX) throw new Error('bad rle run');
    total += run;
    if (total > MAX) throw new Error('rle too large');
    for (let n = 0; n < run; n++) out.push(value);
  }
  return out;
}

// ---- HEX 正規化(本モジュール内ローカル, '#' の有無を吸収) --------

/**
 * 任意HEX入力を '#' 無し・6桁・大文字へ。3桁は展開、不正は '000000'。
 * @param {string} hex
 * @returns {string} 'RRGGBB'(大文字, '#' 無し)
 */
function hexBody(hex) {
  let h = typeof hex === 'string' ? hex.trim() : '';
  if (h.startsWith('#')) h = h.slice(1);
  if (/^[0-9a-fA-F]{3}$/.test(h)) {
    // 3桁 → 6桁へ展開
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return '000000';
  return h.toUpperCase();
}

// ---- 公開 API ------------------------------------------------

/**
 * 図案をコンパクトな共有用文字列(base64url 本体)へエンコード。
 * @param {Object} pattern
 * @param {number} pattern.width
 * @param {number} pattern.height
 * @param {string} [pattern.title]
 * @param {string[]} pattern.colors  パレット順の '#RRGGBB' 文字列配列
 * @param {number[]} pattern.grid    colorId の row-major 1次元配列(長さ width*height, 0=背景)
 * @returns {string} base64url 化した本体文字列(先頭 '#' やキーは含まない)
 */
export function encodePatternToData({ width, height, title, colors, grid }) {
  const payload = {
    v: 1,
    w: width,
    h: height,
    t: typeof title === 'string' ? title : '',
    c: Array.isArray(colors) ? colors.map(hexBody) : [],
    g: rleEncode(Array.isArray(grid) ? grid : []),
  };
  const json = JSON.stringify(payload);
  return toBase64Url(json);
}

/**
 * encodePatternToData の逆。共有用文字列を図案オブジェクトへ復元。
 * 不正な入力時は null を返す(例外は内部で握り潰す)。
 * @param {string} str  base64url 本体文字列
 * @returns {{ width:number, height:number, title:string, colors:string[], grid:number[] } | null}
 */
export function decodeDataToPattern(str) {
  try {
    if (typeof str !== 'string' || str.length === 0) return null;
    const json = fromBase64Url(str);
    const obj = JSON.parse(json);
    if (!obj || typeof obj !== 'object') return null;

    const width = Number(obj.w);
    const height = Number(obj.h);
    // 復号の入口で寸法を厳格に検証(展開前に外部入力を遮断し、巨大データを弾く)
    if (
      !Number.isInteger(width) || !Number.isInteger(height) ||
      width < 1 || height < 1 || width > 400 || height > 400
    ) {
      return null;
    }

    const colors = Array.isArray(obj.c)
      ? obj.c.map((h) => '#' + hexBody(h))
      : [];
    // rleDecode は総展開長に上限があり、超過時は throw → 下の catch で null を返す
    const grid = rleDecode(obj.g);

    return {
      width,
      height,
      title: typeof obj.t === 'string' ? obj.t : '',
      colors,
      grid,
    };
  } catch {
    // 不正な base64 / JSON / 構造はすべて null
    return null;
  }
}

/**
 * 共有リンク全体の目安長。呼び出し側が長さで警告できるよう素直に返す。
 * (大きい/複雑な図案では URL が長くなるため)
 * @param {string} str  encodePatternToData の戻り値
 * @returns {number}
 */
export function estimateHashLength(str) {
  return typeof str === 'string' ? str.length : 0;
}
