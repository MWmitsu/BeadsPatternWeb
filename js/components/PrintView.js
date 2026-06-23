// ============================================================
// 印刷用ビュー(A4想定の全画面オーバーレイ)
// ------------------------------------------------------------
// 図案を「印刷しやすい紙面」として組む専用コンポーネント。
//   - 完成イメージ(色のみ)
//   - 数字付き設計図(showNumbers:true, showGrid:true)
//   - 色番号一覧表(番号/見本/HEX/色名/個数/割合)
//   - メタ情報(横/縦/総ビーズ数, 作成日時)
// canvas は React の管理外で生成するため ref コンテナへ手動挿入する。
// 実際の @media print の見た目(余白・改ページ・.print-controls 非表示)は
// styles.css 側で定義する前提。ここではクラス付与のみ行う。
// ============================================================

import { html, useRef, useEffect } from '../lib/html.js';
import { renderPatternToCanvas } from '../lib/renderPattern.js';
import { textColorFor } from '../utils/colorDistance.js';

/**
 * @param {Object} props
 * @param {{colors: import('../types.js').BeadColor[], cells: import('../types.js').BeadCell[], width: number, height: number}|null} props.pattern
 * @param {import('../types.js').BeadColor[]} props.colors
 * @param {string} props.title
 * @param {number} props.totalBeads
 * @param {string} props.createdAt   ISO文字列 or 表示用文字列
 * @param {() => void} props.onClose
 */
export function PrintView(props) {
  const { pattern, colors, title, totalBeads, createdAt, onClose } = props;

  // canvas を差し込むコンテナ(完成イメージ / 数字付き設計図)
  const previewRef = useRef(null);
  const blueprintRef = useRef(null);

  // pattern が変わるたびに canvas を作り直してコンテナへ挿入する。
  useEffect(() => {
    const previewBox = previewRef.current;
    const blueprintBox = blueprintRef.current;
    if (!previewBox || !blueprintBox) return;

    // 既存の canvas を一旦クリア(再描画時の重複防止)
    previewBox.replaceChildren();
    blueprintBox.replaceChildren();

    if (!pattern) return;

    // 完成イメージ:色のみ(グリッド・数字なし)
    const previewCanvas = renderPatternToCanvas(pattern, {
      cellSize: 12,
      showGrid: false,
      showNumbers: false,
      backgroundColor: '#FFFFFF',
    });
    previewCanvas.className = 'print-canvas';
    previewBox.appendChild(previewCanvas);

    // 数字付き設計図:グリッド + 数字(制作時に数えやすいよう大きめのマス)
    const blueprintCanvas = renderPatternToCanvas(pattern, {
      cellSize: 22,
      showGrid: true,
      showNumbers: true,
      backgroundColor: '#FFFFFF',
    });
    blueprintCanvas.className = 'print-canvas';
    blueprintBox.appendChild(blueprintCanvas);
  }, [pattern, colors]);

  // 作成日時を読みやすい日本語表記へ(失敗時は元文字列のまま)
  const createdAtLabel = formatDate(createdAt);

  // 色一覧は色番号順(id昇順)で表示
  const sortedColors = (colors || []).slice().sort((a, b) => a.id - b.id);

  const width = pattern ? pattern.width : 0;
  const height = pattern ? pattern.height : 0;

  return html`
    <div class="print-overlay" role="dialog" aria-modal="true" aria-label="印刷プレビュー">
      <div class="print-controls">
        <button type="button" class="btn btn--primary" onClick=${() => window.print()}>
          印刷する
        </button>
        <button type="button" class="btn btn--ghost" onClick=${onClose}>
          閉じる
        </button>
      </div>

      <div class="print-sheet">
        <h1 class="print-title">${title || '無題の図案'}</h1>

        <div class="print-meta">
          <span class="badge">横 ${width} マス</span>
          <span class="badge">縦 ${height} マス</span>
          <span class="badge">総ビーズ数 ${formatNumber(totalBeads)} 個</span>
          <span class="print-meta__date muted">作成日時: ${createdAtLabel}</span>
        </div>

        ${!pattern
          ? html`<p class="warn warn--error">図案がありません。先に画像を変換してください。</p>`
          : html`
              <section class="print-section">
                <h2 class="print-section__title">完成イメージ</h2>
                <div class="print-figure" ref=${previewRef}></div>
              </section>

              <section class="print-section">
                <h2 class="print-section__title">数字付き設計図</h2>
                <div class="print-figure" ref=${blueprintRef}></div>
              </section>

              <section class="print-section">
                <h2 class="print-section__title">色番号一覧</h2>
                <table class="print-colorlist">
                  <thead>
                    <tr>
                      <th>番号</th>
                      <th>見本</th>
                      <th>HEX</th>
                      <th>色名</th>
                      <th>個数</th>
                      <th>割合</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${sortedColors.map(
                      (c) => html`
                        <tr key=${c.id}>
                          <td class="print-colorlist__num">${c.id}</td>
                          <td>
                            <span
                              class="print-colorlist__swatch"
                              style=${{
                                backgroundColor: c.hex,
                                color: textColorFor(c.hex),
                              }}
                            >
                              ${c.id}
                            </span>
                          </td>
                          <td class="print-colorlist__hex">${c.hex}</td>
                          <td>${c.name || ''}</td>
                          <td class="print-colorlist__count">${formatNumber(c.count)}</td>
                          <td class="print-colorlist__ratio">${formatRatio(c.ratio)}%</td>
                        </tr>
                      `
                    )}
                  </tbody>
                </table>
              </section>
            `}
      </div>
    </div>
  `;
}

// ---- 表示整形ヘルパー(モジュール内専用) ----------------------

/** 数値に桁区切りを付ける(非数値は素直に文字列化) */
function formatNumber(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return String(n ?? '');
  return n.toLocaleString('ja-JP');
}

/** 割合を小数1桁で表示(非数値は 0) */
function formatRatio(r) {
  if (typeof r !== 'number' || !Number.isFinite(r)) return '0.0';
  return r.toFixed(1);
}

/** ISO文字列等を「YYYY/MM/DD HH:MM」へ。失敗時は元の文字列を返す。 */
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
