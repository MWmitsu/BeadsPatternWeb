// ============================================================
// 画像アップローダー
// ------------------------------------------------------------
// クリックによるファイル選択と、ドラッグ&ドロップの両方で画像を受け取る。
// 受け取った File は loadImageFile で検証読込し、fileToDataUrl で
// データURL を取得して onImage で親へ渡す。失敗時は onError でメッセージを通知する。
// 元画像(originalUrl)が渡されていればプレビューとファイル名を表示する。
// ============================================================

import { html, useRef, useState } from '../lib/html.js';
import { loadImageFile, fileToDataUrl } from '../utils/imageLoader.js';

/**
 * @param {Object} props
 * @param {(payload: {image: HTMLImageElement, dataUrl: string, name: string, width: number, height: number}) => void} props.onImage
 *        画像読込成功時に呼ばれる。
 * @param {string|null} props.originalUrl       元画像プレビュー用のデータURL(無ければ案内表示)
 * @param {string|null} props.sourceImageName   元画像のファイル名
 * @param {(message: string) => void} props.onError  読込失敗時のメッセージ通知
 */
export function ImageUploader(props) {
  const { onImage, originalUrl, sourceImageName, onError } = props;

  // 非表示の <input type="file"> を参照(ドロップ領域クリックで開く)
  const inputRef = useRef(null);
  // ドラッグ中かどうか(枠線の強調表示に使用)
  const [dragover, setDragover] = useState(false);

  /**
   * 受け取った File を検証読込し、成功すれば onImage、失敗すれば onError を呼ぶ。
   * @param {File} file
   */
  const handleFile = async (file) => {
    if (!file) return;
    try {
      // 画像要素として読み込み(対応形式チェックもここで行われる)
      const image = await loadImageFile(file);
      // 保存・サムネイル用のデータURLを取得
      const dataUrl = await fileToDataUrl(file);
      onImage({
        image,
        dataUrl,
        name: file.name || '画像',
        // 実寸(自然サイズ)を渡す
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    } catch (err) {
      const message =
        err && err.message ? err.message : '画像の読み込みに失敗しました';
      if (onError) onError(message);
    }
  };

  // ドロップ領域クリック → ファイル選択ダイアログを開く
  const openFileDialog = () => {
    if (inputRef.current) inputRef.current.click();
  };

  // ファイル選択時
  const onInputChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) handleFile(file);
    // 同じファイルを連続選択しても change が発火するようリセット
    e.target.value = '';
  };

  // ドラッグが領域に入った/上にある間
  const onDragOver = (e) => {
    e.preventDefault();
    if (!dragover) setDragover(true);
  };

  // ドラッグが領域から出たとき
  const onDragLeave = (e) => {
    e.preventDefault();
    setDragover(false);
  };

  // ドロップ時
  const onDrop = (e) => {
    e.preventDefault();
    setDragover(false);
    const file =
      e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // キーボード操作(Enter/Space)でもファイル選択を開けるようにする
  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openFileDialog();
    }
  };

  const dropClass = 'uploader__drop' + (dragover ? ' uploader--dragover' : '');

  return html`
    <div class="uploader panel">
      <div class="panel__title">画像を選ぶ</div>
      <div class="panel__body">
        <div
          class=${dropClass}
          role="button"
          tabindex="0"
          onClick=${openFileDialog}
          onKeyDown=${onKeyDown}
          onDragOver=${onDragOver}
          onDragEnter=${onDragOver}
          onDragLeave=${onDragLeave}
          onDrop=${onDrop}
        >
          ${
            originalUrl
              ? html`
                  <div class="uploader__preview">
                    <img
                      class="uploader__image"
                      src=${originalUrl}
                      alt="元画像プレビュー"
                    />
                    ${
                      sourceImageName
                        ? html`<div class="uploader__name">${sourceImageName}</div>`
                        : null
                    }
                    <div class="uploader__hint muted">
                      別の画像に差し替えるにはここをクリック、またはドロップ
                    </div>
                  </div>
                `
              : html`
                  <div class="uploader__hint">
                    <div class="uploader__lead">
                      ここに画像をドラッグ&ドロップ
                    </div>
                    <div class="muted">またはクリックして選択</div>
                    <div class="uploader__formats muted">
                      対応形式: JPEG / PNG / WebP
                    </div>
                  </div>
                `
          }
        </div>

        <input
          ref=${inputRef}
          class="uploader__input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange=${onInputChange}
          style=${{ display: 'none' }}
        />
      </div>
    </div>
  `;
}
