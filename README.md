# アイロンビーズ図案メーカー

画像をアップロードすると、**ブラウザ内だけ**で色を自動判定し、アイロンビーズ制作用のドット絵図案・数字付き設計図・色番号一覧・使用個数・印刷用ページを自動生成するWebアプリのMVPです。

- 画像は**外部サーバーへ送信しません**（読み込みも変換もすべてブラウザ内で完結）。
- ライブラリ（React / ReactDOM / htm）は `vendor/` に**ローカル同梱**。CDNや外部APIは使いません。
- **ビルド不要**（Node.js / npm 不要）。`MahjongScoreWeb` と同じく `serve.ps1` で起動します。
- PWA 対応（`manifest.webmanifest` + `sw.js`）。2回目以降はオフラインでも起動可能。

## 起動方法

PowerShell でこのフォルダに移動して、次を実行します。

```powershell
./serve.ps1
```

ブラウザで `http://localhost:8080/` が自動的に開きます（停止は Ctrl+C）。
ポートを変える場合は `./serve.ps1 -Port 8090`。

> ⚠ `index.html` をファイルとして直接ダブルクリックして開くと、ES Modules と Service Worker の制約で動きません。必ず `serve.ps1`（または任意の静的サーバ）経由で開いてください。

## 主な機能（MVP）

- 画像アップロード（jpg / jpeg / png / webp）、ドラッグ&ドロップ対応
- 指定ビーズ数へ縮小しドット絵化（横×縦を指定）
- 画像内の色を自動抽出 → 近似色を統合 → 最大色数以内に減色
- 少数色（既定: 3個以下）を近似色へ自動統合
- 色ごとに番号を自動割り振り、使用個数・割合を集計
- 表示モード: 完成イメージ / 数字付き設計図 / グリッド付き / 色別ハイライト / 元画像比較
- 色一覧（番号・色見本・HEX・推定色名・個数・割合）と手動編集（色変更・HEX/色名編集・色統合）
- マスをクリックして色を塗り替える手動編集
- PNG（完成・数字付き）/ CSV（色一覧）/ JSON（プロジェクト）出力、印刷用ページ（A4想定 `@media print`）
- localStorage への保存・読み込み

## 追加機能

- **画像の合わせ方**: 引き伸ばす / 切り抜き（範囲をドラッグ＋拡大で選択・比率ロックで歪まない）/ 全体（余白）
- **分割印刷**: 大きな図案を区画ごとにページ分割（行・列番号の見出し＋概観図つき）して貼り合わせ
- **実ビーズ色マッピング**: 検出色に近い市販ビーズ色（標準48 / パーラー風 / ハマ風・近似）を表示、図案全体をその色へスナップ
- **必要数の見積り**: 予備%を加えた購入目安を色一覧・CSV・印刷に表示
- **作業チェックモード**: 置いたマスをタップで消し込み、進捗（%）表示・色ごとの一括チェック
- **共有**: 画像を共有/保存（Web Share）、図案をURLに埋め込む共有リンク（サーバー不要）
- **PWA / モバイル**: ホーム画面に追加・オフライン起動、スマホでは画面幅に自動フィット

## 設定の初期値

| 項目 | 初期値 |
| --- | --- |
| 横 × 縦ビーズ数 | 64 × 64 |
| 最大色数 | 24（8/16/24/32/48/64 から選択） |
| 色統合の強さ / RGB距離しきい値 | 標準 / 35 |
| 少数色の自動統合 | ON（3個以下） |
| グリッド線 / 数字表示 / 背景 | ON / ON / 白扱い |
| ディザリング / コントラスト補正 / 輪郭強調 | OFF / OFF / OFF |

## ファイル構成

```text
BeadsPatternWeb/
  index.html              … エントリ（vendorのUMD読込後にjs/main.jsを実行）
  serve.ps1               … ローカル静的サーバ（Node不要）
  manifest.webmanifest    … PWAマニフェスト
  sw.js                   … Service Worker（オフライン対応）
  css/styles.css          … スタイル（3カラム / レスポンシブ / @media print）
  vendor/                 … React・ReactDOM・htm（ローカル同梱・外部送信なし）
  icons/                  … アプリアイコン（svg + png）
  js/
    main.js               … Reactルートのマウント
    App.js                … 状態管理と全体の結線
    types.js              … 型(JSDoc)と共有定数
    lib/
      html.js             … React + htm セットアップ
      renderPattern.js    … 図案描画の中心関数（プレビュー/書き出し共用）
    utils/
      colorDistance.js    … 色距離・変換・明度・文字色
      colorName.js        … 推定色名
      colorQuantize.js    … 減色アルゴリズム（純粋関数）
      colorDetection.js   … 変換パイプライン本体
      imageLoader.js      … 画像読み込み
      pixelateImage.js    … 指定サイズへ縮小しImageData化
      exportPng.js        … PNG書き出し
      exportCsv.js        … CSV書き出し
      storage.js          … localStorage保存・読み込み
    components/           … ImageUploader / SettingsPanel / BeadCanvas /
                            ColorPalette / ExportPanel / PrintView / ProjectList
```

> 仕様書の `src/` ツリー（React+TS+Vite前提）を、ビルド不要のESM構成へ読み替えています（`src/` → `js/`、`.tsx/.ts` → `.js`＋JSDoc型、`styles.css` → `css/styles.css`）。

## 将来拡張（TODO）

- スポイト / 塗りつぶし / 範囲選択 / Undo・Redo / 作業済みチェック
- 大きな図案の分割印刷
- iPhoneアプリ化（PWAとして「ホーム画面に追加」済の土台あり）

## プライバシー

著作権のある画像を扱う可能性を踏まえ、本アプリは画像を一切サーバーへ送信しません。個人利用・自作用の図案作成ツールです。
