// ============================================================
// エントリポイント: React ルートを #root にマウントする
// ============================================================

import { ReactDOM, html } from './lib/html.js';
import { App } from './App.js';

const container = document.getElementById('root');
const root = ReactDOM.createRoot(container);
root.render(html`<${App} />`);
