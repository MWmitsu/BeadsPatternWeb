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
    sizeMm = 0,
    patternWidth = 0,
    patternHeight = 0,
    onOpenBeadList,
    onFlipH,
    onFlipV,
    onRotate,
    bufferPercent = 10,
    onBufferChange,
    checkMode = false,
    onToggleCheckMode,
    doneCount = 0,
    totalBeads = 0,
    onResetDone,
    onShareImage,
    onShareLink,
    onShareQr,
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
          <div class="field__label">ビーズ色（近い市販ビーズ色の目安）</div>
          <div class="tools__row">
            <select
              class="tools__select"
              value=${beadPaletteId}
              onChange=${(e) => onBeadPaletteChange && onBeadPaletteChange(e.target.value)}
            >
              <option value="none">使わない（判定した色のまま）</option>
              ${beadPalettes.map((p) => html`<option key=${p.id} value=${p.id}>${p.name}</option>`)}
            </select>
            <button
              type="button"
              class="btn btn--sm"
              disabled=${disabled || beadPaletteId === 'none'}
              onClick=${() => onSnapToBeads && onSnapToBeads()}
            >市販ビーズ色に合わせる</button>
          </div>
          ${selected && selected.note
            ? html`<p class="field__hint muted">${selected.note}</p>`
            : html`<p class="field__hint muted">
                色一覧に「近い市販ビーズ色」と色番号を表示します。「市販ビーズ色に合わせる」で図案全体をその色に置き換えます。
              </p>`}
          ${sizeMm > 0 && patternWidth > 0
            ? html`<p class="field__hint muted">
                完成サイズの目安：約 ${((patternWidth * sizeMm) / 10).toFixed(1)} × ${((patternHeight * sizeMm) / 10).toFixed(1)} cm（${sizeMm}mmビーズ）
              </p>`
            : null}
          <div class="tools__row" style=${{ marginTop: '6px' }}>
            <button
              type="button"
              class="btn btn--sm"
              disabled=${disabled}
              onClick=${() => onOpenBeadList && onOpenBeadList()}
            >ビーズ一覧（買い物リスト）を見る</button>
          </div>
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
          <p class="field__hint muted">色一覧・印刷・一覧データ（CSV／表計算ソフトで開けます）に「必要数（使用個数＋予備）」を表示します。買い足しの目安にできます。</p>
        </div>

        <div class="divider"></div>

        <!-- 変形 -->
        <div class="tools__block">
          <div class="field__label">変形</div>
          <div class="tools__row tools__transform">
            <button type="button" class="btn btn--sm btn--ghost" disabled=${disabled} onClick=${() => onFlipH && onFlipH()}>⇆ 左右反転</button>
            <button type="button" class="btn btn--sm btn--ghost" disabled=${disabled} onClick=${() => onFlipV && onFlipV()}>⇅ 上下反転</button>
            <button type="button" class="btn btn--sm btn--ghost" disabled=${disabled} onClick=${() => onRotate && onRotate()}>⟳ 90°回転</button>
          </div>
          <p class="field__hint muted">アイロンの裏面用に反転したり、向きを変えられます。</p>
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
            >画像を共有</button>
            <button
              type="button"
              class="btn btn--sm"
              disabled=${disabled}
              onClick=${() => onShareLink && onShareLink()}
            >リンクを共有</button>
            ${onShareQr &&
            html`<button
              type="button"
              class="btn btn--sm"
              disabled=${disabled}
              onClick=${() => onShareQr()}
            >QRコードで共有</button>`}
          </div>
          <p class="field__hint muted">
            スマホでは「共有」を押すとLINE・メッセージ・メールなどの共有メニューが開きます（パソコンではコピーします）。
            リンクには図案が埋め込まれており（準備なしで使えます）、受け取った人が開くとそのまま表示されます。
            「QRコードで共有」を押すと画面にQRコードが出ます。パソコンの画面をスマホのカメラで読み取ると、その図案をスマホで開けます（小さめの図案向け）。
          </p>
        </div>

      </div>
    </section>
  `;
}
