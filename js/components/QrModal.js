// ============================================================
// QrModal: 共有リンクのQRコードを画面に表示するモーダル
// ------------------------------------------------------------
// パソコンの画面に出したQRコードをスマホのカメラで読み取ると、
// その図案をスマホのブラウザで開ける（サーバ不要・リンクに図案を内蔵）。
// QRは自前生成（js/lib/qrcode.js）。外部サービスへ画像も図案も送らない。
// ============================================================

import { html, useRef, useEffect } from '../lib/html.js';

export function QrModal(props) {
  const { matrix, url, title, onClose, onCopy, onSave } = props;
  const canvasRef = useRef(null);

  // QR行列をキャンバスへ描画（量子化領域=余白4モジュール付き、にじみ無し）
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !matrix) return;
    const { size, modules } = matrix;
    const quiet = 4;
    const full = size + quiet * 2;
    // 画面で読みやすい大きさへ（おおよそ 300px 目安、整数倍で鮮明に）
    const cell = Math.max(2, Math.min(10, Math.floor(300 / full)));
    const px = full * cell;
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, px, px);
    ctx.fillStyle = '#000000';
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (modules[y][x]) {
          ctx.fillRect((x + quiet) * cell, (y + quiet) * cell, cell, cell);
        }
      }
    }
  }, [matrix]);

  return html`
    <div class="qrmodal" role="dialog" aria-modal="true" aria-label="QRコードで共有">
      <div class="qrmodal__sheet">
        <div class="qrmodal__head">
          <strong>QRコードで共有</strong>
          <button class="qrmodal__close" type="button" onClick=${onClose} aria-label="閉じる">×</button>
        </div>

        <div class="qrmodal__body">
          <p class="qrmodal__lead">
            スマホのカメラでこのQRコードを読み取ると、図案「${title || '無題の図案'}」をスマホで開けます。
          </p>
          <div class="qrmodal__canvas-wrap">
            <canvas ref=${canvasRef} class="qrmodal__canvas"></canvas>
          </div>
          <div class="qrmodal__url-row">
            <input class="field qrmodal__url" type="text" readonly value=${url} onFocus=${(e) => e.target.select()} />
            <button type="button" class="btn btn--sm" onClick=${() => onCopy && onCopy(url)}>コピー</button>
          </div>
          <p class="field__hint muted">
            読み取れないときは、QRコードを大きく表示するか、「コピー」したリンクをスマホへ送ってください。
            図案が大きいほどQRは細かくなり読み取りにくくなります（その場合は「画像を共有」「リンクを共有」をお使いください）。
          </p>
        </div>

        <div class="qrmodal__foot">
          ${onSave &&
          html`<button type="button" class="btn btn--sm" onClick=${() => onSave(canvasRef.current)}>QR画像を保存</button>`}
          <button class="btn btn--primary" type="button" onClick=${onClose}>閉じる</button>
        </div>
      </div>
    </div>
  `;
}
