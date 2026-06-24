// ============================================================
// 作例（テンプレート）データ
// ------------------------------------------------------------
// 画像を用意しなくても、ボタン1つで定番モチーフのドット絵図案を作れる。
// 各テンプレートは図形を計算で描くジェネレーターを持ち、文字グリッド
// （1文字=1色キー、'.'/' '=透明背景）を生成する。buildTemplate がそれを
// applyLoaded がそのまま読める保存図案形 { width,height,colors,grid,... }
// へ変換する。色のにじみが無く、設計どおりのきれいな図案になる。
// ============================================================

import { BACKGROUND_COLOR_ID } from '../types.js';

// 使用する色キー → HEX と色名
const PAL = {
  r: { hex: '#E60026', name: '赤' },
  o: { hex: '#FF8A00', name: 'オレンジ' },
  y: { hex: '#FFD23F', name: '黄' },
  g: { hex: '#4CAF50', name: '緑' },
  u: { hex: '#1E88E5', name: '青' },
  b: { hex: '#5CC8F5', name: '水色' },
  p: { hex: '#FF7DA8', name: 'ピンク' },
  k: { hex: '#333333', name: '黒' },
  w: { hex: '#FFFFFF', name: '白' },
  c: { hex: '#F2D9B0', name: 'ベージュ' },
};

// --- 小さなヘルパー --------------------------------------------

/** H×W の2次元配列（null=背景）を作る */
function grid(W, H) {
  const g = new Array(H);
  for (let y = 0; y < H; y++) g[y] = new Array(W).fill(null);
  return g;
}

/** 中心(cx,cy)・半径rの円内のセルを ch で塗る（onlyOver指定時はその色の上だけ） */
function fillCircle(g, cx, cy, r, ch, onlyOver) {
  const H = g.length;
  const W = g[0].length;
  const r2 = r * r;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= r2) {
        if (onlyOver == null || g[y][x] === onlyOver) g[y][x] = ch;
      }
    }
  }
}

/** 多角形（頂点配列）内判定（even-odd） */
function pointInPoly(px, py, verts) {
  let inside = false;
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const xi = verts[i][0], yi = verts[i][1];
    const xj = verts[j][0], yj = verts[j][1];
    const hit = (yi > py) !== (yj > py) &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// --- モチーフ・ジェネレーター ----------------------------------

function genHeart() {
  const W = 15, H = 13, g = grid(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const X = ((x + 0.5) / W * 2 - 1) * 1.15;
      const Y = (1 - (y + 0.5) / H) * 2.5 - 1.0; // 上=約1.4 / 下=約-0.9
      const f = Math.pow(X * X + Y * Y - 1, 3) - X * X * Y * Y * Y;
      if (f <= 0) g[y][x] = 'r';
    }
  }
  return g;
}

function genStar() {
  const W = 15, H = 15, g = grid(W, H);
  const cx = 7.5, cy = 7.7, R = 7.2, r = 3.0;
  const verts = [];
  for (let k = 0; k < 10; k++) {
    const rad = k % 2 === 0 ? R : r;
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    verts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (pointInPoly(x + 0.5, y + 0.5, verts)) g[y][x] = 'y';
    }
  }
  return g;
}

function genRainbow() {
  const W = 17, H = 10, g = grid(W, H);
  const cx = 8.5, cy = 9.5;
  const bands = [
    { c: 'r', R: 8.5 }, { c: 'o', R: 7.2 }, { c: 'y', R: 5.9 },
    { c: 'g', R: 4.6 }, { c: 'u', R: 3.3 },
  ];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dy > 0) continue; // 上半分の弧だけ
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 8.5 || d < 2.0) continue; // 外側・内側の穴は背景
      let col = null;
      for (const bnd of bands) if (d <= bnd.R) col = bnd.c; // 最小半径の帯が勝つ
      if (col) g[y][x] = col;
    }
  }
  return g;
}

function genFlower() {
  const W = 15, H = 15, g = grid(W, H);
  const cx = 7.5, cy = 7.5;
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5;
    fillCircle(g, cx + Math.cos(a) * 3.6, cy + Math.sin(a) * 3.6, 2.7, 'p');
  }
  fillCircle(g, cx, cy, 2.3, 'y'); // 花の中心
  return g;
}

