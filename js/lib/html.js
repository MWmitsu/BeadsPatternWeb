// ============================================================
// React + htm の共有セットアップ
// ------------------------------------------------------------
// ビルド工程(Vite/Babel)を使わずにReactを動かすため、UMD版のReact/ReactDOMと
// htm を index.html の <script> でローカル読み込みし、ここでグローバルとして受け取る。
//
// htm とは:
//   JSXの代わりにES標準の「タグ付きテンプレートリテラル」でReact要素を書ける極小(約1KB)ライブラリ。
//   これによりトランスパイル無しでJSX相当の記述が可能になる(= Node/ビルド不要)。
//   使い方:  html`<div class="x">${child}</div>`
//
// 重要(htm × React の差異吸収):
//   htm は属性をそのまま createElement に渡すため、HTMLの書き味である
//   `class` / `for` / 文字列の `style` は React では正しく解釈されない。
//   そこで createElement をラップし、以下を正規化してから React.createElement へ渡す:
//     - class           → className
//     - for             → htmlFor
//     - style(文字列)    → スタイルオブジェクト
//   これにより各コンポーネントは素直に `class="..."` と書ける。
//
// すべてのコンポーネントは React/フック/html をこのモジュールから import すること。
// ============================================================

const React = window.React;
const ReactDOM = window.ReactDOM;
const htm = window.htm;

if (!React || !ReactDOM || !htm) {
  throw new Error(
    'vendor ライブラリの読み込みに失敗しました (React/ReactDOM/htm)。' +
      'index.html の <script> 読み込み順、または vendor/ フォルダを確認してください。'
  );
}

/** "background:#fff;color:#000" のような文字列を React の style オブジェクトへ変換 */
function styleStringToObject(str) {
  const obj = {};
  const parts = str.split(';');
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const idx = part.indexOf(':');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (!key) continue;
    // ハイフンケース → キャメルケース(background-color → backgroundColor)
    const camel = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    obj[camel] = val;
  }
  return obj;
}

/** htm から渡される props を React 向けに正規化してから createElement する */
function createElementNormalized(type, props, ...children) {
  if (props) {
    if ('class' in props && !('className' in props)) {
      props.className = props.class;
      delete props.class;
    }
    if ('for' in props && !('htmlFor' in props)) {
      props.htmlFor = props.for;
      delete props.for;
    }
    if (typeof props.style === 'string') {
      props.style = styleStringToObject(props.style);
    }
  }
  return React.createElement(type, props, ...children);
}

// html: htm を(正規化付き)createElement にバインドしたテンプレート関数
export const html = htm.bind(createElementNormalized);

export { React, ReactDOM };

// よく使うフック / API を再エクスポート
export const {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  useLayoutEffect,
  memo,
  Fragment,
  createElement,
} = React;

/**
 * 参照が安定したコールバックを返す(中身は毎レンダー最新を呼ぶ)。
 * React.memo した子へ渡しても再描画を誘発せず、かつ stale closure にもならない。
 * (提案中の React useEffectEvent と同等の安全パターン)
 */
export function useEvent(fn) {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback((...args) => ref.current && ref.current(...args), []);
}
