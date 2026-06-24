// ============================================================
// 印刷用ビュー(A4想定の全画面オーバーレイ)
// ------------------------------------------------------------
//  - 1ページ印刷: 完成イメージ + 数字付き設計図
//  - 分割印刷:    図案を区画(タイル)に分け、各区画を1ページずつ印刷して貼り合わせる。
//                 各区画に列番号・行番号の見出しを付け、概観図で位置を示す。
//  - 色番号一覧表(番号/見本/HEX/色名/個数/割合)は常に表示。
// canvas は React 管理外で生成し、ref コンテナへ手動挿入する。
// 実際の @media print(余白・改ページ・操作ボタン非表示)は styles.css 側。
// ============================================================

import { html, useRef, useEffect, useState } from '../lib/html.js';
import {
  renderPatternToCanvas,
  renderNumberedTileCanvas,
  renderTileOverviewCanvas,
} from '../lib/renderPattern.js';
import { textColorFor } from '../utils/colorDistance.js';
import { matchToPalette } from '../utils/beadMatch.js';
import { PRINT_TILE_OPTIONS } from '../types.js';

/**
 * @param {Object} props
 * @param {{colors:Array,cells:Array,width:number,height:number}|null} props.pattern
 * @param {Array} props.colors
 * @param {string} props.title
 * @param {number} props.totalBeads
 * @param {string} props.createdAt
 * @param {() => void} props.onClose
 */
