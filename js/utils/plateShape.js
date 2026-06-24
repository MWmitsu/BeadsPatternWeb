// ============================================================
// ペグボードのプレート形状マスク
// ------------------------------------------------------------
// グリッドは矩形のまま、形状内のセルだけを「ビーズを置ける」とするマスクを作る。
// 形状外のセルは非ビーズ(背景)として扱う。正方形は全面有効。
// ============================================================

/** プレート形状の選択肢(9種) */
export const PLATE_SHAPES = [
  { id: 'square', name: '正方形' },
  { id: 'circle', name: '円' },
  { id: 'hexagon', name: '六角形' },
  { id: 'octagon', name: '八角形' },
  { id: 'diamond', name: 'ひし形' },
  { id: 'triangle', name: '三角形' },
  { id: 'heart', name: 'ハート' },
  { id: 'star', name: '星' },
  { id: 'flower', name: '花' },
];

/** 点(px,py)が多角形 verts の内側か(レイキャスティング) */
function pointInPolygon(px, py, verts) {
  let inside = false;
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const xi = verts[i][0];
    const yi = verts[i][1];
    const xj = verts[j][0];
    const yj = verts[j][1];
    const intersect = (yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function regularPolygon(n, rotDeg, r) {
  const verts = [];
  const rot = (rotDeg * Math.PI) / 180;
  for (let i = 0; i < n; i++) {
    const a = rot + (i * 2 * Math.PI) / n;
    verts.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return verts;
}

function starPolygon(points, outer, inner, rotDeg) {
  const verts = [];
  const rot = (rotDeg * Math.PI) / 180;
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = rot + (i * Math.PI) / points;
    verts.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return verts;
}

const HEX = regularPolygon(6, 90, 1.0); // pointy-top
const OCT = regularPolygon(8, 22.5, 1.06);
const TRI = [[0, -1], [1, 1], [-1, 1]]; // 上が頂点・底辺が下端の三角形(グリッドを満たす)
const STAR = starPolygon(5, 1.0, 0.42, -90);

/** 正規化座標(nx,ny ∈ [-1,1]) が形状内か */
function inShape(shape, nx, ny) {
  switch (shape) {
    case 'circle':
      return nx * nx + ny * ny <= 1.02;
    case 'diamond':
      return Math.abs(nx) + Math.abs(ny) <= 1.0;
    case 'hexagon':
      return pointInPolygon(nx, ny, HEX);
    case 'octagon':
      return pointInPolygon(nx, ny, OCT);
    case 'triangle':
      return pointInPolygon(nx, ny, TRI);
    case 'star':
      return pointInPolygon(nx, ny, STAR);
    case 'heart': {
      const X = nx * 1.15;
      const Y = -ny * 1.15 + 0.35;
      const t = X * X + Y * Y - 1;
      return t * t * t - X * X * Y * Y * Y <= 0;
    }
    case 'flower': {
      const r = Math.hypot(nx, ny);
      const th = Math.atan2(ny, nx);
      return r <= 0.55 + 0.45 * Math.abs(Math.cos(2.5 * th));
    }
    case 'square':
    default:
      return true;
  }
}

/**
 * 形状マスクを作る。1=ビーズを置ける(形状内), 0=形状外(非ビーズ)。
 * @returns {Uint8Array} 長さ width*height(row-major)
 */
export function makePlateMask(shape, width, height) {
  const mask = new Uint8Array(width * height);
  if (!shape || shape === 'square') {
    mask.fill(1);
    return mask;
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = ((x + 0.5) / width) * 2 - 1;
      const ny = ((y + 0.5) / height) * 2 - 1;
      mask[y * width + x] = inShape(shape, nx, ny) ? 1 : 0;
    }
  }
  return mask;
}
