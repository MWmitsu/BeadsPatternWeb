// ============================================================
// BeadListModal: 買い物に使える「ビーズリスト」モーダル
// ------------------------------------------------------------
// 各色の 色見本 / 色名 / 商品番号(ブランド選択時) / 使用数・必要数 を一覧。
// 完成サイズ(cm)も表示。ブランド/サイズは選択中のパレットに基づく。
// ============================================================

import { html } from '../lib/html.js';
import { matchToPalette } from '../utils/beadMatch.js';

export function BeadListModal(props) {
  const {
    colors = [],
    totalBeads = 0,
    bufferPercent = 0,
    beadPaletteColors = null,
    paletteName = '',
    sizeMm = 0,
    width = 0,
    height = 0,
    onClose,
  } = props;

  const sorted = colors.slice().sort((a, b) => a.id - b.id);
  const needOf = (c) => (bufferPercent > 0 ? Math.ceil(c.count * (1 + bufferPercent / 100)) : c.count);
  const totalNeed = sorted.reduce((s, c) => s + needOf(c), 0);
  const cm = (n) => (n * sizeMm) / 10;
  const sizeText = sizeMm > 0
    ? `約 ${cm(width).toFixed(1)} × ${cm(height).toFixed(1)} cm（${sizeMm}mm）`
    : '';

  return html`
    <div class="beadlist" role="dialog" aria-modal="true" aria-label="ビーズ一覧">
      <div class="beadlist__sheet">
        <div class="beadlist__head">
          <strong>ビーズ一覧</strong>
          ${paletteName ? html`<span class="badge">${paletteName}</span>` : null}
          <button class="beadlist__close" type="button" onClick=${onClose} aria-label="閉じる">×</button>
        </div>

        <div class="beadlist__meta muted">
          全 ${colors.length} 色・総ビーズ ${totalBeads.toLocaleString()}個（必要数 ${totalNeed.toLocaleString()}個）${sizeText ? '・' + sizeText : ''}
        </div>

        <div class="beadlist__list">
          ${sorted.length === 0
            ? html`<p class="muted">色がありません。先に画像を変換してください。</p>`
            : sorted.map((c) => {
                const need = needOf(c);
                const bead = beadPaletteColors ? matchToPalette(c.hex, beadPaletteColors) : null;
                const label = bead ? bead.name : c.name || c.hex;
                return html`
                  <div class="beadlist__row" key=${c.id}>
                    <span class="beadlist__dot" style=${`background:${c.hex}`}></span>
                    <div class="beadlist__info">
                      <div class="beadlist__name">${c.id}. ${label}</div>
                      <div class="beadlist__no muted">${bead ? '色番号：' + bead.code : c.hex}</div>
                    </div>
                    <div class="beadlist__count">
                      <span class="beadlist__count-need">${need.toLocaleString()}</span>
                      ${bufferPercent > 0
                        ? html`<span class="beadlist__count-base muted">使用 ${c.count.toLocaleString()}個</span>`
                        : null}
                    </div>
                  </div>
                `;
              })}
        </div>

        <div class="beadlist__foot">
          ${bufferPercent > 0
            ? html`<span class="muted beadlist__foot-note">「必要数」は使用個数に予備${bufferPercent}%を足した目安です。</span>`
            : null}
          <button class="btn btn--primary" type="button" onClick=${onClose}>閉じる</button>
        </div>
      </div>
    </div>
  `;
}
