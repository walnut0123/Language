// SDKs load only after configuration. No OAuth access tokens are stored by this app.
const $ = id => document.getElementById(id);
const app = window.VocabularyApp;
const status = text => { $('cloud-status').textContent = text; };
const config = window.FIREBASE_CONFIG;
if (!config?.apiKey || !config?.projectId || !config?.authDomain || !config?.appId) {
  status('브라우저에 저장 중 · 클라우드 연결 설정 전입니다.');
} else {
  boot().catch(() => status('클라우드를 시작하지 못했습니다. 브라우저 기록은 유지됩니다. 새로고침해 주세요.'));
}
async function boot() {
  const [firebase, authApi, dbApi] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js')
  ]);
  const instance = firebase.initializeApp(config), auth = authApi.getAuth(instance), db = dbApi.getFirestore(instance);
  const provider = new authApi.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  let user = null, busy = false, applying = false, timer, generation = 0, unsubscribe;
  let queue = [], revision = 0, ready = false, refreshRequested = false;
  const guestKey = 'haru-vocabulary-v1';
  const key = () => user ? `haru-cloud-${user.uid}` : guestKey;
  const pendingKey = () => `${key()}-operation-`;
  function readQueue() {
    const entries = [];
    for (let i = 0; i < localStorage.length; i++) {
      const storedKey = localStorage.key(i);
      if (storedKey.startsWith(pendingKey())) entries.push(JSON.parse(localStorage.getItem(storedKey)));
    }
    return entries.sort((a, b) => a.queuedAt - b.queuedAt || a.sequence - b.sequence || a.id.localeCompare(b.id));
  }
  const setUI = () => {
    $('cloud-login').hidden = !!user; $('cloud-login').disabled = false;
    for (const id of ['cloud-sync', 'cloud-logout']) $(id).hidden = !user;
    $('cloud-recover').hidden = true;
    $('cloud-migrate').hidden = !user || !localStorage.getItem(guestKey);
  };
  const backup = () => localStorage.setItem(`${key()}-recovery-${Date.now()}`, JSON.stringify(app.snapshot()));
  const errorText = error => error.code === 'permission-denied' ? '접근 권한이 없습니다. Firebase 보안 규칙을 확인하세요.' :
    error.code === 'resource-exhausted' ? '클라우드 사용 한도에 도달했습니다.' : error.message || '네트워크 또는 설정을 확인하세요.';
  function apply(state, persist = true) {
    applying = true;
    try { app.apply(state); if (persist) app.persist(); } finally { applying = false; }
  }
  window.CloudSession = {
    get key() { return key(); },
    record(method, args, before, after) {
      if (!user || applying) return;
      const cmd = window.CloudState.command(method, args, before, after, crypto.randomUUID());
      cmd.queuedAt = Date.now(); cmd.sequence = ++sequence;
      queue.push(cmd);
      try { localStorage.setItem(pendingKey() + cmd.id, JSON.stringify(cmd)); status('이 기기에 저장됨 · 클라우드 전송 대기'); }
      catch { status('전송 대기 기록을 저장하지 못했습니다. 탭을 닫기 전에 JSON 백업을 내보내세요.'); }
      clearTimeout(timer); timer = setTimeout(sync, 700);
    }
  };
  let sequence = 0;
  async function sync() {
    if (!user || busy || !ready) return;
    busy = true;
    try {
      const known = new Set(queue.map(c => c.id));
      for (const cmd of readQueue()) if (!known.has(cmd.id)) { queue.push(cmd); known.add(cmd.id); }
    } catch { busy = false; status('전송 대기를 읽지 못했습니다. JSON 백업을 먼저 보관하세요.'); return; }
    const token = generation, uid = user.uid, batch = queue.slice(0, 100), ref = dbApi.doc(db, 'users', uid, 'learning', 'state');
    status('클라우드 동기화 중…');
    try {
      const result = await dbApi.runTransaction(db, async tx => {
        const head = await tx.get(ref);
        const chunks = head.exists() ? await Promise.all(Array.from({ length: head.data().chunkCount }, (_, i) =>
          tx.get(dbApi.doc(db, 'users', uid, 'chunks', String(i))))) : [];
        const receipts = await Promise.all(batch.map(c => tx.get(dbApi.doc(db, 'users', uid, 'operations', c.id))));
        if (chunks.some(chunk => !chunk.exists())) throw Error('클라우드 기록 일부를 읽지 못했습니다. 기존 기록은 유지합니다.');
        let remote = head.exists() ? Learning.parse(JSON.parse(chunks.map(chunk => chunk.data().json).join('')), app.data) : Learning.fresh();
        const pending = batch.filter((_, i) => !receipts[i].exists());
        for (const cmd of pending) {
          if (cmd.method === 'replace') {
            if ((head.data()?.revision || 0) !== revision) throw Error('다른 기기의 기록이 변경되어 백업 교체를 중단했습니다. 전송 대기 기록을 백업한 후 다시 확인하세요.');
            remote = Learning.parse(cmd.args[0], app.data);
          } else remote = window.CloudState.replay(remote, [cmd], app.data);
        }
        const json = JSON.stringify(remote);
        const parts = [];
        for (let offset = 0; offset < json.length;) {
          let end = Math.min(offset + 120000, json.length);
          if (end < json.length && /[\uD800-\uDBFF]/.test(json[end - 1])) end--;
          parts.push(json.slice(offset, end)); offset = end;
        }
        if (parts.length + pending.length > 450) throw Error('기록이 한 번에 전송할 수 있는 크기를 넘었습니다. JSON 백업을 보관하세요. 이력 보관 구조를 확장해야 합니다.');
        const nextRevision = (head.data()?.revision || 0) + (pending.length ? 1 : 0);
        if (pending.length) {
          tx.set(ref, { chunkCount: parts.length, revision: nextRevision, updatedAt: dbApi.serverTimestamp() });
          parts.forEach((json, i) => tx.set(dbApi.doc(db, 'users', uid, 'chunks', String(i)), { json, updatedAt: dbApi.serverTimestamp() }));
          for (const cmd of pending) tx.set(dbApi.doc(db, 'users', uid, 'operations', cmd.id), { createdAt: dbApi.serverTimestamp() });
        }
        return { state: remote, revision: nextRevision };
      });
      if (token !== generation) return;
      const ids = new Set(batch.map(c => c.id));
      queue = queue.filter(c => !ids.has(c.id)); revision = result.revision;
      for (const id of ids) localStorage.removeItem(pendingKey() + id);
      // Changes made while the request was in flight remain queued and visible.
      if (!queue.length) apply(result.state);
      status(queue.length ? '추가 학습 기록 전송 대기' : `${user.email || 'Google 계정'} · 클라우드 저장 완료`);
      $('cloud-recover').hidden = true;
    } catch (error) {
      if (token === generation) {
        status(`클라우드 저장 미완료 · ${errorText(error)} 이 기기의 기록과 전송 대기는 유지됩니다.`);
        $('cloud-recover').hidden = !queue.length;
      }
    } finally {
      busy = false;
      if (token === generation && (refreshRequested || (queue.length && navigator.onLine))) {
        clearTimeout(timer); timer = setTimeout(sync, refreshRequested ? 0 : 15000); refreshRequested = false;
      }
    }
  }
  authApi.onAuthStateChanged(auth, async next => {
    const token = ++generation;
    ready = false; clearTimeout(timer); unsubscribe?.();
    user = next; queue = []; revision = 0; setUI();
    for (const child of document.querySelector('main').children) if (!child.classList.contains('cloud-bar')) child.inert = !!user;
    if (!user) {
      const raw = localStorage.getItem(guestKey);
      try { apply(raw ? Learning.parse(JSON.parse(raw), app.data) : Learning.fresh()); }
      catch { apply(Learning.fresh(), false); status('기존 브라우저 기록을 읽지 못했습니다. 원래 저장값은 보존했습니다.'); return; }
      status('로그아웃 상태 · 기존 브라우저 기록으로 학습합니다.'); return;
    }
    status('계정 기록을 불러오는 중…');
    apply(Learning.fresh(), false);
    try {
      queue = readQueue();
      const cached = localStorage.getItem(key());
      // Never leave another account's state on screen while loading this account.
      apply(cached ? Learning.parse(JSON.parse(cached), app.data) : Learning.fresh());
      if (token !== generation) return;
      ready = true;
      for (const child of document.querySelector('main').children) child.inert = false;
      await sync();
      if (token !== generation) return;
      unsubscribe = dbApi.onSnapshot(dbApi.doc(db, 'users', user.uid, 'learning', 'state'), snapshot => {
        if (token !== generation || snapshot.metadata.hasPendingWrites || snapshot.metadata.fromCache || !snapshot.exists()) return;
        if (busy) { refreshRequested = true; return; }
        if (queue.length) return;
        try {
          if (snapshot.data().revision !== revision) sync();
        } catch { status('서버 기록을 읽지 못했습니다. 현재 기록은 유지합니다.'); }
      }, () => status('클라우드 연결이 끊겼습니다. 지금 동기화로 다시 확인하세요.'));
    } catch (error) { status(`계정 기록을 열지 못했습니다. ${errorText(error)} 로그아웃 후 기존 브라우저 기록을 사용할 수 있습니다.`); }
  });
  $('cloud-login').addEventListener('click', async () => {
    try { await authApi.setPersistence(auth, authApi.browserLocalPersistence); await authApi.signInWithPopup(auth, provider); }
    catch { status('로그인을 완료하지 못했습니다. 팝업 허용 및 Firebase 승인 도메인 설정을 확인하세요.'); }
  });
  $('cloud-sync').addEventListener('click', sync);
  $('cloud-recover').addEventListener('click', async () => {
    if (!user || busy || !queue.length) return;
    if (!confirm('현재 학습 상태와 전송 대기를 JSON으로 백업한 뒤, 대기 전송을 중단하고 서버 기록을 엽니다. 백업 파일은 다운로드 폴더에서 확인하세요. 계속할까요?')) return;
    try {
      const recovery = { ...app.snapshot(), pendingRecovery: queue, exportedAt: new Date().toISOString() };
      localStorage.setItem(`${key()}-recovery-${Date.now()}`, JSON.stringify(recovery));
      const url = URL.createObjectURL(new Blob([JSON.stringify(recovery, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = `haru-conflict-backup-${Date.now()}.json`;
      document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      const ids = queue.map(cmd => cmd.id);
      for (const id of ids) localStorage.removeItem(pendingKey() + id);
      queue = []; await sync();
    } catch { status('복구 백업을 만들지 못했습니다. 전송 대기는 삭제하지 않았습니다.'); }
  });
  $('cloud-logout').addEventListener('click', async () => {
    if (busy) { status('동기화가 끝난 뒤 로그아웃해 주세요.'); return; }
    if (queue.length) { status('아직 전송하지 못한 기록이 있습니다. 지금 동기화를 완료하거나 JSON 백업을 내보내세요.'); return; }
    await authApi.signOut(auth);
  });
  $('cloud-migrate').addEventListener('click', async () => {
    if (!ready || busy || queue.length) { status('동기화를 완료한 후 기록을 이전해 주세요.'); return; }
    if (!confirm('기존 브라우저 기록으로 계정의 클라우드 기록을 교체합니다. 현재 계정 기록은 이 기기에 복구 사본을 남깁니다. 계속할까요?')) return;
    try {
      backup();
      const local = Learning.parse(JSON.parse(localStorage.getItem(guestKey)), app.data);
      app.apply(local); app.persist(); await sync();
    } catch { status('기록 이전에 실패했습니다. 기존 기록은 유지됩니다. JSON 백업을 확인하세요.'); }
  });
  window.addEventListener('online', sync);
  window.addEventListener('focus', sync);
  window.addEventListener('beforeunload', event => { if (queue.length || busy) { event.preventDefault(); event.returnValue = ''; } });
  setUI();
}
