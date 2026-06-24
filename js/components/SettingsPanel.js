// ============================================================
// SettingsPanel - 変換設定パネル
// ------------------------------------------------------------
// 「基本」「色判定」の各設定を編集し、変更後の完全な Settings を
// onChange でイミュータブルに親へ通知する。下部に「画像から変換」ボタンと
// 警告(warnings)表示を持つ。
//
// 重要:
//   - 設定の更新は必ず新しいオブジェクトを作って onChange に渡す(破壊的変更禁止)。
//   - detection 配下の値を更新するヘルパー patchDetection を用意。
//   - mergeStrength を選ぶと detection.colorDistanceThreshold を
//     MERGE_STRENGTH_THRESHOLD[値] に追従させる。
// ============================================================

import { html } from '../lib/html.js';
import { MAX_COLOR_OPTIONS, MERGE_STRENGTH_THRESHOLD, FIT_MODES, THEME_COLORS } from '../types.js';

/**
 * 変換設定パネル。
 * @param {Object} props
 * @param {import('../types.js').Settings} props.settings 現在の全設定
 * @param {(next: import('../types.js').Settings) => void} props.onChange 設定変更コールバック(完全な Settings を渡す)
 * @param {() => void} props.onConvert 変換実行コールバック
 * @param {boolean} props.converting 変換処理中か
 * @param {boolean} props.canConvert 変換可能か(画像未選択時などは false)
 * @param {string[]} props.warnings 表示する警告メッセージ配列
 */
