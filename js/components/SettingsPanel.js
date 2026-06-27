// ============================================================
// SettingsPanel - 変換設定パネル
// ------------------------------------------------------------
// 上部に「最低限必要な設定」と「画像から変換」ボタン、
// 下部に折りたたみの「詳しい設定」(見た目・台座・色判定の細かい調整)を置く。
// 設定の更新は必ず新しいオブジェクトを作って onChange に渡す(破壊的変更禁止)。
// mergeStrength を選ぶと detection.colorDistanceThreshold を追従させる。
// ============================================================

import { html, useState, useEffect, memo } from '../lib/html.js';
import { MAX_COLOR_OPTIONS, MERGE_STRENGTH_THRESHOLD, FIT_MODES } from '../types.js';
import { PLATE_SHAPES } from '../utils/plateShape.js';

/**
 * 変換設定パネル。
 * @param {Object} props
 * @param {import('../types.js').Settings} props.settings
 * @param {(next: import('../types.js').Settings) => void} props.onChange
 * @param {() => void} props.onConvert
 * @param {boolean} props.converting
 * @param {boolean} props.canConvert
 * @param {string[]} props.warnings
 */
export const SettingsPanel = memo(function SettingsPanel(props) {
  const {
    settings,
    onChange,
    onConvert,
    converting = false,
    canConvert = false,
    canCrop = false,
    onOpenCrop,
    warnings = [],
  } = props;

  const fitMode = settings.fitMode || 'contain';
  const detection = settings.detection;

  const patch = (partial) => onChange({ ...settings, ...partial });
  const patchDetection = (partial) =>
    onChange({ ...settings, detection: { ...detection, ...partial } });

  const toNumber = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  // 横/縦ビーズ数は入力中に空にできるよう、表示用テキストをローカルに保持する。
  // (type=number の制御値だと iPhone で消したとき即 0 になり「0 が残る」不具合になるため)
  const [widthText, setWidthText] = useState(String(settings.width));
  const [heightText, setHeightText] = useState(String(settings.height));
  useEffect(() => { setWidthText(String(settings.width)); }, [settings.width]);
  useEffect(() => { setHeightText(String(settings.height)); }, [settings.height]);

  const clampDim = (n) => Math.max(1, Math.min(400, Math.floor(n)));
  const onDimInput = (key, raw, setText) => {
    setText(raw);
    if (raw === '') return; // 空のあいだは確定しない(0 を残さない)
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 1) patch({ [key]: clampDim(n) });
  };
  const onDimBlur = (key, raw, setText) => {
    const n = Number(raw);
    const v = Number.isFinite(n) && n >= 1 ? clampDim(n) : 1; // 空や0で離れたら最小1へ
    setText(String(v));
    if (v !== settings[key]) patch({ [key]: v });
  };

  const handleMergeStrengthChange = (strength) => {
    onChange({
      ...settings,
      mergeStrength: strength,
      detection: { ...detection, colorDistanceThreshold: MERGE_STRENGTH_THRESHOLD[strength] },
    });
  };

  const convertDisabled = !canConvert || converting;

  return html`
    <section class="settings panel">
      <h2 class="panel__title">変換設定</h2>
      <div class="panel__body">

        <!-- ===== 最低限の設定 ===== -->
        <div class="field">
          <div class="field__row">
            <label class="field__label" for="settings-width">横ビーズ数</label>
            <input
              id="settings-width"
              class="settings__input"
              type="number"
              inputmode="numeric"
              min="1"
              max="400"
              value=${widthText}
              onInput=${(e) => onDimInput('width', e.target.value, setWidthText)}
              onBlur=${(e) => onDimBlur('width', e.target.value, setWidthText)}
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
              inputmode="numeric"
              min="1"
              max="400"
              value=${heightText}
              onInput=${(e) => onDimInput('height', e.target.value, setHeightText)}
              onBlur=${(e) => onDimBlur('height', e.target.value, setHeightText)}
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
              onChange=${(e) => patchDetection({ maxColors: toNumber(e.target.value, detection.maxColors) })}
            >
              ${MAX_COLOR_OPTIONS.map((n) => html`<option key=${n} value=${n}>${n} 色</option>`)}
            </select>
          </div>
        </div>

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
          <p class="field__hint muted">強いほど似た色を1色にまとめます（色数が減って作りやすい）。</p>
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
              onClick=${() => onOpenCrop && onOpenCrop()}
            >
              範囲を調整…
            </button>
          `}
          <p class="settings__fit-hint muted">${(FIT_MODES.find((m) => m.value === fitMode) || {}).hint || ''}</p>
        </div>

        <div class="field">
          <span class="field__label">背景の扱い</span>
          <div class="field__row settings__radio-row">
            <label class="settings__radio" title="写真などの背景(まわりの色)を自動で消して、被写体だけの図案にします">
              <input
                type="radio"
                name="settings-background"
                checked=${settings.removeBackground === true}
                onChange=${() => patch({ removeBackground: true })}
              />
              <span>背景を自動で消す（おすすめ）</span>
            </label>
            <label class="settings__radio">
              <input
                type="radio"
                name="settings-background"
                checked=${!settings.removeBackground && settings.backgroundAsWhite === true}
                onChange=${() => patch({ backgroundAsWhite: true, removeBackground: false })}
              />
              <span>白として扱う</span>
            </label>
            <label class="settings__radio">
              <input
                type="radio"
                name="settings-background"
                checked=${!settings.removeBackground && settings.backgroundAsWhite === false}
                onChange=${() => patch({ backgroundAsWhite: false, removeBackground: false })}
              />
              <span>透明として扱う</span>
            </label>
          </div>
          <p class="field__hint muted">「背景を自動で消す」は、写真などのまわりの色を消して被写体だけを残します（透明になります）。</p>
        </div>

        <p class="settings__note muted">色数を増やすほど元画像に近づきますが、制作は難しくなります。</p>

        ${warnings.length > 0 &&
        html`
          <div class="settings__warnings">
            ${warnings.map((msg, i) => html`<p key=${i} class="warn">${msg}</p>`)}
          </div>
        `}

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

        <!-- ===== 詳しい設定(折りたたみ) ===== -->
        <details class="settings__advanced">
          <summary class="settings__advanced-summary">詳しい設定（ふだんは触らなくてOK）</summary>

          <h3 class="settings__group-title">見た目・台座</h3>

          <div class="field">
            <div class="field__row">
              <label class="field__label" for="settings-plate">台座（プレート）の形</label>
              <select
                id="settings-plate"
                class="settings__select"
                value=${settings.plateShape || 'none'}
                onChange=${(e) => patch({ plateShape: e.target.value })}
              >
                ${PLATE_SHAPES.map((s) => html`<option key=${s.id} value=${s.id}>${s.name}</option>`)}
              </select>
            </div>
            <p class="field__hint muted">「台座なし」は形の制限なし（画像のまま）。円・ハートなどを選ぶと、形の外はビーズを置かないマス（空マス）になります。</p>
          </div>

          <div class="field">
            <label class="field__row toggle">
              <input type="checkbox" checked=${settings.roundBeads} onChange=${(e) => patch({ roundBeads: e.target.checked })} />
              <span class="field__label">ビーズ風（丸）で表示</span>
            </label>
          </div>

          <div class="divider"></div>
          <h3 class="settings__group-title">色判定（上級者向け）</h3>

          <div class="field">
            <div class="field__row">
              <label class="field__label" for="settings-distance">色をまとめる近さ</label>
              <div class="settings__range-wrap">
                <input
                  id="settings-distance"
                  class="settings__range"
                  type="range"
                  min="0"
                  max="100"
                  value=${detection.colorDistanceThreshold}
                  onInput=${(e) =>
                    patchDetection({ colorDistanceThreshold: toNumber(e.target.value, detection.colorDistanceThreshold) })}
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
                  patchDetection({ minorColorCountThreshold: toNumber(e.target.value, detection.minorColorCountThreshold) })}
              />
            </div>
          </div>

          <div class="field">
            <label class="field__row toggle">
              <input type="checkbox" checked=${detection.dithering} onChange=${(e) => patchDetection({ dithering: e.target.checked })} />
              <span class="field__label">色をなめらかに混ぜる（ディザリング）</span>
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
              <span class="field__label">明暗の差をはっきりさせる（コントラスト補正）</span>
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
              <span class="field__label">ふち（輪郭）をくっきりさせる</span>
            </label>
            <p class="field__hint muted">絵のふち（輪郭）をくっきりさせます。</p>
          </div>
        </details>

      </div>
    </section>
  `;
});
