// ============================================================
// App: 全体の状態管理と結線(中央ハブ)
// ------------------------------------------------------------
// 画像 → 縮小 → 色判定 → 図案(pattern) の生成、表示モード切替、
// 手動編集(マス塗り/色編集/統合)、保存・読込・出力・印刷をまとめる。
// 子コンポーネントは表示と入力に専念し、ロジックはここに集約する。
// ============================================================

import { html, useState, useMemo, useRef } from './lib/html.js';
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
} from './utils/storage.js';
import { ImageUploader } from './components/ImageUploader.js';
import { SettingsPanel } from './components/SettingsPanel.js';
import { BeadCanvas } from './components/BeadCanvas.js';
import { ColorPalette } from './components/ColorPalette.js';
import { ExportPanel } from './components/ExportPanel.js';
import { PrintView } from './components/PrintView.js';
import { ProjectList } from './components/ProjectList.js';
import { CropModal } from './components/CropModal.js';

/** 中央の表示モードタブ定義 */
const VIEW_MODES = [
  { key: 'finished', label: '完成イメージ' },
  { key: 'numbers', label: '数字付き設計図' },
  { key: 'grid', label: 'グリッド' },
  { key: 'highlight', label: '色別ハイライト' },
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

  // ---- プロジェクト ----
  const [title, setTitle] = useState('無題の図案');
  const [projects, setProjects] = useState(() => loadProjects());
  const [currentId, setCurrentId] = useState(null);
  const [createdAt, setCreatedAt] = useState(null);
  const draftIdRef = useRef(makeId());

  // ---- UI 状態 ----
  const [converting, setConverting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
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
        setPattern(result);
        setCreatedAt(new Date().toISOString());
        setHighlightColorId(null);
        setEditColorId(null);
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
        setError('画像の変換に失敗しました' + (e && e.message ? ': ' + e.message : ''));
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
    setOriginalUrl(payload.dataUrl);
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
      const c = document.createElement('canvas');
      c.width = 90;
      c.height = 90;
      const x = c.getContext('2d');
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
    if (!image) { setError('先に画像を読み込んでください。'); return; }
    setCropOpen(true);
  };
  const applyCropFromModal = (crop) => {
    const next = { ...settings, fitMode: 'crop', crop };
    setSettings(next);
    setCropOpen(false);
    if (image) convertWith(image, next);
  };

  // ---- マス塗り(手動編集) ----
  const handleCellClick = (x, y) => {
    if (editColorId == null || !pattern) return;
    const idx = y * pattern.width + x;
    const color = pattern.colors.find((c) => c.id === editColorId);
    if (!color) return;
    const cur = pattern.cells[idx];
    if (cur && cur.colorId === editColorId) return; // 変化なし
    const cells = pattern.cells.slice();
    cells[idx] = { x, y, colorId: editColorId, hex: color.hex };
    const { colors, totalBeads } = recomputeCounts(cells, pattern.colors);
    setPattern({ ...pattern, cells, colors, totalBeads });
  };

  // ---- 色のHEX/色名編集 ----
  const handleEditColor = (id, patch) => {
    if (!pattern) return;
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
      createdAt: createdAt || now,
      updatedAt: now,
    };
  };

  // JSON保存ボタン用(サムネ無しの軽量版を毎レンダーで作らないようメモ化)
  const project = useMemo(
    () => (pattern ? buildProjectBase(false) : null),
    // eslint-disable-next-line
    [pattern, settings, title, currentId, sourceImageName, createdAt]
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
  const applyLoaded = (obj) => {
    try {
      if (
        !obj ||
        !Array.isArray(obj.colors) ||
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
      setImage(null); // 再変換用の元画像は持ち越さない
      setHighlightColorId(null);
      setEditColorId(null);
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
      list.push(`横・縦は${WARN.maxDimension}マス以下を推奨します(大きすぎると動作が重くなります)。`);
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
              <li>「画像を選ぶ」で写真を読み込む（または<b>サンプルで試す</b>）。</li>
              <li>横・縦のマス数と最大色数を決めて<b>「画像から変換」</b>。</li>
              <li>比率が違う写真は<b>「画像の合わせ方」</b>で引き伸ばす／切り抜くを選べます。</li>
              <li>右の色一覧で番号を確認。番号クリックでその色だけ強調。印刷・PNG/CSV保存も可能。</li>
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
            onImportProject=${applyLoaded}
            disabled=${!pattern}
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
              <span>🖌 塗りモード: マスをクリックすると <b>${editColorLabel}</b> で塗り替えます。</span>
              <button class="btn btn--sm btn--ghost" type="button" onClick=${() => setEditColorId(null)}>
                やめる
              </button>
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
            onCellClick=${handleCellClick}
            editingEnabled=${editColorId != null}
          />
        </div>

        <!-- 右カラム -->
        <div class="app__col app__col--right">
          <${ColorPalette}
            colors=${colors}
            totalBeads=${totalBeads}
            highlightColorId=${highlightColorId}
            onHighlight=${handleHighlight}
            editColorId=${editColorId}
            onSelectEditColor=${setEditColorId}
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
    </div>
  `;
}
