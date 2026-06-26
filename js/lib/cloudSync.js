// ============================================================
// cloudSync: Googleログインでクラウド同期(Firebase Firestore)
// ------------------------------------------------------------
// 既存の「やること(task)」「麻雀スコア」アプリと同じ Firebase 方式をベースにしつつ、
// この豆アプリは「図案(projects)」と「在庫(inventory)」という独立した2系統のデータを持つため、
// 単純な「1ドキュメント丸ごと上書き(last-writer-wins)」だと、片方を編集しただけで
// もう片方が別端末で消える等のデータ消失が起きる。これを避ける設計:
//
//  * データは beadsweb/{uid} の1ドキュメントに { projects, inventory } として保存。2系統は独立に同期。
//  * 取り込み判定は「時刻」ではなく「内容のハッシュ(sig)」で行う(端末間の時計ずれに強い・決定的):
//    端末は最後に同期した内容のsig(=基準 high-water mark)を localStorage に保持する。
//    - 受信: 系統ごとに、クラウドの内容sigが基準と違い かつ 未送信のローカル変更(dirty)が無いときだけ取り込む。
//    - 送信: 変わった系統だけを merge:true で書く。取り込み(adopt)はpushを誘発しないのでping-pongしない。
//    - ログイン時(reconcile): 系統ごとに「クラウドが基準と違う/ローカルが基準と違う」を判定し、
//      両方変わっていれば1回だけ確認ダイアログ、片方だけなら自動で取り込み/送信。
//  * push失敗は握りつぶさず再試行(指数バックオフ)。容量超過などの恒久エラーは状態として通知。
//  * 取り込みは「端末への保存が成功したときだけ」基準を更新する(保存失敗で取りこぼさない)。
//  * 認証が切り替わった後に古いpushが解決しても無視する(authGenガード)。
//
// Firebase SDK は「Googleでログイン」を押したときに初めて読み込む(遅延読込)ので、
// 使わない人のためには本体は外部スクリプトを読み込まない。
// App 側は init() でコールバックを渡し、ローカル⇄クラウドの読み書きを委譲する。
// ============================================================

const FIREBASE_VERSION = '10.12.2';
const SCRIPTS = [
  `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app-compat.js`,
  `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth-compat.js`,
  `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore-compat.js`,
];
// 既存アプリと同じ Firebase プロジェクト(公開設定・秘密情報ではない)。
const firebaseConfig = {
  apiKey: 'AIzaSyA1FESENiPINRETzsSC9kx7IWwVz2cFMgE',
  authDomain: 'mahjong-score-640be.firebaseapp.com',
  projectId: 'mahjong-score-640be',
  storageBucket: 'mahjong-score-640be.firebasestorage.app',
  messagingSenderId: '984052277684',
  appId: '1:984052277684:web:ecd17b70b7a0ff61a552e1',
};
const COLL = 'beadsweb';
const FIELDS = ['projects', 'inventory'];

let cbs = {
  getLocal: () => ({ projects: [], inventory: {} }),
  applyRemote: () => true,
  onStatus: () => {},
  confirmConflict: () => true,
  toast: () => {},
};
let loadPromise = null;
let inited = false;
let auth = null, db = null, user = null, unsub = null;
let pushTimer = null, pushing = false, applyingRemote = false, reconciling = false, authGen = 0;
let needsReconcile = false; // get()失敗時、最初のsnapshotをreconcile経由にする
let retryCount = 0;
let lastError = null;
const dirty = { projects: false, inventory: false }; // 未送信のローカル変更がある系統
let hwm = { sig: {} }; // 基準: 系統ごとの「最後に同期した内容」のハッシュ

function supportedEnv() { return /^https?:$/.test(location.protocol); }