export function PrintView(props) {
  const {
    pattern,
    colors,
    title,
    totalBeads,
    createdAt,
    onClose,
    bufferPercent = 0,
    beadPaletteColors = null,
  } = props;

  // 大きい図案は既定で分割印刷ON
  const [split, setSplit] = useState(() =>
    pattern ? Math.max(pattern.width, pattern.height) > 48 : false
  );
  const [tileSize, setTileSize] = useState(30);

  const previewRef = useRef(null);
  const blueprintRef = useRef(null);
  const overviewRef = useRef(null);
  const tilesRef = useRef(null);

  // 分割時の区画数
  const cols = pattern ? Math.ceil(pattern.width / tileSize) : 0;
  const rows = pattern ? Math.ceil(pattern.height / tileSize) : 0;
  const tileCount = cols * rows;

  useEffect(() => {
    if (!pattern) return;

    if (!split) {
      // --- 1ページ印刷: 完成イメージ + 数字付き設計図 ---
      if (previewRef.current) {
        previewRef.current.replaceChildren();
        const c = renderPatternToCanvas(pattern, { cellSize: 12, showGrid: false, showNumbers: false });
        c.className = 'print-canvas';
        previewRef.current.appendChild(c);
      }
      if (blueprintRef.current) {
        blueprintRef.current.replaceChildren();
        const c = renderPatternToCanvas(pattern, { cellSize: 22, showGrid: true, showNumbers: true });
        c.className = 'print-canvas';
        blueprintRef.current.appendChild(c);
      }
      return;
    }

    // --- 分割印刷: 概観図 + 区画ごとのページ ---
    if (overviewRef.current) {
      overviewRef.current.replaceChildren();
      const ov = renderTileOverviewCanvas(pattern, tileSize, tileSize);
      ov.className = 'print-canvas print-overview__canvas';
      overviewRef.current.appendChild(ov);
    }
    if (tilesRef.current) {
      tilesRef.current.replaceChildren();
      let n = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          n += 1;
          const region = { col: c * tileSize, row: r * tileSize, cols: tileSize, rows: tileSize };
          const canvas = renderNumberedTileCanvas(pattern, region, { cellSize: 26 });
          canvas.className = 'print-canvas';

          const c0 = c * tileSize + 1;
          const c1 = Math.min((c + 1) * tileSize, pattern.width);
          const r0 = r * tileSize + 1;
          const r1 = Math.min((r + 1) * tileSize, pattern.height);

          const tile = document.createElement('section');
          tile.className = 'print-tile';
          const label = document.createElement('div');
          label.className = 'print-tile__label';
          label.textContent =
            `区画 ${n}／${tileCount}（行${r + 1}・列${c + 1}）　横 ${c0}〜${c1} ／ 縦 ${r0}〜${r1}`;
          tile.appendChild(label);
          tile.appendChild(canvas);
          tilesRef.current.appendChild(tile);
        }
      }
    }
  }, [pattern, split, tileSize]);

  const createdAtLabel = formatDate(createdAt);
  const sortedColors = (colors || []).slice().sort((a, b) => a.id - b.id);
  const width = pattern ? pattern.width : 0;
  const height = pattern ? pattern.height : 0;

  return html`
    <div class="print-overlay" role="dialog" aria-modal="true" aria-label="印刷プレビュー">
      <div class="print-controls">
        <button type="button" class="btn btn--primary" onClick=${() => window.print()}>印刷する</button>
        <label class="print-controls__opt">
          <input type="checkbox" checked=${split} onChange=${(e) => setSplit(e.target.checked)} />
          <span>分割印刷</span>
        </label>
        ${split &&
        html`
          <label class="print-controls__opt">
            <span>1区画</span>
            <select value=${tileSize} onChange=${(e) => setTileSize(Number(e.target.value))}>
              ${PRINT_TILE_OPTIONS.map((n) => html`<option key=${n} value=${n}>${n}×${n}マス</option>`)}
            </select>
          </label>
          <span class="print-controls__count muted">全 ${tileCount} 区画</span>
        `}
        <button type="button" class="btn btn--ghost" onClick=${onClose}>閉じる</button>
      </div>

      <div class="print-sheet">
        <h1 class="print-title">${title || '無題の図案'}</h1>

        <div class="print-meta">
          <span class="badge">横 ${width} マス</span>
          <span class="badge">縦 ${height} マス</span>
          <span class="badge">総ビーズ数 ${formatNumber(totalBeads)} 個</span>
          <span class="print-meta__date muted">作成日時：${createdAtLabel}</span>
        </div>

        ${!pattern
          ? html`<p class="warn warn--error">図案がありません。先に画像を変換してください。</p>`
          : !split
          ? html`
              <section class="print-section">
                <h2 class="print-section__title">完成イメージ</h2>
                <div class="print-figure" ref=${previewRef}></div>
              </section>
              <section class="print-section">
                <h2 class="print-section__title">数字付き設計図</h2>
                <div class="print-figure" ref=${blueprintRef}></div>
              </section>
            `
          : html`
              <section class="print-section">
                <h2 class="print-section__title">全体の概観（赤線が区画の区切り）</h2>
                <div class="print-figure print-overview" ref=${overviewRef}></div>
                <p class="muted">
                  全 ${tileCount} 区画（横 ${cols} × 縦 ${rows}）に分かれています。区画（分けて印刷する1枚ぶん）を
                  1ページずつ印刷し、列・行番号を合わせて貼り合わせてください。
                </p>
              </section>
              <div class="print-tiles" ref=${tilesRef}></div>
            `}

        ${pattern &&
        html`
          <section class="print-section">
            <h2 class="print-section__title">色一覧</h2>
            <table class="print-colorlist">
              <thead>
                <tr>
                  <th>色番号</th><th>見本</th><th>色コード</th><th>色名</th><th>使用個数</th><th>割合（％）</th>
                  <th>必要数（予備込み）</th>
                  ${beadPaletteColors ? html`<th>近い市販色</th>` : null}
                </tr>
              </thead>
              <tbody>
                ${sortedColors.map((c) => {
                  const need = bufferPercent > 0 ? Math.ceil(c.count * (1 + bufferPercent / 100)) : c.count;
                  const bead = beadPaletteColors ? matchToPalette(c.hex, beadPaletteColors) : null;
                  return html`
                    <tr key=${c.id}>
                      <td class="print-colorlist__num">${c.id}</td>
                      <td>
                        <span
                          class="print-colorlist__swatch"
                          style=${{ backgroundColor: c.hex, color: textColorFor(c.hex) }}
                        >${c.id}</span>
                      </td>
                      <td class="print-colorlist__hex">${c.hex}</td>
                      <td>${c.name || ''}</td>
                      <td class="print-colorlist__count">${formatNumber(c.count)}</td>
                      <td class="print-colorlist__ratio">${formatRatio(c.ratio)}%</td>
                      <td class="print-colorlist__count">${formatNumber(need)}</td>
                      ${beadPaletteColors
                        ? html`<td>${bead ? `${bead.code} ${bead.name}` : ''}</td>`
                        : null}
                    </tr>
                  `;
                })}
              </tbody>
            </table>
          </section>
        `}
      </div>
    </div>
  `;
}

// ---- 表示整形ヘルパー ----------------------------------------
function formatNumber(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return String(n ?? '');
  return n.toLocaleString('ja-JP');
}
function formatRatio(r) {
  if (typeof r !== 'number' || !Number.isFinite(r)) return '0.0';
  return r.toFixed(1);
}
function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}
