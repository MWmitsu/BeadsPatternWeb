// ============================================================
// ColorPalette: 検出された色パレットの一覧 / 編集 UI
// ------------------------------------------------------------
// 各色を行として表示し、HEX・色名の編集、色別ハイライトのトグル、
// 「この色で塗る」選択、他色への統合を行う。
//
// TODO(将来拡張): スポイト / 塗りつぶし / 範囲選択 / Undo-Redo / 作業チェック。
// ============================================================

import { html, useState, useEffect } from '../lib/html.js';
import { COLOR_NAMES } from '../types.js';
import { isValidHex, normalizeHex, textColorFor } from '../utils/colorDistance.js';
import { matchToPalette } from '../utils/beadMatch.js';

/**
 * @param {Object} props
 * @param {import('../types.js').BeadColor[]} props.colors パレット色一覧
 * @param {number} props.totalBeads 透明背景を除いた総ビーズ数
 * @param {number|null} props.highlightColorId ハイライト中の色ID
 * @param {(colorId: number|null) => void} props.onHighlight 行クリックでハイライトをトグル
 * @param {number|null} props.editColorId キャンバス塗り用に選択中の色ID
 * @param {(colorId: number|null) => void} props.onSelectEditColor 塗り色の選択/解除
 * @param {(id: number, patch: {hex?: string, name?: string}) => void} props.onEditColor 色編集
 * @param {(fromId: number, toId: number) => void} props.onMergeColors 色統合
 */
export function ColorPalette(props) {
  const {
    colors = [],
    totalBeads = 0,
    beadPaletteColors = null,
    bufferPercent = 0,
    highlightColorId = null,
    onHighlight,
    editColorId = null,
    onSelectEditColor,
    onEditColor,
    onMergeColors,
  } = props;

  if (!colors || colors.length === 0) {
    return html`
      <div class="panel palette">
        <div class="panel__title">色一覧</div>
        <div class="panel__body">
          <p class="muted">まだ色がありません。画像を変換すると、ここに色一覧が表示されます。</p>
        </div>
      </div>
    `;
  }

  return html`
    <div class="panel palette">
      <div class="panel__title">
        色一覧
        <span class="badge">${colors.length}色</span>
        <span class="muted palette__total">総ビーズ ${totalBeads}個</span>
      </div>
      <div class="panel__body">
        <div class="palette__hint">
          色番号や色見本をクリックすると、その色だけを強調表示します（並べる順番の確認に便利です）。
          各行では、色の変更（カラーピッカーまたは色コード）、「この色で塗る」でのマスの塗り替え、「別の色とまとめる」もできます。
        </div>
        <div class="palette__list" role="list">
          ${colors.map(
            (color) => html`
              <${PaletteRow}
                key=${color.id}
                color=${color}
                isHighlighted=${highlightColorId === color.id}
                isEditing=${editColorId === color.id}
                colors=${colors}
                beadPaletteColors=${beadPaletteColors}
                bufferPercent=${bufferPercent}
                onHighlight=${onHighlight}
                onSelectEditColor=${onSelectEditColor}
                onEditColor=${onEditColor}
                onMergeColors=${onMergeColors}
              />
            `
          )}
        </div>
      </div>
    </div>
  `;
}

/**
 * パレットの1行(1色)。HEX/色名の編集はローカルstateで保持し、確定時に親へ通知する。
 */
