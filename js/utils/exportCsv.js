// ============================================================
// CSV 書き出しユーティリティ
// ------------------------------------------------------------
// パレットの色一覧を CSV 文字列化し、Excel でも文字化けしないよう
// UTF-8 BOM 付きでダウンロードする。
// ============================================================

import { matchToPalette } from './beadMatch.js';

/**
 * CSV の1セルを簡易エスケープする。
 * ダブルクオートで囲み、内部の " は "" に置換する。
 * @param {string|number} value
 * @returns {string}
 */
function escapeCsvCell(value) {
  const s = String(value ?? '');
  return `"${s.replace(/"/g, '""')}"`;
}

/**
 * 色一覧から CSV 文字列を生成する。
 * 先頭行: 番号,HEX,色名,使用個数,割合
 * @param {Array<{id:number,hex:string,name:string,count:number,ratio:number}>} colors
 * @returns {string}
 */
export function buildColorsCsv(colors, opts = {}) {
  const bufferPercent = Number(opts.bufferPercent) || 0;
  const beadPaletteColors =
    Array.isArray(opts.beadPaletteColors) && opts.beadPaletteColors.length > 0
      ? opts.beadPaletteColors
      : null;

  const header = ['番号', 'HEX', '色名', '使用個数', '割合', '必要数'];
  if (beadPaletteColors) header.push('近い市販色番号', '近い市販色名');
  const lines = [header.map(escapeCsvCell).join(',')];

  for (const c of colors) {
    const need = bufferPercent > 0 ? Math.ceil(c.count * (1 + bufferPercent / 100)) : c.count;
    const row = [
      c.id,
      c.hex,
      c.name,
      c.count,
      Number(c.ratio ?? 0).toFixed(1), // 割合は小数1桁
      need,
    ];
    if (beadPaletteColors) {
      const bead = matchToPalette(c.hex, beadPaletteColors);
      row.push(bead ? bead.code : '', bead ? bead.name : '');
    }
    lines.push(row.map(escapeCsvCell).join(','));
  }

  return lines.join('\r\n');
}

/**
 * 色一覧 CSV を UTF-8 BOM 付きでダウンロードする。
 * @param {Array} colors
 * @param {string} [filename='colors.csv']
 */
export function exportColorsCsv(colors, filename = 'colors.csv', opts = {}) {
  const csv = buildColorsCsv(colors, opts);
  // 先頭に BOM(﻿)を付与して Excel での文字化けを防ぐ
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
