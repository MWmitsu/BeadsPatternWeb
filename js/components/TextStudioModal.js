// ============================================================
// TextStudioModal: 文字をデザインしてビーズ図案にするモーダル
// ------------------------------------------------------------
// フォントを選び、並べ方を選び、1文字ずつ位置・大きさ・色・書体を調整できる。
// 入力した瞬間に横一列で綺麗に自動配置され（既定）、こだわりたい人だけ
// 「1文字ずつ調整」で深掘りできる（累進的開示）。
// プレビューは確定と同じ renderCompositionToCanvas を使う真のWYSIWYG。
// 確定すると最終PNGとグリッド寸法だけを親へ渡し、既存の変換パイプラインに乗せる。
// ============================================================

import { html, useState, useEffect, useRef, useMemo } from '../lib/html.js';
import { useModalA11y } from '../lib/useModal.js';
import { FONT_PRESETS, getFont } from '../data/textFonts.js';
import { renderCompositionToCanvas, splitGraphemes, NUDGE_STEP } from '../utils/textCompose.js';

const ARRANGES = [
  { key: 'row', label: '横ならべ' },
  { key: 'col', label: 'たてならべ' },
  { key: 'two', label: '2行' },
  { key: 'arch', label: 'アーチ' },
  { key: 'wave', label: 'なみ' },
];

const COLORS = ['#1F1F1F', '#E60026', '#FF8A00', '#FFD23F', '#4CAF50', '#1E88E5', '#5CC8F5', '#FF7DA8', '#8D5524', '#FFFFFF'];

const LONG_SIDES = [
  { v: 32, label: '小さめ' },
  { v: 48, label: 'ふつう' },
  { v: 64, label: '大きめ' },
];

const MAX_CHARS = 20;
// プレビューに足す余白(px)。ドラッグで文字を動かす余地（大きいほど端で見切れにくい）。
// 確定時の図案には付かない（apply は余白なしのtightで描く）。
const PREVIEW_MARGIN = 150;
// 1文字の移動量(段)の上限。矢印連打/ドラッグでキャンバスが無制限に巨大化して
// iPhoneでメモリ膨張・PNG生成失敗するのを防ぐ。
const NUDGE_LIMIT = 40;
const clampNudge = (v) => Math.max(-NUDGE_LIMIT, Math.min(NUDGE_LIMIT, v || 0));

