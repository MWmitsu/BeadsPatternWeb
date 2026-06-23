// ============================================================
// 型定義(JSDoc)とアプリ全体で共有する定数
// ------------------------------------------------------------
// ビルドレス構成のため型は JSDoc @typedef で表現する(エディタ補完用、実行時は無影響)。
// 各モジュール・コンポーネントはこのファイルの typedef と定数を「契約」として参照する。
// ============================================================

/** ビーズ無し(透明背景)セルを表す予約カラーID。通常の色IDは 1 から始まる。 */
export const BACKGROUND_COLOR_ID = 0;

/** 透明ピクセル判定のアルファしきい値(これ未満は背景扱い) */
export const ALPHA_THRESHOLD = 16;

// ---- 型(JSDoc) -------------------------------------------------

/** @typedef {{ r: number, g: number, b: number }} RGB */

/**
 * @typedef {Object} BeadColor パレット1色
 * @property {number} id        1始まりの色番号
 * @property {string} hex       "#RRGGBB"(大文字)
 * @property {RGB}    rgb
 * @property {string} name      推定色名(手動編集可)
 * @property {number} count     使用マス数
 * @property {number} ratio     全ビーズ中の割合(0-100, 小数1桁想定)
 */

/**
 * @typedef {Object} BeadCell グリッド1マス
 * @property {number} x
 * @property {number} y
 * @property {number} colorId   BACKGROUND_COLOR_ID なら透明背景
 * @property {string} hex       表示用HEX(背景セルは "")
 */

/**
 * @typedef {Object} ColorDetectionSettings 色判定設定(仕様準拠)
 * @property {number}  maxColors                 最大色数
 * @property {number}  colorDistanceThreshold    RGB距離しきい値(近似色統合)
 * @property {boolean} mergeMinorColors          少数色を近似色へ統合するか
 * @property {number}  minorColorCountThreshold  この個数以下の色を統合
 * @property {boolean} dithering                 ディザリング
 * @property {boolean} contrastCorrection        コントラスト補正
 * @property {boolean} outlineEnhancement        輪郭強調
 */

/**
 * @typedef {Object} Settings アプリの全設定(基本 + 色判定)
 * @property {number}  width               横ビーズ数
 * @property {number}  height              縦ビーズ数
 * @property {boolean} showGrid            グリッド線表示
 * @property {boolean} showNumbers         数字表示
 * @property {boolean} backgroundAsWhite   true=背景を白扱い / false=透明扱い
 * @property {'弱'|'標準'|'強'} mergeStrength 色統合の強さ(しきい値プリセット)
 * @property {ColorDetectionSettings} detection
 */

/**
 * @typedef {Object} DetectionResult 変換結果
 * @property {number} width
 * @property {number} height
 * @property {BeadColor[]} colors
 * @property {BeadCell[]}  cells
 * @property {number} totalBeads         透明背景を除いた総ビーズ数
 * @property {number} backgroundCount    透明背景マス数
 */

/**
 * @typedef {Object} BeadPattern 保存される図案(仕様の BeadPattern を拡張)
 * @property {string} id
 * @property {string} title
 * @property {string} sourceImageName
 * @property {number} width
 * @property {number} height
 * @property {number} totalBeads
 * @property {BeadColor[]} colors
 * @property {number[]} grid    colorId の1次元配列(row-major, 長さ width*height) ※localStorage節約のためcells圧縮形
 * @property {Settings} settings
 * @property {string=} thumbnail データURL(小さな完成イメージ, 任意)
 * @property {string} createdAt ISO文字列
 * @property {string} updatedAt ISO文字列
 */

// ---- 定数 ------------------------------------------------------

/** 推定色名の候補(手動編集のセレクトにも使用) */
export const COLOR_NAMES = [
  '黒', '白', '灰色', '赤', 'ピンク', 'オレンジ', '黄',
  '緑', '水色', '青', '紫', '茶色', '肌色', 'ベージュ', 'その他',
];

/** 最大色数の選択肢 */
export const MAX_COLOR_OPTIONS = [8, 16, 24, 32, 48, 64];

/** 色統合の強さ → RGB距離しきい値プリセット */
export const MERGE_STRENGTH_THRESHOLD = { 弱: 20, 標準: 35, 強: 55 };

/** 警告判定のしきい値 */
export const WARN = {
  largeBeadCount: 9216,   // 96*96。これ以上は描画/印刷が重くなる警告
  hugeBeadCount: 16384,   // 128*128。これ以上は特に重い
  manyColors: 48,         // これ以上は制作難の警告
  fewColors: 8,           // これ以下は元画像と差が出やすい警告
  maxDimension: 200,      // 横/縦の上限(超で警告)
};

/** 既定設定(仕様の初期値) */
export const DEFAULT_SETTINGS = {
  width: 64,
  height: 64,
  showGrid: true,
  showNumbers: true,
  backgroundAsWhite: true,
  mergeStrength: '標準',
  fitMode: 'stretch', // 'stretch'(引き伸ばす) | 'crop'(切り抜き) | 'contain'(全体・余白)
  crop: null,         // 切り抜き範囲(正規化 {x,y,w,h} 0..1)。null は自動(中央カバー)
  detection: {
    maxColors: 24,
    colorDistanceThreshold: 35,
    mergeMinorColors: true,
    minorColorCountThreshold: 3,
    dithering: false,
    contrastCorrection: false,
    outlineEnhancement: false,
  },
};

/** 画像の合わせ方(アスペクト比の扱い) */
export const FIT_MODES = [
  { value: 'stretch', label: '引き伸ばす', hint: 'グリッド全体に広げる（比率は無視）' },
  { value: 'crop', label: '切り抜く', hint: '比率を保ち、使う範囲を選ぶ' },
  { value: 'contain', label: '全体を入れる', hint: '比率を保ち全体を収める（余白は背景の扱い＝白か透明になります）' },
];

/** 分割印刷の1区画あたりのマス数(選択肢) */
export const PRINT_TILE_OPTIONS = [25, 30, 40, 50];

/** 受け付ける画像MIME */
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ACCEPTED_IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp'];

/** localStorage キー */
export const STORAGE_KEY = 'beads-pattern-projects-v1';
