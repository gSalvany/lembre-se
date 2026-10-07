/* =============================================================
   lembre.js — a biblioteca comum do ecossistema lembre-se
   -------------------------------------------------------------
   O CONTRATO
   Cada app publica um RESUMO do que os outros precisam saber.
   Os outros leem só esse resumo, nunca os dados internos do app.
   Assim, cada app pode mudar a forma como guarda as coisas por
   dentro, desde que continue publicando o resumo no mesmo formato.

   Onde fica: IndexedDB "lembre-se", tabela "resumos", uma linha
   por app: { app, contrato, atualizadoEm, dados }.

   Quem publica o quê (contrato 1):
     memento  → { name, birth, quotes, memories, daylog, distractions, expenses, weekReviews }
     volumen  → { items: [{ id, type, title, author, category, status, current, total, notes, sessions, updatedAt, thumb }] }
   (cognitio, audire e atrium entram nas próximas etapas)

   Avisos ao vivo: quando um app publica, os outros apps abertos
   recebem { tipo: 'resumo', app } pelo canal "lembre-se".

   Tudo aqui é opcional: se este arquivo não carregar, cada app
   continua funcionando sozinho, só sem conversar com os outros.
   ============================================================= */
(function () {
  'use strict';
  if (self.Lembre) return;
  const DB = 'lembre-se', STORE = 'resumos', CONTRATO = 1;

  let dbP = null;
  function abrir() {
    if (dbP) return dbP;
    dbP = new Promise(ok => {
      let r;
      try { r = indexedDB.open(DB, 1); } catch (e) { return ok(null); }
      const t = setTimeout(() => ok(null), 4000);
      r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE); };
      r.onsuccess = () => {
        clearTimeout(t);
        const db = r.result;
        db.onversionchange = () => { db.close(); dbP = null; };     // deixa a Arca recriar o banco numa restauração
        ok(db);
      };
      r.onerror = r.onblocked = () => { clearTimeout(t); ok(null); };
    });
    return dbP;
  }
  const req = r => new Promise((ok, no) => { r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });

  let canal = null;
  try { canal = 'BroadcastChannel' in self ? new BroadcastChannel('lembre-se') : null; } catch (e) {}

  /** Grava o resumo de um app e avisa os outros. */
  async function publicar(app, dados) {
    const db = await abrir(); if (!db) return false;
    const reg = { app, contrato: CONTRATO, atualizadoEm: Date.now(), dados };
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(reg, app);
      await new Promise((ok, no) => { tx.oncomplete = ok; tx.onerror = () => no(tx.error); tx.onabort = () => no(tx.error); });
    } catch (e) { console.warn('[lembre] não foi possível publicar o resumo de ' + app, e); return false; }
    try { canal && canal.postMessage({ tipo: 'resumo', app, em: reg.atualizadoEm }); } catch (e) {}
    return true;
  }
  /** Resumo de um app, ou null se ele ainda não publicou (ou publicou num contrato que esta página não conhece). */
  async function ler(app) {
    const db = await abrir(); if (!db) return null;
    try { const r = await req(db.transaction(STORE, 'readonly').objectStore(STORE).get(app)); return r && r.contrato === CONTRATO ? r : null; }
    catch (e) { return null; }
  }
  /** Todos os resumos, como { memento: {...}, volumen: {...} }. */
  async function lerTodos() {
    const db = await abrir(); if (!db) return {};
    try {
      const st = db.transaction(STORE, 'readonly').objectStore(STORE);
      const [ks, vs] = await Promise.all([req(st.getAllKeys()), req(st.getAll())]);
      const out = {}; ks.forEach((k, i) => { if (vs[i] && vs[i].contrato === CONTRATO) out[k] = vs[i]; });
      return out;
    } catch (e) { return {}; }
  }
  /** Chama fn({ tipo, app }) quando outro app publica. Devolve a função que cancela. */
  function ouvir(fn) {
    if (!canal) return () => {};
    const h = e => { if (e.data && e.data.tipo) fn(e.data); };
    canal.addEventListener('message', h);
    return () => canal.removeEventListener('message', h);
  }
  /** Agenda a publicação: muitas gravações seguidas viram uma só publicação. */
  function agendar(app, construir, espera = 800) {
    let t = null, rodando = false, denovo = false;
    const rodar = async () => {
      if (rodando) { denovo = true; return; }
      rodando = true;
      try { const dados = await construir(); if (dados) await publicar(app, dados); }
      catch (e) { console.warn('[lembre] falha ao montar o resumo de ' + app, e); }
      finally { rodando = false; if (denovo) { denovo = false; agendar_(); } }
    };
    const agendar_ = () => { clearTimeout(t); t = setTimeout(rodar, espera); };
    addEventListener('pagehide', () => { if (t) { clearTimeout(t); t = null; rodar(); } });   // publica antes de sair do app
    return agendar_;
  }
  /** Link para um item de outro app: Lembre.link('cognitio', { ficha: id }) */
  function link(app, params) {
    const u = new URL('../' + app + '/', location.href);
    Object.entries(params || {}).forEach(([k, v]) => { if (v != null) u.searchParams.set(k, v); });
    return u.pathname + u.search;
  }

  self.Lembre = { contrato: CONTRATO, publicar, ler, lerTodos, ouvir, agendar, link };
})();
