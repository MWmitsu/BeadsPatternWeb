// ============================================================
// localStorage による図案プロジェクトの保存・読み込み
// ------------------------------------------------------------
// cells(BeadCell[])は容量を食うため grid(colorId の1次元配列)に圧縮して保存し、
// 読み込み時に colors の id→hex 対応から cells を復元する。
// ============================================================

import { STORAGE_KEY, BACKGROUND_COLOR_ID, DRAFT_KEY, INVENTORY_KEY } from '../types.js';

/**
 * ブラウザ向けのユニークID(時刻 + 乱数)を生成する。
 * @returns {string}
 */
export function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * BeadCell[] を colorId の1次元配列(row-major, 長さ width*height)に圧縮する。
 * 欠けているマスは BACKGROUND_COLOR_ID(0)で埋める。
 * @param {Array<{x:number,y:number,colorId:number}>} cells
 * @param {number} width
 * @param {number} height
 * @returns {number[]}
 */
export function cellsToGrid(cells, width, height) {
  const grid = new Array(width * height).fill(BACKGROUND_COLOR_ID);
  for (const cell of cells) {
    if (cell.x < 0 || cell.x >= width || cell.y < 0 || cell.y >= height) continue;
    grid[cell.y * width + cell.x] = cell.colorId;
  }
  return grid;
}

/**
 * grid(colorId の1次元配列)から BeadCell[] を復元する。
 * colors から id→hex 対応を作り、背景セルの hex は ''(空文字)にする。
 * @param {number[]} grid
 * @param {number} width
 * @param {number} height
 * @param {Array<{id:number,hex:string}>} colors
 * @returns {Array<{x:number,y:number,colorId:number,hex:string}>}
 */
export function gridToCells(grid, width, height, colors) {
  // 破損データ(null要素など)でも例外を投げないよう、妥当な色だけを採用する
  const hexMap = new Map(
    (colors || []).filter((c) => c && Number.isInteger(c.id)).map((c) => [c.id, c.hex])
  );
  const cells = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const colorId = grid[y * width + x] ?? BACKGROUND_COLOR_ID;
      const hex = colorId === BACKGROUND_COLOR_ID ? '' : (hexMap.get(colorId) || '');
      cells.push({ x, y, colorId, hex });
    }
  }
  return cells;
}

/**
 * localStorage から生のプロジェクト配列を読み込む(失敗時 [])。
 * @returns {Array}
 */
function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * プロジェクトを保存する。既存一覧から id 一致を探し upsert する。
 * @param {Object} project BeadPattern
 * @returns {{ok:boolean, error?:string}}
 */
export function saveProject(project) {
  try {
    const all = readAll();
    const idx = all.findIndex((p) => p && p.id === project.id);
    if (idx >= 0) {
      all[idx] = project;
    } else {
      all.push(project);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return { ok: true };
  } catch {
    // QuotaExceededError 等
    return { ok: false, error: '保存できませんでした（このブラウザの保存できる量がいっぱいかもしれません）。' };
  }
}

/**
 * 全プロジェクトを updatedAt 降順で読み込む(パース失敗時 [])。
 * @returns {Array}
 */
export function loadProjects() {
  const all = readAll();
  return all.slice().sort((a, b) => {
    const ta = a && a.updatedAt ? String(a.updatedAt) : '';
    const tb = b && b.updatedAt ? String(b.updatedAt) : '';
    // 新しい順(降順)
    if (ta < tb) return 1;
    if (ta > tb) return -1;
    return 0;
  });
}

/**
 * id 指定で1件読み込む。見つからなければ null。
 * @param {string} id
 * @returns {Object|null}
 */
export function loadProject(id) {
  const all = readAll();
  return all.find((p) => p && p.id === id) || null;
}

/**
 * プロジェクト一覧をまるごと置き換えて保存する(クラウド同期の取り込み用)。
 * @param {Array} projects
 * @returns {{ok:boolean, error?:string}}
 */
export function saveAllProjects(projects) {
  try {
    const list = Array.isArray(projects) ? projects.filter((p) => p && typeof p === 'object' && p.id) : [];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return { ok: true };
  } catch {
    return { ok: false, error: '保存できませんでした（保存できる量を超えている可能性があります）。' };
  }
}

/**
 * id 指定でプロジェクトを削除する。
 * @param {string} id
 */
export function deleteProject(id) {
  try {
    const all = readAll();
    const next = all.filter((p) => !(p && p.id === id));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // 削除失敗は致命的でないため握りつぶす
  }
}

// ---- 自動保存(編集中ドラフト) ----------------------------------

/** 編集中の図案をドラフトとして自動保存する(容量超過等は無視)。 */
export function saveDraft(project) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(project));
    return true;
  } catch {
    return false;
  }
}

/** ドラフトを読み込む(無ければ null)。 */
export function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** ドラフトを消す。 */
export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

// ---- ビーズ在庫(手持ち数) --------------------------------------
// 市販ビーズ色ごとの手持ち数を { "<paletteId>:<colorCode>": number } で保持する。

/** 在庫マップを読み込む(失敗時 {})。 */
export function loadInventory() {
  try {
    const raw = localStorage.getItem(INVENTORY_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
    // 数値だけを採用(破損データ防御)
    const out = {};
    for (const k of Object.keys(obj)) {
      const n = Number(obj[k]);
      if (Number.isFinite(n) && n >= 0) out[k] = Math.floor(n);
    }
    return out;
  } catch {
    return {};
  }
}

/** 在庫マップを保存する。 */
export function saveInventory(inv) {
  try {
    localStorage.setItem(INVENTORY_KEY, JSON.stringify(inv || {}));
    return true;
  } catch {
    return false;
  }
}

// ---- 全データのバックアップ／復元 ------------------------------
// 図案(プロジェクト全件)＋在庫を1つのオブジェクトにまとめる。端末間移動・保管用。

/** バックアップ用に全データをまとめて返す。 */
export function exportAllData() {
  return {
    kind: 'beads-pattern-app-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    projects: loadProjects(),
    inventory: loadInventory(),
  };
}

/**
 * バックアップから全データを復元する(プロジェクトと在庫を上書き)。
 * @returns {{ok:boolean, projects:number, error?:string}}
 */
export function importAllData(obj) {
  try {
    if (!obj || obj.kind !== 'beads-pattern-app-backup') {
      return { ok: false, projects: 0, error: 'このアプリのバックアップファイルではありません。' };
    }
    const projects = Array.isArray(obj.projects) ? obj.projects.filter((p) => p && typeof p === 'object' && p.id) : [];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    if (obj.inventory && typeof obj.inventory === 'object' && !Array.isArray(obj.inventory)) {
      saveInventory(obj.inventory);
    }
    return { ok: true, projects: projects.length };
  } catch {
    return { ok: false, projects: 0, error: '復元に失敗しました（保存できる量を超えている可能性があります）。' };
  }
}
