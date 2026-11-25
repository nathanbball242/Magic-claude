'use strict';
/* Start screen, settings and boot. window.FRIEND_BUILD hides the owner's personal decks. */
const STORE_KEY = (typeof window !== 'undefined' && window.FRIEND_BUILD) ? 'cmdTableSettings' : 'shaySettings';
function saveSettings() { try { localStorage.setItem(STORE_KEY, JSON.stringify(SETTINGS)); } catch (e) { /* storage unavailable */ } }
function loadSettings() { try { Object.assign(SETTINGS, JSON.parse(localStorage.getItem(STORE_KEY) || '{}')); } catch (e) { /* ignore */ } }

const BOT_DECKS = [
  ['cloud', 'R G W', 'Cloud, Ex-SOLDIER. Equipment voltron with Swords, Embercleave, Teferi\'s Protection.'],
  ['sai', 'U', 'Sai, Master Thopterist. Artifact thopters with Urza, Rhystic Study, Cyclonic Rift, counterspells.'],
  ['revival', 'R W B', 'Terra, Herald of Hope. Revival Trance precon upgraded for the graveyard: Entomb, Reanimate, Living Death, Sheoldred, Archon of Cruelty.'],
  ['wakanda', 'G W', 'T\'Challa, the Black Panther. Wakanda Forever precon: Vibranium artifacts and the monarch, upgraded with Swords, Stoneforge, Sword of Fire and Ice.'],
  ['elendaBot', 'W B', 'Elenda, the Dusk Rose. Vampire aristocrats: Teysa, Sanguine Bond, Butcher of Malakir, Toxic Deluge.'],
];
const OWN_DECKS = [
  ['shay', 'Shay Cormac', 'W B', 'Your purchased build. Tag with bounty counters, protect Shay, then wipe.'],
  ['elenda', 'Elenda, the Dusk Rose', 'W B', 'Same 99 with Shay moved in. Cuts Gideon\'s Lawkeeper, Goldmeadow Harrier, Blinding Mage, Sorceress Queen. Adds Shay Cormac, Viscera Seer, Zulaport Cutthroat, Cruel Celebrant.'],
];

function deckListHTML(key) {
  const d = DECKS[key];
  const rows = d.list.map(([n, k]) => `<div>${k > 1 ? k + ' ' : ''}${esc(n)}${d.upgrades && d.upgrades.includes(n) ? ' <span style="color:var(--gold)">(upgrade)</span>' : ''}</div>`).join('');
  const cut = (d.cut || []).map(n => `<div class="cut">${esc(n)}</div>`).join('');
  return `<h4>${esc(d.name)}: ${esc(d.commander)} + ${deckCount(key)}</h4>${rows}${cut ? `<h4>${key === 'elenda' ? 'Cut from the Shay list' : ['revival', 'wakanda'].includes(key) ? 'Cut from the precon for the upgrades' : 'Cut to reach 99 (weakest original precon creatures)'}</h4>${cut}` : ''}`;
}
function customKeyFor(deck) { return registerCustomDeck(deck); }

