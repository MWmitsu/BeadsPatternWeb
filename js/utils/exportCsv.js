// ============================================================
// CSV 書き出しユーティリティ
// ------------------------------------------------------------
// パレットの色一覧を CSV 文字列化し、Excel でも文字化けしないよう
// UTF-8 BOM 付きでダウンロードする。
// ============================================================

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
export function buildColorsCsv(colors) {
  const header = ['番号', 'HEX', '色名', '使用個数', '割合'];
  const lines = [header.map(escapeCsvCell).join(',')];

  for (const c of colors) {
    const row = [
      c.id,
      c.hex,
      c.name,
      c.count,
      // 割合は小数1桁で表記
      Number(c.ratio ?? 0).toFixed(1),
    ];
    lines.push(row.map(escapeCsvCell).join(','));
  }

  return lines.join('\r\n');
}

/**
 * 色一覧 CSV を UTF-8 BOM 付きでダウンロードする。
 * @param {Array} colors
 * @param {string} [filename='colors.csv']
 */
export function exportColorsCsv(colors, filename = 'colors.csv') {
  const csv = buildColorsCsv(colors);
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
