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
        <div class="panel__title">色パレット</div>
        <div class="panel__body">
          <p class="muted">まだ色がありません。画像を変換するとここに一覧が表示されます。</p>
        </div>
      </div>
    `;
  }

  return html`
    <div class="panel palette">
      <div class="panel__title">
        色パレット
        <span class="badge">${colors.length}色</span>
        <span class="muted palette__total">総ビーズ ${totalBeads}個</span>
      </div>
      <div class="panel__body">
        <div class="palette__hint muted">
          番号や色見本をクリックすると、その色だけをハイライト表示します。
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
    onHighlight,
    onSelectEditColor,
    onEditColor,
    onMergeColors,
  } = props;

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
        title=${isHighlighted ? 'ハイライト解除' : 'この色をハイライト'}
        onClick=${toggleHighlight}
      >
        ${color.id}
      </button>

      <button
        type="button"
        class="palette__swatch swatch"
        style=${`background:${color.hex};color:${fg}`}
        title=${isHighlighted ? 'ハイライト解除' : 'この色をハイライト'}
        onClick=${toggleHighlight}
      >
        ${isHighlighted ? '●' : ''}
      </button>

      <div class="palette__edit">
        <input
          type="text"
          class=${'palette__hex field' + (hexValid ? '' : ' warn--error')}
          value=${hexInput}
          maxlength="7"
          spellcheck="false"
          aria-label=${`色${color.id}のHEX`}
          onInput=${(e) => setHexInput(e.target.value)}
          onBlur=${commitHex}
          onKeyDown=${(e) => {
            if (e.key === 'Enter') e.target.blur();
          }}
        />
        <input
          type="text"
          class="palette__name field"
          list="palette-color-names"
          value=${color.name || ''}
          aria-label=${`色${color.id}の色名`}
          onBlur=${(e) => commitName(e.target.value)}
          onKeyDown=${(e) => {
            if (e.key === 'Enter') e.target.blur();
          }}
        />
      </div>

      <div class="palette__stats">
        <span class="palette__count">${color.count}個</span>
        <span class="palette__ratio muted">${formatRatio(color.ratio)}%</span>
      </div>

      <div class="palette__actions">
        <button
          type="button"
          class=${'btn btn--sm ' + (isEditing ? 'btn--primary' : 'btn--ghost')}
          title="この色でキャンバスを塗る色として選択"
          onClick=${toggleEdit}
        >
          ${isEditing ? '塗り中' : 'この色で塗る'}
        </button>

        ${colors.length > 1 &&
        html`
          <label class="palette__merge">
            <span class="muted palette__merge-label">統合先</span>
            <select
              class="palette__merge-select field"
              value=${mergeTarget}
              aria-label=${`色${color.id}の統合先`}
              onChange=${(e) => applyMerge(e.target.value)}
            >
              <option value="">選択…</option>
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
