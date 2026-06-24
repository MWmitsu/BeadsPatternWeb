// ============================================================
// CropModal: 元画像から「使う範囲」を選ぶモーダル
// ------------------------------------------------------------
// 引き伸ばさずに作りたいとき、グリッド(横×縦)の比率にロックした枠を
// ドラッグで移動・スライダーで拡大して範囲を決める。枠は常にグリッド比率なので
// 結果が歪まない。決定すると正規化座標 {x,y,w,h}(0..1) を親へ返す。
// ============================================================

import { html, useState, useRef } from '../lib/html.js';

/** 画像内に収まる最大の gridAR 矩形(正規化 0..1)を返す */
function computeMaxCover(iw, ih, gridAR) {
  // pixelW/pixelH = gridAR を満たす最大矩形
  let wN = (gridAR * ih) / iw;
  let hN = 1;
  if (wN > 1) {
    wN = 1;
    hN = iw / (gridAR * ih);
  }
  return { w: wN, h: hN };
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * @param {Object} props
 * @param {string} props.imageUrl 元画像のデータURL
 * @param {number} props.imageW 元画像の実ピクセル幅
 * @param {number} props.imageH 元画像の実ピクセル高さ
 * @param {number} props.gridW 横ビーズ数
 * @param {number} props.gridH 縦ビーズ数
 * @param {{x:number,y:number,w:number,h:number}|null} props.initialCrop
 * @param {(crop:{x:number,y:number,w:number,h:number})=>void} props.onApply
 * @param {()=>void} props.onCancel
 */
export function CropModal(props) {
  const { imageUrl, imageW, imageH, gridW, gridH, initialCrop, onApply, onCancel } = props;

  const gridAR = gridW / gridH;
  const maxCover = computeMaxCover(imageW, imageH, gridAR);

  const initZoom =
    initialCrop && initialCrop.w > 0 ? clamp(maxCover.w / initialCrop.w, 1, 5) : 1;
  const initCenter = initialCrop
    ? { cx: initialCrop.x + initialCrop.w / 2, cy: initialCrop.y + initialCrop.h / 2 }
    : { cx: 0.5, cy: 0.5 };

  const [zoom, setZoom] = useState(initZoom);
  const [center, setCenter] = useState(initCenter);
  const areaRef = useRef(null);
  const dragging = useRef(false);

  // 現在の枠(正規化)。中央はクランプして枠が画像内に収まるようにする。
  const wN = Math.min(1, maxCover.w / zoom);
  const hN = Math.min(1, maxCover.h / zoom);
  const cx = clamp(center.cx, wN / 2, 1 - wN / 2);
  const cy = clamp(center.cy, hN / 2, 1 - hN / 2);
  const box = { x: cx - wN / 2, y: cy - hN / 2, w: wN, h: hN };

  const moveTo = (clientX, clientY) => {
    const el = areaRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const nx = (clientX - rect.left) / rect.width;
    const ny = (clientY - rect.top) / rect.height;
    setCenter({ cx: clamp(nx, 0, 1), cy: clamp(ny, 0, 1) });
  };

  const onPointerDown = (e) => {
    dragging.current = true;
    if (e.currentTarget.setPointerCapture) {
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
    }
    moveTo(e.clientX, e.clientY);
  };
  const onPointerMove = (e) => {
    if (!dragging.current) return;
    moveTo(e.clientX, e.clientY);
  };
  const onPointerUp = () => {
    dragging.current = false;
  };

  const apply = () => onApply({ x: box.x, y: box.y, w: box.w, h: box.h });
  const reset = () => {
    setZoom(1);
    setCenter({ cx: 0.5, cy: 0.5 });
  };

  return html`
    <div class="cropmodal" role="dialog" aria-modal="true" aria-label="使う範囲を選ぶ">
      <div class="cropmodal__sheet">
        <div class="cropmodal__head">
          <strong>使う範囲を選ぶ</strong>
          <span class="muted">枠は ${gridW}×${gridH} の比率です。ドラッグ（押したまま動かす）で位置を変え、スライダーで拡大できます。</span>
        </div>

        <div
          class="cropmodal__area"
          ref=${areaRef}
          style=${{ aspectRatio: `${imageW} / ${imageH}` }}
          onPointerDown=${onPointerDown}
          onPointerMove=${onPointerMove}
          onPointerUp=${onPointerUp}
          onPointerLeave=${onPointerUp}
        >
          <img class="cropmodal__img" src=${imageUrl} alt="元画像" draggable="false" />
          <div
            class="cropmodal__box"
            style=${`left:${box.x * 100}%;top:${box.y * 100}%;width:${box.w * 100}%;height:${box.h * 100}%`}
          ></div>
        </div>

        <div class="cropmodal__controls">
          <label class="cropmodal__zoom">
            <span class="muted">拡大</span>
            <input
              type="range"
              min="1"
              max="5"
              step="0.05"
              value=${zoom}
              onInput=${(e) => setZoom(Number(e.target.value))}
            />
          </label>
          <div class="cropmodal__btns">
            <button class="btn btn--ghost btn--sm" type="button" onClick=${reset}>全体に戻す</button>
            <button class="btn btn--ghost" type="button" onClick=${onCancel}>キャンセル</button>
            <button class="btn btn--primary" type="button" onClick=${apply}>この範囲で決定</button>
          </div>
        </div>
      </div>
    </div>
  `;
}