// ---- 内容ハッシュ(順序非依存) ------------------------------------
function stableStringify(x) {
  if (x === null || typeof x !== 'object') return JSON.stringify(x);
  if (Array.isArray(x)) return '[' + x.map(stableStringify).join(',') + ']';
  const keys = Object.keys(x).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(x[k])).join(',') + '}';
}
function djb2(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return s.length + ':' + (h >>> 0).toString(36);
}
/** 系統の内容を順序非依存にハッシュ化(projectsはid順に正規化)。空でも一定の文字列を返す。 */
function sigOf(field, v) {
  if (field === 'projects') {
    const arr = (Array.isArray(v) ? v.slice() : []).sort((a, b) =>
      String((a && a.id) || '').localeCompare(String((b && b.id) || ''))
    );
    return djb2('[' + arr.map(stableStringify).join(',') + ']');
  }
  return djb2(stableStringify(v && typeof v === 'object' && !Array.isArray(v) ? v : {}));
}
function hasField(v) {
  if (Array.isArray(v)) return v.length > 0;
  if (v && typeof v === 'object') return Object.keys(v).length > 0;
  return false;
}
function normField(field, v) {
  if (field === 'projects') return Array.isArray(v) ? v : [];
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
}

// ---- 基準(hwm)の永続化(端末×アカウント単位) -----------------------
function hwmKey(uid) { return 'beads-cloud-hwm-v2:' + uid; }
function loadHwm(uid) {
  try {
    const r = localStorage.getItem(hwmKey(uid));
    if (r) { const o = JSON.parse(r); return { sig: (o && o.sig) || {} }; }
  } catch (_) {}
  return { sig: {} };
}
function saveHwm() {
  try { if (user) localStorage.setItem(hwmKey(user.uid), JSON.stringify(hwm)); } catch (_) {}
}

// ---- Firebase 遅延読込・初期化 -----------------------------------
function loadFirebase() {
  if (window.firebase && window.firebase.initializeApp) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = SCRIPTS.reduce(
    (p, src) => p.then(() => new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.onload = resolve;
      s.onerror = () => reject(new Error('firebase script load failed: ' + src));
      document.head.appendChild(s);
    })),
    Promise.resolve()
  );
  return loadPromise;
}
function ensureFirebaseReady() {
  return loadFirebase().then(() => {
    if (inited) return;
    inited = true;
    window.firebase.initializeApp(firebaseConfig);
    auth = window.firebase.auth();
    db = window.firebase.firestore();
    try { db.enablePersistence({ synchronizeTabs: true }).catch(() => {}); } catch (_) {}
    auth.onAuthStateChanged((u) => onAuth(u));
  });
}

function docRef() { return db.collection(COLL).doc(user.uid); }

function friendlyError(e) {
  const code = (e && e.code) || '';
  if (code === 'permission-denied') return 'クラウドへのアクセスが許可されていません（Firestoreのルール設定が必要かもしれません）。';
  if (code === 'unavailable') return 'クラウドに接続できませんでした（通信状態をご確認ください）。';
  return 'クラウド同期でエラーが発生しました（' + (code || '不明') + '）。';
}

function status() {
  return { available: supportedEnv(), signedIn: !!user, email: user ? user.email : null, busy: reconciling, error: lastError };
}
function emitStatus() { try { cbs.onStatus(status()); } catch (_) {} }

// ---- 認証状態の変化 ----------------------------------------------
function onAuth(u) {
  user = u;
  if (unsub) { unsub(); unsub = null; }
  dirty.projects = false; dirty.inventory = false;
  pushing = false;
  if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
  if (!u) { reconciling = false; lastError = null; emitStatus(); return; }
  hwm = loadHwm(u.uid);
  const myGen = ++authGen;
  reconciling = true; lastError = null; needsReconcile = false;
  emitStatus();
  docRef().get()
    .then((snap) => { if (myGen !== authGen) return; reconcile(snap.exists ? snap.data() : null, snap.exists); })
    .catch((e) => {
      console.error('cloud get', e);
      lastError = friendlyError(e);
      needsReconcile = true; // 最初のsnapshotで突き合わせをやり直す
      try { cbs.toast('クラウドの読み込みに失敗しました。後でもう一度お試しください。'); } catch (_) {}
    })
    .then(() => {
      if (myGen !== authGen) return;
      reconciling = false;
      subscribe();
      if (dirty.projects || dirty.inventory) pushNow();
      emitStatus();
    });
}