function boot() {
  const friend = !!window.FRIEND_BUILD;
  if (friend) {
    delete DECKS.shay; delete DECKS.elenda; delete DECKS.elendaBot;
    for (let i = BOT_DECKS.length - 1; i >= 0; i--) if (!DECKS[BOT_DECKS[i][0]]) BOT_DECKS.splice(i, 1);
  }
  loadSettings();
  UI.init();
  document.documentElement.dataset.size = SETTINGS.cardSize || 'normal';
  if (!Array.isArray(SETTINGS.botDecks) || !SETTINGS.botDecks.length) SETTINGS.botDecks = ['cloud'];
  SETTINGS.botDecks = SETTINGS.botDecks.filter(k => DECKS[k] || String(k).startsWith('custom:')).slice(0, 4);
  if (!SETTINGS.botDecks.length) SETTINGS.botDecks = ['cloud'];

  const deckOptions = () => {
    const { mine, others } = DeckStore.all();
    const o = BOT_DECKS.map(([k]) => [k, DECKS[k].name]);
    for (const d of mine) o.push(['custom:' + d.id, 'Custom: ' + d.name]);
    for (const d of others) o.push(['custom:' + d.id, 'Shared: ' + d.name]);
    return o;
  };
  const findCustom = (key) => { const id = key.slice(7); const { mine, others } = DeckStore.all(); return [...mine, ...others].find(d => d.id === id); };

  const drawBots = () => {
    const box = document.getElementById('botList');
    const opts = deckOptions();
    SETTINGS.botDecks = SETTINGS.botDecks.map(k => (opts.some(o => o[0] === k) ? k : 'cloud'));
    box.innerHTML = SETTINGS.botDecks.map((k, i) => {
      const info = BOT_DECKS.find(x => x[0] === k);
      const cd = !info && k.startsWith('custom:') ? findCustom(k) : null;
      const desc = info ? `<span class="pips">${info[1]}</span> ${esc(info[2])}` : cd ? `${esc(cd.commander)}. A deck built on this page; the bot plays it with the same rules engine.` : '';
      return `<div class="bot-row"><label for="botDeck${i}">Bot ${i + 1}</label><select id="botDeck${i}" data-i="${i}">${opts.map(([key, label]) => `<option value="${esc(key)}" ${key === k ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select>${SETTINGS.botDecks.length > 1 ? `<button class="btn rm" data-rm="${i}" aria-label="Remove bot ${i + 1}">Remove</button>` : ''}<small>${desc}</small></div>`;
    }).join('');
    box.querySelectorAll('select').forEach(s => s.onchange = () => { SETTINGS.botDecks[+s.dataset.i] = s.value; saveSettings(); drawBots(); });
    box.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { SETTINGS.botDecks.splice(+b.dataset.rm, 1); saveSettings(); drawBots(); });
    document.getElementById('addBot').hidden = SETTINGS.botDecks.length >= 4;
  };
  document.getElementById('addBot').onclick = () => { const used = new Set(SETTINGS.botDecks); const next = BOT_DECKS.map(x => x[0]).find(k => !used.has(k)) || 'cloud'; SETTINGS.botDecks.push(next); saveSettings(); drawBots(); };

  const drawMine = () => {
    const box = document.getElementById('myPick');
    const { mine, others } = DeckStore.all();
    const cards = [];
    if (!friend) for (const [k, name, pips, desc] of OWN_DECKS) cards.push({ key: k, name, pips, desc });
    else for (const [k, pips, desc] of BOT_DECKS) cards.push({ key: k, name: DECKS[k].name, pips, desc: 'Play the upgraded precon yourself. ' + desc });
    for (const d of mine) cards.push({ key: 'custom:' + d.id, name: d.name, pips: '', desc: `${d.commander} + ${d.cards.reduce((a, x) => a + x[1], 0)} cards. Your deck.`, deck: d, editable: true });
    for (const d of others) cards.push({ key: 'custom:' + d.id, name: d.name, pips: '', desc: `${d.commander}. Shared on this page by another player.`, deck: d });
    if (!cards.some(c => c.key === SETTINGS.myDeck)) SETTINGS.myDeck = cards.length ? cards[0].key : '';
    box.innerHTML = cards.map(c => `<div class="opp-card my-card" role="button" tabindex="0" data-mine="${esc(c.key)}" aria-pressed="${c.key === SETTINGS.myDeck}"><b>${esc(c.name)}</b><span class="pips">${esc(c.pips)}</span><small>${esc(c.desc)}</small>${c.editable ? `<span class="deck-acts"><button class="btn mini" data-edit="${esc(c.deck.id)}">Edit</button><button class="btn mini" data-del="${esc(c.deck.id)}">Delete</button></span>` : ''}</div>`).join('')
      + (cards.length ? '' : '<p class="sub">No decks yet. Build or paste one to start.</p>');
    box.querySelectorAll('[data-mine]').forEach(b => {
      const pick = () => { SETTINGS.myDeck = b.dataset.mine; saveSettings(); drawMine(); };
      b.onclick = (e) => { if (e.target.closest('[data-edit],[data-del]')) return; pick(); };
      b.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } };
    });
    box.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => UI.deckBuilder(DeckStore.local.find(d => d.id === b.dataset.edit), () => { drawMine(); drawBots(); }));
    box.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      const d = DeckStore.local.find(x => x.id === b.dataset.del);
      UI.openSheet(`<h3>Delete ${esc(d.name)}?</h3><p class="sub">This removes the deck from this page for good.</p><div class="row-btns"><button class="btn" id="dlNo">Keep it</button><button class="btn danger" id="dlYes">Delete deck</button></div>`, true);
      UI.el('dlNo').onclick = () => UI.closeSheet();
      UI.el('dlYes').onclick = async () => { UI.closeSheet(); await DeckStore.remove(d.id); drawMine(); drawBots(); };
    });
    const st = document.getElementById('deckStoreNote');
    if (st) st.textContent = DeckStore.status === 'shared' ? 'Decks you save are stored with this page, so they follow you to any device and other players here can use them too.' : 'Decks you save stay in this browser.';
  };
  document.getElementById('buildDeck').onclick = () => UI.deckBuilder(null, (d) => { SETTINGS.myDeck = 'custom:' + d.id; saveSettings(); drawMine(); drawBots(); });
  DeckStore.loadLocal();
  DeckStore.listeners.push(() => { drawMine(); drawBots(); });
  DeckStore.connect();
  drawMine(); drawBots();

  const bind = (id, key, conv = (v) => v) => { const el = document.getElementById(id); if (!el) return; if (el.type === 'checkbox') { el.checked = !!SETTINGS[key]; el.onchange = () => { SETTINGS[key] = el.checked; saveSettings(); }; } else { el.value = String(SETTINGS[key]); el.onchange = () => { SETTINGS[key] = conv(el.value); saveSettings(); if (key === 'cardSize') document.documentElement.dataset.size = el.value; }; } };
  bind('setHouse', 'shayHouseRule'); bind('setStop', 'stopEverySpell'); bind('setTithe', 'askTithe'); bind('setSpeed', 'botDelay', Number); bind('setMana', 'manualMana'); bind('setSize', 'cardSize');
  if (friend) { const h = document.getElementById('setHouse'); if (h) h.closest('label').hidden = true; }
  document.getElementById('deckLists').innerHTML = [...(friend ? [] : ['shay', 'elenda']), 'cloud', 'sai', 'revival', 'wakanda', 'elendaBot'].filter(k => DECKS[k]).map(deckListHTML).join('');

  document.getElementById('startBtn').onclick = async () => {
    if (!SETTINGS.myDeck) { UI.toast('Pick or build a deck first.'); return; }
    const btn = document.getElementById('startBtn');
    const keys = [SETTINGS.myDeck, ...SETTINGS.botDecks];
    try {
      if (keys.some(k => k.startsWith('custom:'))) {
        btn.disabled = true; btn.textContent = 'Loading card data…';
        for (const k of keys.filter(k => k.startsWith('custom:'))) {
          const d = findCustom(k);
          if (!d) throw new Error('A selected deck is no longer available.');
          customKeyFor(d);
          const missing = await ensureDeckDefs(d.cards, d.commander);
          if (missing.includes(d.commander)) throw new Error(`Card data for ${d.commander} could not be loaded.`);
        }
      }
    } catch (e) { btn.disabled = false; btn.textContent = 'Shuffle up'; UI.toast(e.message); return; }
    document.getElementById('start').hidden = true;
    document.getElementById('game').hidden = false;
    newGame(SETTINGS.botDecks.slice(), { humanDeck: SETTINGS.myDeck });
    UI.render();
    try { await gameLoop(); }
    catch (e) { console.error(e); UI.toast('Something broke: ' + e.message); log('Engine error: ' + e.message, 'warn'); UI.render(); }
  };
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
}
