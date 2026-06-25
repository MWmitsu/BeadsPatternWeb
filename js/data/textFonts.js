// ============================================================
// 文字デザイン用フォントプリセット
// ------------------------------------------------------------
// フォント名は初心者に分かりにくいので「見た目の愛称＋見本」で選ばせる。
// 各 stack は Windows と iOS 双方で似た見た目になるようフォールバックを並べ、
// 末尾に総称(sans-serif/serif)を必ず置いてどの端末でも破綻しないようにする。
// フォントファイルは同梱しない（文字は作成時に即ビーズ格子へ画像化されるため、
// 共有相手の環境フォントには依存しない）。
// UI（見本タイル）も描画（ctx.font 組み立て）も、この1ソースを参照する。
// ============================================================

/** @typedef {{ key:string, label:string, sample:string, stack:string, forceBold?:boolean }} FontPreset */

/** @type {FontPreset[]} */
export const FONT_PRESETS = [
  {
    key: 'maru',
    label: 'まる',
    sample: 'あ',
    stack: "'Hiragino Maru Gothic ProN','ヒラギノ丸ゴ ProN','BIZ UDPGothic','Meiryo','メイリオ','Yu Gothic UI','游ゴシック',sans-serif",
  },
  {
    key: 'gothic',
    label: 'ゴシック',
    sample: 'あ',
    stack: "'Hiragino Sans','ヒラギノ角ゴシック','BIZ UDPGothic','Yu Gothic UI','游ゴシック','Meiryo','メイリオ','MS PGothic',sans-serif",
  },
  {
    key: 'futomaru',
    label: 'ふとマル',
    sample: 'あ',
    stack: "'Hiragino Maru Gothic ProN','ヒラギノ丸ゴ ProN','BIZ UDPGothic','Meiryo','メイリオ',sans-serif",
    forceBold: true,
  },
  {
    key: 'pop',
    label: 'ポップ',
    sample: 'Aあ',
    stack: "'Comic Sans MS','Chalkboard SE','Hiragino Maru Gothic ProN','ヒラギノ丸ゴ ProN','BIZ UDPGothic','Meiryo',sans-serif",
  },
  {
    key: 'mincho',
    label: '明朝',
    sample: 'あ',
    stack: "'Hiragino Mincho ProN','ヒラギノ明朝 ProN','YuMincho','游明朝','BIZ UDPMincho','MS PMincho',serif",
  },
  {
    key: 'kyokasho',
    label: 'きょうかしょ',
    sample: 'あ',
    stack: "'UD Digi Kyokasho N-R','UDデジタル教科書体 N-R','YuKyokasho','游明朝','Hiragino Mincho ProN',serif",
  },
];

/** key → プリセット の対応表 */
export const FONT_MAP = Object.fromEntries(FONT_PRESETS.map((f) => [f.key, f]));

/** key からプリセットを得る（無ければ先頭=まる） */
export function getFont(key) {
  return FONT_MAP[key] || FONT_PRESETS[0];
}