// ---- ログイン時の突き合わせ(系統ごと・内容ベース) -------------------
function reconcile(cloud, cloudExists) {
  const local = cbs.getLocal();
  const decisions = {};
  const conflicts = [];
  for (const F of FIELDS) {
    const hadBaseline = Object.prototype.hasOwnProperty.call(hwm.sig, F);
    const baseSig = hwm.sig[F] || '';
    const cloudHas = !!(cloudExists && cloud && F in cloud);
    const cloudSig = cloudHas ? sigOf(F, cloud[F]) : null;
    const localSig = sigOf(F, local[F]);
    const cloudChanged = cloudHas && cloudSig !== baseSig;       // クラウドが基準と違う
    // ローカルが基準と違う。基準があれば「空にした(全消去)」も変更として扱う。
    // 基準が無い新規端末では、空のローカルでクラウドを消さないよう hasField で守る。
    const localChanged = hadBaseline ? (localSig !== baseSig) : hasField(local[F]);
    if (cloudChanged && localChanged && cloudSig !== localSig) { decisions[F] = 'conflict'; conflicts.push(F); }
    else if (cloudChanged) decisions[F] = 'cloud';
    else if (localChanged) decisions[F] = 'local';
    else decisions[F] = 'none';
  }
  let useCloud = false;
  if (conflicts.length) { try { useCloud = !!cbs.confirmConflict(); } catch (_) { useCloud = false; } }
  for (const F of FIELDS) {
    let d = decisions[F];
    if (d === 'conflict') d = useCloud ? 'cloud' : 'local';
    if (d === 'cloud') applyRemoteField(F, cloud[F]);
    else if (d === 'local') dirty[F] = true; // 後で pushNow される
  }
}

// ---- 受信(リアルタイム購読・内容ベース) ---------------------------
function subscribe() {
  unsub = docRef().onSnapshot(
    (snap) => {
      if (!snap.exists) return;
      if (snap.metadata.hasPendingWrites) return; // 自分の書き込みのエコーは無視
      const remote = snap.data();
      if (needsReconcile) { needsReconcile = false; reconcile(remote, true); if (dirty.projects || dirty.inventory) pushNow(); emitStatus(); return; }
      if (pushing) return; // 送信中は取り込まない
      for (const F of FIELDS) {
        if (dirty[F]) continue;       // 未送信のローカル変更がある系統は上書きしない
        if (!(F in remote)) continue; // その系統がクラウドに無ければ何もしない(空で消さない)
        const remoteSig = sigOf(F, remote[F]);
        // クラウドの内容が基準と違うときだけ取り込む(同じ=自分のエコー/既知 → 何もしない)
        if (remoteSig !== (hwm.sig[F] || '')) applyRemoteField(F, remote[F]);
      }
    },
    (e) => { console.error('snapshot', e); lastError = friendlyError(e); emitStatus(); }
  );
}

/** クラウドの1系統をローカルへ反映。保存成功時のみ基準(hwm)を更新する。 */
function applyRemoteField(F, value) {
  const norm = normField(F, value);
  applyingRemote = true;
  let ok = true;
  try {
    const r = cbs.applyRemote(F === 'projects' ? { projects: norm } : { inventory: norm });
    ok = r !== false; // コールバックが false を返したら保存失敗
  } catch (_) {
    ok = false;
  } finally {
    applyingRemote = false;
  }
  if (ok) { hwm.sig[F] = sigOf(F, norm); saveHwm(); }
  return ok;
}

// ---- 送信(デバウンス＋失敗時バックオフ) ---------------------------
/** ローカルが変わったら呼ぶ。kind: 'projects' | 'inventory' | 'all'。 */
function onLocalChange(kind) {
  if (kind === 'inventory') dirty.inventory = true;
  else if (kind === 'projects') dirty.projects = true;
  else { dirty.projects = true; dirty.inventory = true; }
  if (applyingRemote || reconciling || !user || !db) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(pushNow, 900);
}

