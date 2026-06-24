// ============================================================
// localStorage による図案プロジェクトの保存・読み込み
// ------------------------------------------------------------
// cells(BeadCell[])は容量を食うため grid(colorId の1次元配列)に圧縮して保存し、
// 読み込み時に colors の id→hex 対応から cells を復元する。
// ============================================================

import { STORAGE_KEY, BACKGROUND_COLOR_ID, DRAFT_KEY } from '../types.js';

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
  const hexMap = new Map((colors || []).map((c) => [c.id, c.hex]));
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
    return { ok: false, error: '保存に失敗しました(容量超過の可能性)' };
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
