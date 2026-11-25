'use strict';
/* =====================================================================
   Phone-first UI. Everything the engine asks the human goes through here.
   ===================================================================== */
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const FRAME = { W: '#e9e1c6', U: '#8fb6dc', B: '#7c7684', R: '#de8a72', G: '#86b886', multi: '#d8be66', none: '#aeb3b6', land: '#b79f80' };
function frameColor(c) {
  if (isLand(c) && !c.animated) return FRAME.land;
  const cols = colorsOf(c).replace(/[^WUBRG]/g, '');
  if (cols.length > 1) return FRAME.multi;
  return FRAME[cols] || FRAME.none;
}
const PIP_BG = { W: '#f3ecd0', U: '#a9cbe9', B: '#a59aa8', R: '#ec9c83', G: '#9fcf98', C: '#cfcfcf' };
function pipHTML(sym) {
  if (/^\d+$/.test(sym) || sym === 'X') return `<span class="mp">${sym}</span>`;
  if (sym.includes('/')) { const [a, b] = sym.split('/'); return `<span class="mp hy" style="--a:${PIP_BG[a]};--b:${PIP_BG[b]}">${a}${b}</span>`; }
  return `<span class="mp" style="background:${PIP_BG[sym] || '#ccc'}">${sym}</span>`;
}
function manaHTML(str) { return (String(str).match(/\{[^}]+\}/g) || []).map(x => pipHTML(x.slice(1, -1))).join(''); }
function imgURL(c) {
  if (c.token || c.faceHidden) return null;
  const im = c.d.img;
  const name = im ? im.name : c.name;
  return `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}&format=image&version=normal${im && im.face ? '&face=' + im.face : ''}`;
}
function typeLine(c) {
  const t = c.d.types.filter(x => x !== 'Basic').join(' ');
  return c.d.sub ? `${t} — ${c.d.sub}` : t;
}
function fallbackHTML(c) {
  const pt = c.d.pt ? `${c.d.pt[0]}/${c.d.pt[1]}` : '';
  return `<div class="ftxt"><div class="fn">${esc(c.name)}</div>${c.d.mc ? `<div class="fc">${manaHTML(c.d.mc)}</div>` : ''}<div class="ft">${esc(typeLine(c))}</div><div class="fr">${esc(c.d.text || '')}</div>${pt ? `<div class="fc">${pt}</div>` : ''}</div>`;
}
function imgHTML(c) {
  const u = imgURL(c);
  return u ? `<img class="art" alt="" loading="lazy" src="${u}" onerror="this.remove()">` : '';
}
function gcardHTML(c, extra = '') {
  return `<button class="gcard" style="--frame:${frameColor(c)}" data-gid="${c.id}">${fallbackHTML(c)}${imgHTML(c)}${extra}</button>`;
}
function findAny(id) {
  for (const p of G.players) for (const z of ['bf', 'hand', 'cz', 'gy', 'exile', 'library']) { const c = p[z].find(x => x.id === id); if (c) return c; }
  for (const it of G.stack) if (it.card && it.card.id === id) return it.card;
  return null;
}