function pushNow() {
  pushTimer = null;
  if (!user || !db) return;
  if (pushing) return; // 二重送信防止(完了後に再評価)
  if (!dirty.projects && !dirty.inventory) return;
  const myGen = authGen;
  const local = cbs.getLocal();
  const payload = {};
  const pushed = [];
  const snapSig = {};
  if (dirty.projects) { payload.projects = normField('projects', local.projects); pushed.push('projects'); snapSig.projects = sigOf('projects', payload.projects); }
  if (dirty.inventory) { payload.inventory = normField('inventory', local.inventory); pushed.push('inventory'); snapSig.inventory = sigOf('inventory', payload.inventory); }
  // Firestore は undefined を拒否するため JSON 経由で除去
  let safe;
  try { safe = JSON.parse(JSON.stringify(payload)); } catch (_) { safe = payload; }
  pushing = true;
  docRef().set(safe, { merge: true })
    .then(() => {
      if (myGen !== authGen) return; // 認証が切り替わっていたら無視
      pushing = false;
      for (const F of pushed) {
        // 送信後にローカルが再変更されていなければ dirty を下ろす
        if (sigOf(F, cbs.getLocal()[F]) === snapSig[F]) dirty[F] = false;
        hwm.sig[F] = snapSig[F]; // クラウドはこの内容になった
      }
      saveHwm();
      retryCount = 0;
      if (lastError) { lastError = null; emitStatus(); }
      // 送信中に積まれた変更があれば続けて送る
      if (dirty.projects || dirty.inventory) { if (pushTimer) clearTimeout(pushTimer); pushTimer = setTimeout(pushNow, 300); }
    })
    .catch((e) => {
      if (myGen !== authGen) return; // 認証が切り替わっていたら無視
      pushing = false;
      console.error('cloud push', e);
      const code = (e && e.code) || '';
      const msg = String((e && e.message) || '');
      const tooBig = code === 'resource-exhausted' || code === 'invalid-argument' || /maximum|exceeds|too large|1048576|longer than/i.test(msg);
      if (tooBig) {
        // 恒久エラー: 無限再試行しない。状態として通知(dirtyは残し、次の変更/ログインで再挑戦)。
        lastError = 'データが大きすぎてクラウドに保存できませんでした。保存図案を減らすか、「全データのバックアップ」をお使いください。';
        try { cbs.toast(lastError); } catch (_) {}
        emitStatus();
      } else {
        // 一時エラー: バックオフ再試行
        try { cbs.toast('クラウド同期に失敗しました。自動で再試行します。'); } catch (_) {}
        retryCount = Math.min(retryCount + 1, 6);
        const backoff = Math.min(30000, 1000 * Math.pow(2, retryCount));
        if (pushTimer) clearTimeout(pushTimer);
        pushTimer = setTimeout(pushNow, backoff);
      }
    });
}

// ---- 公開API --------------------------------------------------
/**
 * @param {{getLocal:Function, applyRemote:Function, onStatus:Function, confirmConflict:Function, toast:Function}} callbacks
 */
export function init(callbacks) {
  cbs = { ...cbs, ...callbacks };
  emitStatus();
}

export function signIn() {
  if (!supportedEnv()) { try { cbs.toast('オンライン版（URLで開いた状態）でお使いください。'); } catch (_) {} return; }
  emitStatus();
  ensureFirebaseReady()
    .then(() => {
      const provider = new window.firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      return auth.signInWithPopup(provider);
    })
    .then(() => { try { cbs.toast('ログインしました。'); } catch (_) {} })
    .catch((e) => {
      const code = (e && e.code) || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request' || code === 'auth/user-cancelled') return;
      if (code === 'auth/popup-blocked') { try { cbs.toast('ポップアップを許可してください。'); } catch (_) {} return; }
      console.error('signIn', e);
      try { cbs.toast('ログインできませんでした（' + (code || '不明') + '）。'); } catch (_) {}
    });
}

export function signOut() { if (auth) auth.signOut(); }
export function notifyLocalChange(kind) { onLocalChange(kind); }
export function getStatus() { return status(); }