function genSmiley() {
  const W = 15, H = 15, g = grid(W, H);
  const cx = 7.5, cy = 7.5;
  fillCircle(g, cx, cy, 6.9, 'y');               // 顔
  fillCircle(g, cx - 2.4, cy - 1.4, 1.15, 'k');  // 左目
  fillCircle(g, cx + 2.4, cy - 1.4, 1.15, 'k');  // 右目
  // 口（下向きの弧）
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - (cy - 0.6);
      const d = Math.sqrt(dx * dx + dy * dy);
      if (dy > 1.3 && d > 2.9 && d < 4.1 && Math.abs(dx) < 3.7) g[y][x] = 'k';
    }
  }
  return g;
}

function genMushroom() {
  const W = 15, H = 15, g = grid(W, H);
  // かさ（赤い半ドーム）
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ex = (x + 0.5 - 7.5) / 6.9;
      const ey = (y + 0.5 - 6.3) / 5.4;
      if (y + 0.5 <= 6.6 && ex * ex + ey * ey <= 1) g[y][x] = 'r';
    }
  }
  // 白い水玉（かさの上だけ）
  fillCircle(g, 4.2, 4.4, 1.25, 'w', 'r');
  fillCircle(g, 8.6, 3.2, 1.05, 'w', 'r');
  fillCircle(g, 11.2, 5.2, 1.2, 'w', 'r');
  fillCircle(g, 6.6, 5.6, 1.0, 'w', 'r');
  // 軸（ベージュ・下の角を丸める）
  for (let y = 7; y < 14; y++) {
    for (let x = 5; x <= 9; x++) {
      const edge = (x === 5 || x === 9) && y >= 12; // 下の左右角を落とす
      if (!edge) g[y][x] = 'c';
    }
  }
  return g;
}

// --- 公開テンプレート一覧 --------------------------------------

export const TEMPLATES = [
  { id: 'heart', name: 'ハート', emoji: '❤️', gen: genHeart },
  { id: 'star', name: 'ほし', emoji: '⭐', gen: genStar },
  { id: 'rainbow', name: 'にじ', emoji: '🌈', gen: genRainbow },
  { id: 'flower', name: 'おはな', emoji: '🌸', gen: genFlower },
  { id: 'smiley', name: 'スマイル', emoji: '😊', gen: genSmiley },
  { id: 'mushroom', name: 'きのこ', emoji: '🍄', gen: genMushroom },
];

/**
 * テンプレート定義を applyLoaded がそのまま読める保存図案形へ変換する。
 * @param {{id:string,name:string,gen:Function}} tpl
 * @returns {{width:number,height:number,colors:Array,grid:number[],title:string,settings:Object,sourceImageName:null}}
 */
export function buildTemplate(tpl) {
  const g = tpl.gen();
  const H = g.length;
  const W = g[0].length;
  const gridArr = new Array(W * H).fill(BACKGROUND_COLOR_ID);
  const idByChar = new Map();
  const usedChars = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ch = g[y][x];
      if (!ch || ch === '.' || ch === ' ') continue; // 背景
      let id = idByChar.get(ch);
      if (id == null) {
        id = usedChars.length + 1;
        idByChar.set(ch, id);
        usedChars.push(ch);
      }
      gridArr[y * W + x] = id;
    }
  }
  const colors = usedChars.map((ch, i) => {
    const def = PAL[ch] || { hex: '#000000', name: 'その他' };
    return {
      id: i + 1,
      hex: def.hex,
      rgb: hexToRgb(def.hex),
      name: def.name,
      count: 0,
      ratio: 0,
    };
  });
  return {
    width: W,
    height: H,
    colors,
    grid: gridArr,
    title: tpl.name,
    sourceImageName: null,
    // 作例は「モチーフだけ（透明背景）／台座なし／全体を入れる」を既定にする
    settings: {
      width: W,
      height: H,
      backgroundAsWhite: false,
      removeBackground: false,
      plateShape: 'none',
      fitMode: 'contain',
    },
  };
}
