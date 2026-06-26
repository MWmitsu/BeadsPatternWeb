// ============================================================
// CloudSyncPanel: Googleログインでクラウド同期(複数端末でデータ共有)
// ------------------------------------------------------------
// 既存の「やること」「麻雀スコア」アプリと同じ Firebase 方式。
// ログインすると、保存した図案と在庫が iPad・PC など複数端末で自動同期される。
// 折りたたみパネル(details)。状態は App の cloudStatus から受け取る。
// ============================================================

import { html } from '../lib/html.js';

export function CloudSyncPanel(props) {
  const { status = {}, onSignIn, onSignOut } = props;
  const { available = true, signedIn = false, email = '', busy = false, error = null } = status;

  return html`
    <details class="panel cloudsync panel--collapsible">
      <summary class="panel__title">
        クラウド同期（Googleログイン）
        ${signedIn ? html`<span class="badge badge--on">オン</span>` : null}
      </summary>
      <div class="panel__body">
        ${error ? html`<p class="cloudsync__error">⚠ ${error}</p>` : null}
        ${!available
          ? html`<p class="muted">この環境では使えません。ホーム画面に追加したアプリ、または URL で開いた状態でお使いください（この端末内のみに保存されます）。</p>`
          : signedIn
            ? html`
                <p class="cloudsync__status">
                  クラウド同期：<b class="cloudsync__on">オン</b>
                  ${email ? html`<span class="muted"> 　${email}</span>` : null}
                  <br /><span class="muted">複数の端末（iPad・PCなど）で自動的に同期中です。</span>
                </p>
                <div class="cloudsync__actions">
                  <button type="button" class="btn btn--ghost" onClick=${onSignOut}>ログアウト</button>
                </div>
              `
            : html`
                <p class="muted cloudsync__lead">
                  Googleでログインすると、保存した図案と在庫が<b>複数の端末で自動的に同期</b>されます。
                  機種変更やiPad・PCの併用でもデータを引き継げます。
                </p>
                <div class="cloudsync__actions">
                  <button type="button" class="btn btn--primary cloudsync__signin" onClick=${onSignIn} disabled=${busy}>
                    ${busy ? '接続中…' : '🔑 Googleでログイン'}
                  </button>
                </div>
                <p class="muted cloudsync__note">
                  ※ ログイン時のみ Google（Firebase）に接続します。図案・在庫データはあなたのGoogleアカウントに保存されます（写真の元画像は送信しません）。
                </p>
              `}
      </div>
    </details>
  `;
}