const UI = {
  tiles: new Map(), mode: null, data: null, res: null, pending: false, logTail: [],
  el: (id) => document.getElementById(id),

  init() {
    const game = UI.el('game');
    game.addEventListener('click', (e) => {
      const t = e.target.closest('[data-id]');
      if (t) { const c = findAny(+t.dataset.id); if (c) UI.onCardTap(c); return; }
      const z = e.target.closest('[data-zone]');
      if (z) UI.openZone(z.dataset.zone, +z.dataset.pi);
      const a = e.target.closest('[data-act]');
      if (a) UI.onAct(a.dataset.act);
    });
    UI.el('sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet' && UI.sheetDismissable) UI.closeSheet(); });
  },
  onLog(msg, cls) { UI.render(); },
  render() {
    if (UI.pending || typeof document === 'undefined') return;
    UI.pending = true;
    requestAnimationFrame(() => { UI.pending = false; try { UI.draw(); } catch (e) { console.error(e); } });
  },

  /* ---------------- tiles ---------------- */
  tile(c, where) {
    let slot = UI.tiles.get(c.id);
    if (!slot || slot.dataset.name !== c.name) {
      slot = document.createElement('div');
      slot.className = 'slot';
      slot.dataset.name = c.name;
      slot.innerHTML = `<div class="card" data-id="${c.id}" style="--frame:${frameColor(c)}">${fallbackHTML(c)}${imgHTML(c)}<div class="ov"></div></div>`;
      UI.tiles.set(c.id, slot);
    }
    const card = slot.firstChild;
    const ov = card.lastChild;
    const onBF = c.zone === 'bf';
    slot.classList.toggle('tapped', onBF && c.tapped);
    const cls = ['card'];
    if (UI.mode === 'action' && UI.playableIds && UI.playableIds.has(c.id)) cls.push('playable');
    if (UI.mode === 'pick' && UI.data.ids.has(c.id)) cls.push('cand');
    if (UI.mode === 'attack' && UI.data.sel.has(c.id)) cls.push('sel');
    if (UI.mode === 'attack' && !UI.data.sel.has(c.id) && UI.data.elig.has(c.id)) cls.push('cand');
    if (UI.mode === 'block' && UI.data.selected === c.id) cls.push('blocker-sel');
    const inCombat = G.combat && onBF;
    if (inCombat && G.combat.atk.some(a => a.c === c)) cls.push('attacking');
    if (inCombat && (G.combat.atk.some(a => a.blockers.includes(c)) || (UI.mode === 'block' && UI.data.assign.has(c.id)))) cls.push('blocking');
    card.className = cls.join(' ');
    let html = '';
    if (onBF) {
      const b = [];
      const k = c.counters;
      if (k.bounty) b.push(`<span class="bd bounty">☠${k.bounty}</span>`);
      if (k.p1p1) b.push(`<span class="bd p1">+${k.p1p1}</span>`);
      if (k.m1m1) b.push(`<span class="bd m1">−${k.m1m1}</span>`);
      if (c.tmp.p || c.tmp.t) { const tp = c.tmp.p || 0, tt = c.tmp.t || 0; b.push(`<span class="bd ${tp < 0 || tt < 0 ? 'm1' : 'p1'}" title="Until end of turn">${tp >= 0 ? '+' : ''}${tp}/${tt >= 0 ? '+' : ''}${tt} EOT</span>`); }
      for (const x of ['lore', 'page', 'age', 'cell']) if (k[x]) b.push(`<span class="bd">${x} ${k[x]}</span>`);
      const att = attachments(c);
      if (att.length) b.push(`<span class="bd eq">+${att.length}</span>`);
      const s = st(c);
      if (G.strip[c.ctrl]) b.push(`<span class="bd bounty">${G.strip[c.ctrl] === 'full' ? 'EXPOSED' : 'NO HEX/IND'}</span>`);
      if (s.kw.has('indestructible') && isCreature(c)) b.push('<span class="bd">IND</span>');
      if (s.kw.has('hexproof') || s.kw.has('shroud')) b.push('<span class="bd">HEX</span>');
      html += `<div class="badges">${b.join('')}</div>`;
      if (isCreature(c)) {
        const base = c.d.pt || [0, 0];
        const up = s.p > base[0] || s.t > base[1];
        html += `<div class="ptb ${c.dmg ? 'hurt' : up ? 'up' : ''}">${s.p}/${s.t - c.dmg}</div>`;
        let flag = '';
        if (inCombat && G.combat.atk.some(a => a.c === c)) flag = '<span class="flag atk">ATK</span>';
        else if (inCombat && G.combat.atk.some(a => a.blockers.includes(c))) flag = '<span class="flag blk">BLK</span>';
        else if (UI.mode === 'block' && UI.data.assign.has(c.id)) flag = '<span class="flag blk">BLK</span>';
        else if (c.sick && !s.kw.has('haste') && c.ctrl === G.active) flag = '<span class="flag">new</span>';
        html += flag;
      }
      if (c.attachedTo != null) { const h = attachedTo(c); if (h) html += `<div class="attachlbl">on ${esc(h.name.split(',')[0])}</div>`; }
    }
    ov.innerHTML = html;
    return slot;
  },
  fill(id, cards, where) {
    const box = UI.el(id);
    const els = cards.map(c => UI.tile(c, where));
    const same = box.children.length === els.length && els.every((e, i) => box.children[i] === e);
    if (!same) box.replaceChildren(...els);
  },
  landChips(id, pi) {
    const lands = perms(pi).filter(c => isLand(c) && !c.animated);
    const groups = {};
    const singles = [];
    for (const l of lands) {
      if (isBasic(l)) { (groups[l.name] = groups[l.name] || []).push(l); }
      else singles.push(l);
    }
    const box = UI.el(id);
    const parts = Object.entries(groups).map(([n, ls]) => {
      const un = ls.filter(l => !l.tapped).length;
      const div = document.createElement('div');
      div.className = 'landchip' + (un === 0 ? ' allt' : '');
      div.style.setProperty('--frame', frameColor(ls[0]));
      div.innerHTML = `<span><b>${ls.length}</b> ${esc(n)}</span><small>${un} untapped</small>`;
      return div;
    });
    box.replaceChildren(...parts, ...singles.map(l => UI.tile(l)));
  },

  /* ---------------- full draw ---------------- */
  draw() {
    if (!G) return;
    const me = P(HUMAN);
    const V = UI.viewBot();
    const bot = P(V);
    UI.playableIds = UI.mode === 'action' ? new Set(allLegalActions(HUMAN, UI.data.mode === 'instant').filter(a => a.ok !== false).map(a => a.card.id)) : null;
    const others = (pi) => perms(pi).filter(c => !isCreature(c) && !isLand(c));
    const crs = (pi) => perms(pi).filter(isCreature);
    UI.fill('oppCreatures', crs(V));
    UI.fill('oppOthers', others(V));
    UI.landChips('oppLands', V);
    UI.drawTabs();
    UI.fill('myCreatures', crs(HUMAN));
    UI.fill('myOthers', others(HUMAN));
    UI.landChips('myLands', HUMAN);
    UI.fill('hand', me.hand);
    // bars
    const cmdOf = (pi) => P(pi).cz[0];
    const czChip = (pi) => {
      const c = cmdOf(pi);
      if (!c) return '';
      const tax = 2 * (P(pi).cmdCasts || 0);
      const play = pi === HUMAN && UI.playableIds && UI.playableIds.has(c.id);
      return `<button class="chip cz ${play ? 'playable' : ''}" data-id="${c.id}">${esc(c.name.split(',')[0])}${tax ? ` +${tax}` : ''}</button>`;
    };
    const dmgFrom = (pi) => (pi === HUMAN ? Math.max(0, ...Object.values(P(pi).cmdDmg)) : P(pi).cmdDmg[HUMAN] || 0);
    UI.el('oppBar').innerHTML = `
      <span class="pname">${esc(bot.name)}</span><span class="life ${bot.life <= 10 ? 'low' : ''}">${bot.life}</span>
      ${bot.lost ? '<span class="chip warn">Out of the game</span>' : ''}
      <span class="chip ${dmgFrom(V) >= 14 ? 'gold' : ''}" title="Commander damage from your commander">${esc(UI.cmdName(HUMAN))} ${dmgFrom(V)}/21</span>
      <span class="chip">Hand ${bot.hand.length}</span><span class="chip">Lib ${bot.library.length}</span>
      <button class="chip" data-zone="gy" data-pi="${V}">GY ${bot.gy.length}</button><button class="chip" data-zone="exile" data-pi="${V}">Exile ${bot.exile.length}</button>
      ${czChip(V)}${G.strip[V] ? `<span class="chip gold">Shields down: all ${perms(V).length}</span>` : ''}${G.monarch === V ? '<span class="chip gold">Monarch</span>' : ''}${bot.energy ? `<span class="chip">E ${bot.energy}</span>` : ''}
      <span class="chip">Mana ${manaAvail(V)}${UI.colorSummary(V)}</span>`;
    const mana = manaAvail(HUMAN);
    UI.el('myBar').innerHTML = `
      <span class="life ${me.life <= 10 ? 'low' : ''}">${me.life}</span>
      <span class="chip ${dmgFrom(HUMAN) >= 14 ? 'warn' : ''}" title="Most commander damage taken from one commander">Cmd ${dmgFrom(HUMAN)}/21</span>
      <span class="chip gold" title="Untapped mana by color">Mana ${mana}${UI.colorSummary(HUMAN)}</span>
      ${czChip(HUMAN)}
      <button class="chip" data-zone="gy" data-pi="0">GY ${me.gy.length}</button><button class="chip" data-zone="exile" data-pi="0">Exile ${me.exile.length}</button>
      <span class="chip">Lib ${me.library.length}</span>${G.monarch === HUMAN ? '<span class="chip gold">Monarch</span>' : ''}
      <span class="spacer"></span><button class="chip" data-act="log">Log</button><button class="chip" data-act="menu">Menu</button>`;
    // strip
    const PH = [['upkeep', 'Upkeep'], ['draw', 'Draw'], ['main1', 'Main 1'], ['combat', 'Combat'], ['main2', 'Main 2'], ['end', 'End']];
    const curPh = ['attackers', 'blockers', 'damage'].includes(G.phase) ? 'combat' : G.phase === 'cleanup' ? 'end' : G.phase;
    UI.el('phases').innerHTML = `<span class="turnlbl">T${G.turn} · ${G.active === HUMAN ? 'Your turn' : esc(P(G.active).name)}</span>` + PH.map(([k, l]) => `<span class="ph ${k === curPh ? 'on' : ''}">${l}</span>`).join('');
    UI.el('stack').innerHTML = G.stack.slice().reverse().map((it, i) => { const src = it.kind === 'spell' ? it.card : it.src; return `<button class="stk ${it.p !== HUMAN ? 'bot' : ''} ${i === 0 ? 'top' : ''}" data-id="${src.id}">${esc(P(it.p).name)}: ${esc(stackLabel(it))}<span class="stk-view">View card</span></button>`; }).join('');
    const recent = (G.botRecent || []).map(findAny).filter(Boolean);
    UI.el('botRecent').innerHTML = recent.length ? `<span class="rc-lbl">Bot cast:</span>${recent.map(c => `<button class="chip rc" data-id="${c.id}">${esc(c.name.split(',')[0])}</button>`).join('')}` : '';
    UI.el('ticker').innerHTML = G.log.slice(-4).map(l => `<div class="${esc(l.cls)}">${esc(l.msg)}</div>`).join('');
    UI.drawPrompt();
  },
  drawPrompt() {
    const t = UI.el('promptText'), b = UI.el('promptBtns');
    let text = '', btns = [];
    const m = UI.mode, d = UI.data;
    if (m === 'action') {
      const top = G.stack[G.stack.length - 1];
      if (d.mode === 'instant' && top && top.p !== HUMAN) { const src = top.kind === 'spell' ? top.card : top.src; btns.push({ label: `View ${src.name.split(',')[0]}`, fn: () => UI.showCard(src) }); }
      text = `<b>${esc(d.reason)}</b><br>${d.mode === 'main' ? 'Tap a card in your hand or on the battlefield to play it.' : 'Tap a highlighted card to respond, or continue.'}`;
      btns.push({ label: d.passLabel, cls: 'primary', fn: () => UI.resolve({ type: 'pass' }) });
    } else if (m === 'pick') {
      text = `<b>${esc(d.prompt)}</b><br>Tap a glowing card.`;
      btns.push({ label: 'Cancel', fn: () => UI.resolve(null) });
    } else if (m === 'attack') {
      const os = opps(HUMAN);
      if (G.attackTarget == null || !os.includes(G.attackTarget)) G.attackTarget = os.includes(UI.view) ? UI.view : os[0];
      const tgt = G.attackTarget;
      const tax = attackTax(HUMAN, tgt);
      text = `<b>Declare attackers${os.length > 1 ? ` at ${esc(P(tgt).name)}` : ''}.</b> Tap creatures to toggle.${tax ? ` Tax ${tax} each (${d.sel.size * tax} of ${manaAvail(HUMAN)} mana).` : ''}${os.length > 1 ? ' Pick who to attack:' : ''}`;
      if (os.length > 1) for (const o of os) btns.push({ label: `${o === tgt ? '● ' : ''}${P(o).name.replace(/^Bot (\d+).*/, 'Bot $1')} (${P(o).life})`, cls: o === tgt ? 'tgt on' : 'tgt', fn: () => { G.attackTarget = o; UI.view = o; const t2 = attackTax(HUMAN, o); if (t2) { const max = Math.floor(manaAvail(HUMAN) / t2); while (d.sel.size > max) d.sel.delete([...d.sel].pop()); } UI.render(); } });
      btns.push({ label: 'No attack', fn: () => UI.resolve([]) });
      btns.push({ label: `Attack with ${d.sel.size}`, cls: 'primary', disabled: !d.sel.size, fn: () => UI.resolve([...d.sel].map(findAny)) });
    } else if (m === 'block') {
      const sel = d.selected ? findAny(d.selected) : null;
      text = sel ? `<b>${esc(sel.name)}</b> selected. Now tap the attacker it blocks.` : '<b>Declare blockers.</b> Tap your creature, then the attacker it blocks. Tap a blocker again to undo.';
      btns.push({ label: d.assign.size ? `Done (${d.assign.size} block${d.assign.size > 1 ? 's' : ''})` : 'No blocks', cls: 'primary', fn: () => UI.resolve(true) });
    } else {
      text = G.over ? 'Game over.' : P(G.active).isBot ? `<b>${esc(P(G.active).name)}</b> is playing…` : 'Resolving…';
    }
    t.innerHTML = text;
    b.replaceChildren(...btns.map(x => { const e = document.createElement('button'); e.className = 'btn ' + (x.cls || ''); e.textContent = x.label; e.disabled = !!x.disabled; e.onclick = x.fn; return e; }));
  },

  /* ---------------- waits ---------------- */
  wait(mode, data) {
    return new Promise((res) => {
      UI.mode = mode; UI.data = data;
      UI.res = (v) => { UI.mode = null; UI.data = null; UI.res = null; UI.render(); res(v); };
      UI.render();
    });
  },
  resolve(v) { if (UI.res) UI.res(v); },
  waitAction(opts) { return UI.wait('action', opts); },
  async pickCard(prompt, cands, optional, source) {
    if (cands.every(c => c.zone === 'bf')) {
      const v = await UI.wait('pick', { prompt, ids: new Set(cands.map(c => c.id)), optional });
      return v;
    }
    return await UI.modalPick(prompt, cands, 1, 1, true).then(r => (r ? r[0] : null));
  },
  pickCards(prompt, cands, min, max) { return UI.modalPick(prompt, cands, min, max, false).then(r => r || []); },
  modalPick(prompt, cands, min, max, cancellable) {
    return new Promise((res) => {
      const sel = new Set();
      const render = () => {
        const zl = (c) => (c.zone && c.zone !== 'hand' ? `<span class="zl">${c.zone === 'bf' ? (c.ctrl === HUMAN ? 'yours' : P(c.ctrl).name.replace(/ \(.*/, '')) : c.zone}</span>` : '');
        UI.openSheet(`<h3>${esc(prompt)}</h3><p class="sub">${max === 1 ? 'Tap a card.' : `Choose ${min === max ? max : `${min} to ${max}`}. Selected ${sel.size}.`} Long names are shown on the cards.</p>
          <div class="grid">${cands.map(c => gcardHTML(c, zl(c)).replace('class="gcard"', `class="gcard ${sel.has(c.id) ? 'on' : ''}"`)).join('')}</div>
          <div class="row-btns">${cancellable || min === 0 ? '<button class="btn" id="mpCancel">Cancel</button>' : ''}${max > 1 || min !== max ? `<button class="btn primary" id="mpOk" ${sel.size < min || sel.size > max ? 'disabled' : ''}>Confirm</button>` : ''}</div>`, false);
        UI.el('sheet').querySelectorAll('[data-gid]').forEach(e => e.onclick = () => {
          const id = +e.dataset.gid;
          if (max === 1 && min <= 1) { UI.closeSheet(); res([cands.find(c => c.id === id)]); return; }
          if (sel.has(id)) sel.delete(id); else if (sel.size < max) sel.add(id);
          render();
        });
        const ok = UI.el('mpOk'); if (ok) ok.onclick = () => { UI.closeSheet(); res(cands.filter(c => sel.has(c.id))); };
        const cn = UI.el('mpCancel'); if (cn) cn.onclick = () => { UI.closeSheet(); res(min === 0 && !cancellable ? [] : null); };
      };
      render();
    });
  },
  pickOpt(prompt, opts, card) {
    return new Promise((res) => {
      UI.openSheet(`<h3>${esc(prompt)}</h3>${card ? UI.detailHTML(card, true) : ''}<div class="optlist">${opts.map((o, i) => `<button class="btn" data-oi="${i}" ${o.disabled ? 'disabled' : ''}>${esc(o.label)}</button>`).join('')}</div><div class="row-btns"><button class="btn" id="poCancel">Cancel</button></div>`, false);
      UI.el('sheet').querySelectorAll('[data-oi]').forEach(e => e.onclick = () => { UI.closeSheet(); res(opts[+e.dataset.oi].value); });
      UI.el('poCancel').onclick = () => { UI.closeSheet(); res(null); };
    });
  },
  confirm(prompt, card) {
    return new Promise((res) => {
      UI.openSheet(`<h3>${esc(prompt)}</h3>${card ? UI.detailHTML(card, true) : ''}<div class="row-btns"><button class="btn" id="cfNo">No</button><button class="btn primary" id="cfYes">Yes</button></div>`, false);
      UI.el('cfYes').onclick = () => { UI.closeSheet(); res(true); };
      UI.el('cfNo').onclick = () => { UI.closeSheet(); res(false); };
    });
  },
  mulligan(hand, taken) {
    return new Promise((res) => {
      const lands = hand.filter(isLand).length;
      UI.render();
      UI.openSheet(`<h3>Opening hand${taken ? ` (mulligan ${taken})` : ''}</h3><p class="sub">${lands} land${lands === 1 ? '' : 's'}. ${taken ? `Keeping puts ${Math.max(0, taken - 1)} card${taken - 1 === 1 ? '' : 's'} on the bottom (first mulligan is free).` : 'First mulligan is free.'}</p>
        <div class="mull-grid">${hand.map(c => gcardHTML(c)).join('')}</div>
        <div class="row-btns"><button class="btn" id="mlMull">Mulligan</button><button class="btn primary" id="mlKeep">Keep</button></div>`, false);
      UI.el('sheet').querySelectorAll('[data-gid]').forEach(e => e.onclick = () => {});
      UI.el('mlKeep').onclick = () => { UI.closeSheet(); res(true); };
      UI.el('mlMull').onclick = () => { UI.closeSheet(); res(false); };
    });
  },
  declareAttackers() {
    const elig = new Set(creatures(HUMAN).filter(canAttack).map(c => c.id));
    if (!elig.size) return Promise.resolve([]);
    if (G.tf.cantAttack[HUMAN]) return Promise.resolve([]);
    return UI.wait('attack', { sel: new Set(), elig });
  },
  async declareBlockers() {
    const assign = new Map();
    const forced = (G.combat.forced) || {};
    for (const [bid, aid] of Object.entries(forced)) {
      const b = findAny(+bid), a = findAny(aid);
      if (b && a && b.zone === 'bf' && canBlock(b, a) && G.combat.atk.some(x => x.c === a)) assign.set(b.id, a.id);
    }
    const canAnyBlock = creatures(HUMAN).some(b => G.combat.atk.some(a => canBlock(b, a.c)));
    if (!canAnyBlock) return;
    await UI.wait('block', { assign, selected: null, forced: new Set(assign.keys()) });
    for (const [bid, aid] of assign) {
      const A = G.combat.atk.find(x => x.c.id === aid);
      const b = findAny(bid);
      if (A && b) A.blockers.push(b);
    }
    for (const A of G.combat.atk) if (has(A.c, 'menace') && A.blockers.length === 1) UI.toast(`${A.c.name} has menace: one blocker is not enough, that block is removed.`);
  },

  /* ---------------- taps ---------------- */
  cmdName(pi) { const p = P(pi); const c = [...p.cz, ...p.bf, ...p.gy, ...p.exile, ...p.hand].find(x => x.isCmd && x.owner === pi); return c ? c.name.split(',')[0] : 'Commander'; },
  viewBot() {
    const bots = G.players.filter(p => p.idx !== HUMAN).map(p => p.idx);
    // follow the action: the active bot, or the bot attacking you
    const follow = G.combat && G.combat.dp === HUMAN ? G.combat.ap : (G.active !== HUMAN ? G.active : null);
    if (follow != null && UI.lastFollow !== follow + ':' + G.turn + ':' + !!G.combat) { UI.lastFollow = follow + ':' + G.turn + ':' + !!G.combat; UI.view = follow; }
    if (UI.view == null || !bots.includes(UI.view)) UI.view = bots.find(b => !P(b).lost) ?? bots[0];
    return UI.view;
  },
  drawTabs() {
    const box = UI.el('oppTabs');
    const bots = G.players.filter(p => p.idx !== HUMAN);
    if (bots.length < 2) { box.innerHTML = ''; box.hidden = true; return; }
    box.hidden = false;
    const cand = (pi) => (UI.mode === 'pick' ? perms(pi).filter(c => UI.data.ids.has(c.id)).length : 0);
    box.innerHTML = bots.map(p => {
      const n = cand(p.idx);
      const flags = [G.active === p.idx ? 'turn' : '', G.combat && G.combat.ap === p.idx && G.combat.dp === HUMAN ? 'atk' : '', p.lost ? 'out' : '', UI.view === p.idx ? 'on' : ''].filter(Boolean).join(' ');
      return `<button class="otab ${flags}" data-tab="${p.idx}"><b>${esc(p.name.replace(/ \(.*/, ''))}</b> <small>${esc((DECKS[p.deckKey] || {}).short || '')}</small><span class="ol">${p.lost ? 'out' : p.life}</span>${n ? `<span class="ocand">${n}</span>` : ''}</button>`;
    }).join('');
    box.querySelectorAll('[data-tab]').forEach(e => e.onclick = () => { UI.view = +e.dataset.tab; UI.render(); });
  },
  colorSummary(pi) {
    const m = manaColors(pi);
    const parts = [...'WUBRGC'].filter(k => m[k]).map(k => `${pipHTML(k)}${m[k]}`);
    return parts.length ? ` <span class="msum">${parts.join(' ')}</span>` : '';
  },
  onCardTap(c) {
    const m = UI.mode, d = UI.data;
    if (m === 'pick') {
      if (d.ids.has(c.id)) { UI.resolve(c); return; }
      return UI.showCard(c);
    }
    if (m === 'attack') {
      if (d.elig.has(c.id)) {
        if (d.sel.has(c.id)) d.sel.delete(c.id);
        else {
          const tax = attackTax(HUMAN, G.attackTarget);
          if (tax && (d.sel.size + 1) * tax > manaAvail(HUMAN)) { UI.toast(`Not enough mana for the attack tax (${tax} each).`); return; }
          d.sel.add(c.id);
        }
        UI.render(); return;
      }
      return UI.showCard(c);
    }
    if (m === 'block') {
      const isAttacker = G.combat && G.combat.atk.some(a => a.c === c);
      if (c.ctrl === HUMAN && c.zone === 'bf' && isCreature(c) && !isAttacker) {
        if (d.forced.has(c.id)) { UI.toast(`${c.name} must block (Fighter Class).`); return; }
        if (d.assign.has(c.id)) { d.assign.delete(c.id); d.selected = null; UI.render(); return; }
        if (!G.combat.atk.some(a => canBlock(c, a.c))) { UI.toast(`${c.name} can't block any attacker.`); return; }
        d.selected = d.selected === c.id ? null : c.id; UI.render(); return;
      }
      if (isAttacker && d.selected) {
        const b = findAny(d.selected);
        if (!canBlock(b, c)) { UI.toast(`${b.name} can't block ${c.name}${has(c, 'flying') ? ' (flying)' : ''}.`); return; }
        d.assign.set(b.id, c.id); d.selected = null; UI.render(); return;
      }
      return UI.showCard(c);
    }
    UI.showCard(c);
  },
  zoneOf(c) { return c.zone; },
  actionsFor(c) {
    if (UI.mode !== 'action') return [];
    const owner = c.zone === 'bf' ? c.ctrl : c.owner;
    if (owner !== HUMAN) return [];
    let acts = legalActionsFor(HUMAN, c, c.zone);
    if (UI.data.mode === 'instant') acts = acts.filter(a => a.type !== 'land');
    return acts;
  },
  showCard(c) {
    const acts = UI.actionsFor(c);
    UI.openSheet(`<div class="row-btns" style="justify-content:space-between"><h3>${esc(c.faceHidden ? 'Face-down card' : c.name)}</h3><button class="btn" id="scClose">Close</button></div>
      ${UI.detailHTML(c)}
      ${acts.length ? `<div class="acts">${acts.map((a, i) => `<button class="btn ${a.ok !== false ? 'primary' : ''}" data-ai="${i}" ${a.ok === false ? 'disabled' : ''}><span>${esc(a.label)}</span>${a.type !== 'land' ? `<span class="cost">${a.cost != null ? (+a.cost === 0 ? 'free' : manaHTML(String(toCost(a.cost)))) : ''}</span>` : ''}</button>`).join('')}</div>` : ''}`, true);
    UI.el('scClose').onclick = () => UI.closeSheet();
    UI.el('sheet').querySelectorAll('[data-ai]').forEach(e => e.onclick = () => { const a = acts[+e.dataset.ai]; UI.closeSheet(); UI.resolve(a); });
  },
  detailHTML(c, compact) {
    const lines = [];
    if (c.zone === 'bf') {
      if (isCreature(c)) { const s = st(c); lines.push(`Now ${s.p}/${s.t}${c.dmg ? `, ${c.dmg} damage marked` : ''}`); if (c.tmp.p || c.tmp.t) lines.push(`Until end of turn: ${(c.tmp.p || 0) >= 0 ? '+' : ''}${c.tmp.p || 0}/${(c.tmp.t || 0) >= 0 ? '+' : ''}${c.tmp.t || 0}`); const kws = [...s.kw].filter(k => !['onlyWalls'].includes(k)); if (kws.length) lines.push('Has: ' + kws.join(', ')); if (s.prot.size) lines.push('Protection from: ' + [...s.prot].join('')); if (s.ward) lines.push(`Ward ${s.ward}`); }
      const k = Object.entries(c.counters).filter(([, v]) => v > 0).map(([n, v]) => `${v} ${n === 'p1p1' ? '+1/+1' : n === 'm1m1' ? '-1/-1' : n}`);
      if (k.length) lines.push('Counters: ' + k.join(', '));
      const att = attachments(c); if (att.length) lines.push('Attached: ' + att.map(a => a.name).join(', '));
      if (c.attachedTo != null) { const h = attachedTo(c); if (h) lines.push('Attached to ' + h.name); }
      lines.push(`Controller: ${P(c.ctrl).name}${c.tapped ? ' · tapped' : ''}${c.sick && isCreature(c) ? ' · summoning sick' : ''}`);
    }
    if (c.zone === 'exile' && c.foretold != null) lines.push(`Foretold on turn ${c.foretold}`);
    if (c.isCmd) lines.push(`Commander · tax ${2 * (P(c.owner).cmdCasts || 0)}`);
    const sit = G.stack.find(it => (it.kind === 'spell' ? it.card : it.src) === c);
    if (sit) {
      const tg = sit.ctx.targets.map(t => t.isPlayer ? (t.pi === HUMAN ? 'you' : t.name) : `${t.name}${t.ctrl === HUMAN ? ' (yours)' : ''}`);
      lines.unshift(`On the stack: ${P(sit.p).name} ${sit.kind === 'spell' ? 'cast it' : 'activated or triggered it'}${sit.ctx.modeLabel ? ` (${sit.ctx.modeLabel})` : ''}${tg.length ? `, targeting ${tg.join(', ')}` : ''}${sit.ctx.counterTarget ? `, countering ${sit.ctx.counterTarget.card.name}` : ''}.`);
      if (sit.kind === 'ability') lines.unshift(`Ability: ${sit.label.replace(c.name + ': ', '')}`);
    } else if (c.zone && c.zone !== 'bf' && c.zone !== 'hand') lines.push(`Zone: ${{ gy: 'graveyard', exile: 'exile', cz: 'command zone', library: 'library' }[c.zone] || c.zone} (${P(c.owner).name})`);
    const big = `<div class="bigcard" style="--frame:${frameColor(c)}">${fallbackHTML(c).replace('class="ftxt"', 'class="ftxt"')}${imgHTML(c)}</div>`;
    return `<div class="detail">${big}<div class="oracle"><div>${manaHTML(c.d.mc || '')} ${esc(typeLine(c))}${c.d.pt ? ` · ${c.d.pt[0]}/${c.d.pt[1]}` : ''}</div><div style="margin-top:6px">${esc(c.d.text || '')}</div>${lines.length ? `<div class="meta">${lines.map(esc).map(x => `<span>${x}</span>`).join('')}</div>` : ''}</div></div>`;
  },
  openZone(zone, pi) {
    const cards = P(pi)[zone].slice().reverse().map(c => (pi !== HUMAN && c.faceDown ? Object.assign(Object.create(c), { faceHidden: true, name: 'Foretold card', d: { ...c.d, text: 'A face-down foretold card.', mc: '', img: null } }) : c));
    const title = `${pi === HUMAN ? 'Your' : P(pi).name + "'s"} ${zone === 'gy' ? 'graveyard' : 'exile'} (${cards.length})`;
    UI.openSheet(`<div class="row-btns" style="justify-content:space-between"><h3>${esc(title)}</h3><button class="btn" id="zClose">Close</button></div>${cards.length ? `<div class="grid">${cards.map(c => gcardHTML(c, c.foretold != null && pi === HUMAN ? '<span class="zl">foretold</span>' : '')).join('')}</div>` : '<p class="sub">Empty.</p>'}`, true);
    UI.el('zClose').onclick = () => UI.closeSheet();
    UI.el('sheet').querySelectorAll('[data-gid]').forEach(e => e.onclick = () => { const c = findAny(+e.dataset.gid); if (c && !(pi !== HUMAN && c.faceDown)) UI.showCard(c); });
  },
  onAct(a) {
    if (a === 'log') {
      UI.openSheet(`<div class="row-btns" style="justify-content:space-between"><h3>Game log</h3><span><button class="btn" id="lgCopy">Copy log</button> <button class="btn" id="lgClose">Close</button></span></div><textarea id="lgText" readonly hidden style="width:100%;height:140px;background:var(--panel-2);color:var(--fg);border:1px solid var(--line);border-radius:8px;font-size:11px"></textarea><div class="logbox">${G.log.slice().reverse().map(l => `<div class="logline ${esc(l.cls)}">${esc(l.msg)}</div>`).join('')}</div>`, true);
      UI.el('lgClose').onclick = () => UI.closeSheet();
      UI.el('lgCopy').onclick = () => {
        const txt = `Opponent deck: ${G.botKey}, my deck: ${P(HUMAN).deckKey}\n` + G.log.slice(-300).map(l => l.msg).join('\n');
        const fallback = () => { const ta = UI.el('lgText'); ta.hidden = false; ta.value = txt; ta.focus(); ta.select(); UI.toast('Copy the selected text, then paste it to Claude.'); };
        try { navigator.clipboard.writeText(txt).then(() => UI.toast('Log copied. Paste it to Claude.'), fallback); } catch (e) { fallback(); }
      };
    }
    if (a === 'menu') {
      UI.openSheet(`<div class="row-btns" style="justify-content:space-between"><h3>Menu</h3><button class="btn" id="mnClose">Close</button></div>
        <div class="settings">
          <label><input type="checkbox" id="mnStop" ${SETTINGS.stopEverySpell ? 'checked' : ''}> Let me respond to every bot spell (not only removal, wipes and attacks)</label>
          <label><input type="checkbox" id="mnHouse" ${SETTINGS.shayHouseRule ? 'checked' : ''}> House rule: Shay's {1} ability also puts a bounty counter on every bot creature</label>
          <label><input type="checkbox" id="mnTithe" ${SETTINGS.askTithe ? 'checked' : ''}> Ask me before paying for Rhystic Study, Mystic Remora and Smothering Tithe</label>
          <label>Bot speed <select id="mnSpeed"><option value="900">Slow</option><option value="450">Normal</option><option value="120">Fast</option></select></label>
        </div>
        <button class="btn danger" id="mnConcede">Concede and start a new game</button>`, true);
      UI.el('mnSpeed').value = String(SETTINGS.botDelay);
      UI.el('mnStop').onchange = (e) => { SETTINGS.stopEverySpell = e.target.checked; saveSettings(); };
      UI.el('mnHouse').onchange = (e) => { SETTINGS.shayHouseRule = e.target.checked; saveSettings(); };
      UI.el('mnTithe').onchange = (e) => { SETTINGS.askTithe = e.target.checked; saveSettings(); };
      UI.el('mnSpeed').onchange = (e) => { SETTINGS.botDelay = +e.target.value; saveSettings(); };
      UI.el('mnClose').onclick = () => UI.closeSheet();
      UI.el('mnConcede').onclick = () => { location.reload(); };
    }
  },

  /* ---------------- sheet / toast ---------------- */
  openSheet(html, dismissable) {
    const s = UI.el('sheet');
    s.innerHTML = `<div class="sheet-box" role="dialog">${html}</div>`;
    s.hidden = false;
    UI.sheetDismissable = dismissable;
  },
  closeSheet() { const s = UI.el('sheet'); s.hidden = true; s.innerHTML = ''; },
  toast(msg) {
    const t = UI.el('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(UI.toastT); UI.toastT = setTimeout(() => { t.hidden = true; }, 2600);
  },
  gameOver() {
    UI.render();
    const win = G.winner === HUMAN;
    const title = win ? 'You win' : P(HUMAN).lost ? 'You lose' + (G.winner != null ? ` · ${P(G.winner).name} is ${living().length > 1 ? 'still standing' : 'the winner'}` : '') : 'Draw';
    const me = P(HUMAN);
    const bots = G.players.filter(p => p.idx !== HUMAN).map(p => `${p.name}: ${p.lost ? 'out' : p.life + ' life'}`).join(' · ');
    UI.openSheet(`<h3>${title}</h3><p class="sub">Turn ${G.turn}. You ${me.life} life. ${esc(bots)}.</p>
      <div class="logbox">${G.log.slice(-8).map(l => `<div class="logline ${esc(l.cls)}">${esc(l.msg)}</div>`).join('')}</div>
      <div class="row-btns"><button class="btn" id="goLog">Full log</button><button class="btn primary" id="goAgain">New game</button></div>`, false);
    UI.el('goAgain').onclick = () => location.reload();
    UI.el('goLog').onclick = () => UI.onAct('log');
  },
};
