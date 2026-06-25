// ============================================================
// 保存済み図案の一覧パネル ProjectList
// ------------------------------------------------------------
// localStorage に保存された図案(BeadPattern)を一覧表示し、各項目から
// 「読込」「削除」を行えるようにするコンポーネント。
//   - thumbnail があればサムネイル画像を表示(無ければプレースホルダ)
//   - タイトル / サイズ(横×縦) / 色数 / 総ビーズ数 / 更新日時 を表示
//   - currentId と一致する項目は「編集中」として強調表示
//   - 削除は確認ダイアログ(window.confirm)を挟む
// 親(App)が projects 配列と現在編集中のIDを渡し、操作は onLoad/onDelete で通知。
// ============================================================

import { html } from '../lib/html.js';

/**
 * 更新日時(ISO文字列)を「YYYY/M/D HH:MM」の見やすい形に整形する。
 * 不正な値の場合は空文字を返す(表示しない)。
 * @param {string=} iso
 * @returns {string}
 */
function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const mo = d.getMonth() + 1;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}/${mo}/${day} ${hh}:${mm}`;
}

/**
 * 保存済み図案一覧パネル。
 * @param {Object} props
 * @param {import('../types.js').BeadPattern[]} props.projects 保存済み図案の配列
 * @param {string|null} props.currentId 現在編集中の図案ID(強調表示用)
 * @param {(id: string) => void} props.onLoad 読込ボタン押下時
 * @param {(id: string) => void} props.onDelete 削除ボタン押下時(確認後に呼ぶ)
 */
export function ProjectList(props) {
  const { projects = [], currentId = null, onLoad, onDelete } = props;

  // 削除は誤操作防止のため確認を挟む
  const handleDelete = (project) => {
    const ok = window.confirm(`「${project.title || '無題'}」を削除します。よろしいですか？`);
    if (ok && onDelete) onDelete(project.id);
  };

  return html`
    <details class="panel projects panel--collapsible">
      <summary class="panel__title">保存した図案</summary>
      <div class="panel__body">
        ${projects.length === 0
          ? html`<p class="projects__empty muted">保存した図案はありません。</p>`
          : html`
              <ul class="projects__list">
                ${projects.map((p) => {
                  const isActive = currentId != null && p.id === currentId;
                  const colorCount = Array.isArray(p.colors) ? p.colors.length : 0;
                  const updated = formatDateTime(p.updatedAt);
                  return html`
                    <li
                      key=${p.id}
                      class=${'projects__item' + (isActive ? ' projects__item--active' : '')}
                    >
                      <div class="projects__thumb">
                        ${p.thumbnail
                          ? html`<img
                              class="projects__thumb-img"
                              src=${p.thumbnail}
                              alt=${`${p.title || '無題'} のサムネイル`}
                            />`
                          : html`<span class="projects__thumb-empty muted">画像なし</span>`}
                      </div>

                      <div class="projects__info">
                        <div class="projects__title">
                          ${p.title || '無題'}
                          ${isActive
                            ? html`<span class="badge projects__current-badge">編集中</span>`
                            : null}
                        </div>
                        <dl class="projects__meta">
                          <span class="projects__meta-item">サイズ ${p.width}×${p.height}</span>
                          <span class="projects__meta-item">色数 ${colorCount}</span>
                          <span class="projects__meta-item">ビーズ ${p.totalBeads}個</span>
                          ${updated
                            ? html`<span class="projects__meta-item projects__meta-date"
                                >更新 ${updated}</span
                              >`
                            : null}
                        </dl>
                      </div>

                      <div class="projects__actions">
                        <button
                          type="button"
                          class="btn btn--primary btn--sm"
                          onClick=${() => onLoad && onLoad(p.id)}
                        >
                          読み込む
                        </button>
                        <button
                          type="button"
                          class="btn btn--danger btn--sm"
                          onClick=${() => handleDelete(p)}
                        >
                          削除
                        </button>
                      </div>
                    </li>
                  `;
                })}
              </ul>
            `}
      </div>
    </details>
  `;
}
