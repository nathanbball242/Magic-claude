'use strict';
/* =====================================================================
   UI additions: mana payment picker, bot spotlight, manual actions,
   deck builder and deck storage (this browser + the page's shared store).
   ===================================================================== */

/* ---------------- mana payment picker ---------------- */
function unitHTML(u) {
  if (!u) return '<span class="mp gen" title="generic only">◇</span>';
  if (u.length === 1) return pipHTML(u);
  if (u === 'WUBRG' || u === 'WUBRGC') return '<span class="mp any" title="any color">✦</span>';
  return `<span class="mpor">${u.split('').map(pipHTML).join('')}</span>`;
}
Object.assign(UI, {
  payMana(cost, srcs, preIds, label) {
    return new Promise((res) => {
      const sel = new Set(preIds);
      const draw = () => {
        const chosen = srcs.filter(s => sel.has(s.c.id));
        const ok = !!planFrom(chosen, cost);
        const amount = chosen.reduce((a, s) => a + s.units.length, 0);
        const kindLbl = { land: 'Land', rock: 'Artifact', improvise: 'Tap artifact', convoke: 'Convoke', treasure: 'Sacrifice' };
        UI.openSheet(`<h3>${esc(label || 'Pay mana')}</h3>
          <p class="sub">Cost ${manaHTML(String(cost))}. Tap sources to choose what pays. Selected: ${amount} mana. <b class="${ok ? 'okc' : 'badc'}">${ok ? 'This pays the cost.' : 'Not enough of the right colors yet.'}</b></p>
          <div class="srcgrid">${srcs.map(s => `<button class="src ${sel.has(s.c.id) ? 'on' : ''}" data-sid="${s.c.id}"><span class="sk">${kindLbl[s.kind] || ''}</span><b>${esc(s.c.name)}</b><span class="su">${s.units.map(unitHTML).join('')}</span></button>`).join('')}</div>
          <div class="row-btns"><button class="btn" id="pmCancel">Cancel</button><button class="btn" id="pmClear">Clear</button><button class="btn" id="pmAuto">Best choice</button><button class="btn primary" id="pmPay" ${ok ? '' : 'disabled'}>Pay</button></div>
          <p class="sub">Turn this off in Menu (Choose mana when casting) to pay automatically.</p>`, false);
        UI.el('sheet').querySelectorAll('[data-sid]').forEach(e => e.onclick = () => { const id = +e.dataset.sid; if (sel.has(id)) sel.delete(id); else sel.add(id); draw(); });
        UI.el('pmCancel').onclick = () => { UI.closeSheet(); res(null); };
        UI.el('pmClear').onclick = () => { sel.clear(); draw(); };
        UI.el('pmAuto').onclick = () => { sel.clear(); preIds.forEach(i => sel.add(i)); draw(); };
        UI.el('pmPay').onclick = () => { UI.closeSheet(); res([...sel]); };
      };
      draw();
    });
  },

  /* ---------------- bot spotlight ---------------- */
  async spotlight(it) {
    if (!G || P(HUMAN).isBot) return;
    UI.spot = { it, t: Date.now() };
    const cards = it.ctx.targets.filter(t => !t.isPlayer);
    UI.spotTargets = new Set(cards.map(t => t.id));
    const onBot = cards.find(t => t.zone === 'bf' && t.ctrl !== HUMAN);
    if (onBot) UI.view = onBot.ctrl;
    else if (!cards.some(t => t.ctrl === HUMAN) && it.p !== HUMAN) UI.view = it.p;
    UI.render();
    if (SETTINGS.botDelay) await sleep(Math.max(800, SETTINGS.botDelay * 2.2));
  },
  drawSpot() {
    const box = UI.el('spot');
    if (!box) return;
    const sp = UI.spot;
    const live = sp && G.stack.includes(sp.it);
    if (!sp || (!live && Date.now() - sp.t > 6000) || sp.dismissed) { box.hidden = true; if (!live) UI.spotTargets = null; return; }
    const it = sp.it;
    const src = it.kind === 'spell' ? it.card : it.src;
    const tg = it.ctx.targets.map(t => (t.isPlayer ? `<span class="tchip pl">${esc(t.pi === HUMAN ? 'You' : P(t.pi).name)}</span>` : `<button class="tchip ${t.ctrl === HUMAN ? 'mine' : ''}" data-id="${t.id}">${esc(t.name)}${t.zone === 'bf' ? ` <small>(${t.ctrl === HUMAN ? 'yours' : esc(P(t.ctrl).name.replace(/ \(.*/, ''))})</small>` : ` <small>(${esc(t.zone || 'gone')})</small>`}</button>`));
    if (it.ctx.counterTarget) tg.push(`<span class="tchip">${esc(it.ctx.counterTarget.label)} (spell)</span>`);
    box.hidden = false;
    box.innerHTML = `<div class="spot-card" data-id="${src.id}" style="--frame:${frameColor(src)}">${fallbackHTML(src)}${imgHTML(src)}</div>
      <div class="spot-body"><div class="spot-head"><b>${esc(P(it.p).name)}</b> ${it.kind === 'spell' ? 'casts' : 'uses'} <button class="spot-name" data-id="${src.id}">${esc(it.kind === 'spell' ? src.name : it.label)}</button>${it.ctx.modeLabel ? ` <small>(${esc(it.ctx.modeLabel)})</small>` : ''} ${live ? '<span class="spot-st">on the stack</span>' : '<span class="spot-st done">resolved</span>'}</div>
      <div class="spot-text">${esc((src.d.text || '').split('\n').slice(0, 3).join(' '))}</div>
      ${tg.length ? `<div class="spot-tg"><span>Target${tg.length > 1 ? 's' : ''}:</span>${tg.join('')}</div>` : '<div class="spot-tg"><span>No targets.</span></div>'}</div>
      <button class="spot-x" aria-label="Hide">×</button>`;
    box.querySelector('.spot-x').onclick = () => { sp.dismissed = true; UI.spotTargets = null; UI.render(); };
  },

  /* ---------------- manual actions ---------------- */
  manualHTML(c) {
    if (!G || G.over || P(HUMAN).isBot || !UI.mode || c.faceHidden || c.zone === 'stack' || c.zone === 'library') return '';
    const b = (id, l) => `<button class="btn mini" data-man="${id}">${l}</button>`;
    let h = '';
    if (c.zone === 'bf') {
      h += b(c.tapped ? 'untap' : 'tap', c.tapped ? 'Untap' : 'Tap');
      if (isCreature(c)) h += b('p1', '+1/+1 counter') + b('p1x', 'Remove +1/+1') + b('m1', '−1/−1 counter');
      h += b('gy', 'Put in graveyard') + b('exile', 'Exile') + b('hand', 'Return to hand') + b('top', 'Top of library');
    } else {
      h += b('bf', 'Put onto battlefield');
      if (c.zone !== 'hand') h += b('hand', 'Put in hand');
      if (c.zone !== 'gy') h += b('gy', 'Put in graveyard');
      if (c.zone !== 'exile') h += b('exile', 'Exile');
    }
    return `<details class="manual"><summary>Manual actions</summary><p class="sub">For card text the game does not automate. Changes happen right away and are logged.</p><div class="man-row">${h}</div></details>`;
  },
  bindManual(c) {
    UI.el('sheet').querySelectorAll('[data-man]').forEach(e => e.onclick = async () => {
      const a = e.dataset.man;
      const who = c.ctrl === HUMAN || c.owner === HUMAN ? '' : ` (${P(c.zone === 'bf' ? c.ctrl : c.owner).name}'s)`;
      const msg = { tap: 'taps', untap: 'untaps', p1: 'puts a +1/+1 counter on', p1x: 'removes a +1/+1 counter from', m1: 'puts a -1/-1 counter on', gy: 'puts into the graveyard', exile: 'exiles', hand: 'returns to hand', top: 'puts on top of the library', bf: 'puts onto the battlefield' }[a];
      log(`Manual: you ${msg} ${c.name}${who}.`, 'warn');
      if (a === 'tap') c.tapped = true;
      else if (a === 'untap') c.tapped = false;
      else if (a === 'p1') addCounters(c, 'p1p1', 1);
      else if (a === 'p1x') { if (c.counters.p1p1) c.counters.p1p1--; }
      else if (a === 'm1') addCounters(c, 'm1m1', 1);
      else if (a === 'gy') { if (c.zone === 'bf') await killBatch([c], 'sba'); else moveTo(c, 'gy'); }
      else if (a === 'exile') await exileC(c);
      else if (a === 'hand') moveTo(c, 'hand', { noCmd: true });
      else if (a === 'top') moveTo(c, 'library');
      else if (a === 'bf') await enterBF(c, c.owner, {});
      await sba();
      UI.closeSheet(); UI.render();
    });
  },
  playerTools() {
    const ps = living();
    UI.openSheet(`<div class="row-btns" style="justify-content:space-between"><h3>Manual tools</h3><button class="btn" id="mtClose">Close</button></div>
      <p class="sub">For effects the game does not automate. Everything is logged.</p>
      <div class="settings"><label>Player <select id="mtP">${ps.map(pi => `<option value="${pi}">${esc(P(pi).name)} (${P(pi).life})</option>`).join('')}</select></label>
      <div class="man-row"><button class="btn mini" data-pt="l-5">Life −5</button><button class="btn mini" data-pt="l-1">Life −1</button><button class="btn mini" data-pt="l1">Life +1</button><button class="btn mini" data-pt="l5">Life +5</button><button class="btn mini" data-pt="draw">Draw a card</button><button class="btn mini" data-pt="mill">Mill a card</button><button class="btn mini" data-pt="shuffle">Shuffle library</button></div></div>
      <div class="settings"><b>Create a token for the chosen player</b>
      <div class="tokrow"><label>Name <input id="mtN" value="Soldier" maxlength="30"></label><label>P/T <input id="mtPT" value="1/1" maxlength="7" size="5"></label><label>How many <input id="mtC" type="number" value="1" min="1" max="20"></label></div>
      <label>Keywords <input id="mtK" placeholder="flying, lifelink" maxlength="80"></label>
      <button class="btn" id="mtTok">Create</button></div>`, true);
    UI.el('mtClose').onclick = () => UI.closeSheet();
    const who = () => +UI.el('mtP').value;
    UI.el('sheet').querySelectorAll('[data-pt]').forEach(e => e.onclick = async () => {
      const pi = who(), a = e.dataset.pt;
      if (a[0] === 'l') { const n = +a.slice(1); P(pi).life += n; log(`Manual: ${P(pi).name} ${n > 0 ? 'gains' : 'loses'} ${Math.abs(n)} life.`, 'warn'); }
      else if (a === 'draw') { log(`Manual: ${P(pi).name} draws.`, 'warn'); await drawCards(pi, 1); }
      else if (a === 'mill') { log('Manual mill.', 'warn'); await mill(pi, 1); }
      else if (a === 'shuffle') { shuffle(P(pi).library); log(`Manual: ${P(pi).name} shuffles.`, 'warn'); }
      await sba(); UI.render(); UI.playerTools(); UI.el('mtP').value = String(pi);
    });
    UI.el('mtTok').onclick = async () => {
      const pi = who();
      const name = (UI.el('mtN').value || 'Token').replace(/[^\w ,'-]/g, '').slice(0, 30) || 'Token';
      const [p, t] = (UI.el('mtPT').value.match(/^(\d+)\/(\d+)$/) || [0, 1, 1]).slice(1).map(Number);
      const kws = (kwList(UI.el('mtK').value.trim()) || []);
      const n = Math.max(1, Math.min(20, +UI.el('mtC').value || 1));
      const key = `${name} ${p}/${t}${kws.length ? ' ' + kws.join(' ') : ''} (manual)`;
      if (!CARDS[key]) C(key, { token: true, types: ['Creature'], sub: name, pt: [p, t], kw: kws, text: kws.join(', ') });
      log(`Manual: ${P(pi).name} creates ${n} ${name} ${p}/${t}.`, 'warn');
      await createToken(pi, key, n); UI.closeSheet(); UI.render();
    };
  },
});

/* ---------------- deck storage ---------------- */
const DeckStore = {
  local: [], shared: [], db: null, uid: null, status: 'local', listeners: [],
  sanitize(d) {
    if (!d || typeof d !== 'object') return null;
    const s = (v, n) => String(v == null ? '' : v).slice(0, n);
    const cards = Array.isArray(d.cards) ? d.cards.filter(x => Array.isArray(x) && typeof x[0] === 'string').slice(0, 150).map(x => [s(x[0], 141), Math.max(1, Math.min(99, +x[1] || 1))]) : [];
    if (!d.commander || !cards.length) return null;
    return { id: s(d.id, 40).replace(/[^\w-]/g, '') || Math.random().toString(36).slice(2), name: s(d.name, 60) || 'Unnamed deck', commander: s(d.commander, 141), cards, updated: +d.updated || 0 };
  },
  loadLocal() { try { this.local = (JSON.parse(localStorage.getItem('customDecks') || '[]') || []).map(d => this.sanitize(d)).filter(Boolean); } catch (e) { this.local = []; } },
  saveLocal() { try { localStorage.setItem('customDecks', JSON.stringify(this.local)); } catch (e) { /* storage blocked */ } },
  notify() { for (const f of this.listeners) f(); },
  async connect() {
    this.loadLocal();
    try {
      if (!window.claude || !window.claude.use) return;
      const db = await window.claude.use('db');
      const user = await window.claude.use('user');
      if (!db || !user) return;
      const uid = await user.id();
      this.db = db; this.uid = uid; this.status = 'shared';
      const timer = setTimeout(() => { if (this.status === 'shared') this.notify(); }, 10000);
      db.collection('decks').onSnapshot((snap) => {
        clearTimeout(timer);
        const out = [];
        for (const doc of snap.docs) {
          const body = doc.data();
          if (!body || !Array.isArray(body.decks)) continue;
          for (const dk of body.decks) { const s = this.sanitize(dk); if (s) out.push({ ...s, mine: doc.id === this.uid }); }
        }
        this.shared = out;
        // my shared decks are the source of truth on every device
        const mine = out.filter(d => d.mine);
        for (const m of mine) if (!this.local.some(l => l.id === m.id)) this.local.push({ ...m });
        this.saveLocal();
        this.notify();
      }, () => { this.status = 'local'; this.notify(); });
    } catch (e) { this.status = 'local'; }
  },
  async pushMine() {
    if (!this.db || !this.uid) return false;
    try { await this.db.doc('decks/' + this.uid).set({ decks: this.local.map(({ id, name, commander, cards, updated }) => ({ id, name, commander, cards, updated })) }); return true; }
    catch (e) { this.status = 'local'; return false; }
  },
  async save(deck) {
    const i = this.local.findIndex(d => d.id === deck.id);
    deck.updated = Date.now();
    if (i >= 0) this.local[i] = deck; else this.local.push(deck);
    this.saveLocal();
    const shared = await this.pushMine();
    this.notify();
    return shared;
  },
  async remove(id) { this.local = this.local.filter(d => d.id !== id); this.saveLocal(); await this.pushMine(); this.notify(); },
  all() {
    const mine = this.local.map(d => ({ ...d, mine: true }));
    const others = this.shared.filter(d => !d.mine && !mine.some(m => m.id === d.id));
    return { mine, others };
  },
};

/* ---------------- deck builder ---------------- */
const DECK_EXAMPLE = `Commander: Atraxa, Praetors' Voice
1 Sol Ring
1 Arcane Signet
1 Swords to Plowshares
1 Llanowar Elves
...
30 Forest`;
UI.deckBuilder = async function (deck, onSaved) {
  const d = deck ? { ...deck } : { id: Math.random().toString(36).slice(2, 10), name: '', commander: '', cards: [] };
  const listText = deck ? deck.cards.map(([n, k]) => `${k} ${n}`).join('\n') : '';
  UI.openSheet(`<div class="row-btns" style="justify-content:space-between"><h3>${deck ? 'Edit deck' : 'Build or paste a deck'}</h3><button class="btn" id="dbClose">Close</button></div>
    <p class="sub">Paste a list exported from Moxfield, Archidekt, MTGA or typed by hand: one card per line, like "1 Sol Ring". Set the commander below or start a line with "Commander:". Every Commander-legal card is recognised; set codes and *CMDR* tags are ignored.</p>
    <div class="settings"><label for="dbName">Deck name</label><input id="dbName" maxlength="60" value="${esc(d.name)}" placeholder="My Atraxa deck">
    <label for="dbCmd">Commander</label><input id="dbCmd" maxlength="141" value="${esc(d.commander)}" placeholder="Atraxa, Praetors' Voice">
    <label for="dbList">Deck list (99 cards)</label><textarea id="dbList" rows="12" placeholder="${esc(DECK_EXAMPLE)}">${esc(listText)}</textarea></div>
    <div id="dbReport" class="db-report"></div>
    <div class="row-btns"><button class="btn" id="dbCheck">Check deck</button><button class="btn primary" id="dbSave" disabled>Save deck</button></div>`, false);
  UI.el('dbClose').onclick = () => UI.closeSheet();
  let parsed = null;
  const check = async () => {
    const rep = UI.el('dbReport');
    rep.innerHTML = '<p class="sub">Loading card data (about 9 MB the first time)…</p>';
    await CardDB.load();
    parsed = parseDecklist(UI.el('dbList').value, UI.el('dbCmd').value);
    if (CardDB.source === 'remote' && parsed.unknown.length) { await CardDB.fetchMissing(parsed.unknown); parsed = parseDecklist(UI.el('dbList').value, UI.el('dbCmd').value); }
    const total = parsed.cards.reduce((a, x) => a + x[1], 0);
    const missing = await ensureDeckDefs(parsed.cards, parsed.commander);
    const names = [parsed.commander, ...parsed.cards.map(x => x[0])].filter(Boolean);
    const ar = automationReport(names);
    const cmdOK = parsed.commander && CARDS[parsed.commander] && CARDS[parsed.commander].types.includes('Legendary');
    const problems = [];
    if (!parsed.commander) problems.push('No commander set. Fill in the Commander box or add a "Commander: Name" line.');
    else if (!cmdOK) problems.push(`${parsed.commander} is not a legendary creature; it will still be used as the commander.`);
    if (total !== 99) problems.push(`The deck has ${total} cards besides the commander. Commander decks have 99. You can still save and play it.`);
    if (parsed.unknown.length) problems.push(`Not recognised: ${parsed.unknown.slice(0, 12).join(', ')}${parsed.unknown.length > 12 ? '…' : ''}. Check spelling; those cards are left out.`);
    if (CardDB.source === 'remote' && missing.length) problems.push('Card data could not be loaded. Open the page online to check cards.');
    rep.innerHTML = `<p><b>${esc(parsed.commander || 'No commander')}</b> + ${total} cards.</p>
      <p class="sub">Automation: ${ar.scripted} cards with hand-written rules, ${ar.full} fully read from Oracle text, ${ar.partial} with some text to resolve by hand (they show a dashed border in play).</p>
      ${problems.map(p => `<p class="warnline">${esc(p)}</p>`).join('')}
      ${ar.notes.length ? `<details><summary>Cards with text you resolve by hand (${ar.notes.length})</summary><p class="sub">${esc(ar.notes.join(', '))}</p></details>` : ''}`;
    UI.el('dbSave').disabled = !(parsed.commander && parsed.cards.length);
  };
  UI.el('dbCheck').onclick = check;
  UI.el('dbSave').onclick = async () => {
    if (!parsed) await check();
    if (!parsed || !parsed.commander) return;
    d.name = (UI.el('dbName').value.trim() || parsed.commander).slice(0, 60);
    d.commander = parsed.commander; d.cards = parsed.cards;
    const shared = await DeckStore.save(d);
    UI.closeSheet();
    UI.toast(shared ? 'Deck saved. It is stored with this page, so it is there on any device.' : 'Deck saved in this browser.');
    if (onSaved) onSaved(d);
  };
  if (deck) check();
};
