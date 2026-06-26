// ============================================================
// BeadListModal: 買い物＆在庫に使える「ビーズリスト」モーダル
// ------------------------------------------------------------
// 各色の 色見本 / 色名 / 商品番号(ブランド選択時) / 使用数・必要数 を一覧。
// ビーズ色(ブランド)選択時は商品色ごとにまとめ、手持ち数(在庫)を記録して
// 「必要数 − 手持ち = 不足(買い足し)」を表示する。完成サイズ(cm)も表示。
// ============================================================

import { html } from '../lib/html.js';
import { matchToPalette } from '../utils/beadMatch.js';

export function BeadListModal(props) {
  const {
    colors = [],
    totalBeads = 0,
    bufferPercent = 0,
    beadPaletteColors = null,
    beadPaletteId = 'none',
    paletteName = '',
    sizeMm = 0,
    width = 0,
    height = 0,
    inventory = {},
    onSetInventory,
    onClose,
  } = props;

  const sorted = colors.slice().sort((a, b) => a.id - b.id);
  const needOf = (c) => (bufferPercent > 0 ? Math.ceil(c.count * (1 + bufferPercent / 100)) : c.count);
  const totalNeed = sorted.reduce((s, c) => s + needOf(c), 0);
  const cm = (n) => (n * sizeMm) / 10;
  const sizeText = sizeMm > 0
    ? `約 ${cm(width).toFixed(1)} × ${cm(height).toFixed(1)} cm（${sizeMm}mm）`
    : '';

  // ビーズ色(ブランド)選択時は商品色ごとにまとめ、在庫管理を有効にする。
  const hasPalette = !!(beadPaletteColors && beadPaletteColors.length);
  const canInventory = hasPalette && !!onSetInventory;
  let groups = null;
  let totalShort = 0;
  let colorsShort = 0;
  if (hasPalette) {
    const map = new Map();
    for (const c of sorted) {
      const bead = matchToPalette(c.hex, beadPaletteColors);
      const key = bead.code;
      const g = map.get(key) || { code: bead.code, name: bead.name, hex: bead.hex, need: 0, count: 0 };
      g.need += needOf(c);
      g.count += c.count;
      map.set(key, g);
    }
    groups = [...map.values()].sort((a, b) => b.need - a.need);
    for (const g of groups) {
      const owned = Number(inventory[`${beadPaletteId}:${g.code}`]) || 0;
      const short = Math.max(0, g.need - owned);
      g.owned = owned;
      g.short = short;
      if (short > 0) { totalShort += short; colorsShort++; }
    }
  }

  const onOwnedInput = (code, raw) => {
    if (!onSetInventory) return;
    onSetInventory(`${beadPaletteId}:${code}`, raw);
  };

  return html`
    <div class="beadlist" role="dialog" aria-modal="true" aria-label="ビーズ一覧">
      <div class="beadlist__sheet">
        <div class="beadlist__head">
          <strong>ビーズ一覧${canInventory ? '・在庫' : ''}</strong>
          ${paletteName ? html`<span class="badge">${paletteName}</span>` : null}
          <button class="beadlist__close" type="button" onClick=${onClose} aria-label="閉じる">×</button>
        </div>

        <div class="beadlist__meta muted">
          全 ${colors.length} 色・総ビーズ ${totalBeads.toLocaleString()}個（必要数 ${totalNeed.toLocaleString()}個）${sizeText ? '・' + sizeText : ''}
          ${canInventory
            ? (totalShort > 0
                ? html`<br /><b class="beadlist__short-sum">買い足し ${totalShort.toLocaleString()}個（${colorsShort}色）</b>`
                : html`<br /><b class="beadlist__enough">手持ちで足りています 🎉</b>`)
            : null}
        </div>

        ${!hasPalette
          ? html`<p class="beadlist__hint muted">「制作・共有ツール」でビーズ色（ブランド）を選ぶと、商品番号と<b>在庫管理（手持ち数と買い足し）</b>が使えます。</p>`
          : null}

        <div class="beadlist__list">
          ${hasPalette
            ? (groups.length === 0
                ? html`<p class="muted">色がありません。先に画像を変換してください。</p>`
                : groups.map((g) => html`
                    <div class=${'beadlist__row' + (g.short > 0 ? ' beadlist__row--short' : '')} key=${g.code}>
                      <span class="beadlist__dot" style=${`background:${g.hex}`}></span>
                      <div class="beadlist__info">
                        <div class="beadlist__name">${g.name}</div>
                        <div class="beadlist__no muted">色番号：${g.code}・必要 ${g.need.toLocaleString()}個</div>
                      </div>
                      <label class="beadlist__inv">
                        <span class="beadlist__inv-label muted">手持ち</span>
                        <input
                          class="beadlist__inv-input field"
                          type="number"
                          inputmode="numeric"
                          min="0"
                          placeholder="0"
                          value=${g.owned > 0 ? String(g.owned) : ''}
                          onInput=${(e) => onOwnedInput(g.code, e.target.value)}
                        />
                      </label>
                      <div class="beadlist__count">
                        ${g.short > 0
                          ? html`<span class="beadlist__short">買い足し ${g.short.toLocaleString()}個</span>`
                          : html`<span class="beadlist__ok">足りてる ✓</span>`}
                      </div>
                    </div>
                  `))
            : (sorted.length === 0
                ? html`<p class="muted">色がありません。先に画像を変換してください。</p>`
                : sorted.map((c) => {
                    const need = needOf(c);
                    return html`
                      <div class="beadlist__row" key=${c.id}>
                        <span class="beadlist__dot" style=${`background:${c.hex}`}></span>
                        <div class="beadlist__info">
                          <div class="beadlist__name">${c.id}. ${c.name || c.hex}</div>
                          <div class="beadlist__no muted">${c.hex}</div>
                        </div>
                        <div class="beadlist__count">
                          <span class="beadlist__count-need">${need.toLocaleString()}</span>
                          ${bufferPercent > 0
                            ? html`<span class="beadlist__count-base muted">使用 ${c.count.toLocaleString()}個</span>`
                            : null}
                        </div>
                      </div>
                    `;
                  }))}
        </div>

        <div class="beadlist__foot">
          ${bufferPercent > 0
            ? html`<span class="muted beadlist__foot-note">「必要数」は使用個数に予備${bufferPercent}%を足した目安です。</span>`
            : null}
          ${canInventory
            ? html`<span class="muted beadlist__foot-note">手持ち数は自動で保存され、ほかの図案にも引き継がれます。</span>`
            : null}
          <button class="btn btn--primary" type="button" onClick=${onClose}>閉じる</button>
        </div>
      </div>
    </div>
  `;
}
