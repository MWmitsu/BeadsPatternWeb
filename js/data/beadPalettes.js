// ============================================================
// 市販ビーズに近い色データ(純データ・関数なし・importなし)
// ------------------------------------------------------------
// 各パレットは { id, name, note, colors } 構造。
// colors の各要素は { code, name, hex } で、hex は "#RRGGBB" 大文字。
// name は日本語の色名、code は短い識別子。
// hex は視覚的に妥当でパレット内重複しない近似値。
// ※ パーラー/ハマは公式色ではなく近似色(note に明記)。
// ============================================================

/**
 * @typedef {Object} PaletteColor
 * @property {string} code 短い識別子(例 'S01')
 * @property {string} name 日本語の色名
 * @property {string} hex  "#RRGGBB"(大文字)
 */

/**
 * @typedef {Object} BeadPalette
 * @property {string} id
 * @property {string} name
 * @property {string} note
 * @property {PaletteColor[]} colors
 */

/** @type {BeadPalette[]} 市販ビーズ近似パレット集 */
export const BEAD_PALETTES = [
  // --------------------------------------------------------
  // 1) 標準（48色）: 当アプリの標準色
  //    色相環(赤系〜桃)×明暗 + 無彩色 + 肌色/茶系
  // --------------------------------------------------------
  {
    id: 'standard48',
    name: '標準（48色）',
    note: '当アプリの標準色。市販ビーズ購入時の目安に。',
    colors: [
      // 赤・朱
      { code: 'S01', name: 'あか', hex: '#E2232B' },
      { code: 'S02', name: 'べにいろ', hex: '#B01724' },
      { code: 'S03', name: 'しゅいろ', hex: '#F04E23' },
      // 橙
      { code: 'S04', name: 'だいだい', hex: '#F57C1F' },
      { code: 'S05', name: 'やまぶき', hex: '#F4A11D' },
      // 黄
      { code: 'S06', name: 'きいろ', hex: '#FFD300' },
      { code: 'S07', name: 'うすきいろ', hex: '#FCE98A' },
      { code: 'S08', name: 'からしいろ', hex: '#C9A227' },
      // 黄緑
      { code: 'S09', name: 'きみどり', hex: '#A6CE39' },
      { code: 'S10', name: 'わかくさいろ', hex: '#7CB342' },
      // 緑
      { code: 'S11', name: 'みどり', hex: '#2E9E48' },
      { code: 'S12', name: 'ふかみどり', hex: '#1B6E3A' },
      { code: 'S13', name: 'うすみどり', hex: '#9FD8A6' },
      // 青緑
      { code: 'S14', name: 'あおみどり', hex: '#11A39A' },
      { code: 'S15', name: 'ふかあおみどり', hex: '#0E7C75' },
      // 水色
      { code: 'S16', name: 'みずいろ', hex: '#5EC8E5' },
      { code: 'S17', name: 'うすみずいろ', hex: '#AEE2F2' },
      // 青
      { code: 'S18', name: 'あお', hex: '#1C75BC' },
      { code: 'S19', name: 'そらいろ', hex: '#3E9BD8' },
      // 紺
      { code: 'S20', name: 'こん', hex: '#13357A' },
      { code: 'S21', name: 'ぐんじょう', hex: '#283C9E' },
      // 青紫
      { code: 'S22', name: 'あおむらさき', hex: '#5B4BA3' },
      { code: 'S23', name: 'すみれいろ', hex: '#7A5FC0' },
      // 紫
      { code: 'S24', name: 'むらさき', hex: '#8E3FA8' },
      { code: 'S25', name: 'うすむらさき', hex: '#C49BD6' },
      // 赤紫
      { code: 'S26', name: 'あかむらさき', hex: '#B0297A' },
      { code: 'S27', name: 'まじぇんた', hex: '#D6248C' },
      // 桃
      { code: 'S28', name: 'ももいろ', hex: '#F384B0' },
      { code: 'S29', name: 'うすもも', hex: '#F9C2D6' },
      { code: 'S30', name: 'こいもも', hex: '#E85C92' },
      // 無彩色
      { code: 'S31', name: 'しろ', hex: '#FFFFFF' },
      { code: 'S32', name: 'おふほわいと', hex: '#F3EFE6' },
      { code: 'S33', name: 'うすはいいろ', hex: '#CFD2D4' },
      { code: 'S34', name: 'はいいろ', hex: '#9A9DA1' },
      { code: 'S35', name: 'こいはいいろ', hex: '#5A5E63' },
      { code: 'S36', name: 'くろ', hex: '#1A1A1A' },
      // 肌色・ベージュ・茶系
      { code: 'S37', name: 'うすだいだい', hex: '#FBD5B5' },
      { code: 'S38', name: 'はだいろ', hex: '#F2C09A' },
      { code: 'S39', name: 'ベージュ', hex: '#E4CBA6' },
      { code: 'S40', name: 'うすちゃ', hex: '#C49A6C' },
      { code: 'S41', name: 'ちゃいろ', hex: '#8B5A2B' },
      { code: 'S42', name: 'こげちゃ', hex: '#5A3A1E' },
      // 追加色相(中間色の補強)
      { code: 'S43', name: 'さんごいろ', hex: '#F2705B' },
      { code: 'S44', name: 'レモンいろ', hex: '#F5E050' },
      { code: 'S45', name: 'ターコイズ', hex: '#1FB6C9' },
      { code: 'S46', name: 'みなとブルー', hex: '#0F5E8C' },
      { code: 'S47', name: 'ラベンダー', hex: '#B7A8DD' },
      { code: 'S48', name: 'えんじ', hex: '#7A1F2B' },
    ],
  },

  // --------------------------------------------------------
  // 2) パーラー風（近似）: Perler でよくある色を JP名+近似hex
  // --------------------------------------------------------
  {
    id: 'perler',
    name: 'パーラー風（近似）',
    note: '公式の色ではない近似色です。目安としてご利用ください。',
    colors: [
      { code: 'P01', name: 'しろ', hex: '#FBFBF7' },
      { code: 'P02', name: 'くろ', hex: '#1B1B1B' },
      { code: 'P03', name: 'はいいろ', hex: '#9B9FA3' },
      { code: 'P04', name: 'あか', hex: '#D81E2C' },
      { code: 'P05', name: 'チェリー', hex: '#A8132A' },
      { code: 'P06', name: 'オレンジ', hex: '#F36F21' },
      { code: 'P07', name: 'やまぶき', hex: '#F6A623' },
      { code: 'P08', name: 'きいろ', hex: '#FFD61E' },
      { code: 'P09', name: 'クリーム', hex: '#F8EDB0' },
      { code: 'P10', name: 'きみどり', hex: '#9CCB3B' },
      { code: 'P11', name: 'みどり', hex: '#2BA24C' },
      { code: 'P12', name: 'ふかみどり', hex: '#19743C' },
      { code: 'P13', name: 'ミント', hex: '#8FD6B4' },
      { code: 'P14', name: 'みずいろ', hex: '#69C7E6' },
      { code: 'P15', name: 'あお', hex: '#1E73BE' },
      { code: 'P16', name: 'こん', hex: '#1C3A78' },
      { code: 'P17', name: 'ターコイズ', hex: '#1BB5C4' },
      { code: 'P18', name: 'むらさき', hex: '#7E3FA6' },
      { code: 'P19', name: 'うすむらさき', hex: '#B594D2' },
      { code: 'P20', name: 'ふじいろ', hex: '#9A8AD0' },
      { code: 'P21', name: 'ピンク', hex: '#F072A8' },
      { code: 'P22', name: 'うすピンク', hex: '#F9C5D8' },
      { code: 'P23', name: 'マゼンタ', hex: '#D32D8B' },
      { code: 'P24', name: 'うすだいだい', hex: '#FBD2AE' },
      { code: 'P25', name: 'ベージュ', hex: '#E3C8A0' },
      { code: 'P26', name: 'ちゃいろ', hex: '#8A5A2C' },
      { code: 'P27', name: 'こげちゃ', hex: '#583720' },
      { code: 'P28', name: 'うすちゃ', hex: '#BE946A' },
      { code: 'P29', name: 'からしいろ', hex: '#C7A12A' },
      { code: 'P30', name: 'サンゴ', hex: '#F26B57' },
    ],
  },

  // --------------------------------------------------------
  // 3) ハマ風（近似）: Hama でよくある色を JP名+近似hex
  // --------------------------------------------------------
  {
    id: 'hama',
    name: 'ハマ風（近似）',
    note: '公式の色ではない近似色です。目安としてご利用ください。',
    colors: [
      { code: 'H01', name: 'しろ', hex: '#FCFCF9' },
      { code: 'H02', name: 'くろ', hex: '#202020' },
      { code: 'H03', name: 'はいいろ', hex: '#8E9296' },
      { code: 'H04', name: 'こいはいいろ', hex: '#56595D' },
      { code: 'H05', name: 'あか', hex: '#D42230' },
      { code: 'H06', name: 'えんじ', hex: '#9C1C2C' },
      { code: 'H07', name: 'オレンジ', hex: '#F2701D' },
      { code: 'H08', name: 'やまぶき', hex: '#F5A41C' },
      { code: 'H09', name: 'きいろ', hex: '#FFD914' },
      { code: 'H10', name: 'うすきいろ', hex: '#FAEA9A' },
      { code: 'H11', name: 'きみどり', hex: '#92C63E' },
      { code: 'H12', name: 'みどり', hex: '#239A47' },
      { code: 'H13', name: 'ふかみどり', hex: '#15673A' },
      { code: 'H14', name: 'パステルグリーン', hex: '#A9DCB0' },
      { code: 'H15', name: 'みずいろ', hex: '#62C4E4' },
      { code: 'H16', name: 'パステルブルー', hex: '#A9DCEF' },
      { code: 'H17', name: 'あお', hex: '#1A6FB5' },
      { code: 'H18', name: 'こん', hex: '#1B356F' },
      { code: 'H19', name: 'あおみどり', hex: '#149C92' },
      { code: 'H20', name: 'むらさき', hex: '#74399E' },
      { code: 'H21', name: 'パステルパープル', hex: '#C0A8DC' },
      { code: 'H22', name: 'あおむらさき', hex: '#5547A0' },
      { code: 'H23', name: 'ピンク', hex: '#EE6FA4' },
      { code: 'H24', name: 'うすピンク', hex: '#F8C3D6' },
      { code: 'H25', name: 'こいピンク', hex: '#E0357F' },
      { code: 'H26', name: 'うすだいだい', hex: '#FBD0AB' },
      { code: 'H27', name: 'ベージュ', hex: '#E1C59C' },
      { code: 'H28', name: 'ちゃいろ', hex: '#855629' },
      { code: 'H29', name: 'こげちゃ', hex: '#523320' },
      { code: 'H30', name: 'うすちゃ', hex: '#BB9066' },
    ],
  },
];

/** 既定パレットID */
export const DEFAULT_BEAD_PALETTE_ID = 'standard48';
