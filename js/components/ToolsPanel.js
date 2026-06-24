// ============================================================
// ToolsPanel: 制作・共有まわりのツールをまとめた右カラムのパネル
// ------------------------------------------------------------
//  - ビーズ色: 市販ビーズに近い色パレットの選択 / 図案全体をその色へスナップ
//  - 必要数: 購入見積り用の予備%(色一覧・印刷・CSVに反映)
//  - 作業チェック: 置いたマスの消し込みモードと進捗表示
//  - 共有: 画像(Web Share/保存) / 共有リンク(URLに図案を埋め込む)
// ============================================================

import { html } from '../lib/html.js';

/** 0〜100 の整数へ */
function clampPct(v, fallback) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, n));
}

export function ToolsPanel(props) {
  const {
    hasPattern = false,
    beadPalettes = [],
    beadPaletteId = 'none',
    onBeadPaletteChange,
    onSnapToBeads,
    bufferPercent = 10,
    onBufferChange,
    checkMode = false,
    onToggleCheckMode,
    doneCount = 0,
    totalBeads = 0,
    highlightColorId = null,
    onMarkHighlightDone,
    onResetDone,
    onShareImage,
    onShareLink,
  } = props;

  const selected = beadPalettes.find((p) => p.id === beadPaletteId) || null;
  const pct = totalBeads > 0 ? Math.round((doneCount / totalBeads) * 100) : 0;
  const disabled = !hasPattern;

  return html`
    <section class="panel tools">
      <h2 class="panel__title">制作・共有ツール</h2>
      <div class="panel__body">

        <!-- ビーズ色 -->
        <div class="tools__block">
          <div class="field__label">ビーズ色（市販色の目安）</div>
          <div class="tools__row">
            <select
              class="tools__select"
              value=${beadPaletteId}
              onChange=${(e) => onBeadPaletteChange && onBeadPaletteChange(e.target.value)}
            >
              <option value="none">使わない（検出色のまま）</option>
              ${beadPalettes.map((p) => html`<option key=${p.id} value=${p.id}>${p.name}</option>`)}
            </select>
            <button
              type="button"
              class="btn btn--sm"
              disabled=${disabled || beadPaletteId === 'none'}
              onClick=${() => onSnapToBeads && onSnapToBeads()}
            >市販色に合わせる</button>
          </div>
          ${selected && selected.note
            ? html`<p class="field__hint muted">${selected.note}</p>`
            : html`<p class="field__hint muted">
                色一覧に「近い市販色」と番号を表示します。「市販色に合わせる」で図案全体をその色に置き換えます。
              </p>`}
        </div>

        <div class="divider"></div>

        <!-- 必要数の予備 -->
        <div class="tools__block">
          <label class="tools__row">
            <span class="field__label">必要数の予備</span>
            <span class="tools__bufrow">
              <input
                type="number"
                min="0"
                max="100"
                class="tools__buf"
                value=${bufferPercent}
                onInput=${(e) => onBufferChange && onBufferChange(clampPct(e.target.value, bufferPercent))}
              />
              <span>%</span>
            </span>
          </label>
          <p class="field__hint muted">色一覧・印刷・CSVに「必要数（個数＋予備）」を表示します。買い足しの目安に。</p>
        </div>

        <div class="divider"></div>

        <!-- 作業チェック -->
        <div class="tools__block">
          <div class="tools__row">
            <span class="field__label">作業チェック</span>
            <button
              type="button"
              class=${'btn btn--sm ' + (checkMode ? 'btn--primary' : 'btn--ghost')}
              disabled=${disabled}
              onClick=${() => onToggleCheckMode && onToggleCheckMode()}
            >${checkMode ? 'チェック中（マスをタップ）' : 'チェックを始める'}</button>
          </div>
          <div class="tools__progress">
            <div class="tools__bar"><span style=${`width:${pct}%`}></span></div>
            <span class="muted tools__progress-num">${doneCount} / ${totalBeads}（${pct}%）</span>
          </div>
          <div class="tools__row tools__check-actions">
            <button
              type="button"
              class="btn btn--sm btn--ghost"
              disabled=${disabled || highlightColorId == null}
              title=${highlightColorId == null ? 'まず色一覧で色を選んで強調表示してください' : ''}
              onClick=${() => onMarkHighlightDone && onMarkHighlightDone(true)}
            >${highlightColorId != null ? `色${highlightColorId}を全部チェック` : '強調色を全部チェック'}</button>
            <button
              type="button"
              class="btn btn--sm btn--ghost"
              disabled=${disabled || doneCount === 0}
              onClick=${() => onResetDone && onResetDone()}
            >全部リセット</button>
          </div>
        </div>

        <div class="divider"></div>

        <!-- 共有 -->
        <div class="tools__block">
          <div class="field__label">共有</div>
          <div class="tools__row tools__share">
            <button
              type="button"
              class="btn btn--sm"
              disabled=${disabled}
              onClick=${() => onShareImage && onShareImage()}
            >画像を共有／保存</button>
            <button
              type="button"
              class="btn btn--sm"
              disabled=${disabled}
              onClick=${() => onShareLink && onShareLink()}
            >共有リンクをコピー</button>
          </div>
          <p class="field__hint muted">
            「共有リンク」は図案をURLに埋め込みます（サーバー不要）。受け取った人が開くとそのまま表示されます。
          </p>
        </div>

      </div>
    </section>
  `;
}
