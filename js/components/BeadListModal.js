// ============================================================
// BeadListModal: 買い物＆在庫に使える「ビーズリスト」モーダル
// ------------------------------------------------------------
// 各色の 色見本 / 色名 / 商品番号(ブランド選択時) / 使用数・必要数 を一覧。
// ビーズ色(ブランド)選択時は商品色ごとにまとめ、在庫を管理する:
//   手持ち(買った数) − 消費(完成作品で使った数) = 残り。
//   「必要 − 残り = 不足(買い足し)」を表示。手持ちは ＋(買い足し)/−(使った) で増減。
//   「完成にして在庫から引く」で、この作品の使用分を在庫の消費として記録(取り消し可)。
// ============================================================

import { html } from '../lib/html.js';
import { matchToPalette, neededCount } from '../utils/beadMatch.js';

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
    reflected = false,
    canReflect = false,
    projectTitle = '',
    onToggleReflect,
    onSetInventory,
    onClose,
  } = props;

  const sorted = colors.slice().sort((a, b) => a.id - b.id);
  const needOf = (c) => neededCount(c.count, bufferPercent);
  const totalNeed = sorted.reduce((s, c) => s + needOf(c), 0);
  const cm = (n) => (n * sizeMm) / 10;
  const sizeText = sizeMm > 0
    ? `約 ${cm(width).toFixed(1)} × ${cm(height).toFixed(1)} cm（${sizeMm}mm）`
    : '';

  // ビーズ色(ブランド)選択時は商品色ごとにまとめ、在庫管理を有効にする。
  const hasPalette = !!(beadPaletteColors && beadPaletteColors.length);
  const canInventory = hasPalette && !!onSetInventory;
  const showReflect = hasPalette && canReflect && !!onToggleReflect;
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
      const owned = Number(inventory[`${beadPaletteId}:${g.code}`]) || 0; // 手持ち(残り在庫)
      const short = Math.max(0, g.need - owned);
      g.owned = owned;
      g.short = short;
      if (short > 0) { totalShort += short; colorsShort++; }
    }
  }

  const setOwned = (code, value) => {
    if (!onSetInventory) return;
    onSetInventory(`${beadPaletteId}:${code}`, value);
  };
  const onOwnedInput = (code, raw) => setOwned(code, raw);
  const bump = (g, delta) => setOwned(g.code, String(Math.max(0, g.owned + delta)));

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

        ${showReflect
          ? html`
            <div class=${'beadlist__reflect' + (reflected ? ' beadlist__reflect--on' : '')}>
              ${reflected
                ? html`
                    <span class="beadlist__reflect-on">✅ この作品は完成・在庫に反映済み</span>
                    <button class="btn btn--ghost btn--sm" type="button" onClick=${onToggleReflect}>反映を取り消す</button>`
                : html`
                    <button class="btn btn--primary btn--sm" type="button" onClick=${onToggleReflect}>✅ 完成にして在庫から引く</button>
                    <span class="muted beadlist__reflect-hint">この作品で使った分を在庫から差し引きます（取り消しOK）。</span>`}
            </div>`
          : null}

        ${!hasPalette
          ? html`<p class="beadlist__hint muted">「制作・共有ツール」でビーズ色（ブランド）を選ぶと、商品番号と<b>在庫管理（手持ち・買い足し・完成で在庫を引く）</b>が使えます。</p>`
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
                        <div class="beadlist__no muted">
                          色番号：${g.code}・必要 ${g.need.toLocaleString()}個
                        </div>
                      </div>
                      <div class="beadlist__inv">
                        <span class="beadlist__inv-label muted">手持ち</span>
                        <div class="beadlist__stepper">
                          <button type="button" class="beadlist__step" onClick=${() => bump(g, -1)} aria-label="使った（1減らす）" title="使った（−1）">−</button>
                          <input
                            class="beadlist__inv-input field"
                            type="number"
                            inputmode="numeric"
                            min="0"
                            placeholder="0"
                            value=${g.owned > 0 ? String(g.owned) : ''}
                            onInput=${(e) => onOwnedInput(g.code, e.target.value)}
                          />
                          <button type="button" class="beadlist__step" onClick=${() => bump(g, 1)} aria-label="買い足し（1増やす）" title="買い足し（＋1）">＋</button>
                        </div>
                      </div>
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
            ? html`<span class="muted beadlist__foot-note">手持ちは ＋（買い足し）／−（使った）で増減でき、自動保存・他の図案にも引き継がれます。「完成にして在庫から引く」を押すと、この手持ちから使った分が実際に減ります（取り消しで戻ります）。</span>`
            : null}
          <button class="btn btn--primary" type="button" onClick=${onClose}>閉じる</button>
        </div>
      </div>
    </div>
  `;
}
