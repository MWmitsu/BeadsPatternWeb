// ============================================================
// 出力パネル(ExportPanel)
// ------------------------------------------------------------
// 生成済みの図案を各種形式で書き出す/読み込むためのボタン群をまとめたパネル。
//   ・完成イメージPNG / 数字付き設計図PNG / 色一覧CSV
//   ・印刷画面を開く
//   ・プロジェクトをJSONで保存 / JSONから読込
//   ・localStorageへ保存
// 実際の保存処理(localStorage更新やApp状態反映)は親(App)から渡される
// コールバックに委譲し、ファイル生成系はユーティリティに一任する。
// ============================================================

import { html, useRef } from '../lib/html.js';
import { exportFinishedPng, exportNumberedPng, sanitizeName } from '../utils/exportPng.js';
import { exportColorsCsv } from '../utils/exportCsv.js';

/**
 * 出力パネル
 * @param {Object} props
 * @param {{colors:Array, cells:Array, width:number, height:number, title?:string}|null} props.pattern
 *        生成済みの図案。未生成なら null。
 * @param {Array} props.colors パレット(色一覧CSV用)
 * @param {Object|null} props.project JSON保存用の完全データ(grid を含む BeadPattern)
 * @param {() => void} props.onSaveLocal localStorageへ保存(App側で実処理)
 * @param {() => void} props.onOpenPrint 印刷画面を開く
 * @param {(obj:Object) => void} props.onImportProject JSON読込結果をAppへ渡す
 * @param {boolean} props.disabled 図案未生成なら true(出力系を無効化)
 */
