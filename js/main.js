'use strict';
/* Start screen, settings and boot. */
function saveSettings() { try { localStorage.setItem('shaySettings', JSON.stringify(SETTINGS)); } catch (e) { /* storage unavailable */ } }
function loadSettings() { try { Object.assign(SETTINGS, JSON.parse(localStorage.getItem('shaySettings') || '{}')); } catch (e) { /* ignore */ } }

function deckListHTML(key) {
  const d = DECKS[key];
  const rows = d.list.map(([n, k]) => `<div>${k > 1 ? k + ' ' : ''}${esc(n)}${d.upgrades && d.upgrades.includes(n) ? ' <span style="color:var(--gold)">(upgrade)</span>' : ''}</div>`).join('');
  const cut = (d.cut || []).map(n => `<div class="cut">${esc(n)}</div>`).join('');
  return `<h4>${esc(d.name)}: ${esc(d.commander)} + ${deckCount(key)}</h4>${rows}${cut ? `<h4>${key === 'elenda' ? 'Cut from the Shay list' : ['revival', 'wakanda'].includes(key) ? 'Cut from the precon for the upgrades' : 'Cut to reach 99 (weakest original precon creatures)'}</h4>${cut}` : ''}`;
}

function boot() {
  loadSettings();
  UI.init();
  const BOT_DECKS = [
    ['cloud', 'R G W', 'Cloud, Ex-SOLDIER. Equipment voltron with Swords, Embercleave, Teferi\'s Protection.'],
    ['sai', 'U', 'Sai, Master Thopterist. Artifact thopters with Urza, Rhystic Study, Cyclonic Rift, counterspells.'],
    ['revival', 'R W B', 'Terra, Herald of Hope. Revival Trance precon upgraded for the graveyard: Entomb, Reanimate, Living Death, Sheoldred, Archon of Cruelty.'],
    ['wakanda', 'G W', 'T\'Challa, the Black Panther. Wakanda Forever precon: Vibranium artifacts and the monarch, upgraded with Swords, Stoneforge, Sword of Fire and Ice.'],
    ['elendaBot', 'W B', 'Elenda, the Dusk Rose. Vampire aristocrats: Teysa, Sanguine Bond, Butcher of Malakir, Toxic Deluge.'],
  ];
  if (!Array.isArray(SETTINGS.botDecks) || !SETTINGS.botDecks.length) SETTINGS.botDecks = ['cloud'];
  SETTINGS.botDecks = SETTINGS.botDecks.filter(k => DECKS[k]).slice(0, 4);
  if (!SETTINGS.botDecks.length) SETTINGS.botDecks = ['cloud'];
  const drawBots = () => {
    const box = document.getElementById('botList');
    box.innerHTML = SETTINGS.botDecks.map((k, i) => {
      const info = BOT_DECKS.find(x => x[0] === k) || ['', '', ''];
      return `<div class="bot-row"><label for="botDeck${i}">Bot ${i + 1}</label><select id="botDeck${i}" data-i="${i}">${BOT_DECKS.map(([key]) => `<option value="${key}" ${key === k ? 'selected' : ''}>${esc(DECKS[key].name)}</option>`).join('')}</select>${SETTINGS.botDecks.length > 1 ? `<button class="btn rm" data-rm="${i}" aria-label="Remove bot ${i + 1}">Remove</button>` : ''}<small><span class="pips">${info[1]}</span> ${esc(info[2])}</small></div>`;
    }).join('');
    box.querySelectorAll('select').forEach(s => s.onchange = () => { SETTINGS.botDecks[+s.dataset.i] = s.value; saveSettings(); drawBots(); });
    box.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { SETTINGS.botDecks.splice(+b.dataset.rm, 1); saveSettings(); drawBots(); });
    const add = document.getElementById('addBot');
    add.hidden = SETTINGS.botDecks.length >= 4;
  };
  document.getElementById('addBot').onclick = () => { const used = new Set(SETTINGS.botDecks); const next = BOT_DECKS.map(x => x[0]).find(k => !used.has(k)) || 'cloud'; SETTINGS.botDecks.push(next); saveSettings(); drawBots(); };
  drawBots();
  const mine = document.querySelectorAll('.opp-card[data-mine]');
  const setMine = (k) => { SETTINGS.myDeck = k; mine.forEach(x => x.setAttribute('aria-pressed', x.dataset.mine === k ? 'true' : 'false')); };
  if (!DECKS[SETTINGS.myDeck]) SETTINGS.myDeck = 'shay';
  setMine(SETTINGS.myDeck);
  mine.forEach(b => b.onclick = () => { setMine(b.dataset.mine); saveSettings(); });
  const house = document.getElementById('setHouse');
  house.checked = SETTINGS.shayHouseRule;
  house.onchange = () => { SETTINGS.shayHouseRule = house.checked; saveSettings(); };
  const stop = document.getElementById('setStop'), tithe = document.getElementById('setTithe'), speed = document.getElementById('setSpeed');
  stop.checked = SETTINGS.stopEverySpell; tithe.checked = SETTINGS.askTithe; speed.value = String(SETTINGS.botDelay);
  stop.onchange = () => { SETTINGS.stopEverySpell = stop.checked; saveSettings(); };
  tithe.onchange = () => { SETTINGS.askTithe = tithe.checked; saveSettings(); };
  speed.onchange = () => { SETTINGS.botDelay = +speed.value; saveSettings(); };
  document.getElementById('deckLists').innerHTML = ['shay', 'elenda', 'cloud', 'sai', 'revival', 'wakanda', 'elendaBot'].map(deckListHTML).join('');
  document.getElementById('startBtn').onclick = async () => {
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