function PaletteRow(props) {
  const {
    color,
    isHighlighted,
    isEditing,
    colors,
    beadPaletteColors = null,
    bufferPercent = 0,
    onHighlight,
    onSelectEditColor,
    onEditColor,
    onMergeColors,
  } = props;

  // 近い市販ビーズ色(目安)と必要数(個数 + 予備%)
  const bead = beadPaletteColors ? matchToPalette(color.hex, beadPaletteColors) : null;
  const need = bufferPercent > 0 ? Math.ceil(color.count * (1 + bufferPercent / 100)) : color.count;

  // 入力途中の値はローカルで保持(無効なHEXでも一時的に保持できるように)
  const [hexInput, setHexInput] = useState(color.hex);
  const [mergeTarget, setMergeTarget] = useState('');

  // 統合などで採番が変わると、同じ行インスタンス(key=id)に別の色が割り当たることがある。
  // その際にHEX入力が前の色の値のまま残らないよう、color.hex の変化へ追従させる。
  useEffect(() => {
    setHexInput(color.hex);
  }, [color.hex]);

  const fg = textColorFor(color.hex);

  // 行・見本クリックでハイライトをトグル
  const toggleHighlight = () => {
    if (onHighlight) onHighlight(isHighlighted ? null : color.id);
  };

  // HEX確定: 有効なら正規化して親へ。無効なら元の値へ戻す。
  const commitHex = () => {
    if (isValidHex(hexInput)) {
      const normalized = normalizeHex(hexInput);
      if (normalized !== color.hex && onEditColor) {
        onEditColor(color.id, { hex: normalized });
      }
      setHexInput(normalized);
    } else {
      setHexInput(color.hex);
    }
  };

  // 色名確定
  const commitName = (value) => {
    const name = value.trim();
    if (name !== color.name && onEditColor) {
      onEditColor(color.id, { name });
    }
  };

  // 「この色で塗る」トグル
  const toggleEdit = () => {
    if (onSelectEditColor) onSelectEditColor(isEditing ? null : color.id);
  };

  // 統合実行: 選択された統合先IDへ
  const applyMerge = (value) => {
    setMergeTarget('');
    const toId = Number(value);
    if (!value || Number.isNaN(toId) || toId === color.id) return;
    if (onMergeColors) onMergeColors(color.id, toId);
  };

  const rowClass = [
    'palette__row',
    isHighlighted ? 'palette__row--active' : '',
    isEditing ? 'palette__row--editing' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const hexValid = isValidHex(hexInput);

  return html`
    <div class=${rowClass} role="listitem">
      <button
        type="button"
        class="palette__id"
        title=${isHighlighted ? '強調表示をやめる' : 'この色を強調表示'}
        onClick=${toggleHighlight}
      >
        ${color.id}
      </button>

      <button
        type="button"
        class="palette__swatch swatch"
        style=${`background:${color.hex};color:${fg}`}
        title=${isHighlighted ? '強調表示をやめる' : 'この色を強調表示'}
        onClick=${toggleHighlight}
      >
        ${isHighlighted ? '●' : ''}
      </button>

      <div class="palette__edit">
        <div class="palette__hexrow">
          <input
            type="color"
            class="palette__picker"
            value=${normalizeHex(color.hex)}
            aria-label=${`${color.id}番の色を選ぶ`}
            title="色を選ぶ"
            onChange=${(e) => onEditColor && onEditColor(color.id, { hex: e.target.value.toUpperCase() })}
          />
          <input
            type="text"
            class=${'palette__hex field' + (hexValid ? '' : ' warn--error')}
            value=${hexInput}
            maxlength="7"
            spellcheck="false"
            aria-label=${`${color.id}番の色コード`}
            title="色コード（#から始まる6桁）"
            onInput=${(e) => setHexInput(e.target.value)}
            onBlur=${commitHex}
            onKeyDown=${(e) => {
              if (e.key === 'Enter') e.target.blur();
            }}
          />
        </div>
        <input
          type="text"
          class="palette__name field"
          list="palette-color-names"
          value=${color.name || ''}
          aria-label=${`${color.id}番の色名`}
          onBlur=${(e) => commitName(e.target.value)}
          onKeyDown=${(e) => {
            if (e.key === 'Enter') e.target.blur();
          }}
        />
      </div>

      <div class="palette__stats">
        <span class="palette__count">${color.count}個</span>
        <span class="palette__ratio muted">${formatRatio(color.ratio)}%</span>
        ${bufferPercent > 0
          ? html`<span class="palette__need muted" title="使用個数＋予備${bufferPercent}%">必要数 ${need}個</span>`
          : null}
      </div>

      ${bead &&
      html`
        <div class="palette__bead" title="近い市販ビーズ色（目安）">
          <span class="muted">近い市販ビーズ色</span>
          <span class="palette__bead-swatch swatch" style=${`background:${bead.hex}`}></span>
          <span class="palette__bead-code">${bead.code}</span>
          <span class="palette__bead-name">${bead.name}</span>
        </div>
      `}

      <div class="palette__actions">
        <button
          type="button"
          class=${'btn btn--sm ' + (isEditing ? 'btn--primary' : 'btn--ghost')}
          title="この色を、図案を塗る色として選ぶ"
          onClick=${toggleEdit}
        >
          ${isEditing ? '塗り中' : 'この色で塗る'}
        </button>

        ${colors.length > 1 &&
        html`
          <label class="palette__merge">
            <span class="muted palette__merge-label">別の色とまとめる</span>
            <select
              class="palette__merge-select field"
              value=${mergeTarget}
              aria-label=${`${color.id}番の色を別の色とまとめる`}
              onChange=${(e) => applyMerge(e.target.value)}
            >
              <option value="">まとめ先を選ぶ…</option>
              ${colors
                .filter((c) => c.id !== color.id)
                .map(
                  (c) => html`
                    <option key=${c.id} value=${c.id}>
                      ${c.id}: ${c.name || c.hex}
                    </option>
                  `
                )}
            </select>
          </label>
        `}
      </div>

      <datalist id="palette-color-names">
        ${COLOR_NAMES.map((n) => html`<option key=${n} value=${n}></option>`)}
      </datalist>
    </div>
  `;
}

/** 割合を小数1桁の文字列に整形(NaN/未定義は 0)。 */
function formatRatio(ratio) {
  const n = typeof ratio === 'number' && !Number.isNaN(ratio) ? ratio : 0;
  return n.toFixed(1);
}