export function TextStudioModal(props) {
  const { initialState = {}, onApply, onCancel, onPersist } = props;
  const sheetRef = useRef(null);
  useModalA11y(sheetRef, onCancel);
  // 開き直しても消えないよう、前回の設定(initialState)から初期化する
  const init = initialState || {};

  const [text, setText] = useState(init.text != null ? init.text : '');
  const [fontKey, setFontKey] = useState(init.fontKey || 'maru');
  const [bold, setBold] = useState(init.bold != null ? init.bold : true);
  const [arrange, setArrange] = useState(init.arrange || 'row');
  const [letterSpacing, setLetterSpacing] = useState(init.letterSpacing != null ? init.letterSpacing : 0); // -0.3 .. 0.6 (em)
  const [fontScale, setFontScale] = useState(init.fontScale != null ? init.fontScale : 1); // 0.7 .. 1.4
  const [lineGap, setLineGap] = useState(init.lineGap != null ? init.lineGap : 1.25); // 2行用
  const [curve, setCurve] = useState(init.curve != null ? init.curve : 0.45); // アーチ/なみ用 0..1
  const [globalColor, setGlobalColor] = useState(init.globalColor || '#1F1F1F');
  const [outlineOn, setOutlineOn] = useState(init.outlineOn != null ? init.outlineOn : false);
  const [outlineColor, setOutlineColor] = useState(init.outlineColor || '#FFFFFF');
  const [longSide, setLongSide] = useState(init.longSide || 48);
  const [whiteBg, setWhiteBg] = useState(init.whiteBg != null ? init.whiteBg : false);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [perChar, setPerChar] = useState(init.perChar || {}); // { [index]: { color?, dy?, dx?, sizeMul?, fontKey? } }
  const [fontsTick, setFontsTick] = useState(0); // 同梱フォント読み込み完了でプレビューを描き直す

  // 使用中フォント（全体＋個別）を読み込み、完了したらプレビューを再描画する。
  // webフォントは非同期読込なので、これが無いとcanvasが代替フォントのまま固まる。
  useEffect(() => {
    if (!document.fonts || !document.fonts.load) return;
    const fams = new Set([getFont(fontKey).family]);
    Object.values(perChar).forEach((o) => { if (o && o.fontKey) fams.add(getFont(o.fontKey).family); });
    let cancelled = false;
    fams.forEach((fam) => {
      if (!fam) return;
      document.fonts.load(`24px '${fam}'`, 'あいうえお国Aa0').then(() => {
        if (!cancelled) setFontsTick((t) => t + 1);
      }).catch(() => {});
    });
    return () => { cancelled = true; };
  }, [fontKey, perChar]);

  const previewRef = useRef(null);
  const geomRef = useRef({ boxes: [], W: 0, H: 0, originX: 0, originY: 0 });
  const prevTextRef = useRef(init.text != null ? init.text : '');
  const dragRef = useRef(null); // ドラッグ中: { index, lastX, lastY, frame }
  const compRef = useRef(null); // 最新の全設定スナップショット（閉じたとき親へ保存する）
  const [frameNonce, setFrameNonce] = useState(0); // ドラッグ終了で枠を解除して再描画
  const [revealed, setRevealed] = useState(() => new Set()); // 画面に出たフォントタイルだけ実フォントを読む
  const fontGridRef = useRef(null);

  // 見た目の1文字に分解（最大20字）。1レンダーにつき1回だけ分割する。
  const allGraphemes = useMemo(() => splitGraphemes(text), [text]);
  const graphemes = useMemo(() => allGraphemes.slice(0, MAX_CHARS), [allGraphemes]);
  const overLimit = allGraphemes.length > MAX_CHARS;

  // 継承を解決した描画用 chars
  const chars = useMemo(
    () =>
      graphemes.map((ch, i) => {
        const o = perChar[i] || {};
        return {
          ch,
          color: o.color != null ? o.color : globalColor,
          fontKey: o.fontKey != null ? o.fontKey : fontKey,
          dx: o.dx || 0,
          dy: o.dy || 0,
          sizeMul: o.sizeMul != null ? o.sizeMul : 1,
        };
      }),
    [graphemes, perChar, globalColor, fontKey]
  );

  const global = { bold, arrange, letterSpacing, fontScale, lineGap, curve, whiteBg, outline: { on: outlineOn, color: outlineColor } };
  // 空白だけ・空は「文字なし」とみなす（決定ボタンを無効化）
  const hasContent = graphemes.some((g) => g.trim() !== '');
  // 白い文字＋透明背景は完成イメージで見えにくいので注意を出す
  const whiteOnTransparent = !whiteBg && chars.some((c) => (c.color || '').toUpperCase() === '#FFFFFF');

  // 現在の全設定を毎レンダー記録（閉じたときにこれを親へ保存して、次回開いたとき復元する）
  compRef.current = { text, fontKey, bold, arrange, letterSpacing, fontScale, lineGap, curve, globalColor, outlineOn, outlineColor, longSide, whiteBg, perChar };

  // モーダル表示中は背面ページのスクロールを止める（iOSで背景が一緒に動かない）
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // 閉じたとき（キャンセル/×/決定いずれでも）最新の設定を親へ保存し、次回開いたとき復元する
  useEffect(() => () => { if (onPersist) onPersist(compRef.current); }, []);

  // 選択中の文字が範囲外になったら解除
  useEffect(() => {
    if (selectedIndex != null && selectedIndex >= graphemes.length) setSelectedIndex(null);
  }, [graphemes.length, selectedIndex]);

  // フォントタイルは「グリッドに見えている分だけ」実フォントを読み込む（多数のフォントを
  // 一度にダウンロードしないための遅延読込）。スクロールで近づいたものを順次読み込む。
  useEffect(() => {
    const grid = fontGridRef.current;
    if (!grid) return;
    const reveal = () => {
      const gr = grid.getBoundingClientRect();
      const m = 40; // 画面外でも少し近いものは先読み（多すぎる一括DLを避ける）
      const vis = [];
      grid.querySelectorAll('[data-fontkey]').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom >= gr.top - m && r.top <= gr.bottom + m) vis.push(el.getAttribute('data-fontkey'));
      });
      setRevealed((prev) => {
        let changed = false;
        const n = new Set(prev);
        vis.forEach((k) => { if (k && !n.has(k)) { n.add(k); changed = true; } });
        return changed ? n : prev; // 変化なしなら同じ参照を返し再描画しない
      });
    };
    reveal();
    const t1 = setTimeout(reveal, 60);
    const t2 = setTimeout(reveal, 300);
    grid.addEventListener('scroll', reveal, { passive: true });
    window.addEventListener('resize', reveal);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      grid.removeEventListener('scroll', reveal);
      window.removeEventListener('resize', reveal);
    };
  }, []);

  // プレビュー再描画（確定と同一レンダラ）
  useEffect(() => {
    const cv = previewRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    // ドラッグ中は枠を固定（文字を動かしてもキャンバスが揺れない）。通常は余白付きで描く。
    const opts = dragRef.current ? { frame: dragRef.current.frame } : { margin: PREVIEW_MARGIN };
    const res = renderCompositionToCanvas(chars, global, opts);
    if (!res) {
      cv.width = 16;
      cv.height = 16;
      ctx.clearRect(0, 0, 16, 16);
      geomRef.current = { boxes: [], W: 0, H: 0, originX: 0, originY: 0 };
      return;
    }
    cv.width = res.W;
    cv.height = res.H;
    // 透明背景は市松模様で分かるように
    if (!whiteBg) {
      const s = Math.max(6, Math.round(res.W / 28));
      for (let y = 0; y < res.H; y += s) {
        for (let x = 0; x < res.W; x += s) {
          ctx.fillStyle = ((x / s + y / s) % 2 === 0) ? '#f0f0f0' : '#ffffff';
          ctx.fillRect(x, y, s, s);
        }
      }
    }
    ctx.drawImage(res.canvas, 0, 0);
    geomRef.current = { boxes: res.boxes, W: res.W, H: res.H, originX: res.originX, originY: res.originY };
    if (selectedIndex != null && res.boxes[selectedIndex]) {
      const b = res.boxes[selectedIndex];
      ctx.save();
      ctx.strokeStyle = '#1aa37a';
      ctx.lineWidth = Math.max(2, res.W * 0.008);
      ctx.setLineDash([Math.max(5, res.W * 0.02), Math.max(4, res.W * 0.015)]);
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.restore();
    }
  }, [chars, bold, arrange, letterSpacing, fontScale, lineGap, curve, whiteBg, outlineOn, outlineColor, selectedIndex, fontsTick, frameNonce]);

  // プレビュー上のタップ＝文字を選択、そのままドラッグ＝その字を移動
  const onPreviewPointerDown = (e) => {
    const cv = previewRef.current;
    if (!cv) return;
    const rect = cv.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const px = (e.clientX - rect.left) * (cv.width / rect.width);
    const py = (e.clientY - rect.top) * (cv.height / rect.height);
    const g = geomRef.current;
    let hit = null;
    for (let i = 0; i < g.boxes.length; i++) {
      const b = g.boxes[i];
      // break しない: 重なり時は後に描いた（前面の）文字＝高index を選ぶ
      if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) hit = i;
    }
    setSelectedIndex(hit);
    if (hit != null) {
      // ドラッグ開始: いまの枠を固定して、文字を動かしてもキャンバスが揺れないようにする
      dragRef.current = {
        index: hit,
        lastX: e.clientX,
        lastY: e.clientY,
        frame: { W: g.W, H: g.H, originX: g.originX, originY: g.originY },
      };
      if (cv.setPointerCapture) { try { cv.setPointerCapture(e.pointerId); } catch (_) {} }
    }
  };

  const onPreviewPointerMove = (e) => {
    const d = dragRef.current;
    const cv = previewRef.current;
    if (!d || !cv) return;
    const rect = cv.getBoundingClientRect();
    if (!rect.width) return;
    const scaleX = cv.width / rect.width;
    const scaleY = cv.height / rect.height;
    // 画面上の移動量 → デザイン座標 px → ナッジ段（STEP単位）の連続値
    const ddx = ((e.clientX - d.lastX) * scaleX) / NUDGE_STEP;
    const ddy = ((e.clientY - d.lastY) * scaleY) / NUDGE_STEP;
    d.lastX = e.clientX;
    d.lastY = e.clientY;
    const i = d.index;
    setPerChar((pc) => {
      const cur = pc[i] || {};
      return { ...pc, [i]: { ...cur, dx: clampNudge((cur.dx || 0) + ddx), dy: clampNudge((cur.dy || 0) + ddy) } };
    });
  };

  const onPreviewPointerUp = () => {
    const d = dragRef.current;
    if (!d) return;
    const i = d.index;
    dragRef.current = null;
    // 指を離したら最寄りの0.5段にスナップして格子をそろえる
    setPerChar((pc) => {
      const cur = pc[i];
      if (!cur) return pc;
      const snap = (v) => Math.round((v || 0) * 2) / 2;
      return { ...pc, [i]: { ...cur, dx: snap(cur.dx), dy: snap(cur.dy) } };
    });
    setFrameNonce((n) => n + 1); // 枠を解除してぴったり寸法で描き直す
  };

  // 1文字の個別上書き
  const updateChar = (i, partial) =>
    setPerChar((pc) => ({ ...pc, [i]: { ...(pc[i] || {}), ...partial } }));
  const nudge = (i, dxStep, dyStep) => {
    const cur = perChar[i] || {};
    updateChar(i, { dx: clampNudge((cur.dx || 0) + dxStep), dy: clampNudge((cur.dy || 0) + dyStep) });
  };
  const resizeChar = (i, delta) => {
    const cur = perChar[i] || {};
    const v = Math.min(1.8, Math.max(0.5, Math.round(((cur.sizeMul != null ? cur.sizeMul : 1) + delta) * 10) / 10));
    updateChar(i, { sizeMul: v });
  };
  const resetChar = (i) =>
    setPerChar((pc) => {
      const next = { ...pc };
      delete next[i];
      return next;
    });

  // テキスト変更。個別調整(perChar)は index 基準なので、末尾の追記/削除なら
  // そのまま整合する＝温存し、途中の挿入/削除のときだけ調整と選択を解除して
  // 「別の字へ黙ってズレる」のを防ぐ。
  const onChangeText = (next) => {
    const before = splitGraphemes(prevTextRef.current).slice(0, MAX_CHARS);
    const after = splitGraphemes(next).slice(0, MAX_CHARS);
    let p = 0;
    while (p < before.length && p < after.length && before[p] === after[p]) p++;
    const pureTailEdit = p === before.length || p === after.length;
    if (!pureTailEdit) {
      setPerChar({});
      setSelectedIndex(null);
    }
    prevTextRef.current = next;
    setText(next);
  };

  const apply = async () => {
    // 確定前に使用中フォントの読み込みを待つ（最終PNGが代替フォントにならないように）
    try {
      if (document.fonts && document.fonts.load) {
        const fams = new Set([getFont(fontKey).family]);
        Object.values(perChar).forEach((o) => { if (o && o.fontKey) fams.add(getFont(o.fontKey).family); });
        await Promise.all([...fams].map((fam) => document.fonts.load(`24px '${fam}'`, text || 'あ').catch(() => {})));
      }
    } catch (_) { /* 読み込み失敗時もそのまま描画（代替フォント） */ }
    const res = renderCompositionToCanvas(chars, global);
    if (!res) return;
    const dataUrl = res.canvas.toDataURL('image/png');
    onApply({ dataUrl, W: res.W, H: res.H, longSide, whiteBg, text });
  };

  const sel = selectedIndex != null && selectedIndex < graphemes.length ? selectedIndex : null;
  const selChar = sel != null ? graphemes[sel] : '';
  const selOverride = sel != null ? (perChar[sel] || {}) : {};

  return html`
    <div class="textstudio" role="dialog" aria-modal="true" aria-label="文字をデザインする">
      <div class="textstudio__sheet" ref=${sheetRef}>
        <div class="textstudio__head">
          <strong>文字をデザインする</strong>
          <button class="textstudio__close" type="button" onClick=${onCancel} aria-label="閉じる">×</button>
        </div>

        <div class="textstudio__body">
          <!-- 入力 -->
          <div class="field">
            <input
              class="field textstudio__text"
              type="text"
              placeholder="例: あい / なまえ / LOVE"
              value=${text}
              onInput=${(e) => onChangeText(e.target.value)}
            />
            ${overLimit ? html`<p class="field__hint muted">文字は ${MAX_CHARS} 文字までです（多いとビーズが細かくなりすぎます）。</p>` : null}
          </div>

          <!-- プレビュー -->
          <div class="textstudio__preview">
            ${hasContent
              ? html`<canvas
                  ref=${previewRef}
                  class="textstudio__canvas"
                  onPointerDown=${onPreviewPointerDown}
                  onPointerMove=${onPreviewPointerMove}
                  onPointerUp=${onPreviewPointerUp}
                  onPointerCancel=${onPreviewPointerUp}
                ></canvas>`
              : html`<div class="textstudio__empty muted">ここに文字を入力すると、図案のプレビューが出ます。</div>`}
          </div>
          ${hasContent ? html`<p class="textstudio__tip muted">文字を<b>タップ</b>するとその字を調整できます。<b>そのまま指やマウスでドラッグ</b>すると、好きな位置へ動かせます。</p>` : null}

          <!-- 選択中の1文字の調整 -->
          ${sel != null &&
          html`
            <div class="textstudio__charedit">
              <div class="textstudio__charedit-head">
                <span class="badge">「${selChar}」を調整中</span>
                <button class="btn btn--ghost btn--sm" type="button" onClick=${() => resetChar(sel)}>この字をもとに戻す</button>
                <button class="btn btn--ghost btn--sm" type="button" onClick=${() => setSelectedIndex(null)}>選択をやめる</button>
              </div>
              <div class="textstudio__nudge">
                <span class="muted">うごかす</span>
                <div class="textstudio__nudge-pad">
                  <button class="btn btn--sm" type="button" title="上へ" onClick=${() => nudge(sel, 0, -1)}>↑</button>
                  <div class="textstudio__nudge-mid">
                    <button class="btn btn--sm" type="button" title="左へ" onClick=${() => nudge(sel, -1, 0)}>←</button>
                    <button class="btn btn--sm" type="button" title="右へ" onClick=${() => nudge(sel, 1, 0)}>→</button>
                  </div>
                  <button class="btn btn--sm" type="button" title="下へ" onClick=${() => nudge(sel, 0, 1)}>↓</button>
                </div>
                <span class="muted">大きさ</span>
                <div class="textstudio__size-btns">
                  <button class="btn btn--sm" type="button" onClick=${() => resizeChar(sel, -0.1)}>− 小さく</button>
                  <button class="btn btn--sm" type="button" onClick=${() => resizeChar(sel, 0.1)}>＋ 大きく</button>
                </div>
              </div>
              <div class="textstudio__charcolor">
                <span class="muted">この字の色</span>
                <div class="textstudio__swatches">
                  ${COLORS.map(
                    (c) => html`<button
                      key=${c}
                      class=${'textstudio__swatch' + (selOverride.color === c ? ' textstudio__swatch--on' : '')}
                      style=${`background:${c}`}
                      title=${c}
                      onClick=${() => updateChar(sel, { color: c })}
                    ></button>`
                  )}
                </div>
              </div>
              <div class="textstudio__charfont">
                <span class="muted">この字の書体</span>
                <select
                  class="settings__select"
                  value=${selOverride.fontKey != null ? selOverride.fontKey : ''}
                  onChange=${(e) => updateChar(sel, { fontKey: e.target.value || undefined })}
                >
                  <option value="">全体と同じ</option>
                  ${FONT_PRESETS.map((f) => html`<option key=${f.key} value=${f.key}>${f.label}</option>`)}
                </select>
              </div>
            </div>
          `}

          <div class="divider"></div>

          <!-- フォント選択 -->
          <div class="field">
            <span class="field__label">フォント（${FONT_PRESETS.length}種）</span>
            <div class="textstudio__tiles textstudio__font-tiles" ref=${fontGridRef}>
              ${FONT_PRESETS.map(
                (f) => html`<button
                  key=${f.key}
                  data-fontkey=${f.key}
                  class=${'textstudio__tile' + (fontKey === f.key ? ' textstudio__tile--on' : '')}
                  onClick=${() => setFontKey(f.key)}
                >
                  <span class="textstudio__tile-sample" style=${`font-family:${revealed.has(f.key) ? f.stack : 'sans-serif'};${f.forceBold ? 'font-weight:bold;' : ''}`}>${f.sample}</span>
                  <span class="textstudio__tile-label">${f.label}</span>
                </button>`
              )}
            </div>
          </div>

          <!-- 並べ方 -->
          <div class="field">
            <span class="field__label">並べ方</span>
            <div class="textstudio__tiles">
              ${ARRANGES.map(
                (a) => html`<button
                  key=${a.key}
                  class=${'textstudio__tile textstudio__tile--text' + (arrange === a.key ? ' textstudio__tile--on' : '')}
                  onClick=${() => setArrange(a.key)}
                >${a.label}</button>`
              )}
            </div>
          </div>

          <!-- スライダー類 -->
          <div class="field">
            <label class="field__row toggle">
              <input type="checkbox" checked=${bold} onChange=${(e) => setBold(e.target.checked)} />
              <span class="field__label">太字（ビーズで読みやすい）</span>
            </label>
          </div>

          <div class="field">
            <span class="field__label">文字の間隔</span>
            <div class="textstudio__slider">
              <span class="muted">つめる</span>
              <input type="range" min="-0.3" max="0.6" step="0.05" value=${letterSpacing} onInput=${(e) => setLetterSpacing(Number(e.target.value))} />
              <span class="muted">ひろげる</span>
            </div>
          </div>

          <div class="field">
            <span class="field__label">文字の大きさ</span>
            <div class="textstudio__slider">
              <span class="muted">小さめ</span>
              <input type="range" min="0.7" max="1.4" step="0.05" value=${fontScale} onInput=${(e) => setFontScale(Number(e.target.value))} />
              <span class="muted">大きめ</span>
            </div>
          </div>

          ${arrange === 'two' &&
          html`<div class="field">
            <span class="field__label">行の間隔</span>
            <div class="textstudio__slider">
              <span class="muted">せまく</span>
              <input type="range" min="0.9" max="2" step="0.05" value=${lineGap} onInput=${(e) => setLineGap(Number(e.target.value))} />
              <span class="muted">ひろく</span>
            </div>
          </div>`}

          ${(arrange === 'arch' || arrange === 'wave') &&
          html`<div class="field">
            <span class="field__label">カーブの強さ</span>
            <div class="textstudio__slider">
              <span class="muted">よわい</span>
              <input type="range" min="0" max="1" step="0.05" value=${curve} onInput=${(e) => setCurve(Number(e.target.value))} />
              <span class="muted">つよい</span>
            </div>
          </div>`}

          <!-- 全体の色 -->
          <div class="field">
            <span class="field__label">全体の色</span>
            <div class="textstudio__swatches">
              ${COLORS.map(
                (c) => html`<button
                  key=${c}
                  class=${'textstudio__swatch' + (globalColor === c ? ' textstudio__swatch--on' : '')}
                  style=${`background:${c}`}
                  title=${c}
                  onClick=${() => setGlobalColor(c)}
                ></button>`
              )}
            </div>
          </div>

          <!-- 縁取り -->
          <div class="field">
            <label class="field__row toggle">
              <input type="checkbox" checked=${outlineOn} onChange=${(e) => setOutlineOn(e.target.checked)} />
              <span class="field__label">ふちどりをつける（細い字が消えにくい）</span>
            </label>
            ${outlineOn &&
            html`<div class="textstudio__swatches">
              ${COLORS.map(
                (c) => html`<button
                  key=${c}
                  class=${'textstudio__swatch' + (outlineColor === c ? ' textstudio__swatch--on' : '')}
                  style=${`background:${c}`}
                  title=${c}
                  onClick=${() => setOutlineColor(c)}
                ></button>`
              )}
            </div>`}
          </div>

          <div class="divider"></div>

          <!-- 図案の大きさ -->
          <div class="field">
            <span class="field__label">図案の大きさ（ビーズの数）</span>
            <div class="textstudio__tiles">
              ${LONG_SIDES.map(
                (s) => html`<button
                  key=${s.v}
                  class=${'textstudio__tile textstudio__tile--text' + (longSide === s.v ? ' textstudio__tile--on' : '')}
                  onClick=${() => setLongSide(s.v)}
                >${s.label}<br /><span class="muted">${s.v}マス</span></button>`
              )}
            </div>
          </div>

          <!-- 背景 -->
          <div class="field">
            <span class="field__label">背景</span>
            <div class="field__row settings__radio-row">
              <label class="settings__radio">
                <input type="radio" name="ts-bg" checked=${!whiteBg} onChange=${() => setWhiteBg(false)} />
                <span>文字だけ（透明）</span>
              </label>
              <label class="settings__radio">
                <input type="radio" name="ts-bg" checked=${whiteBg} onChange=${() => setWhiteBg(true)} />
                <span>白い四角の中に文字</span>
              </label>
            </div>
            ${whiteOnTransparent &&
            html`<p class="field__hint warn">白い文字は「文字だけ（透明）」だと完成イメージで見えにくくなります。背景を「白い四角の中に文字」にするか、文字の色を変えてください。</p>`}
          </div>

          <div class="field">
            <button class="btn btn--ghost btn--sm" type="button" onClick=${() => { setPerChar({}); setSelectedIndex(null); }}>1文字ずつの調整をぜんぶ戻す</button>
          </div>
        </div>

        <div class="textstudio__foot">
          <button class="btn btn--ghost" type="button" onClick=${onCancel}>キャンセル</button>
          <button class="btn btn--primary" type="button" disabled=${!hasContent} onClick=${apply}>この図案にする</button>
        </div>
      </div>
    </div>
  `;
}
