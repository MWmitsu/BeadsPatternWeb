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
import { pixelateToImageData, removeBackgroundEdges } from './utils/pixelateImage.js';
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
  loadInventory,
  saveInventory,
  saveAllProjects,
  exportAllData,
  importAllData,
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
import { CloudSyncPanel } from './components/CloudSyncPanel.js';
import * as cloudSync from './lib/cloudSync.js';
import { QrModal } from './components/QrModal.js';
import { makeQrMatrix } from './lib/qrcode.js';
import { TextStudioModal } from './components/TextStudioModal.js';
import { BEAD_PALETTES } from './data/beadPalettes.js';
import { snapPatternToPalette, matchToPalette } from './utils/beadMatch.js';
import { makePlateMask } from './utils/plateShape.js';
import {
  encodePatternToData,
  decodeDataToPattern,
  SHARE_HASH_KEY,
  estimateHashLength,
} from './utils/shareCodec.js';
import { TEMPLATES, buildTemplate } from './data/templates.js';

/** 中央の表示モードタブ定義 */
const VIEW_MODES = [
  { key: 'numbers', label: '数字付き設計図' },
  { key: 'grid', label: 'マス目' },
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
 * 文字・名前を「濃い文字 + 透明背景」のPNGデータURLにする。
 * 背景の扱いで「白として扱う＝文字＋白地」「透明として扱う＝文字だけ」を選べる。
 */
function renderTextToDataUrl(text, opts = {}) {
  const lines = String(text).split('\n').slice(0, 6).map((s) => s || ' ');
  const fontSize = 120;
  const family = 'system-ui, "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif';
  const font = `bold ${fontSize}px ${family}`;
  const mctx = document.createElement('canvas').getContext('2d');
  mctx.font = font;
  let maxW = 1;
  for (const ln of lines) maxW = Math.max(maxW, mctx.measureText(ln).width);
  const lineH = fontSize * 1.2;
  const padX = fontSize * 0.28;
  const padY = fontSize * 0.18;
  const W = Math.ceil(maxW + padX * 2);
  const H = Math.ceil(lineH * lines.length + padY * 2);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, W, H); // 透明背景
  ctx.fillStyle = opts.color || '#1f1f1f';
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((ln, i) => ctx.fillText(ln, W / 2, padY + lineH * (i + 0.5)));
  return c.toDataURL('image/png');
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
  if (!shape || shape === 'square' || shape === 'none') return basePattern;
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
 * crop=比率維持で範囲切り抜き / contain(既定)=比率維持で全体を収める
 * ※取り込み時にマス目を画像比率へ合わせるので、contain は通常そのままぴったり収まる(余白なし)。
 */
function computeRects(image, w, h, fitMode, crop) {
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  const gridAR = w / h;

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

  // contain(既定。'stretch' 等の旧値もここで全体表示に倒す)
  const scale = Math.min(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  return {
    src: { sx: 0, sy: 0, sw: iw, sh: ih },
    dest: { dx: (w - dw) / 2, dy: (h - dh) / 2, dw, dh },
  };
}

/**
 * 図案(プロジェクト)が「在庫に反映」されたとき、各市販ビーズ色を何個消費するかを集計する。
 * key = "<paletteId>:<colorCode>"、値 = 使用個数(予備%は含めない=実消費)。
 * ビーズ色(ブランド)が未選択('none')のプロジェクトは消費0(商品色に対応づけられないため)。
 * @returns {Object<string, number>}
 */
function consumptionOfProject(p) {
  const out = {};
  const pid = p && p.settings && p.settings.beadPaletteId;
  if (!pid || pid === 'none') return out;
  const palette = BEAD_PALETTES.find((b) => b.id === pid);
  if (!palette || !palette.colors) return out;
  for (const c of (p.colors || [])) {
    if (!c || typeof c.hex !== 'string') continue;
    const bead = matchToPalette(c.hex, palette.colors);
    const key = `${pid}:${bead.code}`;
    out[key] = (out[key] || 0) + (Number(c.count) || 0);
  }
  return out;
}

/** 変換に関わる設定の署名（自動プレビューの重複変換抑止に使う）。convertSig と同じ並び。 */
function convertSignatureOf(s) {
  const d = s.detection || {};
  return [
    s.width, s.height, s.fitMode,
    s.backgroundAsWhite, s.removeBackground,
    d.maxColors, d.colorDistanceThreshold, d.mergeMinorColors,
    d.minorColorCountThreshold, d.dithering, d.contrastCorrection, d.outlineEnhancement,
  ].join('|');
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
  const [viewMode, setViewMode] = useState('numbers');
  const [cellSize, setCellSize] = useState(12);
  const [mobileTab, setMobileTab] = useState('figure'); // スマホ下タブ: figure | colors | tools | save
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
  const [inventory, setInventory] = useState(() => loadInventory()); // ビーズ在庫(手持ち数)
  const [reflected, setReflected] = useState(false); // この図案を「完成として在庫に反映」したか
  const [reflectedUsed, setReflectedUsed] = useState({}); // 反映時に在庫から実際に引いた数(取り消しで戻す)
  const [currentId, setCurrentId] = useState(null);
  const [createdAt, setCreatedAt] = useState(null);
  const draftIdRef = useRef(makeId());
  const draftWarnedRef = useRef(false); // 自動保存の容量超過を一度だけ通知するため
  const editedRef = useRef(false); // 手動編集後か(自動プレビューで上書きしないため)
  const convertSigSkipRef = useRef(true); // 自動プレビュー: 初回(マウント時)はスキップ
  const lastConvertSigRef = useRef(null); // 直近に変換した設定の署名(同一設定の重複自動変換を防ぐ)

  // ---- UI 状態 ----
  const [converting, setConverting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [beadListOpen, setBeadListOpen] = useState(false);
  const [qrShare, setQrShare] = useState(null); // { matrix, url } QRコード共有モーダル
  const [textStudioOpen, setTextStudioOpen] = useState(false); // 文字デザインモーダル
  const [textStudioInitial, setTextStudioInitial] = useState(null); // 文字デザインを開くときの初期設定
  const [textComposition, setTextComposition] = useState(null); // 前回の文字デザイン設定(開き直しても保持)
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const noticeTimer = useRef(null);
  const [cloudStatus, setCloudStatus] = useState({ available: true, signedIn: false, email: '', busy: false });

  const flash = (msg) => {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2500);
  };

  // ---- クラウド同期(Googleログイン / Firebase) ----
  // 保存図案＋在庫を1ユーザー1ドキュメントに同期。Firebase は初回ログイン時に遅延読込。
  useEffect(() => {
    const stripThumb = (p) => { const { thumbnail, ...rest } = p; return rest; };
    cloudSync.init({
      // ローカルの最新を返す(localStorageが真実。クラウドは軽量化のため画像=サムネを外す)
      getLocal: () => ({ projects: loadProjects().map(stripThumb), inventory: loadInventory() }),
      // クラウドの内容をローカルへ反映(系統ごと・部分適用)。既存ローカルのサムネは保持。
      // 端末への保存が成功したかを返す(false=保存失敗。cloudSync は基準を更新せず再取得する)。
      applyRemote: (data) => {
        let ok = true;
        if (data && 'projects' in data) {
          const incoming = Array.isArray(data.projects) ? data.projects : [];
          const localById = new Map(loadProjects().map((p) => [p.id, p]));
          const merged = incoming.map((p) => {
            const local = localById.get(p.id);
            if (local && local.thumbnail && !p.thumbnail) return { ...p, thumbnail: local.thumbnail };
            return p;
          });
          const pr = saveAllProjects(merged);
          if (pr.ok) setProjects(loadProjects());
          else { flash(pr.error || 'この端末に図案を保存しきれませんでした。'); ok = false; }
        }
        if (data && 'inventory' in data) {
          const inv = data.inventory && typeof data.inventory === 'object' && !Array.isArray(data.inventory) ? data.inventory : {};
          if (saveInventory(inv)) setInventory(inv);
          else { flash('この端末に在庫を保存できませんでした（保存容量がいっぱいかもしれません）。'); ok = false; }
        }
        return ok;
      },
      onStatus: (st) => setCloudStatus(st),
      confirmConflict: () =>
        window.confirm('この端末とクラウドの両方にデータがあります。\n\n「OK」＝クラウドのデータを使う\n「キャンセル」＝この端末のデータを使う'),
      toast: (m) => {
        setNotice(m);
        if (noticeTimer.current) clearTimeout(noticeTimer.current);
        noticeTimer.current = setTimeout(() => setNotice(null), 3800);
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- 変換(縮小 → 色判定) ----
  // img を直接受け取るので state 反映前でも実行できる(画像読込直後の自動変換に使う)。
  const convertWith = (img, st = settings) => {
    if (!img) return;
    editedRef.current = false; // 変換すると手動編集はリセットされる(自動プレビュー再開)
    lastConvertSigRef.current = convertSignatureOf(st); // この設定で変換済みと記録(自動プレビューの重複を防ぐ)
    setConverting(true);
    setError(null);
    // 「変換中…」表示を一度描画させてから重い処理に入る
    setTimeout(() => {
      try {
        const w = clampDim(st.width);
        const h = clampDim(st.height);
        const d = st.detection;
        // fitMode/crop に応じて元画像から使う範囲(src)と描画先(dest)を計算
        const rects = computeRects(img, w, h, st.fitMode || 'contain', st.crop || null);
        // 背景を自動で消すときは透明扱い(白で埋めない)で処理する
        const bgWhite = st.removeBackground ? false : st.backgroundAsWhite;
        const imageData = pixelateToImageData(img, w, h, {
          backgroundAsWhite: bgWhite,
          contrastCorrection: d.contrastCorrection,
          outlineEnhancement: d.outlineEnhancement,
          srcRect: rects.src,
          destRect: rects.dest,
        });
        // 背景の自動削除: 縁につながる背景色のマスを透明にする
        if (st.removeBackground) removeBackgroundEdges(imageData);
        const result = detectBeadPattern(imageData, {
          maxColors: d.maxColors,
          colorDistanceThreshold: d.colorDistanceThreshold,
          mergeMinorColors: d.mergeMinorColors,
          minorColorCountThreshold: d.minorColorCountThreshold,
          dithering: d.dithering,
          backgroundAsWhite: bgWhite,
        });
        setPattern(maskOffShape(result, st.plateShape));
        setCreatedAt(new Date().toISOString());
        setEditColorId(null);
        setCheckMode(false);
        setDoneSet(new Set());
        setReflected(false); // 新しく変換した図案はまだ未完成(在庫未反映)
        setReflectedUsed({});
        setMirrorX(false);
        setMirrorY(false);
        setActiveTool('pen');
        clearHistory();
        setViewMode('numbers');
        // 画面幅に収まるセルサイズへ自動フィット(スマホでは小さめ)
        setCellSize(autoFitCellSize(result.width));
        // スマホでは変換後に「図案」プレビューへスクロールして結果を見せる
        if (typeof window !== 'undefined' && window.innerWidth <= 820) {
          setMobileTab('figure');
          setTimeout(() => {
            const el = document.querySelector('[data-sec="figure"]');
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
    // 新しい画像＝新しい作品。タイトルもその画像のファイル名にする(別作品が同名になるのを防ぐ)。
    const baseName = (payload.name || '').replace(/\.[^.]+$/, '');
    setTitle(baseName || '無題の図案');
    // マス目(グリッド)を画像の比率に合わせる＝画像全体を、歪まず・切り取らず・余白なしで取り込む。
    // 「横ビーズ数」を基準に、縦は画像比率から自動で決める。
    const iw = payload.image.naturalWidth || payload.width || 1;
    const ih = payload.image.naturalHeight || payload.height || 1;
    const baseW = clampDim(settings.width || 64);
    const gw = baseW;
    const gh = clampDim(Math.round((baseW * ih) / iw));
    const next = { ...settings, width: gw, height: gh, fitMode: 'contain', crop: null };
    setSettings(next);
    // 新しい画像は別の作品として扱う。読み込み中だった保存図案を上書きしないようIDを刷新する。
    setCurrentId(null);
    draftIdRef.current = makeId();
    // 読み込んだら即変換して結果を見せる(設定を変えれば再変換できる)
    convertWith(payload.image, next);
  };

  // 文字・名前から図案を作る(文字を画像化→グリッドを比率に合わせて変換)
  const handleTextToImage = (text) => {
    const t = String(text || '').trim();
    if (!t) { setError('文字を入力してください。'); return; }
    try {
      const dataUrl = renderTextToDataUrl(t);
      const img = new Image();
      img.onload = () => {
        // グリッドを文字の縦横比に合わせる(長辺=48マス目安)
        const ar = (img.naturalWidth || 1) / (img.naturalHeight || 1);
        const LONG = 48;
        let gw, gh;
        if (ar >= 1) { gw = LONG; gh = Math.max(8, Math.round(LONG / ar)); }
        else { gh = LONG; gw = Math.max(8, Math.round(LONG * ar)); }
        // 文字は「文字だけ(透明背景)」を既定にする。背景の扱いで白地にも切替可。
        const next = {
          ...settings,
          width: clampDim(gw),
          height: clampDim(gh),
          fitMode: 'contain',
          backgroundAsWhite: false,
          removeBackground: false,
        };
        setSettings(next);
        setImage(img);
        setOriginalUrl(dataUrl);
        setSourceImageName('文字「' + t.slice(0, 16) + '」');
        if (!title || title === '無題の図案') setTitle(t.slice(0, 20));
        setCurrentId(null);
        draftIdRef.current = makeId();
        convertWith(img, next);
      };
      img.onerror = () => setError('文字の図案化に失敗しました。');
      img.src = dataUrl;
    } catch (e) {
      setError('文字の図案化に失敗しました。');
    }
  };

  // 文字デザインモーダルを開く。前回の設定があれば復元し、無ければ入力途中の文字で開始する。
  const handleOpenTextStudio = (t) => {
    if (textComposition) {
      setTextStudioInitial(textComposition);
    } else {
      setTextStudioInitial({ text: typeof t === 'string' ? t : '' });
    }
    setTextStudioOpen(true);
  };

  // 文字デザインの結果（合成済みPNG）を図案にする
  const handleApplyTextComposition = (payload) => {
    setTextStudioOpen(false);
    const { dataUrl, W, H, longSide, whiteBg, text } = payload || {};
    if (!dataUrl) { setError('文字の図案化に失敗しました。'); return; }
    try {
      const img = new Image();
      img.onload = () => {
        const ar = (img.naturalWidth || W || 1) / (img.naturalHeight || H || 1);
        const LONG = longSide || 48;
        let gw, gh;
        if (ar >= 1) { gw = LONG; gh = Math.max(8, Math.round(LONG / ar)); }
        else { gh = LONG; gw = Math.max(8, Math.round(LONG * ar)); }
        const next = {
          ...settings,
          width: clampDim(gw),
          height: clampDim(gh),
          fitMode: 'contain',
          backgroundAsWhite: !!whiteBg,
          removeBackground: false,
        };
        setSettings(next);
        setImage(img);
        setOriginalUrl(dataUrl);
        const t = String(text || '').trim();
        setSourceImageName('文字「' + t.slice(0, 16) + '」');
        if (!title || title === '無題の図案') setTitle(t.slice(0, 20) || '文字の図案');
        setCurrentId(null);
        draftIdRef.current = makeId();
        convertWith(img, next);
      };
      img.onerror = () => setError('文字の図案化に失敗しました。');
      img.src = dataUrl;
    } catch (e) {
      setError('文字の図案化に失敗しました。');
    }
  };

  // 作例（テンプレート）から図案を作る（画像不要・設計どおりのきれいな図案）
  const handleTemplate = (id) => {
    const tpl = TEMPLATES.find((t) => t.id === id);
    if (!tpl) return;
    try {
      applyLoaded(buildTemplate(tpl));
      flash('「' + tpl.name + '」の作例を読み込みました。色や形を自由に変えられます。');
    } catch (e) {
      setError('作例の読み込みに失敗しました。');
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
  // ※editedRef(手動編集フラグ)は「実際に図案が変化した箇所」で個別に立てる。
  //   ここで一律に立てると、無変化クリックや台座形状変更だけで自動プレビューが止まる不具合になる。
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
    editedRef.current = true; // 実際に変化したときだけ手動編集フラグを立てる
    const { colors, totalBeads } = recomputeCounts(cells, pattern.colors);
    setPattern({ ...pattern, cells, colors, totalBeads });
    // 消しゴムで背景になったマスは作業チェック(doneSet)から外す(進捗が総数を超えないように)
    if (erase) {
      setDoneSet((prev) => {
        if (!prev.size) return prev;
        let mut = false;
        const nextDone = new Set();
        for (const idx of prev) {
          const c = cells[idx];
          if (c && c.colorId !== BACKGROUND_COLOR_ID) nextDone.add(idx);
          else mut = true;
        }
        return mut ? nextDone : prev;
      });
    }
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
    editedRef.current = true; // 実際に変化したときだけ手動編集フラグを立てる
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
    editedRef.current = true; // 反転・回転は手動編集扱い(自動プレビューで上書きしない)
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
  };
  const handleFlipH = () => transformPattern((x, y, W) => [W - 1 - x, y], pattern.width, pattern.height);
  const handleFlipV = () => transformPattern((x, y, W, H) => [x, H - 1 - y], pattern.width, pattern.height);
  const handleRotate = () => transformPattern((x, y, W, H) => [H - 1 - y, x], pattern.height, pattern.width);

  // ---- 色のHEX/色名編集 ----
  const handleEditColor = (id, patch) => {
    if (!pattern) return;
    // 無変化な編集(同じHEX/色名の再適用、カラーピッカーで現在色を選び直す等)は何もしない。
    // 履歴や手動編集フラグを汚すと、以後の自動プレビューが止まる副作用が出るため。
    const cur = pattern.colors.find((c) => c.id === id);
    if (!cur) return;
    const hexChanged = patch.hex != null && patch.hex !== cur.hex;
    const nameChanged = patch.name != null && patch.name !== cur.name;
    if (!hexChanged && !nameChanged) return;
    pushHistory();
    editedRef.current = true;
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
    editedRef.current = true; // 色の統合は手動編集扱い
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
    // 採番が変わるため塗り色の選択は解除
    setEditColorId(null);
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
    editedRef.current = true; // ビーズ色スナップは手動編集扱い
    const res = snapPatternToPalette(pattern.cells, pattern.colors, pal.colors);
    setPattern({ ...pattern, cells: res.cells, colors: res.colors, totalBeads: res.totalBeads });
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
    const copyToClipboard = () => {
      const ok = () => flash('共有リンクをコピーしました。メールやSNSに貼り付けて送れます。');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(ok).catch(() => window.prompt('このリンクをコピーしてください', url));
      } else {
        window.prompt('このリンクをコピーしてください', url);
      }
    };
    // iPhone等ではOSの共有シートを開く(LINE/メッセージ/メール/AirDrop等へ送れる)。
    // 非対応(主にPCブラウザ)ならクリップボードにコピー。
    if (navigator.share) {
      navigator
        .share({ title: title || 'アイロンビーズ図案', text: 'アイロンビーズ図案を共有します', url })
        .catch((err) => {
          if (!err || err.name !== 'AbortError') copyToClipboard();
        });
      return;
    }
    copyToClipboard();
  };

  // ---- 共有: QRコード(共有リンクをQR化して画面表示。サーバ不要) ----
  const handleShareQr = () => {
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
    const url = location.origin + location.pathname + '#' + SHARE_HASH_KEY + '=' + data;
    const matrix = makeQrMatrix(url);
    if (!matrix) {
      setError('この図案はQRコードにするには大きすぎます。「リンクを共有」か「画像を共有」をご利用ください。');
      return;
    }
    setQrShare({ matrix, url });
  };

  // QRコード共有モーダルのリンクコピー
  const handleQrCopy = (url) => {
    const ok = () => flash('リンクをコピーしました。');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(ok).catch(() => window.prompt('このリンクをコピーしてください', url));
    } else {
      window.prompt('このリンクをコピーしてください', url);
    }
  };

  // QR画像(キャンバス)をPNGで保存
  const handleQrSave = (canvas) => {
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const safeTitle = String(title || '').replace(/[\\/:*?"<>|]/g, '_').trim() || 'beads';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = safeTitle + '_QR.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      flash('QRコード画像を保存しました。');
    }, 'image/png');
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
    draftIdRef.current = makeId(); // 共有リンクの図案は別作品。直前に開いていた保存図案を上書きしない。
    setCreatedAt(new Date().toISOString());
    setEditColorId(null);
    setCheckMode(false);
    setDoneSet(new Set());
    setReflected(false);
    setReflectedUsed({});
    setMirrorX(false);
    setMirrorY(false);
    setActiveTool('pen');
    clearHistory();
    setViewMode('numbers');
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

  // ---- 自動プレビュー: 変換に関わる設定を変えたら少し待って自動で作り直す ----
  // 手動編集後・作業チェック中・画像なしのときはしない(編集や進捗を守る)。crop は決定時に直接変換するため除く。
  const dconv = settings.detection;
  const convertSig = [
    settings.width, settings.height, settings.fitMode,
    settings.backgroundAsWhite, settings.removeBackground,
    dconv.maxColors, dconv.colorDistanceThreshold, dconv.mergeMinorColors,
    dconv.minorColorCountThreshold, dconv.dithering, dconv.contrastCorrection, dconv.outlineEnhancement,
  ].join('|');
  useEffect(() => {
    if (convertSigSkipRef.current) { convertSigSkipRef.current = false; return; }
    if (!image || editedRef.current || doneSet.size > 0) return;
    // 直前に同じ設定で変換済みなら何もしない(明示変換直後の重複自動変換を防ぐ)
    if (convertSig === lastConvertSigRef.current) return;
    const id = setTimeout(() => {
      if (image && !editedRef.current && doneSet.size === 0) convertWith(image);
    }, 500);
    return () => clearTimeout(id);
    // eslint-disable-next-line
  }, [convertSig]);

  // ---- 作業チェック中は画面を消さない(Wake Lock。対応端末のみ・非対応はサイレント) ----
  // 実物のビーズを手で扱う間にスマホ画面がスリープしないようにする。
  useEffect(() => {
    if (!checkMode) return;
    if (!('wakeLock' in navigator) || !navigator.wakeLock || !navigator.wakeLock.request) return;
    let lock = null;
    let stopped = false;
    const acquire = () => {
      navigator.wakeLock.request('screen').then((l) => {
        if (stopped) { try { l.release(); } catch (_) {} return; }
        lock = l;
      }).catch(() => {});
    };
    acquire();
    // iOSはタブ非表示で解除されるため、復帰時に取り直す
    const onVis = () => { if (document.visibilityState === 'visible' && !stopped) acquire(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', onVis);
      if (lock) { try { lock.release(); } catch (_) {} }
    };
  }, [checkMode]);

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
      inventoryReflected: reflected, // 完成として在庫に反映済みか
      inventoryUsed: reflectedUsed || {}, // 反映時に在庫から引いた数(取り消し用)
      createdAt: createdAt || now,
      updatedAt: now,
    };
  };

  // JSON保存ボタン用(サムネ無しの軽量版を毎レンダーで作らないようメモ化)
  const project = useMemo(
    () => (pattern ? buildProjectBase(false) : null),
    // eslint-disable-next-line
    [pattern, settings, title, currentId, sourceImageName, createdAt, doneSet, reflected, reflectedUsed]
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
      cloudSync.notifyLocalChange('projects');
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
      // 復元する設定の横/縦は1〜400へ丸める(過去の不具合で0が保存されていても安全に直す)
      setSettings(
        obj.settings
          ? { ...freshSettings(), ...obj.settings, width: clampDim(obj.settings.width), height: clampDim(obj.settings.height) }
          : freshSettings()
      );
      setTitle(obj.title || '無題の図案');
      editedRef.current = true; // 復元した図案は自動プレビューで上書きしない(再変換は手動で)
      setCurrentId(obj.id || null);
      // IDの無い読み込み(テンプレート/インポート)は別作品として新IDを採番し、
      // 直前に開いていた保存図案を保存時に上書きしないようにする。
      draftIdRef.current = obj.id || makeId();
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
      setEditColorId(null);
      setCheckMode(false);
      setDoneSet(new Set(Array.isArray(obj.done) ? obj.done : []));
      setReflected(!!obj.inventoryReflected);
      setReflectedUsed(obj.inventoryUsed && typeof obj.inventoryUsed === 'object' ? obj.inventoryUsed : {});
      setMirrorX(false);
      setMirrorY(false);
      setActiveTool('pen');
      clearHistory();
      setViewMode('numbers');
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
    cloudSync.notifyLocalChange('projects');
    if (currentId === id) setCurrentId(null);
  };

  // ---- ビーズ在庫(手持ち数) ----
  // key = "<paletteId>:<colorCode>"。空入力は0(キー削除)。自動でlocalStorageへ保存。
  const handleSetInventory = (key, raw) => {
    setInventory((inv) => {
      const next = { ...inv };
      const n = Math.max(0, Math.floor(Number(raw)));
      if (!raw || !Number.isFinite(n) || n <= 0) delete next[key];
      else next[key] = n;
      saveInventory(next);
      cloudSync.notifyLocalChange('inventory');
      return next;
    });
  };

  // 「完成として在庫に反映」の切り替え。
  // ON: この作品の使用分を在庫(手持ち)から実際に差し引く。引いた量を作品に保存(取り消し用)。
  // OFF: 前回引いた分を在庫に戻す。
  const handleToggleReflect = () => {
    if (!pattern) return;
    const pid = settings.beadPaletteId;
    if (!pid || pid === 'none') {
      setError('在庫に反映するには、先に「制作・共有ツール」でビーズ色（ブランド）を選んでください。');
      return;
    }
    const willReflect = !reflected;
    const proj0 = buildProjectBase(true);
    if (!proj0.id) proj0.id = makeId();

    const nextInv = { ...inventory };
    let snapshot = {};
    if (willReflect) {
      // 使用分を在庫から引く。手持ちが足りなければ引けた分だけ記録する(取り消しで正確に戻すため)。
      const used = consumptionOfProject(proj0);
      for (const key of Object.keys(used)) {
        const before = Number(nextInv[key]) || 0;
        const sub = Math.min(before, used[key]);
        if (sub > 0) {
          snapshot[key] = sub;
          const after = before - sub;
          if (after > 0) nextInv[key] = after; else delete nextInv[key];
        }
      }
    } else {
      // 取り消し: 前回引いた分(保存済みスナップショット)を在庫へ戻す。
      snapshot = reflectedUsed && typeof reflectedUsed === 'object' ? reflectedUsed : {};
      for (const key of Object.keys(snapshot)) {
        nextInv[key] = (Number(nextInv[key]) || 0) + (Number(snapshot[key]) || 0);
      }
    }

    const proj = { ...proj0, inventoryReflected: willReflect, inventoryUsed: willReflect ? snapshot : {} };
    const res = saveProject(proj);
    if (!res.ok) { setError(res.error || '保存に失敗しました。'); return; }

    saveInventory(nextInv);
    setInventory(nextInv);
    setReflected(willReflect);
    setReflectedUsed(willReflect ? snapshot : {});
    setCurrentId(proj.id);
    draftIdRef.current = proj.id;
    setProjects(loadProjects());
    cloudSync.notifyLocalChange('inventory');
    cloudSync.notifyLocalChange('projects');

    const total = Object.values(snapshot).reduce((a, b) => a + (Number(b) || 0), 0);
    if (willReflect) {
      flash(`完成！在庫から ${total.toLocaleString()}個 引きました（取り消しできます）。`);
    } else {
      flash(`在庫への反映を取り消し、${total.toLocaleString()}個 戻しました。`);
    }
  };

  // ---- 全データのバックアップ／復元(図案＋在庫を1ファイルに) ----
  const handleBackupAll = () => {
    try {
      const data = exportAllData();
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `ビーズ図案バックアップ_${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      flash('全データ（図案＋在庫）をファイルに保存しました。');
    } catch (e) {
      setError('バックアップに失敗しました。');
    }
  };
  const handleRestoreAll = (obj) => {
    const res = importAllData(obj);
    if (!res.ok) {
      setError(res.error || '復元に失敗しました。');
      return;
    }
    setProjects(loadProjects());
    setInventory(loadInventory());
    cloudSync.notifyLocalChange('all');
    flash(`バックアップから復元しました（図案 ${res.projects} 件）。`);
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
      // 「台座なし(none)」「正方形(square)」は形の制限なし → マスク無し(空ペグも描かない)
      pattern && settings.plateShape && settings.plateShape !== 'square' && settings.plateShape !== 'none'
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

      <main class=${'app__main' + (pattern ? '' : ' app__main--empty')} data-tab=${mobileTab}>
        <!-- ① つくる -->
        <div class="zone zone--make" data-sec="make">
          <div class="zone__label"><span class="zone__step">1</span>つくる</div>
          <${ImageUploader}
            onImage=${handleImage}
            originalUrl=${originalUrl}
            sourceImageName=${sourceImageName}
            onError=${setError}
            onTextToImage=${handleTextToImage}
            onOpenTextStudio=${handleOpenTextStudio}
            templates=${TEMPLATES}
            onTemplate=${handleTemplate}
          />
          ${image || pattern
            ? html`<${SettingsPanel}
                settings=${settings}
                onChange=${setSettings}
                onConvert=${handleConvert}
                converting=${converting}
                canConvert=${!!image}
                canCrop=${!!image}
                onOpenCrop=${openCrop}
                warnings=${warnings}
              />`
            : html`
                <details class="help">
                  <summary class="help__summary">はじめての方へ（使い方）</summary>
                  <ol class="help__steps">
                    <li><b>「写真をえらぶ」</b>で写真を読み込みます（または<b>「サンプル」「文字」</b>）。</li>
                    <li>読み込むと自動で図案になります。サイズ（横ビーズ数）や色数を変えたいときは下の設定で調整します。</li>
                    <li>写真は<b>全体をそのままの比率</b>で取り込みます（マス目を写真の形に自動で合わせます）。</li>
                    <li><b>「色」</b>で色番号、<b>「道具」</b>で市販ビーズ色・必要数・作業チェック・在庫・共有が使えます。</li>
                    <li><b>「保存」</b>で、この端末・印刷・バックアップ・クラウド同期ができます。</li>
                  </ol>
                </details>`}
        </div>

        <!-- 図案（主役） -->
        <div class="zone zone--figure" data-sec="figure">
          ${pattern
            ? html`
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
                    <button class="btn btn--sm btn--ghost" type="button" onClick=${() => setEditColorId(null)}>やめる</button>
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
                />`
            : html`
                <div class="figure-empty">
                  <div class="figure-empty__icon" aria-hidden="true">🧩</div>
                  <p class="figure-empty__text">ここに図案が出ます。<br />左上の<b>「写真をえらぶ」</b>から始めましょう。</p>
                </div>`}
        </div>

        <!-- ② 仕上げ・ほぞん（色 / 道具 / 保存） -->
        <div class="app__rightcol">
          <div class="zone zone--colors" data-sec="colors">
            ${pattern
              ? html`<${ColorPalette}
                  colors=${colors}
                  totalBeads=${totalBeads}
                  beadPaletteColors=${beadPaletteColors}
                  bufferPercent=${settings.bufferPercent}
                  editColorId=${editColorId}
                  onSelectEditColor=${selectEditColor}
                  onEditColor=${handleEditColor}
                  onMergeColors=${handleMergeColors}
                />`
              : null}
          </div>
          <div class="zone zone--tools" data-sec="tools">
            ${pattern
              ? html`<${ToolsPanel}
                  hasPattern=${!!pattern}
                  beadPalettes=${BEAD_PALETTES}
                  beadPaletteId=${settings.beadPaletteId}
                  onBeadPaletteChange=${(id) => setSettings({ ...settings, beadPaletteId: id })}
                  onSnapToBeads=${handleSnapToBeads}
                  paletteName=${beadPalette ? beadPalette.name : ''}
                  sizeMm=${beadPalette ? beadPalette.sizeMm : 0}
                  patternWidth=${pattern ? pattern.width : 0}
                  patternHeight=${pattern ? pattern.height : 0}
                  onOpenBeadList=${() => { if (pattern) setBeadListOpen(true); }}
                  onFlipH=${handleFlipH}
                  onFlipV=${handleFlipV}
                  onRotate=${handleRotate}
                  bufferPercent=${settings.bufferPercent}
                  onBufferChange=${(v) => setSettings({ ...settings, bufferPercent: v })}
                  checkMode=${checkMode}
                  onToggleCheckMode=${toggleCheckMode}
                  doneCount=${doneCount}
                  totalBeads=${totalBeads}
                  onResetDone=${handleResetDone}
                  onShareImage=${handleShareImage}
                  onShareLink=${handleShareLink}
                  onShareQr=${handleShareQr}
                />`
              : null}
          </div>
          <div class="zone zone--save" data-sec="save">
            ${pattern
              ? html`<${ExportPanel}
                  pattern=${exportPattern}
                  colors=${colors}
                  project=${project}
                  onSaveLocal=${handleSaveLocal}
                  onOpenPrint=${handleOpenPrint}
                  onImportProject=${(obj) => applyLoaded(obj, { sourceImageUrl: obj && obj.thumbnail })}
                  onBackupAll=${handleBackupAll}
                  onRestoreAll=${handleRestoreAll}
                  disabled=${!pattern}
                  bufferPercent=${settings.bufferPercent}
                  beadPaletteColors=${beadPaletteColors}
                />`
              : null}
            <${ProjectList}
              projects=${projects}
              currentId=${currentId}
              onLoad=${handleLoadProject}
              onDelete=${handleDeleteProject}
            />
            <${CloudSyncPanel}
              status=${cloudStatus}
              onSignIn=${() => cloudSync.signIn()}
              onSignOut=${() => cloudSync.signOut()}
            />
          </div>
        </div>
      </main>

      ${pattern &&
      html`
        <nav class="tabbar" aria-label="セクション切替">
          ${[['figure', '🧩', '図案'], ['colors', '🎨', '色'], ['tools', '🧰', '道具'], ['save', '💾', '保存']].map(
            ([k, ic, lb]) => html`
              <button
                key=${k}
                type="button"
                class=${'tabbar__btn' + (mobileTab === k ? ' is-active' : '')}
                aria-current=${mobileTab === k ? 'page' : null}
                onClick=${() => setMobileTab(k)}
              >
                <span class="tabbar__icon" aria-hidden="true">${ic}</span>
                <span class="tabbar__label">${lb}</span>
              </button>
            `
          )}
        </nav>`}

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
          beadPaletteId=${settings.beadPaletteId}
          paletteName=${beadPalette ? beadPalette.name : ''}
          sizeMm=${beadPalette ? beadPalette.sizeMm : 0}
          width=${pattern ? pattern.width : 0}
          height=${pattern ? pattern.height : 0}
          inventory=${inventory}
          reflected=${reflected}
          canReflect=${!!pattern}
          projectTitle=${title}
          onToggleReflect=${handleToggleReflect}
          onSetInventory=${handleSetInventory}
          onClose=${() => setBeadListOpen(false)}
        />
      `}

      ${qrShare &&
      html`
        <${QrModal}
          matrix=${qrShare.matrix}
          url=${qrShare.url}
          title=${title}
          onClose=${() => setQrShare(null)}
          onCopy=${handleQrCopy}
          onSave=${handleQrSave}
        />
      `}

      ${textStudioOpen &&
      html`
        <${TextStudioModal}
          initialState=${textStudioInitial}
          onApply=${handleApplyTextComposition}
          onCancel=${() => setTextStudioOpen(false)}
          onPersist=${setTextComposition}
        />
      `}
    </div>
  `;
}
