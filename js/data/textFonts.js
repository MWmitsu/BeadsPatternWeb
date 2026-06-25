// ============================================================
// 文字デザイン用フォントプリセット
// ------------------------------------------------------------
// フォント名は初心者に分かりにくいので「見た目の愛称＋見本」で選ばせる。
// 2種類のフォントがある:
//   1) 端末標準フォント系（stackのみ）… 漢字も含めフル対応。Win/iOSのフォールバック並び。
//   2) かわいい同梱フォント（family='BP 〜'）… OFLフォントを fonts/ に同梱(css/fonts.css)。
//      日本語は「かな+ASCII+記号」にサブセット済みなので、漢字など範囲外は stack 後続の
//      端末まるゴシック等へフォールバックする。英字向けフォントは (英) を付記。
// family: document.fonts.load で読み込む主フォント名。stack: 実際のCSS font-family。
// fixedWeight: そのフォント本来の太さを使い、太字トグルを無視する（飾り文字のニセ太字を防ぐ）。
// フォントは作成時に即ビーズ画像化するので、共有相手の環境フォントには依存しない。
// ============================================================

/** @typedef {{ key:string, label:string, sample:string, family:string, stack:string, forceBold?:boolean, fixedWeight?:boolean }} FontPreset */

// 日本語のフォールバック（同梱フォントのサブセット外＝漢字等はここで端末フォントに落ちる）
const JP_FB = "'Hiragino Maru Gothic ProN','ヒラギノ丸ゴ ProN','BIZ UDPGothic','Meiryo','メイリオ',sans-serif";
const JP_GO = "'Hiragino Sans','ヒラギノ角ゴシック','BIZ UDPGothic','Yu Gothic UI','Meiryo',sans-serif";

/** @type {FontPreset[]} */
export const FONT_PRESETS = [
  // ---- 端末標準（フル対応・漢字OK） ----
  { key: 'maru', label: 'まる', sample: 'あ',
    family: 'Hiragino Maru Gothic ProN',
    stack: "'Hiragino Maru Gothic ProN','ヒラギノ丸ゴ ProN','BIZ UDPGothic','Meiryo','メイリオ','Yu Gothic UI','游ゴシック',sans-serif" },
  { key: 'gothic', label: 'ゴシック', sample: 'あ',
    family: 'Hiragino Sans',
    stack: "'Hiragino Sans','ヒラギノ角ゴシック','BIZ UDPGothic','Yu Gothic UI','游ゴシック','Meiryo','メイリオ','MS PGothic',sans-serif" },
  { key: 'futomaru', label: 'ふとマル', sample: 'あ', forceBold: true,
    family: 'Hiragino Maru Gothic ProN',
    stack: "'Hiragino Maru Gothic ProN','ヒラギノ丸ゴ ProN','BIZ UDPGothic','Meiryo','メイリオ',sans-serif" },
  { key: 'mincho', label: '明朝', sample: 'あ',
    family: 'Hiragino Mincho ProN',
    stack: "'Hiragino Mincho ProN','ヒラギノ明朝 ProN','YuMincho','游明朝','BIZ UDPMincho','MS PMincho',serif" },
  { key: 'kyokasho', label: 'きょうかしょ', sample: 'あ',
    family: 'UD Digi Kyokasho N-R',
    stack: "'UD Digi Kyokasho N-R','UDデジタル教科書体 N-R','YuKyokasho','游明朝','Hiragino Mincho ProN',serif" },

  // ---- かわいい同梱フォント（日本語＝かな中心、漢字は端末フォントへ） ----
  { key: 'hachi', label: 'はちまる', sample: 'あ', fixedWeight: true,
    family: 'BP Hachi', stack: "'BP Hachi'," + JP_FB },
  { key: 'mochiy', label: 'もちもち', sample: 'あ', fixedWeight: true,
    family: 'BP Mochiy', stack: "'BP Mochiy'," + JP_FB },
  { key: 'rocknroll', label: 'ポップまる', sample: 'あ', fixedWeight: true,
    family: 'BP RocknRoll', stack: "'BP RocknRoll'," + JP_FB },
  { key: 'yusei', label: 'マジック', sample: 'あ', fixedWeight: true,
    family: 'BP Yusei', stack: "'BP Yusei'," + JP_FB },
  { key: 'yomogi', label: 'てがき', sample: 'あ', fixedWeight: true,
    family: 'BP Yomogi', stack: "'BP Yomogi'," + JP_FB },
  { key: 'stick', label: 'えんぴつ', sample: 'あ', fixedWeight: true,
    family: 'BP Stick', stack: "'BP Stick'," + JP_FB },
  { key: 'reggae', label: 'ふともじ', sample: 'あ', fixedWeight: true,
    family: 'BP Reggae', stack: "'BP Reggae'," + JP_GO },
  { key: 'kaisei', label: 'まるふで', sample: 'あ', fixedWeight: true,
    family: 'BP Kaisei', stack: "'BP Kaisei','YuMincho','游明朝','Hiragino Mincho ProN',serif" },
  { key: 'dot', label: 'ドット', sample: 'あ', fixedWeight: true,
    family: 'BP Dot', stack: "'BP Dot','BIZ UDPGothic','Meiryo',monospace" },

  // ---- かわいい同梱フォント（英字・ローマ字向き／日本語は端末フォントへ） ----
  { key: 'bubble', label: 'まる(英)', sample: 'Ab', fixedWeight: true,
    family: 'BP Bubble', stack: "'BP Bubble','Hiragino Maru Gothic ProN','BIZ UDPGothic',sans-serif" },
  { key: 'pacifico', label: 'ひっき(英)', sample: 'Ab', fixedWeight: true,
    family: 'BP Pacifico', stack: "'BP Pacifico','Hiragino Maru Gothic ProN',cursive" },
  { key: 'gloria', label: 'てがき(英)', sample: 'Ab', fixedWeight: true,
    family: 'BP Gloria', stack: "'BP Gloria','Hiragino Maru Gothic ProN',cursive" },
  { key: 'bungee', label: 'ブロック(英)', sample: 'AB', fixedWeight: true,
    family: 'BP Bungee', stack: "'BP Bungee','Hiragino Sans',sans-serif" },
  { key: 'pixel', label: 'ドット(英)', sample: 'Ab', fixedWeight: true,
    family: 'BP Pixel', stack: "'BP Pixel','BIZ UDPGothic',monospace" },
];

/** key → プリセット の対応表 */
export const FONT_MAP = Object.fromEntries(FONT_PRESETS.map((f) => [f.key, f]));

/** key からプリセットを得る（無ければ先頭=まる） */
export function getFont(key) {
  return FONT_MAP[key] || FONT_PRESETS[0];
}
