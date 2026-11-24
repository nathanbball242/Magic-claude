'use strict';
/* Start screen, settings and boot. */
function saveSettings() { try { localStorage.setItem('shaySettings', JSON.stringify(SETTINGS)); } catch (e) { /* storage unavailable */ } }
function loadSettings() { try { Object.assign(SETTINGS, JSON.parse(localStorage.getItem('shaySettings') || '{}')); } catch (e) { /* ignore */ } }

function deckListHTML(key) {
  const d = DECKS[key];
  const rows = d.list.map(([n, k]) => `<div>${k > 1 ? k + ' ' : ''}${esc(n)}</div>`).join('');
  const cut = (d.cut || []).map(n => `<div class="cut">${esc(n)}</div>`).join('');
  return `<h4>${esc(d.name)}: ${esc(d.commander)} + ${deckCount(key)}</h4>${rows}${cut ? `<h4>Cut to reach 99 (weakest original precon creatures)</h4>${cut}` : ''}`;
}

function boot() {
  loadSettings();
  UI.init();
  let pick = 'cloud';
  const btns = document.querySelectorAll('.opp-card');
  btns.forEach(b => b.onclick = () => { pick = b.dataset.deck; btns.forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); });
  const stop = document.getElementById('setStop'), tithe = document.getElementById('setTithe'), speed = document.getElementById('setSpeed');
  stop.checked = SETTINGS.stopEverySpell; tithe.checked = SETTINGS.askTithe; speed.value = String(SETTINGS.botDelay);
  stop.onchange = () => { SETTINGS.stopEverySpell = stop.checked; saveSettings(); };
  tithe.onchange = () => { SETTINGS.askTithe = tithe.checked; saveSettings(); };
  speed.onchange = () => { SETTINGS.botDelay = +speed.value; saveSettings(); };
  document.getElementById('deckLists').innerHTML = ['shay', 'cloud', 'sai'].map(deckListHTML).join('');
  document.getElementById('startBtn').onclick = async () => {
    document.getElementById('start').hidden = true;
    document.getElementById('game').hidden = false;
    newGame(pick);
    UI.render();
    try { await gameLoop(); }
    catch (e) { console.error(e); UI.toast('Something broke: ' + e.message); log('Engine error: ' + e.message, 'warn'); UI.render(); }
  };
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
}
