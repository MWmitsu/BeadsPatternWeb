// ============================================================
// 市販ビーズに近い色データ(純データ・関数なし・importなし)
// ------------------------------------------------------------
// 各パレット { id, name, brand, sizeMm, note, colors:[{code,name,hex}] }。
// hex は公式提供がほぼ無いため『見た目の近似値』。商品番号・色名は各社チャート参考。
// 公式の色とは異なる場合があります(各 note 参照)。
// ============================================================

export const BEAD_PALETTES = [
  {
    "id": "perler",
    "name": "Perler（5mm）",
    "brand": "Perler",
    "sizeMm": 5,
    "note": "Perler標準（Midi/5mm）の定番色を中心に約40色を収録。code は Perler の 1000ビーズ袋の品番体系 80-19NNN に寄せた（並行する色識別子 PNN と対応：例 Cheddar=P57=80-19057, Pastel Green=P53, Rust=P20）。hex は公式提供がほぼ無いため市販のカラーチャート等を参考にした見た目の近似値であり、公式の色とは異なる場合がある近似色。",
    "colors": [
      {
        "code": "80-19019",
        "name": "しろ",
        "hex": "#F4F4F0"
      },
      {
        "code": "80-19001",
        "name": "くろ",
        "hex": "#1B1B1B"
      },
      {
        "code": "80-19116",
        "name": "ライトグレー（うすはい）",
        "hex": "#B9BCBD"
      },
      {
        "code": "80-19018",
        "name": "グレー（はい）",
        "hex": "#7E8285"
      },
      {
        "code": "80-19005",
        "name": "あか",
        "hex": "#C8252B"
      },
      {
        "code": "80-19227",
        "name": "クランベリー（あかむらさき）",
        "hex": "#9E2347"
      },
      {
        "code": "80-19036",
        "name": "マゼンタ（あかむらさきいろ）",
        "hex": "#C72A6E"
      },
      {
        "code": "80-19009",
        "name": "ピンク（ももいろ）",
        "hex": "#EE7BA3"
      },
      {
        "code": "80-19103",
        "name": "ペールピンク（うすもも）",
        "hex": "#F6C2CE"
      },
      {
        "code": "80-19006",
        "name": "オレンジ（だいだい）",
        "hex": "#EE6A23"
      },
      {
        "code": "80-19057",
        "name": "チェダー（やまぶき）",
        "hex": "#F39C2B"
      },
      {
        "code": "80-19010",
        "name": "きいろ",
        "hex": "#F6D02F"
      },
      {
        "code": "80-19200",
        "name": "パステルイエロー（うすきいろ）",
        "hex": "#F4E59A"
      },
      {
        "code": "80-19020",
        "name": "ラスト（さびちゃ）",
        "hex": "#9E5A2B"
      },
      {
        "code": "80-19007",
        "name": "きみどり",
        "hex": "#7FB23A"
      },
      {
        "code": "80-19234",
        "name": "パロットグリーン（あざやかみどり）",
        "hex": "#3FA535"
      },
      {
        "code": "80-19008",
        "name": "みどり",
        "hex": "#2E8B42"
      },
      {
        "code": "80-19053",
        "name": "パステルグリーン（うすみどり）",
        "hex": "#A8D6A0"
      },
      {
        "code": "80-19038",
        "name": "ダークグリーン（ふかみどり）",
        "hex": "#1F5E36"
      },
      {
        "code": "80-19209",
        "name": "ターコイズ（あおみどり）",
        "hex": "#2BB3A9"
      },
      {
        "code": "80-19011",
        "name": "あお",
        "hex": "#2257A4"
      },
      {
        "code": "80-19208",
        "name": "ライトブルー（みずいろ）",
        "hex": "#6FB4DE"
      },
      {
        "code": "80-19201",
        "name": "パステルブルー（うすみずいろ）",
        "hex": "#A9CFEA"
      },
      {
        "code": "80-19086",
        "name": "ダークブルー（こん）",
        "hex": "#1E3A6E"
      },
      {
        "code": "80-19012",
        "name": "むらさき",
        "hex": "#5E3A93"
      },
      {
        "code": "80-19204",
        "name": "パステルラベンダー（うすむらさき）",
        "hex": "#C2B0DC"
      },
      {
        "code": "80-19013",
        "name": "ちゃいろ",
        "hex": "#6B4226"
      },
      {
        "code": "80-19077",
        "name": "タン（うすちゃ）",
        "hex": "#C49A6C"
      },
      {
        "code": "80-19135",
        "name": "サンド（すないろ）",
        "hex": "#D8C7A6"
      },
      {
        "code": "80-19058",
        "name": "うすだいだい（はだ）",
        "hex": "#F2C6A0"
      },
      {
        "code": "80-19259",
        "name": "ライトブラウン（こむぎ）",
        "hex": "#A9743F"
      },
      {
        "code": "80-19115",
        "name": "ベージュ（クリーム）",
        "hex": "#EEDFC4"
      },
      {
        "code": "80-19261",
        "name": "ピーチ（ももはだ）",
        "hex": "#F6B79B"
      },
      {
        "code": "80-19206",
        "name": "パステルピンク（さくら）",
        "hex": "#F4CAD6"
      },
      {
        "code": "80-19059",
        "name": "ホットコーラル（さんごいろ）",
        "hex": "#F25C54"
      },
      {
        "code": "80-19056",
        "name": "プラム（あずきいろ）",
        "hex": "#6E2C46"
      },
      {
        "code": "80-19109",
        "name": "ブラッシュ（くすみピンク）",
        "hex": "#D98C8C"
      },
      {
        "code": "80-19198",
        "name": "ミント（うすあおみどり）",
        "hex": "#AEE0CE"
      },
      {
        "code": "80-19033",
        "name": "ゴールド（こがね）",
        "hex": "#C9A227"
      },
      {
        "code": "80-19035",
        "name": "シルバー（ぎん）",
        "hex": "#A7ABAE"
      }
    ]
  },
  {
    "id": "perler-mini",
    "name": "Perler Mini（2.6mm）",
    "brand": "Perler",
    "sizeMm": 2.6,
    "note": "Perler Mini（2.6mm）の定番色を中心に約30色を収録。Mini は標準（Midi）とは別シリーズのため、code は Mini 品番体系に寄せた連番 80-54NNN を用いた近似的な識別子であり、公式の品番とは一致しない場合がある。hex は公式提供がほぼ無いため市販のカラーチャート等を参考にした見た目の近似値であり、公式の色とは異なる場合がある近似色。",
    "colors": [
      {
        "code": "80-54001",
        "name": "しろ",
        "hex": "#F4F4F0"
      },
      {
        "code": "80-54002",
        "name": "くろ",
        "hex": "#1B1B1B"
      },
      {
        "code": "80-54003",
        "name": "グレー（はい）",
        "hex": "#7E8285"
      },
      {
        "code": "80-54004",
        "name": "ライトグレー（うすはい）",
        "hex": "#BBBEC0"
      },
      {
        "code": "80-54005",
        "name": "あか",
        "hex": "#C8252B"
      },
      {
        "code": "80-54006",
        "name": "マゼンタ（あかむらさきいろ）",
        "hex": "#C72A6E"
      },
      {
        "code": "80-54007",
        "name": "ピンク（ももいろ）",
        "hex": "#EE7BA3"
      },
      {
        "code": "80-54008",
        "name": "ペールピンク（うすもも）",
        "hex": "#F6C2CE"
      },
      {
        "code": "80-54009",
        "name": "オレンジ（だいだい）",
        "hex": "#EE6A23"
      },
      {
        "code": "80-54010",
        "name": "チェダー（やまぶき）",
        "hex": "#F39C2B"
      },
      {
        "code": "80-54011",
        "name": "きいろ",
        "hex": "#F6D02F"
      },
      {
        "code": "80-54012",
        "name": "パステルイエロー（うすきいろ）",
        "hex": "#F4E59A"
      },
      {
        "code": "80-54013",
        "name": "ラスト（さびちゃ）",
        "hex": "#9E5A2B"
      },
      {
        "code": "80-54014",
        "name": "きみどり",
        "hex": "#7FB23A"
      },
      {
        "code": "80-54015",
        "name": "パロットグリーン（あざやかみどり）",
        "hex": "#3FA535"
      },
      {
        "code": "80-54016",
        "name": "みどり",
        "hex": "#2E8B42"
      },
      {
        "code": "80-54017",
        "name": "パステルグリーン（うすみどり）",
        "hex": "#A8D6A0"
      },
      {
        "code": "80-54018",
        "name": "ダークグリーン（ふかみどり）",
        "hex": "#1F5E36"
      },
      {
        "code": "80-54019",
        "name": "ターコイズ（あおみどり）",
        "hex": "#2BB3A9"
      },
      {
        "code": "80-54020",
        "name": "あお",
        "hex": "#2257A4"
      },
      {
        "code": "80-54021",
        "name": "ライトブルー（みずいろ）",
        "hex": "#6FB4DE"
      },
      {
        "code": "80-54022",
        "name": "ダークブルー（こん）",
        "hex": "#1E3A6E"
      },
      {
        "code": "80-54023",
        "name": "むらさき",
        "hex": "#5E3A93"
      },
      {
        "code": "80-54024",
        "name": "パステルラベンダー（うすむらさき）",
        "hex": "#C2B0DC"
      },
      {
        "code": "80-54025",
        "name": "ちゃいろ",
        "hex": "#6B4226"
      },
      {
        "code": "80-54026",
        "name": "サンド（すないろ）",
        "hex": "#D8C7A6"
      },
      {
        "code": "80-54027",
        "name": "うすだいだい（はだ）",
        "hex": "#F2C6A0"
      },
      {
        "code": "80-54028",
        "name": "ベージュ（クリーム）",
        "hex": "#EEDFC4"
      },
      {
        "code": "80-54029",
        "name": "ホットコーラル（さんごいろ）",
        "hex": "#F25C54"
      },
      {
        "code": "80-54030",
        "name": "ミント（うすあおみどり）",
        "hex": "#AEE0CE"
      }
    ]
  },
  {
    "id": "hama-midi",
    "name": "Hama Midi（5mm）",
    "brand": "Hama",
    "sizeMm": 5,
    "note": "Hama Midi(5mm)の定番色を中心に約40色。codeはHamaの実番号体系(H01〜)に準拠。hexは公式提供が無いため市販カラーチャート等を参考にした見た目の近似値であり、公式の色とは異なる場合がある近似色。重複hexは避けて作成。",
    "colors": [
      {
        "code": "H01",
        "name": "しろ",
        "hex": "#FFFFFF"
      },
      {
        "code": "H02",
        "name": "クリーム",
        "hex": "#F4ECD2"
      },
      {
        "code": "H03",
        "name": "きいろ",
        "hex": "#FFD500"
      },
      {
        "code": "H04",
        "name": "オレンジ",
        "hex": "#F39200"
      },
      {
        "code": "H05",
        "name": "あか",
        "hex": "#E2231A"
      },
      {
        "code": "H06",
        "name": "もも",
        "hex": "#F4A9BE"
      },
      {
        "code": "H07",
        "name": "むらさき",
        "hex": "#7C3F98"
      },
      {
        "code": "H08",
        "name": "あお",
        "hex": "#0054A6"
      },
      {
        "code": "H09",
        "name": "みどり",
        "hex": "#009639"
      },
      {
        "code": "H10",
        "name": "ちゃいろ",
        "hex": "#6B4226"
      },
      {
        "code": "H11",
        "name": "はいいろ",
        "hex": "#9B9B9B"
      },
      {
        "code": "H17",
        "name": "くろ",
        "hex": "#1A1A1A"
      },
      {
        "code": "H18",
        "name": "みずいろ",
        "hex": "#7FC8E6"
      },
      {
        "code": "H19",
        "name": "こん",
        "hex": "#1F2C5C"
      },
      {
        "code": "H20",
        "name": "きみどり",
        "hex": "#8DC63F"
      },
      {
        "code": "H21",
        "name": "ふかみどり",
        "hex": "#006837"
      },
      {
        "code": "H22",
        "name": "こげちゃ",
        "hex": "#4A2F1B"
      },
      {
        "code": "H26",
        "name": "うすだいだい",
        "hex": "#F6C9A8"
      },
      {
        "code": "H27",
        "name": "こむぎ",
        "hex": "#E8C170"
      },
      {
        "code": "H28",
        "name": "べに",
        "hex": "#B01E3C"
      },
      {
        "code": "H29",
        "name": "ふじいろ",
        "hex": "#9D8FC2"
      },
      {
        "code": "H30",
        "name": "うすみどり",
        "hex": "#B7DDA0"
      },
      {
        "code": "H31",
        "name": "うすき",
        "hex": "#FBE58A"
      },
      {
        "code": "H32",
        "name": "うすももいろ",
        "hex": "#F8CEDA"
      },
      {
        "code": "H33",
        "name": "しんく",
        "hex": "#C8102E"
      },
      {
        "code": "H35",
        "name": "そらいろ",
        "hex": "#4FA8DC"
      },
      {
        "code": "H36",
        "name": "わかくさ",
        "hex": "#5BA832"
      },
      {
        "code": "H37",
        "name": "あかちゃ",
        "hex": "#8A4B2C"
      },
      {
        "code": "H38",
        "name": "うすはい",
        "hex": "#CFCFCF"
      },
      {
        "code": "H43",
        "name": "こいむらさき",
        "hex": "#5B2A86"
      },
      {
        "code": "H44",
        "name": "ターコイズ",
        "hex": "#1FB6B6"
      },
      {
        "code": "H45",
        "name": "うすちゃ",
        "hex": "#C49A6C"
      },
      {
        "code": "H46",
        "name": "やまぶき",
        "hex": "#F5A623"
      },
      {
        "code": "H47",
        "name": "こいはい",
        "hex": "#5E5E5E"
      },
      {
        "code": "H48",
        "name": "マゼンタ",
        "hex": "#D6006E"
      },
      {
        "code": "H54",
        "name": "ペールブルー",
        "hex": "#AEDFF0"
      },
      {
        "code": "H58",
        "name": "ねずみ",
        "hex": "#7A7A7A"
      },
      {
        "code": "H60",
        "name": "サーモン",
        "hex": "#F19C7C"
      },
      {
        "code": "H70",
        "name": "わさびいろ",
        "hex": "#A3B86C"
      },
      {
        "code": "H75",
        "name": "あいいろ",
        "hex": "#2E4B8B"
      },
      {
        "code": "H83",
        "name": "だいだいちゃ",
        "hex": "#C96A2B"
      }
    ]
  },
  {
    "id": "hama-mini",
    "name": "Hama Mini（2.5mm）",
    "brand": "Hama",
    "sizeMm": 2.5,
    "note": "Hama Mini(2.5mm)の定番色を中心に約30色。codeはHamaのMini番号体系(M01〜)に準拠した識別子。hexは公式提供が無いため市販カラーチャート等を参考にした見た目の近似値であり、公式の色とは異なる場合がある近似色。重複hexは避けて作成。",
    "colors": [
      {
        "code": "M01",
        "name": "しろ",
        "hex": "#FCFCFC"
      },
      {
        "code": "M02",
        "name": "クリーム",
        "hex": "#F2E9CC"
      },
      {
        "code": "M03",
        "name": "きいろ",
        "hex": "#FFD400"
      },
      {
        "code": "M04",
        "name": "オレンジ",
        "hex": "#F18A00"
      },
      {
        "code": "M05",
        "name": "あか",
        "hex": "#DB1F26"
      },
      {
        "code": "M06",
        "name": "もも",
        "hex": "#F2A2BA"
      },
      {
        "code": "M07",
        "name": "むらさき",
        "hex": "#763C93"
      },
      {
        "code": "M08",
        "name": "あお",
        "hex": "#0050A0"
      },
      {
        "code": "M09",
        "name": "みどり",
        "hex": "#00913C"
      },
      {
        "code": "M10",
        "name": "ちゃいろ",
        "hex": "#653B22"
      },
      {
        "code": "M11",
        "name": "はいいろ",
        "hex": "#969696"
      },
      {
        "code": "M17",
        "name": "くろ",
        "hex": "#161616"
      },
      {
        "code": "M18",
        "name": "みずいろ",
        "hex": "#79C2E2"
      },
      {
        "code": "M19",
        "name": "こん",
        "hex": "#1C2856"
      },
      {
        "code": "M20",
        "name": "きみどり",
        "hex": "#86C13A"
      },
      {
        "code": "M21",
        "name": "ふかみどり",
        "hex": "#00622F"
      },
      {
        "code": "M22",
        "name": "こげちゃ",
        "hex": "#432A18"
      },
      {
        "code": "M26",
        "name": "うすだいだい",
        "hex": "#F4C4A1"
      },
      {
        "code": "M28",
        "name": "べに",
        "hex": "#AB1B38"
      },
      {
        "code": "M29",
        "name": "ふじいろ",
        "hex": "#9788BD"
      },
      {
        "code": "M30",
        "name": "うすみどり",
        "hex": "#AED894"
      },
      {
        "code": "M32",
        "name": "うすももいろ",
        "hex": "#F6C7D4"
      },
      {
        "code": "M35",
        "name": "そらいろ",
        "hex": "#48A2D6"
      },
      {
        "code": "M38",
        "name": "うすはい",
        "hex": "#C9C9C9"
      },
      {
        "code": "M44",
        "name": "ターコイズ",
        "hex": "#19AEAE"
      },
      {
        "code": "M46",
        "name": "やまぶき",
        "hex": "#F09E1A"
      },
      {
        "code": "M47",
        "name": "こいはい",
        "hex": "#585858"
      },
      {
        "code": "M48",
        "name": "マゼンタ",
        "hex": "#CC0068"
      },
      {
        "code": "M54",
        "name": "ペールブルー",
        "hex": "#A6DAEC"
      },
      {
        "code": "M75",
        "name": "あいいろ",
        "hex": "#293F7E"
      }
    ]
  },
  {
    "id": "artkal-midi",
    "name": "Artkal Midi S-5mm",
    "brand": "Artkal",
    "sizeMm": 5,
    "note": "Artkal Sシリーズ(5mm/ミディ)の代表色を約40色に抜粋。codeはS01..体系の実在番号に寄せた。hexは公式提供がほぼ無く、市販カラーチャート等を参考にした見た目の近似値であり、公式の色とは異なる場合がある近似色。",
    "colors": [
      {
        "code": "S01",
        "name": "しろ",
        "hex": "#FFFFFF"
      },
      {
        "code": "S02",
        "name": "オフホワイト",
        "hex": "#F4EFE4"
      },
      {
        "code": "S03",
        "name": "クリーム",
        "hex": "#F7E7B8"
      },
      {
        "code": "S07",
        "name": "はいいろ",
        "hex": "#9B9B9B"
      },
      {
        "code": "S08",
        "name": "こいはいいろ",
        "hex": "#5E5E5E"
      },
      {
        "code": "S09",
        "name": "ぎんねず",
        "hex": "#C7CBD0"
      },
      {
        "code": "S13",
        "name": "くろ",
        "hex": "#000000"
      },
      {
        "code": "S05",
        "name": "あか",
        "hex": "#E10600"
      },
      {
        "code": "S06",
        "name": "あかむらさき",
        "hex": "#A4123F"
      },
      {
        "code": "S04",
        "name": "オレンジ",
        "hex": "#FF671F"
      },
      {
        "code": "S15",
        "name": "うすだいだい",
        "hex": "#FFB07C"
      },
      {
        "code": "S27",
        "name": "きいろ",
        "hex": "#FFD100"
      },
      {
        "code": "S28",
        "name": "やまぶきいろ",
        "hex": "#F4A800"
      },
      {
        "code": "S29",
        "name": "レモンイエロー",
        "hex": "#FBEC5D"
      },
      {
        "code": "S20",
        "name": "みどり",
        "hex": "#249E6B"
      },
      {
        "code": "S21",
        "name": "ふかみどり",
        "hex": "#0F7A3D"
      },
      {
        "code": "S22",
        "name": "きみどり",
        "hex": "#8DC63F"
      },
      {
        "code": "S24",
        "name": "ときわみどり",
        "hex": "#00684A"
      },
      {
        "code": "S25",
        "name": "ミントグリーン",
        "hex": "#7FD1AE"
      },
      {
        "code": "S10",
        "name": "みずいろ",
        "hex": "#41B6E6"
      },
      {
        "code": "S11",
        "name": "そらいろ",
        "hex": "#5BC2E7"
      },
      {
        "code": "S12",
        "name": "あお",
        "hex": "#0072CE"
      },
      {
        "code": "S14",
        "name": "こん",
        "hex": "#1B2A6B"
      },
      {
        "code": "S16",
        "name": "ターコイズ",
        "hex": "#1AB9C4"
      },
      {
        "code": "S23",
        "name": "むらさき",
        "hex": "#64359B"
      },
      {
        "code": "S26",
        "name": "うすむらさき",
        "hex": "#B49AD6"
      },
      {
        "code": "S30",
        "name": "ふじいろ",
        "hex": "#8E7CC3"
      },
      {
        "code": "S19",
        "name": " baburugamu ",
        "hex": "#FCBFA9"
      },
      {
        "code": "S31",
        "name": "ピンク",
        "hex": "#F5639B"
      },
      {
        "code": "S32",
        "name": "こいピンク",
        "hex": "#E0218A"
      },
      {
        "code": "S33",
        "name": "さくらいろ",
        "hex": "#F8C8D8"
      },
      {
        "code": "S34",
        "name": "マゼンタ",
        "hex": "#C2185B"
      },
      {
        "code": "S17",
        "name": "ちゃいろ",
        "hex": "#7B4D35"
      },
      {
        "code": "S18",
        "name": "こげちゃ",
        "hex": "#4A2F1E"
      },
      {
        "code": "S35",
        "name": "きゃめる",
        "hex": "#A9743A"
      },
      {
        "code": "S36",
        "name": "ベージュ",
        "hex": "#D8B98C"
      },
      {
        "code": "S93",
        "name": "うすはだいろ",
        "hex": "#DAB698"
      },
      {
        "code": "S94",
        "name": "こいはだいろ",
        "hex": "#C68A66"
      },
      {
        "code": "S37",
        "name": "オリーブ",
        "hex": "#6B7A2E"
      },
      {
        "code": "S38",
        "name": "ワインレッド",
        "hex": "#7A1F2B"
      }
    ]
  },
  {
    "id": "artkal-mini",
    "name": "Artkal Mini C-2.6mm",
    "brand": "Artkal",
    "sizeMm": 2.6,
    "note": "Artkal Cシリーズ(2.6mm/ミニ)の代表色を約36色に抜粋。codeはC01..体系の連番に寄せた(Cシリーズの色名・色相はSシリーズと概ね対応)。hexは公式提供がほぼ無く、市販カラーチャート等を参考にした見た目の近似値であり、公式の色とは異なる場合がある近似色。",
    "colors": [
      {
        "code": "C01",
        "name": "しろ",
        "hex": "#FFFFFF"
      },
      {
        "code": "C02",
        "name": "オフホワイト",
        "hex": "#F3EDE0"
      },
      {
        "code": "C07",
        "name": "はいいろ",
        "hex": "#9A9A9A"
      },
      {
        "code": "C08",
        "name": "こいはいいろ",
        "hex": "#595959"
      },
      {
        "code": "C09",
        "name": "ぎんねず",
        "hex": "#C4C9CE"
      },
      {
        "code": "C13",
        "name": "くろ",
        "hex": "#000000"
      },
      {
        "code": "C05",
        "name": "あか",
        "hex": "#E2231A"
      },
      {
        "code": "C06",
        "name": "あかむらさき",
        "hex": "#A21942"
      },
      {
        "code": "C04",
        "name": "オレンジ",
        "hex": "#FF6A13"
      },
      {
        "code": "C15",
        "name": "うすだいだい",
        "hex": "#FFB37D"
      },
      {
        "code": "C27",
        "name": "きいろ",
        "hex": "#FFD400"
      },
      {
        "code": "C28",
        "name": "やまぶきいろ",
        "hex": "#F2A100"
      },
      {
        "code": "C29",
        "name": "レモンイエロー",
        "hex": "#FAE85C"
      },
      {
        "code": "C20",
        "name": "みどり",
        "hex": "#1FA06A"
      },
      {
        "code": "C21",
        "name": "ふかみどり",
        "hex": "#0E7338"
      },
      {
        "code": "C22",
        "name": "きみどり",
        "hex": "#8CC63E"
      },
      {
        "code": "C25",
        "name": "ミントグリーン",
        "hex": "#82D4B0"
      },
      {
        "code": "C10",
        "name": "みずいろ",
        "hex": "#43B8E8"
      },
      {
        "code": "C12",
        "name": "あお",
        "hex": "#0070CE"
      },
      {
        "code": "C14",
        "name": "こん",
        "hex": "#1A2966"
      },
      {
        "code": "C16",
        "name": "ターコイズ",
        "hex": "#17B6C1"
      },
      {
        "code": "C23",
        "name": "むらさき",
        "hex": "#6233A0"
      },
      {
        "code": "C26",
        "name": "うすむらさき",
        "hex": "#B398D8"
      },
      {
        "code": "C30",
        "name": "ふじいろ",
        "hex": "#8D7BC6"
      },
      {
        "code": "C31",
        "name": "ピンク",
        "hex": "#F4609A"
      },
      {
        "code": "C32",
        "name": "こいピンク",
        "hex": "#DE1E87"
      },
      {
        "code": "C33",
        "name": "さくらいろ",
        "hex": "#F9CAD9"
      },
      {
        "code": "C19",
        "name": "あわピンク",
        "hex": "#FBC2AB"
      },
      {
        "code": "C17",
        "name": "ちゃいろ",
        "hex": "#794B33"
      },
      {
        "code": "C18",
        "name": "こげちゃ",
        "hex": "#472D1C"
      },
      {
        "code": "C35",
        "name": "きゃめる",
        "hex": "#A77238"
      },
      {
        "code": "C36",
        "name": "ベージュ",
        "hex": "#D6B789"
      },
      {
        "code": "C93",
        "name": "うすはだいろ",
        "hex": "#D9B496"
      },
      {
        "code": "C94",
        "name": "こいはだいろ",
        "hex": "#C58864"
      },
      {
        "code": "C37",
        "name": "オリーブ",
        "hex": "#69782C"
      },
      {
        "code": "C38",
        "name": "ワインレッド",
        "hex": "#781D29"
      }
    ]
  },
  {
    "id": "daiso",
    "name": "ダイソー（5mm）",
    "brand": "ダイソー",
    "sizeMm": 5,
    "note": "ダイソーには公式の色番号がなく、codeは当アプリ独自の連番です。hexは市販のカラーチャートを参考にした見た目の近似値で、公式の色とは異なる場合がある近似色です。",
    "colors": [
      {
        "code": "D01",
        "name": "しろ",
        "hex": "#F7F7F2"
      },
      {
        "code": "D02",
        "name": "オフホワイト",
        "hex": "#ECE7DA"
      },
      {
        "code": "D03",
        "name": "はいいろ",
        "hex": "#9A9C9E"
      },
      {
        "code": "D04",
        "name": "くろ",
        "hex": "#1E1E20"
      },
      {
        "code": "D05",
        "name": "あか",
        "hex": "#D8262C"
      },
      {
        "code": "D06",
        "name": "ピンク",
        "hex": "#EF7FA8"
      },
      {
        "code": "D07",
        "name": "だいだい",
        "hex": "#EF7E2C"
      },
      {
        "code": "D08",
        "name": "きいろ",
        "hex": "#F6CE1E"
      },
      {
        "code": "D09",
        "name": "クリームいろ",
        "hex": "#F3E6A0"
      },
      {
        "code": "D10",
        "name": "きみどり",
        "hex": "#9BC93C"
      },
      {
        "code": "D11",
        "name": "みどり",
        "hex": "#2F9E54"
      },
      {
        "code": "D12",
        "name": "ふかみどり",
        "hex": "#157A47"
      },
      {
        "code": "D13",
        "name": "みずいろ",
        "hex": "#6FC6E6"
      },
      {
        "code": "D14",
        "name": "あお",
        "hex": "#2A6DC4"
      },
      {
        "code": "D15",
        "name": "こん",
        "hex": "#1F3A75"
      },
      {
        "code": "D16",
        "name": "むらさき",
        "hex": "#7B4FA0"
      },
      {
        "code": "D17",
        "name": "うすむらさき",
        "hex": "#B69AD0"
      },
      {
        "code": "D18",
        "name": "ちゃいろ",
        "hex": "#7A4B2B"
      },
      {
        "code": "D19",
        "name": "こげちゃ",
        "hex": "#4A2E1C"
      },
      {
        "code": "D20",
        "name": "うすだいだい",
        "hex": "#F4C9A6"
      },
      {
        "code": "D21",
        "name": "くすみピンク",
        "hex": "#D9A6A0"
      },
      {
        "code": "D22",
        "name": "くすみブルー",
        "hex": "#8FA7B8"
      },
      {
        "code": "D23",
        "name": "クリアレッド",
        "hex": "#E14B57"
      },
      {
        "code": "D24",
        "name": "クリアブルー",
        "hex": "#7FB8DD"
      }
    ]
  },
  {
    "id": "standard48",
    "name": "標準（48色・5mm）",
    "brand": "汎用",
    "sizeMm": 5,
    "note": "特定ブランド非依存の汎用標準色（目安）です。hexは見た目の目安として設定した近似値で、公式の色とは異なる場合がある近似色です。",
    "colors": [
      {
        "code": "S01",
        "name": "しろ",
        "hex": "#FFFFFF"
      },
      {
        "code": "S02",
        "name": "オフホワイト",
        "hex": "#F1EEE4"
      },
      {
        "code": "S03",
        "name": "ごくうすいはいいろ",
        "hex": "#D7D9DA"
      },
      {
        "code": "S04",
        "name": "はいいろ",
        "hex": "#9DA0A3"
      },
      {
        "code": "S05",
        "name": "こいはいいろ",
        "hex": "#5E6164"
      },
      {
        "code": "S06",
        "name": "くろ",
        "hex": "#16161A"
      },
      {
        "code": "S07",
        "name": "あか",
        "hex": "#E0282E"
      },
      {
        "code": "S08",
        "name": "あかむらさき",
        "hex": "#C42A6B"
      },
      {
        "code": "S09",
        "name": "こいあか",
        "hex": "#A81D27"
      },
      {
        "code": "S10",
        "name": "ローズ",
        "hex": "#E36A8E"
      },
      {
        "code": "S11",
        "name": "ピンク",
        "hex": "#F39CBC"
      },
      {
        "code": "S12",
        "name": "うすピンク",
        "hex": "#F8C7D7"
      },
      {
        "code": "S13",
        "name": "サーモンピンク",
        "hex": "#F4A38C"
      },
      {
        "code": "S14",
        "name": "だいだい",
        "hex": "#F07B27"
      },
      {
        "code": "S15",
        "name": "こいだいだい",
        "hex": "#D85F17"
      },
      {
        "code": "S16",
        "name": "やまぶきいろ",
        "hex": "#F5A623"
      },
      {
        "code": "S17",
        "name": "きいろ",
        "hex": "#F7D117"
      },
      {
        "code": "S18",
        "name": "うすきいろ",
        "hex": "#F6E78A"
      },
      {
        "code": "S19",
        "name": "クリームいろ",
        "hex": "#F2E9B8"
      },
      {
        "code": "S20",
        "name": "ライムグリーン",
        "hex": "#C2D92E"
      },
      {
        "code": "S21",
        "name": "きみどり",
        "hex": "#92C73E"
      },
      {
        "code": "S22",
        "name": "みどり",
        "hex": "#34A14F"
      },
      {
        "code": "S23",
        "name": "こいみどり",
        "hex": "#1C7A3F"
      },
      {
        "code": "S24",
        "name": "ふかみどり",
        "hex": "#0F5733"
      },
      {
        "code": "S25",
        "name": "エメラルド",
        "hex": "#1FAE8B"
      },
      {
        "code": "S26",
        "name": "ターコイズ",
        "hex": "#22B5C4"
      },
      {
        "code": "S27",
        "name": "みずいろ",
        "hex": "#74C7E8"
      },
      {
        "code": "S28",
        "name": "そらいろ",
        "hex": "#4AA3DE"
      },
      {
        "code": "S29",
        "name": "あお",
        "hex": "#2A6CC9"
      },
      {
        "code": "S30",
        "name": "こいあお",
        "hex": "#1E4FA3"
      },
      {
        "code": "S31",
        "name": "こん",
        "hex": "#1B2F66"
      },
      {
        "code": "S32",
        "name": "あおむらさき",
        "hex": "#5B4B9E"
      },
      {
        "code": "S33",
        "name": "むらさき",
        "hex": "#7E4FA6"
      },
      {
        "code": "S34",
        "name": "うすむらさき",
        "hex": "#B59BD4"
      },
      {
        "code": "S35",
        "name": "ラベンダー",
        "hex": "#CDB8E6"
      },
      {
        "code": "S36",
        "name": "こいむらさき",
        "hex": "#5A2E7A"
      },
      {
        "code": "S37",
        "name": "マゼンタ",
        "hex": "#C7338A"
      },
      {
        "code": "S38",
        "name": "ワインレッド",
        "hex": "#7E2238"
      },
      {
        "code": "S39",
        "name": "うすだいだい",
        "hex": "#F5CDA8"
      },
      {
        "code": "S40",
        "name": "はだいろ",
        "hex": "#EBB48E"
      },
      {
        "code": "S41",
        "name": "きんちゃ",
        "hex": "#B07A2E"
      },
      {
        "code": "S42",
        "name": "ちゃいろ",
        "hex": "#7C4A26"
      },
      {
        "code": "S43",
        "name": "こげちゃ",
        "hex": "#4A2D1A"
      },
      {
        "code": "S44",
        "name": "ベージュ",
        "hex": "#D8C2A0"
      },
      {
        "code": "S45",
        "name": "カーキ",
        "hex": "#8A8A4B"
      },
      {
        "code": "S46",
        "name": "オリーブ",
        "hex": "#6B7029"
      },
      {
        "code": "S47",
        "name": "くすみブルー",
        "hex": "#8AA3B6"
      },
      {
        "code": "S48",
        "name": "くすみピンク",
        "hex": "#D2A0A2"
      }
    ]
  }
];

export const DEFAULT_BEAD_PALETTE_ID = 'standard48';
