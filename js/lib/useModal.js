// ============================================================
// useModalA11y: モーダルのキーボード操作・フォーカス制御をまとめた共有フック
// ------------------------------------------------------------
// 各モーダル(role="dialog" aria-modal)に次を一括で付与する:
//   - 開いたら中の最初の操作子へフォーカス(背後に取り残さない)
//   - Esc で閉じる
//   - Tab/Shift+Tab をモーダル内で循環(背後の操作子へ抜けない)
//   - 閉じたら元の場所へフォーカスを戻す
// ============================================================

import { useEffect, useRef } from './html.js';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * @param {{current: HTMLElement|null}} sheetRef モーダルの中身(シート)要素への ref
 * @param {Function} onClose 閉じるコールバック(Esc で呼ぶ)
 */
export function useModalA11y(sheetRef, onClose) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const sheet = sheetRef.current;
    const prevActive = (typeof document !== 'undefined') ? document.activeElement : null;

    // 開いたら最初の操作子へフォーカス(無ければシート自体)
    if (sheet) {
      const first = sheet.querySelector(FOCUSABLE);
      if (first && first.focus) {
        try { first.focus(); } catch (_) {}
      } else {
        sheet.setAttribute('tabindex', '-1');
        try { sheet.focus(); } catch (_) {}
      }
    }

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (closeRef.current) closeRef.current();
        return;
      }
      if (e.key === 'Tab' && sheet) {
        const items = [...sheet.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
        if (!items.length) return;
        const firstEl = items[0];
        const lastEl = items[items.length - 1];
        if (!sheet.contains(document.activeElement)) {
          e.preventDefault();
          firstEl.focus();
        } else if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };

    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      // 閉じたら元の要素へフォーカスを戻す
      if (prevActive && prevActive.focus) {
        try { prevActive.focus(); } catch (_) {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
