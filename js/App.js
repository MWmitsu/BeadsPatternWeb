// ============================================================
// App: 全体の状態管理と結線(中央ハブ)
// ------------------------------------------------------------
// 画像 → 縮小 → 色判定 → 図案(pattern) の生成、表示モード切替、
// 手動編集(マス塗り/色編集/統合)、保存・読込・出力・印刷をまとめる。
// 子コンポーネントは表示と入力に専念し、ロジックはここに集約する。
// ============================================================

import { html, useState, useMemo, useRef, useEffect } from './lib/html.js';
import {
  DEFAULT_SETTINGS,
  WARN,
  BACKGROUND_COLOR_ID,
} from './types.js';
import { hexToRgb } from './utils/colorDistance.js';
import { estimateColorNameFromHex } from './utils/colorName.js';
import { pixelateToImageData } from './utils/pixelateImage.js';
import { detectBeadPattern, recountColors } from './utils/colorDetection.js';
import { renderPatternToCanvas } from './lib/renderPattern.js';
import {
  makeId,
  cellsToGrid,
  gridToCells,
  saveProject,
  loadProjects,
  loadProject,
  deleteProject,
  saveDraft,
  loadDraft,
  clearDraft,
} from './utils/storage.js';
import { ImageUploader } from './components/ImageUploader.js';
import { SettingsPanel } from './components/SettingsPanel.js';
import { BeadCanvas } from './components/BeadCanvas.js';
import { ColorPalette } from './components/ColorPalette.js';
import { ExportPanel } from './components/ExportPanel.js';
import { PrintView } from './components/PrintView.js';
import { ProjectList } from './components/ProjectList.js';
import { CropModal } from './components/CropModal.js';
import { ToolsPanel } from './components/ToolsPanel.js';
import { BeadListModal } from './components/BeadListModal.js';
import { BEAD_PALETTES } from './data/beadPalettes.js';
import { snapPatternToPalette } from './utils/beadMatch.js';
import { makePlateMask } from './utils/plateShape.js';
import {
  encodePatternToData,
  decodeDataToPattern,
  SHARE_HASH_KEY,
  estimateHashLength,
} from './utils/shareCodec.js';

/** 中央の表示モードタブ定義 */
const VIEW_MODES = [
  { key: 'finished', label: '完成イメージ' },
  { key: 'numbers', label: '数字付き設計図' },
  { key: 'grid', label: 'マス目' },
  { key: 'highlight', label: '色別に強調表示' },
  { key: 'compare', label: '元画像と比較' },
];

/** DEFAULT_SETTINGS のディープコピーを返す(初期化・リセット用) */
function freshSettings() {
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}

/** 寸法を 1〜400 の整数へ丸める */
function clampDim(v) {
  const n = Math.floor(Number(v) || 1);
  return Math.max(1, Math.min(400, n));
}

/** 画面幅に収まる初期セルサイズ(px)を算出。スマホでは小さく、PCでは最大520px相当。 */
function autoFitCellSize(patternWidth) {
  const vw = typeof window !== 'undefined' && window.innerWidth ? window.innerWidth : 520;
  const target = Math.min(520, Math.max(240, vw - 60));
  return Math.max(2, Math.min(20, Math.floor(target / patternWidth) || 2));
}

/**
 * 元画像を保存用に縮小したデータURL(JPEG)へ変換する。失敗時は null。
 * 自動保存(localStorage)やJSON書き出しの容量超過・肥大を防ぐ。
 * 図案は最大400マスなので長辺1280pxあれば再変換・切り抜きには十分。
 */
function downscaleImageToDataUrl(img, maxEdge) {
  try {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) return null;
    const scale = Math.min(1, maxEdge / Math.max(iw, ih));
    const dw = Math.max(1, Math.round(iw * scale));
    const dh = Math.max(1, Math.round(ih * scale));
    const c = document.createElement('canvas');
    c.width = dw;
    c.height = dh;
    c.getContext('2d').drawImage(img, 0, 0, dw, dh);
    return c.toDataURL('image/jpeg', 0.85);
  } catch (_) {
    return null;
  }
}

/**
 * cells から各色の count / ratio を再計算する(id は変えず、全色を残す)。
 * マス塗りや HEX/色名編集など「採番を変えたくない」編集で使う。
 */
function recomputeCounts(cells, colors) {
  const countById = new Map();
  let total = 0;
  for (const c of cells) {
    if (c.colorId === BACKGROUND_COLOR_ID) continue;
    total++;
    countById.set(c.colorId, (countById.get(c.colorId) || 0) + 1);
  }
  const newColors = colors.map((col) => {
    const count = countById.get(col.id) || 0;
    return {
      ...col,
      count,
      ratio: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    };
  });
  return { colors: newColors, totalBeads: total };
}

/** プレート形状の外側にあるビーズを背景化して返す(再集計込み)。変化が無ければ元を返す。 */
function maskOffShape(basePattern, shape) {
  if (!shape || shape === 'square') return basePattern;
  const mask = makePlateMask(shape, basePattern.width, basePattern.height);
  let changed = false;
  const cells = basePattern.cells.map((c) => {
    if (c.colorId !== BACKGROUND_COLOR_ID && mask[c.y * basePattern.width + c.x] === 0) {
      changed = true;
      return { ...c, colorId: BACKGROUND_COLOR_ID, hex: '' };
    }
    return c;
  });
  if (!changed) return basePattern;
  const { colors, totalBeads } = recomputeCounts(cells, basePattern.colors);
  return { ...basePattern, cells, colors, totalBeads };
}

/** 中央に置く最大の gridAR 矩形(px)を返す */
function coverRectPx(iw, ih, gridAR) {
  let sw = iw;
  let sh = iw / gridAR;
  if (sh > ih) {
    sh = ih;
    sw = ih * gridAR;
  }
  return { sx: (iw - sw) / 2, sy: (ih - sh) / 2, sw, sh };
}