export function ExportPanel(props) {
  const {
    pattern,
    colors,
    project,
    onSaveLocal,
    onOpenPrint,
    onImportProject,
    onBackupAll,
    onRestoreAll,
    disabled,
    bufferPercent = 0,
    beadPaletteColors = null,
  } = props;

  // 隠しファイル入力(JSON読込用)への参照
  const fileInputRef = useRef(null);
  // 全データ復元用の隠しファイル入力
  const restoreInputRef = useRef(null);

  // 完成イメージPNGを保存(グリッド無し)。
  // 完成イメージは「丸ビーズ風」や空ペグ点を含めず、ベタ塗りのクリアな画像にする。
  function handleExportFinished() {
    if (!pattern) return;
    exportFinishedPng(pattern, { showGrid: false });
  }

  // 数字付き設計図PNGを保存
  function handleExportNumbered() {
    if (!pattern) return;
    exportNumberedPng(pattern, {});
  }

  // 色一覧CSVを保存
  function handleExportCsv() {
    if (!colors || colors.length === 0) return;
    const base = sanitizeName(pattern && pattern.title, 'beads');
    exportColorsCsv(colors, base + '_色一覧.csv', { bufferPercent, beadPaletteColors });
  }

  // プロジェクト全体をJSONファイルとして保存
  function handleExportJson() {
    if (!project) return;
    // 整形(改行・インデント)を省いてファイルサイズを抑える(元画像を含むため肥大しやすい)
    const text = JSON.stringify(project);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = sanitizeName(project && project.title, 'project') + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    // クリック処理の完了を待ってから URL を解放する
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  // 「JSONから読込」ボタン → 隠しファイル入力を開く
  function handleImportClick() {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }

  // ファイル選択時:読み込んで JSON をパースし、成功なら親へ渡す
  function handleFileChange(e) {
    const input = e.target;
    const file = input.files && input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(String(reader.result));
        onImportProject(obj);
      } catch (err) {
        // パース失敗(壊れたファイル/JSON以外)はアラートで通知
        alert('保存ファイル（JSON）の読み込みに失敗しました。ファイルが壊れている可能性があります。');
      }
    };
    reader.onerror = () => {
      alert('ファイルの読み込みに失敗しました。');
    };
    reader.readAsText(file);

    // 同じファイルを連続で選んでも change が発火するよう値をリセット
    input.value = '';
  }

  // 全データのバックアップから復元
  function handleRestoreClick() {
    if (restoreInputRef.current) restoreInputRef.current.click();
  }
  function handleRestoreFileChange(e) {
    const input = e.target;
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(String(reader.result));
        if (onRestoreAll) onRestoreAll(obj);
      } catch (err) {
        alert('バックアップファイル（JSON）の読み込みに失敗しました。ファイルが壊れている可能性があります。');
      }
    };
    reader.onerror = () => alert('ファイルの読み込みに失敗しました。');
    reader.readAsText(file);
    input.value = '';
  }

  return html`
    <details class="panel export panel--collapsible">
      <summary class="panel__title">出力・保存</summary>
      <div class="panel__body export__body">

        <div class="export__group">
          <div class="field__label">画像として保存</div>
          <div class="export__btnrow">
            <button
              type="button"
              class="btn btn--primary"
              disabled=${disabled}
              onClick=${handleExportFinished}
            >完成イメージを画像（PNG）で保存</button>
            <button
              type="button"
              class="btn"
              disabled=${disabled}
              onClick=${handleExportNumbered}
            >数字付き設計図を画像（PNG）で保存</button>
          </div>
        </div>

        <div class="divider"></div>

        <div class="export__group">
          <div class="field__label">一覧・印刷</div>
          <div class="export__btnrow">
            <button
              type="button"
              class="btn"
              disabled=${disabled}
              onClick=${handleExportCsv}
            >色一覧を一覧データ（CSV）で保存</button>
            <button
              type="button"
              class="btn"
              disabled=${disabled}
              onClick=${onOpenPrint}
            >印刷画面を開く</button>
          </div>
        </div>

        <div class="divider"></div>

        <div class="export__group">
          <div class="field__label">図案の保存・読み込み</div>
          <div class="export__btnrow">
            <button
              type="button"
              class="btn"
              disabled=${disabled}
              onClick=${handleExportJson}
            >ファイルに書き出す（バックアップ）</button>
            <button
              type="button"
              class="btn btn--ghost"
              onClick=${handleImportClick}
            >ファイルから読み込む</button>
            <button
              type="button"
              class="btn"
              disabled=${disabled}
              onClick=${onSaveLocal}
            >このブラウザに保存</button>
          </div>
          <p class="muted export__note">
            「このブラウザに保存」は、次回このブラウザで開いたときに続きから使えます。
            「ファイルに書き出す」は、いま開いている図案1つをファイルにまとめます。
          </p>
        </div>

        ${(onBackupAll || onRestoreAll) &&
        html`
          <div class="divider"></div>
          <div class="export__group">
            <div class="field__label">全データのバックアップ（図案ぜんぶ＋在庫）</div>
            <div class="export__btnrow">
              ${onBackupAll &&
              html`<button type="button" class="btn" onClick=${() => onBackupAll()}>全部まとめて保存</button>`}
              ${onRestoreAll &&
              html`<button type="button" class="btn btn--ghost" onClick=${handleRestoreClick}>バックアップから復元</button>`}
            </div>
            <p class="muted export__note">
              「このブラウザに保存」した図案ぜんぶと手持ち在庫を、1つのファイルにまとめて保存します。
              機種変更や別の端末への引っ越し、万一に備えた控えに使えます（復元すると既存のデータは置き換わります）。
            </p>
          </div>
        `}

        <!-- JSON読込用の隠しファイル入力 -->
        <input
          ref=${fileInputRef}
          type="file"
          accept=".json,application/json"
          class="export__file"
          style=${{ display: 'none' }}
          onChange=${handleFileChange}
        />
        <!-- 全データ復元用の隠しファイル入力 -->
        <input
          ref=${restoreInputRef}
          type="file"
          accept=".json,application/json"
          class="export__file"
          style=${{ display: 'none' }}
          onChange=${handleRestoreFileChange}
        />
      </div>
    </details>
  `;
}