export function SettingsPanel(props) {
  const {
    settings,
    onChange,
    onConvert,
    converting = false,
    canConvert = false,
    canCrop = false,
    onOpenCrop,
    themeColor = '',
    onThemeChange,
    warnings = [],
  } = props;

  const fitMode = settings.fitMode || 'stretch';

  const detection = settings.detection;

  // settings の指定キーだけを差し替えた新しい Settings を返して通知する
  const patch = (partial) => {
    onChange({ ...settings, ...partial });
  };

  // detection 配下の指定キーだけを差し替える(detection も新しいオブジェクトにする)
  const patchDetection = (partial) => {
    onChange({
      ...settings,
      detection: { ...detection, ...partial },
    });
  };

  // 数値入力を安全に解釈する(空・NaN は fallback を返す)
  const toNumber = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  // 色統合の強さ変更時は、追従して colorDistanceThreshold も更新する
  const handleMergeStrengthChange = (strength) => {
    const threshold = MERGE_STRENGTH_THRESHOLD[strength];
    onChange({
      ...settings,
      mergeStrength: strength,
      detection: { ...detection, colorDistanceThreshold: threshold },
    });
  };

  const convertDisabled = !canConvert || converting;

  return html`
    <section class="settings panel">
      <h2 class="panel__title">変換設定</h2>
      <div class="panel__body">

        <div class="field">
          <span class="field__label">テーマカラー</span>
          <div class="field__row theme-swatches">
            ${THEME_COLORS.map(
              (t) => html`
                <button
                  type="button"
                  key=${t.accent}
                  class=${'theme-swatch' + ((themeColor || '') === t.accent ? ' theme-swatch--active' : '')}
                  style=${`background:${t.accent}`}
                  title=${t.name}
                  aria-label=${t.name}
                  onClick=${() => onThemeChange && onThemeChange(t.accent)}
                ></button>
              `
            )}
          </div>
        </div>

        <div class="divider"></div>

        <!-- ===== 基本設定 ===== -->
        <h3 class="settings__group-title">基本</h3>

        <div class="field">
          <div class="field__row">
            <label class="field__label" for="settings-width">横ビーズ数</label>
            <input
              id="settings-width"
              class="settings__input"
              type="number"
              min="1"
              max="200"
              value=${settings.width}
              onInput=${(e) =>
                patch({ width: toNumber(e.target.value, settings.width) })}
            />
          </div>
        </div>

        <div class="field">
          <div class="field__row">
            <label class="field__label" for="settings-height">縦ビーズ数</label>
            <input
              id="settings-height"
              class="settings__input"
              type="number"
              min="1"
              max="200"
              value=${settings.height}
              onInput=${(e) =>
                patch({ height: toNumber(e.target.value, settings.height) })}
            />
          </div>
        </div>

        <div class="field">
          <div class="field__row">
            <label class="field__label" for="settings-max-colors">最大色数</label>
            <select
              id="settings-max-colors"
              class="settings__select"
              value=${detection.maxColors}
              onChange=${(e) =>
                patchDetection({
                  maxColors: toNumber(e.target.value, detection.maxColors),
                })}
            >
              ${MAX_COLOR_OPTIONS.map(
                (n) => html`<option key=${n} value=${n}>${n} 色</option>`
              )}
            </select>
          </div>
        </div>

        <div class="field">
          <label class="field__row toggle">
            <input
              type="checkbox"
              checked=${settings.showGrid}
              onChange=${(e) => patch({ showGrid: e.target.checked })}
            />
            <span class="field__label">グリッド線を表示</span>
          </label>
        </div>

        <div class="field">
          <label class="field__row toggle">
            <input
              type="checkbox"
              checked=${settings.showNumbers}
              onChange=${(e) => patch({ showNumbers: e.target.checked })}
            />
            <span class="field__label">色番号を表示</span>
          </label>
        </div>

        <div class="field">
          <span class="field__label">背景の扱い</span>
          <div class="field__row settings__radio-row">
            <label class="settings__radio">
              <input
                type="radio"
                name="settings-background"
                checked=${settings.backgroundAsWhite === true}
                onChange=${() => patch({ backgroundAsWhite: true })}
              />
              <span>白として扱う</span>
            </label>
            <label class="settings__radio">
              <input
                type="radio"
                name="settings-background"
                checked=${settings.backgroundAsWhite === false}
                onChange=${() => patch({ backgroundAsWhite: false })}
              />
              <span>透明として扱う</span>
            </label>
          </div>
        </div>

        <div class="field">
          <span class="field__label">画像の合わせ方（写真の比率が違うとき）</span>
          <div class="field__row settings__radio-row settings__fit">
            ${FIT_MODES.map(
              (m) => html`
                <label key=${m.value} class="settings__radio" title=${m.hint}>
                  <input
                    type="radio"
                    name="settings-fit"
                    checked=${fitMode === m.value}
                    onChange=${() => patch({ fitMode: m.value })}
                  />
                  <span>${m.label}</span>
                </label>
              `
            )}
          </div>
          ${fitMode === 'crop' &&
          html`
            <button
              type="button"
              class="btn btn--ghost btn--sm settings__crop-btn"
              disabled=${!canCrop}
              onClick=${() => canCrop && onOpenCrop && onOpenCrop()}
            >
              範囲を調整…
            </button>
          `}
          <p class="settings__fit-hint muted">
            ${(FIT_MODES.find((m) => m.value === fitMode) || {}).hint || ''}
          </p>
        </div>

        <div class="divider"></div>

        <!-- ===== 色判定設定 ===== -->
        <h3 class="settings__group-title">色判定</h3>

        <div class="field">
          <div class="field__row">
            <label class="field__label" for="settings-merge-strength">色のまとめ具合</label>
            <select
              id="settings-merge-strength"
              class="settings__select"
              value=${settings.mergeStrength}
              onChange=${(e) => handleMergeStrengthChange(e.target.value)}
            >
              <option value="弱">弱（色を多めに残す）</option>
              <option value="標準">標準</option>
              <option value="強">強（色を少なくまとめる）</option>
            </select>
          </div>
          <p class="field__hint muted">強いほど、似た色どうしを1色にまとめます（色数が減って作りやすくなります）。</p>
        </div>

        <details class="settings__advanced">
          <summary class="settings__advanced-summary">詳しい色設定（ふだんは触らなくてOK）</summary>

          <div class="field">
            <div class="field__row">
              <label class="field__label" for="settings-distance">色をまとめる距離</label>
              <div class="settings__range-wrap">
                <input
                  id="settings-distance"
                  class="settings__range"
                  type="range"
                  min="0"
                  max="100"
                  value=${detection.colorDistanceThreshold}
                  onInput=${(e) =>
                    patchDetection({
                      colorDistanceThreshold: toNumber(e.target.value, detection.colorDistanceThreshold),
                    })}
                />
                <span class="settings__range-value badge">${detection.colorDistanceThreshold}</span>
              </div>
            </div>
            <p class="field__hint muted">「色のまとめ具合」を数値で細かく調整するものです（大きいほどまとめます）。</p>
          </div>

          <div class="field">
            <label class="field__row toggle">
              <input
                type="checkbox"
                checked=${detection.mergeMinorColors}
                onChange=${(e) => patchDetection({ mergeMinorColors: e.target.checked })}
              />
              <span class="field__label">少ししか使わない色をまとめる</span>
            </label>
            <p class="field__hint muted">数個しか出てこない色を近い色にまとめ、作りやすくします。</p>
          </div>

          <div class="field">
            <div class="field__row">
              <label class="field__label" for="settings-minor-count">何個以下をまとめるか</label>
              <input
                id="settings-minor-count"
                class="settings__input"
                type="number"
                min="0"
                value=${detection.minorColorCountThreshold}
                disabled=${!detection.mergeMinorColors}
                onInput=${(e) =>
                  patchDetection({
                    minorColorCountThreshold: toNumber(e.target.value, detection.minorColorCountThreshold),
                  })}
              />
            </div>
          </div>

          <div class="field">
            <label class="field__row toggle">
              <input
                type="checkbox"
                checked=${detection.dithering}
                onChange=${(e) => patchDetection({ dithering: e.target.checked })}
              />
              <span class="field__label">ディザリング</span>
            </label>
            <p class="field__hint muted">色の境目を細かい点で混ぜ、なめらかに見せます。</p>
          </div>

          <div class="field">
            <label class="field__row toggle">
              <input
                type="checkbox"
                checked=${detection.contrastCorrection}
                onChange=${(e) => patchDetection({ contrastCorrection: e.target.checked })}
              />
              <span class="field__label">コントラスト補正</span>
            </label>
            <p class="field__hint muted">明暗の差をはっきりさせます。</p>
          </div>

          <div class="field">
            <label class="field__row toggle">
              <input
                type="checkbox"
                checked=${detection.outlineEnhancement}
                onChange=${(e) => patchDetection({ outlineEnhancement: e.target.checked })}
              />
              <span class="field__label">輪郭強調</span>
            </label>
            <p class="field__hint muted">絵の輪郭をくっきりさせます。</p>
          </div>
        </details>

        <p class="settings__note muted">
          色数を増やすほど元画像に近づきますが、制作は難しくなります。
        </p>

        <!-- ===== 警告表示 ===== -->
        ${warnings.length > 0 &&
        html`
          <div class="settings__warnings">
            ${warnings.map(
              (msg, i) => html`<p key=${i} class="warn">${msg}</p>`
            )}
          </div>
        `}

        <!-- ===== 変換ボタン ===== -->
        <button
          class="settings__convert btn btn--primary"
          type="button"
          disabled=${convertDisabled}
          onClick=${() => {
            if (!convertDisabled) onConvert();
          }}
        >
          ${converting ? '変換中…' : '画像から変換'}
        </button>

      </div>
    </section>
  `;
}