/**
 * fitMode と crop から、pixelate に渡す src/dest 矩形を計算する。
 * stretch=全体を引き伸ばし / crop=比率維持で範囲切り抜き / contain=比率維持で全体を余白付きで収める
 */
function computeRects(image, w, h, fitMode, crop) {
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  const gridAR = w / h;

  if (fitMode === 'contain') {
    const scale = Math.min(w / iw, h / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    return {
      src: { sx: 0, sy: 0, sw: iw, sh: ih },
      dest: { dx: (w - dw) / 2, dy: (h - dh) / 2, dw, dh },
    };
  }

  if (fitMode === 'crop') {
    // 比率が大きくズレた古い crop は無視して自動カバーに切り替える(歪み防止)
    const cropAR = crop && crop.h > 0 ? (crop.w * iw) / (crop.h * ih) : 0;
    const valid =
      crop && crop.w > 0 && crop.h > 0 && Math.abs(cropAR - gridAR) < 0.05 * gridAR;
    const rect = valid
      ? { sx: crop.x * iw, sy: crop.y * ih, sw: crop.w * iw, sh: crop.h * ih }
      : coverRectPx(iw, ih, gridAR);
    return { src: rect, dest: { dx: 0, dy: 0, dw: w, dh: h } };
  }

  // stretch(既定)
  return { src: { sx: 0, sy: 0, sw: iw, sh: ih }, dest: { dx: 0, dy: 0, dw: w, dh: h } };
}

export function App() {
  // ---- 画像・図案 ----
  const [image, setImage] = useState(null); // HTMLImageElement(再変換用)
  const [originalUrl, setOriginalUrl] = useState(null); // 元画像のデータURL
  const [sourceImageName, setSourceImageName] = useState(null);
  const [pattern, setPattern] = useState(null); // DetectionResult

  // ---- 設定 ----
  const [settings, setSettings] = useState(freshSettings);

  // ---- 表示 ----
  const [viewMode, setViewMode] = useState('finished');
  const [cellSize, setCellSize] = useState(12);
  const [highlightColorId, setHighlightColorId] = useState(null);
  const [editColorId, setEditColorId] = useState(null);
  const [checkMode, setCheckMode] = useState(false); // 作業チェックモード
  const [doneSet, setDoneSet] = useState(() => new Set()); // 作業済みセルの index(y*width+x)
  const [activeTool, setActiveTool] = useState('pen'); // 'pen'|'eraser'|'eyedropper'|'bucket'
  const [mirrorX, setMirrorX] = useState(false); // 左右ミラー描画
  const [mirrorY, setMirrorY] = useState(false); // 上下ミラー描画
  const [history, setHistory] = useState({ past: [], future: [] }); // Undo/Redo

  // ---- プロジェクト ----
  const [title, setTitle] = useState('無題の図案');
  const [projects, setProjects] = useState(() => loadProjects());
  const [currentId, setCurrentId] = useState(null);
  const [createdAt, setCreatedAt] = useState(null);
  const draftIdRef = useRef(makeId());
  const draftWarnedRef = useRef(false); // 自動保存の容量超過を一度だけ通知するため

  // ---- UI 状態 ----
  const [converting, setConverting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [beadListOpen, setBeadListOpen] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const noticeTimer = useRef(null);

  const flash = (msg) => {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2500);
  };

  // ---- 変換(縮小 → 色判定) ----
  // img を直接受け取るので state 反映前でも実行できる(画像読込直後の自動変換に使う)。
  const convertWith = (img, st = settings) => {
    if (!img) return;
    setConverting(true);
    setError(null);
    // 「変換中…」表示を一度描画させてから重い処理に入る
    setTimeout(() => {
      try {
        const w = clampDim(st.width);
        const h = clampDim(st.height);
        const d = st.detection;
        // fitMode/crop に応じて元画像から使う範囲(src)と描画先(dest)を計算
        const rects = computeRects(img, w, h, st.fitMode || 'stretch', st.crop || null);
        const imageData = pixelateToImageData(img, w, h, {
          backgroundAsWhite: st.backgroundAsWhite,
          contrastCorrection: d.contrastCorrection,
          outlineEnhancement: d.outlineEnhancement,
          srcRect: rects.src,
          destRect: rects.dest,
        });
        const result = detectBeadPattern(imageData, {
          maxColors: d.maxColors,
          colorDistanceThreshold: d.colorDistanceThreshold,
          mergeMinorColors: d.mergeMinorColors,
          minorColorCountThreshold: d.minorColorCountThreshold,
          dithering: d.dithering,
          backgroundAsWhite: st.backgroundAsWhite,
        });
        setPattern(maskOffShape(result, st.plateShape));
        setCreatedAt(new Date().toISOString());
        setHighlightColorId(null);
        setEditColorId(null);
        setCheckMode(false);
        setDoneSet(new Set());
        setMirrorX(false);
        setMirrorY(false);
        setActiveTool('pen');
        clearHistory();
        setViewMode('finished');
        // 画面幅に収まるセルサイズへ自動フィット(スマホでは小さめ)
        setCellSize(autoFitCellSize(result.width));
        // スマホでは結果が設定群の下に隠れるため、変換後にプレビューへスクロール
        if (typeof window !== 'undefined' && window.innerWidth <= 820) {
          setTimeout(() => {
            const el = document.querySelector('.app__col--center');
            if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 60);
        }
      } catch (e) {
        setError('画像の変換に失敗しました' + (e && e.message ? '：' + e.message : '。'));
      } finally {
        setConverting(false);
      }
    }, 30);
  };

  const handleConvert = () => {
    if (!image) {
      setError('先に画像を読み込んでください。');
      return;
    }
    convertWith(image);
  };

  // ---- 画像読込 ----
  const handleImage = (payload) => {
    setImage(payload.image);
    // 保存用に縮小した画像をプレビュー/自動保存/書き出しに使う(容量超過・ファイル肥大を防ぐ)。
    // 変換そのものは元の高解像度 payload.image を使うので品質は落ちない。
    const storeUrl = downscaleImageToDataUrl(payload.image, 1280) || payload.dataUrl;
    setOriginalUrl(storeUrl);
    setSourceImageName(payload.name);
    setError(null);
    // タイトル未設定なら拡張子を除いたファイル名を入れる
    if (!title || title === '無題の図案') {
      const base = (payload.name || '').replace(/\.[^.]+$/, '');
      if (base) setTitle(base);
    }
    // 読み込んだら即変換して結果を見せる(設定を変えれば再変換できる)
    convertWith(payload.image);
  };

  // サンプル画像で試す(その場で簡単な絵を生成して読み込む)
  const handleSample = () => {
    try {
      // 高解像度(90の6倍)で描いてから縮小すると、境界がにじまずきれいに変換できる
      const S = 6;
      const c = document.createElement('canvas');
      c.width = 90 * S;
      c.height = 90 * S;
      const x = c.getContext('2d');
      x.scale(S, S);
      x.fillStyle = '#7ec8ff'; x.fillRect(0, 0, 90, 90);        // 空
      x.fillStyle = '#7ccf6a'; x.fillRect(0, 62, 90, 28);       // 地面
      x.fillStyle = '#ffd93d'; x.beginPath(); x.arc(70, 20, 12, 0, Math.PI * 2); x.fill(); // 太陽
      x.fillStyle = '#e6396b'; x.beginPath();                   // ハート
      x.moveTo(42, 66); x.bezierCurveTo(10, 44, 20, 20, 42, 34); x.bezierCurveTo(64, 20, 74, 44, 42, 66); x.fill();
      const url = c.toDataURL('image/png');
      const img = new Image();
      img.onload = () =>
        handleImage({ image: img, dataUrl: url, name: 'サンプル.png', width: img.naturalWidth, height: img.naturalHeight });
      img.src = url;
    } catch (e) {
      setError('サンプル画像の生成に失敗しました。');
    }
  };

  // 範囲選択モーダルを開く / 適用する
  const openCrop = () => {
    if (!image) { setError('範囲を調整するには、先に画像を選んでください。'); return; }
    setCropOpen(true);
  };
  const applyCropFromModal = (crop) => {
    const next = { ...settings, fitMode: 'crop', crop };
    setSettings(next);
    setCropOpen(false);
    if (image) convertWith(image, next);
  };

  // ---- Undo/Redo 履歴(コンパクトなスナップショット) ----
  const snapshotPattern = () => ({
    w: pattern.width,
    h: pattern.height,
    grid: cellsToGrid(pattern.cells, pattern.width, pattern.height),
    colors: pattern.colors.map((c) => ({ ...c })),
    sw: settings.width,
    sh: settings.height,
    done: Array.from(doneSet),
  });
  const restoreSnapshot = (snap) => {
    const cells = gridToCells(snap.grid, snap.w, snap.h, snap.colors);
    const { colors, totalBeads } = recomputeCounts(cells, snap.colors);
    setPattern({
      width: snap.w,
      height: snap.h,
      colors,
      cells,
      totalBeads,
      backgroundCount: snap.w * snap.h - totalBeads,
    });
    // 回転などで設定寸法も変わっていた場合は連動して戻す
    if (snap.sw != null && (snap.sw !== settings.width || snap.sh !== settings.height)) {
      setSettings((s) => ({ ...s, width: snap.sw, height: snap.sh }));
      setCellSize(autoFitCellSize(snap.w));
    }
    // 図案と一緒に作業チェックも当時の状態へ戻す(回転Undo時のズレ防止)
    setDoneSet(new Set(snap.done || []));
  };
  // 編集の直前に呼ぶ。現状を past へ積み future を捨てる。
  const pushHistory = () => {
    if (!pattern) return;
    const snap = snapshotPattern();
    setHistory((hst) => ({ past: [...hst.past.slice(-29), snap], future: [] }));
  };
  const clearHistory = () => setHistory({ past: [], future: [] });
  const undo = () => {
    if (!pattern || history.past.length === 0) return;
    const prev = history.past[history.past.length - 1];
    const cur = snapshotPattern();
    restoreSnapshot(prev);
    setHistory({ past: history.past.slice(0, -1), future: [cur, ...history.future].slice(0, 30) });
  };
  const redo = () => {
    if (!pattern || history.future.length === 0) return;
    const next = history.future[0];
    const cur = snapshotPattern();
    restoreSnapshot(next);
    setHistory({ past: [...history.past, cur].slice(-30), future: history.future.slice(1) });
  };

  // ---- 描画(ドラッグ・ミラー対応): ペン / 消しゴム ----
  const applyMirror = (cellList) => {
    if (!pattern || (!mirrorX && !mirrorY)) return cellList;
    const W = pattern.width;
    const H = pattern.height;
    const out = [];
    for (const { x, y } of cellList) {
      out.push({ x, y });
      if (mirrorX) out.push({ x: W - 1 - x, y });
      if (mirrorY) out.push({ x, y: H - 1 - y });
      if (mirrorX && mirrorY) out.push({ x: W - 1 - x, y: H - 1 - y });
    }
    return out;
  };
  const handleDraw = (cellList, erase) => {
    if (!pattern || !cellList || !cellList.length) return;
    let colorId;
    let hex;
    if (erase) {
      colorId = BACKGROUND_COLOR_ID;
      hex = '';
    } else {
      if (editColorId == null) return;
      const color = pattern.colors.find((c) => c.id === editColorId);
      if (!color) return;
      colorId = editColorId;
      hex = color.hex;
    }
    const W = pattern.width;
    const H = pattern.height;
    const cells = pattern.cells.slice();
    let changed = false;
    for (const { x, y } of applyMirror(cellList)) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const idx = y * W + x;
      if (plateMask && plateMask[idx] === 0) continue; // 形状外には置けない
      if (cells[idx].colorId !== colorId) {
        cells[idx] = { x, y, colorId, hex };
        changed = true;
      }
    }
    if (!changed) return;
    const { colors, totalBeads } = recomputeCounts(cells, pattern.colors);
    setPattern({ ...pattern, cells, colors, totalBeads });
  };

  // ---- 塗りつぶし(バケツ・4連結フラッドフィル) ----
  const handleBucketFill = (sx, sy) => {
    if (editColorId == null || !pattern) return;
    const color = pattern.colors.find((c) => c.id === editColorId);
    if (!color) return;
    const W = pattern.width;
    const H = pattern.height;
    const cells = pattern.cells.slice();
    const target = cells[sy * W + sx].colorId;
    if (target === editColorId) return;
    const seen = new Uint8Array(W * H);
    const stack = [[sx, sy]];
    const region = [];
    while (stack.length) {
      const [x, y] = stack.pop();
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const idx = y * W + x;
      if (seen[idx]) continue;
      seen[idx] = 1;
      if (plateMask && plateMask[idx] === 0) continue; // 形状外は境界扱い
      if (cells[idx].colorId !== target) continue;
      region.push({ x, y });
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    let changed = false;
    for (const { x, y } of applyMirror(region)) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const idx = y * W + x;
      if (plateMask && plateMask[idx] === 0) continue; // 形状外には置けない
      if (cells[idx].colorId !== editColorId) {
        cells[idx] = { x, y, colorId: editColorId, hex: color.hex };
        changed = true;
      }
    }
    if (!changed) return;
    const { colors, totalBeads } = recomputeCounts(cells, pattern.colors);
    setPattern({ ...pattern, cells, colors, totalBeads });
  };

  // ---- スポイト(色抽出) ----
  const handleEyedrop = (x, y) => {
    if (!pattern) return;
    const cid = pattern.cells[y * pattern.width + x].colorId;
    if (cid === BACKGROUND_COLOR_ID) {
      setActiveTool('eraser');
      setCheckMode(false);
    } else {
      setEditColorId(cid);
      setCheckMode(false);
      setActiveTool('pen');
    }
  };

  // ---- 変形(反転・回転) ----
  const transformPattern = (mapFn, newW, newH) => {
    if (!pattern) return;
    pushHistory();
    const W = pattern.width;
    const H = pattern.height;
    const src = pattern.cells;
    const out = new Array(newW * newH);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const [nx, ny] = mapFn(x, y, W, H);
        const s = src[y * W + x];
        out[ny * newW + nx] = { x: nx, y: ny, colorId: s.colorId, hex: s.hex };
      }
    }
    let next = maskOffShape({ ...pattern, width: newW, height: newH, cells: out }, settings.plateShape);
    const { colors, totalBeads } = recomputeCounts(next.cells, next.colors);
    setPattern({ ...next, colors, totalBeads });
    if (newW !== pattern.width || newH !== pattern.height) {
      setSettings((s) => ({ ...s, width: newW, height: newH }));
      setCellSize(autoFitCellSize(newW));
    }
    // 作業チェックも同じ写像で追従させる
    const newDone = new Set();
    for (const idx of doneSet) {
      const oy = Math.floor(idx / W);
      const ox = idx % W;
      const [nx, ny] = mapFn(ox, oy, W, H);
      newDone.add(ny * newW + nx);
    }
    setDoneSet(newDone);
    setHighlightColorId(null);
  };
  const handleFlipH = () => transformPattern((x, y, W) => [W - 1 - x, y], pattern.width, pattern.height);
  const handleFlipV = () => transformPattern((x, y, W, H) => [x, H - 1 - y], pattern.width, pattern.height);
  const handleRotate = () => transformPattern((x, y, W, H) => [H - 1 - y, x], pattern.height, pattern.width);

  // ---- 色のHEX/色名編集 ----
  const handleEditColor = (id, patch) => {
    if (!pattern) return;
    pushHistory();
    const colors = pattern.colors.map((c) => {
      if (c.id !== id) return c;
      const next = { ...c, ...patch };
      if (patch.hex) {
        next.rgb = hexToRgb(patch.hex);
        // 色コード/ピッカーで色を変えたら色名も推定名に追従(名前を同時指定したときは尊重)
        if (patch.name == null) next.name = estimateColorNameFromHex(patch.hex);
      }
      return next;
    });
    let cells = pattern.cells;
    if (patch.hex) {
      cells = pattern.cells.map((cell) =>
        cell.colorId === id ? { ...cell, hex: patch.hex } : cell
      );
    }
    setPattern({ ...pattern, colors, cells });
  };

  // ---- 2色の統合(再採番あり) ----
  const handleMergeColors = (fromId, toId) => {
    if (!pattern || fromId === toId) return;
    const target = pattern.colors.find((c) => c.id === toId);
    if (!target) return;
    pushHistory();
    const merged = pattern.cells.map((cell) =>
      cell.colorId === fromId
        ? { ...cell, colorId: toId, hex: target.hex }
        : cell
    );
    const res = recountColors(merged, pattern.colors);
    setPattern({
      ...pattern,
      cells: res.cells,
      colors: res.colors,
      totalBeads: res.totalBeads,
    });
    // 採番が変わるためハイライト/塗り色の選択は解除
    setHighlightColorId(null);
    setEditColorId(null);
  };

  // ---- 色別ハイライト ----
  const handleHighlight = (colorId) => {
    setHighlightColorId(colorId);
    if (colorId != null) setViewMode('highlight');
    else if (viewMode === 'highlight') setViewMode('finished');
  };

  // ---- 作業チェック(ドラッグ対応) ----
  const handleSetDone = (cellList, markDone) => {
    if (!pattern || !cellList || !cellList.length) return;
    const next = new Set(doneSet);
    let changed = false;
    for (const { x, y } of cellList) {
      if (x < 0 || y < 0 || x >= pattern.width || y >= pattern.height) continue;
      const idx = y * pattern.width + x;
      if (pattern.cells[idx].colorId === BACKGROUND_COLOR_ID) continue; // ビーズの無いマスはチェック対象外
      if (markDone) {
        if (!next.has(idx)) { next.add(idx); changed = true; }
      } else if (next.has(idx)) {
        next.delete(idx);
        changed = true;
      }
    }
    if (changed) setDoneSet(next);
  };
  const handleMarkHighlightDone = (markDone) => {
    if (!pattern || highlightColorId == null) return;
    const next = new Set(doneSet);
    for (const cell of pattern.cells) {
      if (cell.colorId === highlightColorId) {
        const idx = cell.y * pattern.width + cell.x;
        if (markDone) next.add(idx);
        else next.delete(idx);
      }
    }
    setDoneSet(next);
  };
  const handleResetDone = () => setDoneSet(new Set());

  // 作業モードと塗りモードは排他(同時に両方アクティブにしない)
  const toggleCheckMode = () => {
    setCheckMode((v) => !v);
    setEditColorId(null);
  };
  const selectEditColor = (id) => {
    setEditColorId(id);
    // 塗り色を選んだら必ずペンに戻す(消しゴム/スポイトのまま塗って消える事故を防ぐ)
    if (id != null) { setCheckMode(false); setActiveTool('pen'); }
  };

  // ---- 検出色を市販ビーズ色へスナップ ----
  const handleSnapToBeads = () => {
    if (!pattern) return;
    const pal = BEAD_PALETTES.find((p) => p.id === settings.beadPaletteId);
    if (!pal) {
      setError('「ビーズ色」で、標準／パーラー／ハマのいずれかを選んでください。');
      return;
    }
    pushHistory();
    const res = snapPatternToPalette(pattern.cells, pattern.colors, pal.colors);
    setPattern({ ...pattern, cells: res.cells, colors: res.colors, totalBeads: res.totalBeads });
    setHighlightColorId(null);
    setEditColorId(null);
    setDoneSet(new Set());
    flash(`市販ビーズ色（${pal.name}）に合わせました。`);
  };

  // ---- 共有: 画像(Web Share / フォールバックでダウンロード) ----
  const handleShareImage = () => {
    if (!pattern) {
      setError('共有する図案がありません。');
      return;
    }
    // 共有/出力用の完成イメージは「丸ビーズ風」や空ペグ点を含めず、ベタ塗りのクリアな画像にする
    const canvas = renderPatternToCanvas(pattern, {
      cellSize: 12,
      showGrid: false,
      showNumbers: false,
    });
    canvas.toBlob((blob) => {
      if (!blob) return;
      // タイトルに / : * ? 等が含まれてもファイル名が壊れないようにする
      const safeTitle = String(title || '').replace(/[\\/:*?"<>|]/g, '_').trim() || 'beads';
      const fname = safeTitle + '.png';
      const file = new File([blob], fname, { type: 'image/png' });
      const downloadFallback = () => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fname;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 0);
        flash('画像を保存しました。');
      };
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator
          .share({ files: [file], title: title || 'アイロンビーズ図案' })
          .catch((err) => {
            // ユーザーが共有をキャンセル(AbortError)した場合は何もしない。
            // それ以外の失敗時はダウンロードにフォールバック。
            if (!err || err.name !== 'AbortError') downloadFallback();
          });
        return;
      }
      downloadFallback();
    }, 'image/png');
  };

  // ---- 共有: リンク(図案をURLに埋め込む。サーバ不要) ----
  const handleShareLink = () => {
    if (!pattern) {
      setError('共有する図案がありません。');
      return;
    }
    const grid = cellsToGrid(pattern.cells, pattern.width, pattern.height);
    const data = encodePatternToData({
      width: pattern.width,
      height: pattern.height,
      title,
      colors: pattern.colors.map((c) => c.hex),
      grid,
    });
    if (estimateHashLength(data) > 14000) {
      setError('図案が大きいため、共有リンクが長くなりすぎます。「画像を共有」をご利用ください。');
      return;
    }
    const url = location.origin + location.pathname + '#' + SHARE_HASH_KEY + '=' + data;
    const ok = () => flash('共有リンクをコピーしました。メールやSNSに貼り付けて送れます。');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(ok).catch(() => window.prompt('このリンクをコピーしてください', url));
    } else {
      window.prompt('このリンクをコピーしてください', url);
    }
  };

  // ---- 共有データ(URLハッシュ)を図案へ復元 ----
  const applySharedData = (data) => {
    const { width, height, title: t, colors: hexes, grid } = data;
    if (
      !Array.isArray(hexes) ||
      !Array.isArray(grid) ||
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width < 1 ||
      height < 1 ||
      width > 400 ||
      height > 400 ||
      grid.length !== width * height
    ) {
      setError('共有データを読み込めませんでした。');
      return;
    }
    // grid の色番号が範囲外(改ざん/破損)なら拒否する(背景=0, 有効色=1..色数)
    for (let i = 0; i < grid.length; i++) {
      const v = grid[i];
      if (!Number.isInteger(v) || v < 0 || v > hexes.length) {
        setError('共有データを読み込めませんでした。');
        return;
      }
    }
    const colors = hexes.map((hex, i) => ({
      id: i + 1,
      hex,
      rgb: hexToRgb(hex),
      name: estimateColorNameFromHex(hex),
      count: 0,
      ratio: 0,
    }));
    const cells = gridToCells(grid, width, height, colors);
    const { colors: rc, totalBeads } = recomputeCounts(cells, colors);
    setPattern({ width, height, colors: rc, cells, totalBeads, backgroundCount: width * height - totalBeads });
    setTitle(t || '無題の図案');
    setImage(null);
    setOriginalUrl(null);
    setSourceImageName(null);
    setCurrentId(null);
    setCreatedAt(new Date().toISOString());
    setHighlightColorId(null);
    setEditColorId(null);
    setCheckMode(false);
    setDoneSet(new Set());
    setMirrorX(false);
    setMirrorY(false);
    setActiveTool('pen');
    clearHistory();
    setViewMode('finished');
    setCellSize(autoFitCellSize(width));
  };

  // 起動時: URLハッシュに共有図案があれば読み込む
  useEffect(() => {
    const h = window.location.hash || '';
    const key = '#' + SHARE_HASH_KEY + '=';
    if (h.startsWith(key)) {
      const data = decodeDataToPattern(h.slice(key.length));
      if (data) {
        applySharedData(data);
        flash('共有された図案を読み込みました。');
      }
      // 再読み込みで再適用されないようハッシュを消す
      try {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      } catch (_) {}
    } else {
      // 共有リンクが無ければ、前回の自動保存(ドラフト)を復元
      const draft = loadDraft();
      if (draft && Array.isArray(draft.grid) && Array.isArray(draft.colors)) {
        applyLoaded(draft, { sourceImageUrl: draft.thumbnail });
        flash('前回の続きを復元しました。');
      }
    }
    // eslint-disable-next-line
  }, []);

  // 自動保存(ドラフト): 図案/設定/作業状況の変更を少し遅延して保存
  useEffect(() => {
    if (!pattern) return;
    const id = setTimeout(() => {
      let ok = true;
      try {
        ok = saveDraft(buildProjectBase(false));
      } catch (_) {
        ok = false;
      }
      // 容量超過などで自動保存できないときは、一度だけ知らせる(静かに消えるのを防ぐ)
      if (ok === false && !draftWarnedRef.current) {
        draftWarnedRef.current = true;
        flash('自動保存できませんでした（端末の保存容量が不足の可能性）。大切な図案は「ファイルに書き出す」で保存してください。');
      }
    }, 800);
    return () => clearTimeout(id);
    // eslint-disable-next-line
  }, [pattern, settings, title, doneSet]);

  // キーボードショートカット: Ctrl/Cmd+Z で取り消し、Ctrl+Shift+Z / Ctrl+Y でやり直し
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const k = (e.key || '').toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // プレート形状を変えたら現在の図案にマスクを適用する(手動編集は保持・Undo可)。
  // 元画像からきれいに作り直したい場合は「画像から変換」を押す。
  useEffect(() => {
    if (!pattern) return;
    const masked = maskOffShape(pattern, settings.plateShape);
    if (masked !== pattern) {
      pushHistory();
      setPattern(masked);
      // 形状外になったマスの作業チェックを取り除く(進捗が総数を超えないように)
      const mask = makePlateMask(settings.plateShape, masked.width, masked.height);
      setDoneSet((prev) => {
        const next = new Set();
        for (const idx of prev) {
          if (mask[idx] !== 0) next.add(idx);
        }
        return next;
      });
    }
    // eslint-disable-next-line
  }, [settings.plateShape]);

  // ---- プロジェクト構築 ----
  const buildProjectBase = (withThumbnail) => {
    const id = currentId || draftIdRef.current;
    const grid = cellsToGrid(pattern.cells, pattern.width, pattern.height);
    let thumbnail = originalUrl || undefined;
    if (withThumbnail) {
      try {
        const cs =
          Math.max(1, Math.floor(140 / Math.max(pattern.width, pattern.height))) || 1;
        thumbnail = renderPatternToCanvas(pattern, {
          cellSize: cs,
          showGrid: false,
          showNumbers: false,
        }).toDataURL('image/png');
      } catch (_) {
        /* サムネ生成失敗は無視 */
      }
    }
    const now = new Date().toISOString();
    return {
      id,
      title: title || '無題の図案',
      sourceImageName: sourceImageName || '',
      width: pattern.width,
      height: pattern.height,
      totalBeads: pattern.totalBeads,
      colors: pattern.colors,
      grid,
      settings,
      thumbnail,
      done: Array.from(doneSet),
      createdAt: createdAt || now,
      updatedAt: now,
    };
  };

  // JSON保存ボタン用(サムネ無しの軽量版を毎レンダーで作らないようメモ化)
  const project = useMemo(
    () => (pattern ? buildProjectBase(false) : null),
    // eslint-disable-next-line
    [pattern, settings, title, currentId, sourceImageName, createdAt, doneSet]
  );

  // ---- localStorage 保存 ----
  const handleSaveLocal = () => {
    if (!pattern) {
      setError('保存する図案がありません。先に画像を変換してください。');
      return;
    }
    const proj = buildProjectBase(true);
    const res = saveProject(proj);
    if (res.ok) {
      setCurrentId(proj.id);
      draftIdRef.current = proj.id;
      setProjects(loadProjects());
      flash('このブラウザに保存しました。');
    } else {
      setError(res.error || '保存に失敗しました。');
    }
  };

  // ---- 読み込んだ/インポートしたデータを反映 ----
  const applyLoaded = (obj, opts = {}) => {
    try {
      if (
        !obj ||
        !Array.isArray(obj.colors) ||
        !obj.colors.every((c) => c && Number.isInteger(c.id) && typeof c.hex === 'string') ||
        !Array.isArray(obj.grid) ||
        !Number.isInteger(obj.width) ||
        !Number.isInteger(obj.height) ||
        obj.width < 1 ||
        obj.height < 1 ||
        obj.width > 400 ||
        obj.height > 400 ||
        obj.grid.length !== obj.width * obj.height
      ) {
        setError('読み込んだデータの形式が正しくありません。');
        return;
      }
      const cells = gridToCells(obj.grid, obj.width, obj.height, obj.colors);
      const { colors, totalBeads } = recomputeCounts(cells, obj.colors);
      setPattern({
        width: obj.width,
        height: obj.height,
        colors,
        cells,
        totalBeads,
        backgroundCount: obj.width * obj.height - totalBeads,
      });
      setSettings(obj.settings ? { ...freshSettings(), ...obj.settings } : freshSettings());
      setTitle(obj.title || '無題の図案');
      setCurrentId(obj.id || null);
      if (obj.id) draftIdRef.current = obj.id;
      setSourceImageName(obj.sourceImageName || null);
      setOriginalUrl(obj.thumbnail || null);
      setCreatedAt(obj.createdAt || new Date().toISOString());
      // 復元時も元画像を作り直し、範囲調整(切り抜き)・再変換を使えるようにする。
      // ドラフト/JSON書き出しには元画像が入っているので復元できる(保存図案はサムネのみで不可)。
      const srcUrl = opts.sourceImageUrl || null;
      if (srcUrl) {
        const srcImg = new Image();
        srcImg.onload = () => setImage(srcImg);
        srcImg.onerror = () => setImage(null);
        srcImg.src = srcUrl;
      } else {
        setImage(null); // 元画像が無い(保存図案など)場合は持ち越さない
      }
      setHighlightColorId(null);
      setEditColorId(null);
      setCheckMode(false);
      setDoneSet(new Set(Array.isArray(obj.done) ? obj.done : []));
      setMirrorX(false);
      setMirrorY(false);
      setActiveTool('pen');
      clearHistory();
      setViewMode('finished');
      setCellSize(autoFitCellSize(obj.width));
      setError(null);
    } catch (e) {
      setError('読み込みに失敗しました。');
    }
  };

  const handleLoadProject = (id) => {
    const p = loadProject(id);
    if (!p) {
      setError('対象の図案が見つかりませんでした。');
      return;
    }
    applyLoaded(p);
    flash('図案を読み込みました。');
  };

  const handleDeleteProject = (id) => {
    deleteProject(id);
    setProjects(loadProjects());
    if (currentId === id) setCurrentId(null);
  };

  const handleOpenPrint = () => {
    if (!pattern) {
      setError('印刷する図案がありません。先に画像を変換してください。');
      return;
    }
    setPrinting(true);
  };

  // ---- 派生値 ----
  const warnings = useMemo(() => {
    const list = [];
    const beads = settings.width * settings.height;
    if (settings.width > WARN.maxDimension || settings.height > WARN.maxDimension) {
      list.push(`横ビーズ数・縦ビーズ数は${WARN.maxDimension}マス以下をおすすめします（大きすぎると動作が重くなります）。`);
    }
    if (beads > WARN.hugeBeadCount) {
      list.push('マス数が非常に多く、変換・表示・印刷が重くなる可能性があります。');
    } else if (beads > WARN.largeBeadCount) {
      list.push('マス数が多めです。動作が重い場合はサイズを下げてください。');
    }
    if (settings.detection.maxColors >= WARN.manyColors) {
      list.push('色数が多いほど元画像に近づきますが、アイロンビーズ制作は難しくなります。');
    }
    if (settings.detection.maxColors <= WARN.fewColors) {
      list.push('色数が少ないと、元画像と大きく変わって見えることがあります。');
    }
    return list;
  }, [settings.width, settings.height, settings.detection.maxColors]);

  const editColorLabel = useMemo(() => {
    if (editColorId == null || !pattern) return '';
    const c = pattern.colors.find((c) => c.id === editColorId);
    return c ? `${c.id}: ${c.name || c.hex}` : '';
  }, [editColorId, pattern]);

  const colors = pattern ? pattern.colors : [];
  const totalBeads = pattern ? pattern.totalBeads : 0;
  const exportPattern = pattern ? { ...pattern, title: title || '無題の図案' } : null;
  const beadPalette = BEAD_PALETTES.find((p) => p.id === settings.beadPaletteId) || null;
  const beadPaletteColors = beadPalette ? beadPalette.colors : null;
  const doneCount = doneSet.size;
  const plateMask = useMemo(
    () =>
      pattern && settings.plateShape && settings.plateShape !== 'square'
        ? makePlateMask(settings.plateShape, pattern.width, pattern.height)
        : null,
    [settings.plateShape, pattern ? pattern.width : 0, pattern ? pattern.height : 0]
  );

  return html`
    <div class="app">
      <header class="app__header">
        <div class="app__brand">
          <img class="app__logo" src="icons/icon.svg" alt="" width="32" height="32" />
          <h1 class="app__brand-title">アイロンビーズ図案メーカー</h1>
        </div>
        <label class="app__title-field">
          <span class="muted">図案タイトル</span>
          <input
            type="text"
            value=${title}
            placeholder="無題の図案"
            onInput=${(e) => setTitle(e.target.value)}
          />
        </label>
      </header>

      ${error &&
      html`
        <div class="banner banner--error">
          <span>${error}</span>
          <button class="banner__close" type="button" onClick=${() => setError(null)}>×</button>
        </div>
      `}
      ${notice && html`<div class="banner banner--success"><span>${notice}</span></div>`}

      <main class="app__main">
        <!-- 左カラム -->
        <div class="app__col app__col--left">
          <details class="help">
            <summary class="help__summary">はじめての方へ（使い方）</summary>
            <ol class="help__steps">
              <li>「画像を選ぶ」で写真を読み込みます（または<b>「サンプルで試す」</b>）。</li>
              <li>横ビーズ数・縦ビーズ数と最大色数を決めて<b>「画像から変換」</b>を押します。</li>
              <li>比率が違う写真は<b>「画像の合わせ方」</b>で、引き伸ばす／切り抜くを選べます。</li>
              <li>右の色一覧で色番号を確認します。色番号をクリックすると、その色だけ強調表示できます。印刷や、画像（PNG）・一覧データ（CSV／表計算ソフトで開けます）の保存もできます。</li>
              <li><b>「制作・共有ツール」</b>で、市販ビーズ色の目安・必要数・作業チェック・共有が使えます。</li>
            </ol>
          </details>
          <${ImageUploader}
            onImage=${handleImage}
            originalUrl=${originalUrl}
            sourceImageName=${sourceImageName}
            onError=${setError}
            onSample=${handleSample}
          />
          <${SettingsPanel}
            settings=${settings}
            onChange=${setSettings}
            onConvert=${handleConvert}
            converting=${converting}
            canConvert=${!!image}
            canCrop=${!!image}
            onOpenCrop=${openCrop}
            warnings=${warnings}
          />
          <${ExportPanel}
            pattern=${exportPattern}
            colors=${colors}
            project=${project}
            onSaveLocal=${handleSaveLocal}
            onOpenPrint=${handleOpenPrint}
            onImportProject=${(obj) => applyLoaded(obj, { sourceImageUrl: obj && obj.thumbnail })}
            disabled=${!pattern}
            bufferPercent=${settings.bufferPercent}
            beadPaletteColors=${beadPaletteColors}
          />
          <${ProjectList}
            projects=${projects}
            currentId=${currentId}
            onLoad=${handleLoadProject}
            onDelete=${handleDeleteProject}
          />
        </div>

        <!-- 中央カラム -->
        <div class="app__col app__col--center">
          <div class="viewmode">
            ${VIEW_MODES.map(
              (m) => html`
                <button
                  key=${m.key}
                  type="button"
                  class=${'viewmode__tab' + (viewMode === m.key ? ' viewmode__tab--active' : '')}
                  onClick=${() => setViewMode(m.key)}
                >
                  ${m.label}
                </button>
              `
            )}
          </div>

          ${editColorId != null &&
          html`
            <div class="edit-hint">
              <span>🖌 塗りモード：ドラッグ（押したまま動かす）でまとめて <b>${editColorLabel}</b> に塗れます。</span>
              <button class="btn btn--sm btn--ghost" type="button" onClick=${() => setEditColorId(null)}>
                やめる
              </button>
            </div>
          `}

          ${checkMode &&
          html`
            <div class="edit-hint edit-hint--check">
              <span>✓ 作業チェック：ドラッグでまとめてチェック／解除できます（${doneCount} / ${totalBeads}）。</span>
              <button class="btn btn--sm btn--ghost" type="button" onClick=${() => setCheckMode(false)}>やめる</button>
            </div>
          `}

          <${BeadCanvas}
            pattern=${pattern}
            viewMode=${viewMode}
            showGrid=${settings.showGrid}
            showNumbers=${settings.showNumbers}
            highlightColorId=${highlightColorId}
            originalUrl=${originalUrl}
            cellSize=${cellSize}
            onCellSizeChange=${setCellSize}
            plateMask=${plateMask}
            round=${settings.roundBeads}
            editingEnabled=${editColorId != null}
            editColorId=${editColorId}
            activeTool=${activeTool}
            onSetTool=${setActiveTool}
            onStrokeBegin=${pushHistory}
            onDraw=${handleDraw}
            onBucket=${handleBucketFill}
            onEyedrop=${handleEyedrop}
            canUndo=${history.past.length > 0}
            canRedo=${history.future.length > 0}
            onUndo=${undo}
            onRedo=${redo}
            mirrorX=${mirrorX}
            mirrorY=${mirrorY}
            onToggleMirrorX=${() => setMirrorX((v) => !v)}
            onToggleMirrorY=${() => setMirrorY((v) => !v)}
            checkMode=${checkMode}
            doneSet=${doneSet}
            totalBeads=${totalBeads}
            onSetDone=${handleSetDone}
            onToggleCheckMode=${toggleCheckMode}
          />
        </div>

        <!-- 右カラム -->
        <div class="app__col app__col--right">
          <${ToolsPanel}
            hasPattern=${!!pattern}
            beadPalettes=${BEAD_PALETTES}
            beadPaletteId=${settings.beadPaletteId}
            onBeadPaletteChange=${(id) => setSettings({ ...settings, beadPaletteId: id })}
            onSnapToBeads=${handleSnapToBeads}
            paletteName=${beadPalette ? beadPalette.name : ''}
            sizeMm=${beadPalette ? beadPalette.sizeMm : 0}
            patternWidth=${pattern ? pattern.width : 0}
            patternHeight=${pattern ? pattern.height : 0}
            onOpenBeadList=${() => {
              if (pattern) setBeadListOpen(true);
              else setError('先に画像を変換してください。');
            }}
            onFlipH=${handleFlipH}
            onFlipV=${handleFlipV}
            onRotate=${handleRotate}
            bufferPercent=${settings.bufferPercent}
            onBufferChange=${(v) => setSettings({ ...settings, bufferPercent: v })}
            checkMode=${checkMode}
            onToggleCheckMode=${toggleCheckMode}
            doneCount=${doneCount}
            totalBeads=${totalBeads}
            highlightColorId=${highlightColorId}
            onMarkHighlightDone=${handleMarkHighlightDone}
            onResetDone=${handleResetDone}
            onShareImage=${handleShareImage}
            onShareLink=${handleShareLink}
          />
          <${ColorPalette}
            colors=${colors}
            totalBeads=${totalBeads}
            beadPaletteColors=${beadPaletteColors}
            bufferPercent=${settings.bufferPercent}
            highlightColorId=${highlightColorId}
            onHighlight=${handleHighlight}
            editColorId=${editColorId}
            onSelectEditColor=${selectEditColor}
            onEditColor=${handleEditColor}
            onMergeColors=${handleMergeColors}
          />
        </div>
      </main>

      ${printing &&
      html`
        <${PrintView}
          pattern=${pattern}
          colors=${colors}
          title=${title}
          totalBeads=${totalBeads}
          createdAt=${createdAt}
          onClose=${() => setPrinting(false)}
          bufferPercent=${settings.bufferPercent}
          beadPaletteColors=${beadPaletteColors}
        />
      `}

      ${cropOpen && image && originalUrl &&
      html`
        <${CropModal}
          imageUrl=${originalUrl}
          imageW=${image.naturalWidth}
          imageH=${image.naturalHeight}
          gridW=${settings.width}
          gridH=${settings.height}
          initialCrop=${settings.crop}
          onApply=${applyCropFromModal}
          onCancel=${() => setCropOpen(false)}
        />
      `}

      ${beadListOpen &&
      html`
        <${BeadListModal}
          colors=${colors}
          totalBeads=${totalBeads}
          bufferPercent=${settings.bufferPercent}
          beadPaletteColors=${beadPaletteColors}
          paletteName=${beadPalette ? beadPalette.name : ''}
          sizeMm=${beadPalette ? beadPalette.sizeMm : 0}
          width=${pattern ? pattern.width : 0}
          height=${pattern ? pattern.height : 0}
          onClose=${() => setBeadListOpen(false)}
        />
      `}
    </div>
  `;
}
