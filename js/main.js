'use strict';
/* Start screen, settings and boot. */
function saveSettings() { try { localStorage.setItem('shaySettings', JSON.stringify(SETTINGS)); } catch (e) { /* storage unavailable */ } }
function loadSettings() { try { Object.assign(SETTINGS, JSON.parse(localStorage.getItem('shaySettings') || '{}')); } catch (e) { /* ignore */ } }

function deckListHTML(key) {
  const d = DECKS[key];
  const rows = d.list.map(([n, k]) => `<div>${k > 1 ? k + ' ' : ''}${esc(n)}${d.upgrades && d.upgrades.includes(n) ? ' <span style="color:var(--gold)">(upgrade)</span>' : ''}</div>`).join('');
  const cut = (d.cut || []).map(n => `<div class="cut">${esc(n)}</div>`).join('');
  return `<h4>${esc(d.name)}: ${esc(d.commander)} + ${deckCount(key)}</h4>${rows}${cut ? `<h4>${key === 'elenda' ? 'Cut from the Shay list' : 'Cut to reach 99 (weakest original precon creatures)'}</h4>${cut}` : ''}`;
}

function boot() {
  loadSettings();
  UI.init();
  let pick = 'cloud';
  const btns = document.querySelectorAll('.opp-card[data-deck]');
  btns.forEach(b => b.onclick = () => { pick = b.dataset.deck; btns.forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); });
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
  document.getElementById('deckLists').innerHTML = ['shay', 'elenda', 'cloud', 'sai', 'elendaBot'].map(deckListHTML).join('');
  document.getElementById('startBtn').onclick = async () => {
    document.getElementById('start').hidden = true;
    document.getElementById('game').hidden = false;
    newGame(pick, { humanDeck: SETTINGS.myDeck });
    UI.render();
    try { await gameLoop(); }
    catch (e) { console.error(e); UI.toast('Something broke: ' + e.message); log('Engine error: ' + e.message, 'warn'); UI.render(); }
  };
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
}
