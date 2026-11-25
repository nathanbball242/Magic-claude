'use strict';
/* =====================================================================
   Shay Cormac Commander game: rules engine
   Engine never touches the DOM. Human decisions go through UI.* calls,
   bot decisions through AI callbacks. When a player isBot, every choice
   function answers with its ai callback, so the engine can run headless.
   ===================================================================== */

const HUMAN = 0, BOT = 1;
let G = null;
let UID = 1;
const CARDS = {};
const SETTINGS = { botDelay: 450, stopEverySpell: false, askTithe: true };

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* ---------------- card definitions ---------------- */
function parseMC(mc) {
  const r = { generic: 0, pips: 0, x: 0 };
  const syms = (mc || '').match(/\{[^}]+\}/g) || [];
  for (const s of syms) {
    const v = s.slice(1, -1);
    if (/^\d+$/.test(v)) r.generic += +v;
    else if (v === 'X') r.x++;
    else r.pips++;
  }
  r.cmc = r.generic + r.pips;
  return r;
}
function C(name, d) {
  d.name = name;
  d.types = d.types || [];
  d.kw = d.kw || [];
  d.on = d.on || {};
  d.abilities = d.abilities || [];
  const m = parseMC(d.mc);
  d.cmc = d.cmcOverride != null ? d.cmcOverride : m.cmc;
  d.pips = m.pips;
  d.xCount = m.x;
  d.colors = d.colors || '';
  CARDS[name] = d;
  return d;
}

/* ---------------- basic accessors ---------------- */
function P(pi) { return G.players[pi]; }
function opp(pi) { return 1 - pi; }
function PL(pi) { return { isPlayer: true, pi, name: P(pi).name }; }
function nm(c) { return c.isPlayer ? c.name : c.name; }
const YOU_VERBS = ['casts', 'draws', 'attacks', 'discards', 'mulligans', 'keeps', 'pays', 'takes', 'gains', 'loses', 'creates', 'tutors', 'reveals', 'foretells', 'scries', 'ventures', 'becomes', 'goes', 'tries', 'searches', 'sacrifices', 'chooses'];
function fixYou(msg) {
  return msg.replace(/\bYou (\w+)\b/g, (m, v) => (YOU_VERBS.includes(v) ? 'You ' + (v === 'goes' ? 'go' : v === 'tries' ? 'try' : v === 'searches' ? 'search' : v === 'scries' ? 'scry' : v.replace(/s$/, '')) : m))
    .replace(/\bYou go first/, 'You go first');
}
function log(msg, cls = '') {
  if (!G) return;
  msg = fixYou(msg);
  G.log.push({ t: G.turn, msg, cls });
  if (G.log.length > 1500) G.log.shift();
  if (typeof UI !== 'undefined' && UI.onLog) UI.onLog(msg, cls);
}

function mkCard(name, owner, opts = {}) {
  const d = CARDS[name];
  if (!d) throw new Error('Unknown card ' + name);
  return {
    id: UID++, name, d, owner, ctrl: owner, zone: null, zcc: 0,
    tapped: false, sick: true, counters: {}, dmg: 0, dt: false,
    attachedTo: null, token: !!opts.token, isCmd: false,
    tmp: {}, perm: {}, damagedBy: [], phased: false, animated: false,
  };
}

function typesOf(c) {
  const t = c.d.types.slice();
  if ((c.animated || c.tmp.crewed) && !t.includes('Creature')) t.push('Creature');
  return t;
}
function hasType(c, t) { return typesOf(c).includes(t); }
function isCreature(c) { return hasType(c, 'Creature'); }
function isLand(c) { return c.d.types.includes('Land'); }
function isArtifact(c) { return c.d.types.includes('Artifact'); }
function isEnchantment(c) { return c.d.types.includes('Enchantment'); }
function isLegendary(c) { return c.d.types.includes('Legendary'); }
function isEquipment(c) { return c.d.types.includes('Equipment'); }
function isAura(c) { return c.d.types.includes('Aura'); }
function isInstant(c) { return c.d.types.includes('Instant'); }
function isSorcery(c) { return c.d.types.includes('Sorcery'); }
function isPermanentCard(c) { return !isInstant(c) && !isSorcery(c); }
function isHistoric(c) { return isArtifact(c) || isLegendary(c) || c.d.types.includes('Saga'); }
function mv(c) { return c.token ? 0 : c.d.cmc; }
function colorsOf(c) { return c.d.colors || ''; }
function isBasic(c) { return c.d.types.includes('Basic'); }

/* ---------------- battlefield queries ---------------- */
function perms(pi) { return P(pi).bf.filter(c => !c.phased); }
function allPerms() { return [...perms(G.active), ...perms(opp(G.active))]; }
function creatures(pi) { return perms(pi).filter(isCreature); }
function allCreatures() { return allPerms().filter(isCreature); }
function artifactsOf(pi) { return perms(pi).filter(isArtifact); }
function findPerm(id) { return allPerms().find(c => c.id === id) || null; }
function attachedTo(c) { return c.attachedTo != null ? findPerm(c.attachedTo) : null; }
function attachments(c) { return allPerms().filter(a => a.attachedTo === c.id); }
function controls(pi, name) { return perms(pi).some(c => c.name === name); }
function controlsCommander(pi) { return perms(pi).some(c => c.isCmd && c.owner === pi && isCreature(c)); }
function isModified(c) {
  if (Object.values(c.counters).some(v => v > 0)) return true;
  return attachments(c).some(a => (isEquipment(a) && a.ctrl === c.ctrl) || (isAura(a) && a.ctrl === c.ctrl));
}
function metalcraft(pi) { return artifactsOf(pi).length >= 3; }
function trigMult(pi, snapshot) {
  const pool = snapshot || allPerms();
  return pool.some(c => c.name === 'Teysa Karlov' && c.ctrl === pi) ? 2 : 1;
}

/* ---------------- characteristics ---------------- */
function st(c) {
  const d = c.d;
  let p = 0, t = 0;
  if (d.pt) [p, t] = d.pt;
  if (c.animated) [p, t] = [0, 0];
  if (d.dynPT) [p, t] = d.dynPT(c);
  if (c.perm.copyPT) [p, t] = c.perm.copyPT;
  if (G && G.sephiroth && G.sephiroth[c.ctrl] && isCreature(c) && isModified(c)) [p, t] = [7, 5];
  if (c.tmp.basePT) [p, t] = c.tmp.basePT;
  const kw = new Set(d.kw);
  const prot = new Set(d.prot || []);
  let ward = d.ward || 0;
  const lose = new Set();
  if (c.animated) kw.add('haste');
  p += (c.counters.p1p1 || 0) - (c.counters.m1m1 || 0);
  t += (c.counters.p1p1 || 0) - (c.counters.m1m1 || 0);
  const apply = (r) => {
    if (!r) return;
    p += r.p || 0; t += r.t || 0;
    (r.kw || []).forEach(k => kw.add(k));
    (r.prot || []).forEach(k => prot.add(k));
    (r.lose || []).forEach(k => lose.add(k));
    if (r.ward) ward = Math.max(ward, r.ward);
  };
  if (d.self) apply(d.self(c));
  if (G && c.zone === 'bf') {
    for (const s of allPerms()) {
      if (s.d.anthem) apply(s.d.anthem(s, c));
      if (s.attachedTo === c.id && s.d.attachBuff) apply(s.d.attachBuff(s, c));
    }
  }
  p += c.tmp.p || 0; t += c.tmp.t || 0;
  (c.tmp.kw || []).forEach(k => kw.add(k));
  (c.tmp.prot || []).forEach(k => prot.add(k));
  if (c.perm.untilNextP) p += c.perm.untilNextP;
  lose.forEach(k => kw.delete(k));
  if (G && G.strip) {
    const s = G.strip[c.ctrl];
    if (s) {
      kw.delete('hexproof'); kw.delete('indestructible');
      if (s === 'full') { kw.delete('shroud'); ward = 0; prot.clear(); }
    }
  }
  return { p, t, kw, ward, prot };
}
function pow(c) { return st(c).p; }
function tou(c) { return st(c).t; }
function has(c, k) { return st(c).kw.has(k); }

/* ---------------- targeting ---------------- */
function canTarget(c, byPi, src) {
  if (c.isPlayer) return !P(c.pi).protAll;
  if (c.zone !== 'bf') return true;
  const s = st(c);
  if (s.kw.has('shroud')) return false;
  if (c.ctrl !== byPi && s.kw.has('hexproof')) return false;
  if (src) {
    const cols = colorsOf(src);
    for (const col of cols) if (s.prot.has(col)) return false;
    if (s.prot.has('all') && c.ctrl !== byPi) return false;
  }
  return true;
}
function addTarget(ctx, c) {
  ctx.targets.push(c);
  ctx.tz = ctx.tz || {};
  if (!c.isPlayer) ctx.tz[c.id] = { zone: c.zone, zcc: c.zcc };
}
function tOK(ctx, c) {
  if (!c) return false;
  if (c.isPlayer) return !P(c.pi).protAll;
  const z = ctx.tz && ctx.tz[c.id];
  if (!z) return false;
  if (c.zone !== z.zone || c.zcc !== z.zcc || c.phased) return false;
  if (c.zone === 'bf' && !canTarget(c, ctx.p, ctx.card)) return false;
  return true;
}

/* ---------------- choices (human via UI, bot via ai callback) ---------------- */
async function chooseCard(pi, { prompt, cands, optional = false, ai, source }) {
  cands = cands.filter(Boolean);
  if (!cands.length) return null;
  if (P(pi).isBot) {
    const r = ai ? ai(cands) : cands[0];
    return r === undefined ? null : r;
  }
  return await UI.pickCard(prompt, cands, optional, source);
}
async function chooseCards(pi, { prompt, cands, min = 0, max = 1, ai }) {
  if (!cands.length) return [];
  if (P(pi).isBot) {
    const r = ai ? ai(cands) : cands.slice(0, max);
    return (r || []).slice(0, max);
  }
  return await UI.pickCards(prompt, cands, min, max);
}
async function chooseOpt(pi, { prompt, opts, ai, card }) {
  const live = opts.filter(o => !o.disabled);
  if (!live.length) return null;
  if (P(pi).isBot) {
    const r = ai ? ai(live) : live[0].value;
    return r;
  }
  return await UI.pickOpt(prompt, opts, card);
}
async function chooseYes(pi, { prompt, ai, card }) {
  if (P(pi).isBot) return ai ? !!ai() : true;
  return await UI.confirm(prompt, card);
}
async function chooseNumber(pi, { prompt, min, max, ai }) {
  if (max < min) return null;
  if (P(pi).isBot) return ai ? ai(min, max) : max;
  const opts = [];
  for (let i = min; i <= max; i++) opts.push({ label: String(i), value: i });
  return await UI.pickOpt(prompt, opts);
}

/* helper used by card scripts: target a permanent */
async function pickTarget(ctx, prompt, filter, ai, optional = false) {
  const cands = allPerms().filter(c => filter(c) && canTarget(c, ctx.p, ctx.card) && !ctx.targets.includes(c));
  if (!cands.length) return optional;
  const pick = await chooseCard(ctx.p, { prompt, cands, optional, ai: cs => (ai || AIH.oppThreat)(cs, ctx), source: ctx.card });
  if (!pick) return optional;
  addTarget(ctx, pick);
  return true;
}
async function pickPlayerTarget(ctx, prompt, ai) {
  const cands = [PL(HUMAN), PL(BOT)].filter(p => canTarget(p, ctx.p));
  if (!cands.length) return false;
  if (P(ctx.p).isBot) { addTarget(ctx, ai ? ai(cands) : cands.find(x => x.pi !== ctx.p) || cands[0]); return true; }
  const v = await UI.pickOpt(prompt, cands.map(c => ({ label: c.pi === ctx.p ? 'Yourself' : 'Opponent (' + c.name + ')', value: c.pi })));
  if (v == null) return false;
  addTarget(ctx, PL(v));
  return true;
}

/* ---------------- life, damage, counters ---------------- */
function gainLife(pi, n) {
  if (n <= 0 || P(pi).lifeLocked) return;
  P(pi).life += n;
  G.tf.lifeGained[pi] += n;
}
function loseLife(pi, n) {
  if (n <= 0 || P(pi).lifeLocked) return;
  P(pi).life -= n;
}
function dealDamage(src, tgt, n, { combat = false } = {}) {
  if (n <= 0) return 0;
  const sc = colorsOf(src);
  if (tgt.isPlayer) {
    const pl = P(tgt.pi);
    if (pl.protAll || pl.preventDmg) return 0;
    if (!pl.lifeLocked) pl.life -= n;
    if (combat && src.isCmd) pl.cmdDmg[src.owner] = (pl.cmdDmg[src.owner] || 0) + n;
    if (combat && G.monarch === tgt.pi && src.ctrl !== tgt.pi) { G.monarch = src.ctrl; log(`${P(src.ctrl).name} becomes the monarch.`); }
  } else {
    if (tgt.zone !== 'bf') return 0;
    const s = st(tgt);
    for (const col of sc) if (s.prot.has(col)) return 0;
    if (s.prot.has('all')) return 0;
    tgt.dmg += n;
    if (has(src, 'deathtouch')) tgt.dt = true;
    tgt.damagedBy.push(src.id);
    tgt.perm.damagedTurn = G.turn;
  }
  if (src.zone === 'bf' ? has(src, 'lifelink') : src.d.kw.includes('lifelink')) gainLife(src.ctrl, n);
  return n;
}
function addCounters(c, k, n) {
  if (n <= 0 || !c) return;
  c.counters[k] = (c.counters[k] || 0) + n;
  if (k === 'p1p1' || k === 'm1m1') {
    const a = c.counters.p1p1 || 0, b = c.counters.m1m1 || 0, m = Math.min(a, b);
    if (m) { c.counters.p1p1 = a - m; c.counters.m1m1 = b - m; }
  }
}
function snap(c) {
  return {
    id: c.id, name: c.name, ctrl: c.ctrl, owner: c.owner, counters: { ...c.counters },
    p: isCreature(c) ? pow(c) : 0, t: isCreature(c) ? tou(c) : 0,
    attached: attachments(c).map(a => a.id), damagedBy: c.damagedBy.slice(),
    isCmd: c.isCmd, token: c.token, d: c.d, mv: mv(c),
  };
}

/* ---------------- zones ---------------- */
function removeFromZone(c) {
  if (!c.zone || c.zone === 'stack') return;
  const arr = c.zone === 'bf' ? P(c.ctrl).bf : P(c.owner)[c.zone];
  const i = arr.indexOf(c);
  if (i >= 0) arr.splice(i, 1);
}
function resetObject(c) {
  for (const pl of G.players) for (const a of pl.bf) if (a.attachedTo === c.id) a.attachedTo = null;
  c.attachedTo = null; c.tapped = false; c.counters = {}; c.dmg = 0; c.dt = false;
  c.tmp = {}; c.perm = {}; c.damagedBy = []; c.animated = false; c.phased = false;
  if (c.transformedFrom) { c.name = c.transformedFrom; c.d = CARDS[c.transformedFrom]; c.transformedFrom = null; }
  c.ctrl = c.owner;
}
function moveTo(c, zone, opts = {}) {
  const from = c.zone;
  removeFromZone(c);
  if (from === 'bf') resetObject(c);
  c.zcc++;
  c.foretold = null; c.faceDown = false;
  if (c.token) { c.zone = null; return 'gone'; }
  if (c.isCmd && ['gy', 'exile', 'library'].includes(zone) && !opts.noCmd) {
    zone = 'cz';
    log(`${c.name} goes to the command zone.`);
  }
  c.zone = zone;
  const arr = P(c.owner)[zone];
  if (zone === 'library' && opts.bottom) arr.unshift(c); else arr.push(c);
  return zone;
}
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}
async function enterBF(c, pi, opts = {}) {
  removeFromZone(c);
  c.zone = 'bf'; c.zcc++; c.ctrl = pi;
  P(pi).bf.push(c);
  c.tapped = !!(opts.tapped || c.d.entersTapped);
  c.sick = true; c.tmp = {}; c.perm = {}; c.counters = c.counters || {};
  c.dmg = 0; c.dt = false; c.damagedBy = [];
  if (opts.attachTo) c.attachedTo = opts.attachTo.id;
  if (c.d.entersCounters) for (const k in c.d.entersCounters) addCounters(c, k, c.d.entersCounters[k]);
  if (!c.token && !opts.quiet) log(`${P(pi).name}: ${c.name} enters the battlefield${c.tapped ? ' tapped' : ''}.`);
  if (c.d.etb) await c.d.etb(c, opts);
  await emit('etb', { card: c, opts });
  return c;
}
async function createToken(pi, name, n = 1, opts = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const c = mkCard(name, pi, { token: true });
    await enterBF(c, pi, { ...opts, quiet: true });
    out.push(c);
  }
  if (n > 0) log(`${P(pi).name} creates ${n} ${name} token${n > 1 ? 's' : ''}.`);
  return out;
}
function gainControl(c, pi) {
  if (c.zone !== 'bf' || c.ctrl === pi) return;
  const arr = P(c.ctrl).bf; arr.splice(arr.indexOf(c), 1);
  c.ctrl = pi; P(pi).bf.push(c); c.sick = true;
}
function tapC(c) { c.tapped = true; }
function attach(eq, target) {
  if (!eq || !target || eq.zone !== 'bf' || target.zone !== 'bf') return;
  if (eq.attachedTo === target.id) return;
  eq.attachedTo = target.id;
  log(`${eq.name} is attached to ${target.name}.`);
}

/* death / leaving */
async function killBatch(victims, how = 'destroy') {
  victims = [...new Set(victims)].filter(c => c && c.zone === 'bf');
  if (!victims.length) return [];
  const snapshot = allPerms().slice();
  const recs = [];
  for (const c of victims) {
    if (c.zone !== 'bf') continue;
    const lki = snap(c);
    const wasCreature = isCreature(c);
    const toExile = !!c.tmp.exileIfDies && wasCreature;
    if (toExile) log(`${lki.name} is exiled instead of dying.`);
    else log(`${lki.name} ${how === 'sac' ? 'is sacrificed' : wasCreature ? 'dies' : 'is put into the graveyard'}.`, wasCreature ? 'death' : '');
    moveTo(c, toExile ? 'exile' : 'gy');
    recs.push({ c, lki, wasCreature, died: !toExile });
  }
  for (const r of recs) {
    if (r.died && r.wasCreature) {
      G.tf.died = true;
      await fireDies(r, snapshot);
    }
    if (r.died && r.lki.d.ltbToGY) await r.lki.d.ltbToGY(r.c, r.lki);
  }
  return recs.map(r => r.c);
}
async function fireDies(r, snapshot) {
  const lki = r.lki;
  // Touch of Moonglove
  if (G.tf.moonglove.size && lki.damagedBy.some(id => G.tf.moonglove.has(id))) {
    log(`Touch of Moonglove: ${P(lki.ctrl).name} loses 2 life.`);
    loseLife(lki.ctrl, 2);
  }
  for (const s of snapshot) {
    const h = s.d.on && s.d.on.dies;
    if (h) await h(s, { dead: r.c, lki, mult: trigMult(s.ctrl, snapshot), snapshot });
  }
}
async function destroy(c) {
  if (!c || c.zone !== 'bf') return false;
  if (has(c, 'indestructible')) { log(`${c.name} is indestructible.`); return false; }
  await killBatch([c], 'destroy');
  return true;
}
async function destroyMany(list) {
  const v = list.filter(c => c.zone === 'bf' && !has(c, 'indestructible'));
  const saved = list.filter(c => c.zone === 'bf' && has(c, 'indestructible'));
  if (saved.length) log(`Indestructible: ${saved.map(c => c.name).join(', ')} survive.`);
  return await killBatch(v, 'destroy');
}
async function sacrifice(c) { if (c && c.zone === 'bf') await killBatch([c], 'sac'); }
async function exileC(c) {
  if (!c || !c.zone) return;
  const fromBF = c.zone === 'bf';
  const lki = fromBF ? snap(c) : null;
  moveTo(c, 'exile');
  log(`${lki ? lki.name : c.name} is exiled.`);
}
async function bounce(c) {
  if (!c || c.zone !== 'bf') return;
  const n = c.name;
  moveTo(c, 'hand', { noCmd: true });
  log(`${n} returns to its owner's hand.`);
}

/* ---------------- drawing, discard, library ---------------- */
async function drawCards(pi, n = 1) {
  for (let i = 0; i < n; i++) {
    const pl = P(pi);
    if (!pl.library.length) { pl.drewEmpty = true; log(`${pl.name} tries to draw from an empty library.`); return; }
    const c = pl.library.pop();
    c.zone = 'hand'; c.zcc++;
    pl.hand.push(c);
    G.tf.drawn[pi]++;
    await emit('draw', { pi, card: c, nth: G.tf.drawn[pi] });
  }
  if (n > 0) log(`${P(pi).name} draws ${n} card${n > 1 ? 's' : ''}.`);
}
async function discardCard(pi, c) {
  if (c.zone !== 'hand') return;
  log(`${P(pi).name} discards ${c.name}.`);
  if (c.d.madness != null) {
    moveTo(c, 'exile');
    const can = canPay(pi, costOf(pi, c, { from: 'madness' }), {});
    if (can && await chooseYes(pi, { prompt: `Madness: cast ${c.name} for ${c.d.madnessMC}?`, card: c, ai: () => true })) {
      const ok = await castSpell(pi, c, 'madness');
      if (ok) return;
    }
    moveTo(c, 'gy');
    return;
  }
  moveTo(c, 'gy');
}
async function discardN(pi, n, { prompt } = {}) {
  const pl = P(pi);
  n = Math.min(n, pl.hand.length);
  if (n <= 0) return [];
  const picks = await chooseCards(pi, { prompt: prompt || `Discard ${n} card${n > 1 ? 's' : ''}`, cands: pl.hand.slice(), min: n, max: n, ai: cs => AIH.discardOrder(pi, cs).slice(0, n) });
  for (const c of picks) await discardCard(pi, c);
  return picks;
}
async function searchLibrary(pi, filter, { prompt, max = 1, ai } = {}) {
  const pl = P(pi);
  const cands = pl.library.filter(filter);
  let picks = [];
  if (cands.length) picks = await chooseCards(pi, { prompt: prompt || 'Search your library', cands, min: 0, max, ai: ai || (cs => cs.slice(0, max)) });
  shuffle(pl.library);
  return picks;
}
async function scry(pi, n) {
  const pl = P(pi);
  const top = pl.library.slice(-n).reverse();
  for (const c of top) {
    const bottom = await chooseYes(pi, { prompt: `Scry: put ${c.name} on the bottom?`, card: c, ai: () => AIH.scryBottom(pi, c) });
    if (bottom) { pl.library.splice(pl.library.indexOf(c), 1); pl.library.unshift(c); }
  }
  log(`${pl.name} scries ${n}.`);
}
async function fetchBasicsToBF(pi, n, { tapped = true, filter } = {}) {
  const f = filter || (c => isBasic(c) && isLand(c));
  const picks = await searchLibrary(pi, f, { prompt: `Search for up to ${n} land${n > 1 ? 's' : ''}`, max: n, ai: cs => AIH.pickLands(pi, cs, n) });
  for (const c of picks) await enterBF(c, pi, { tapped });
  return picks;
}

/* ---------------- mana ----------------
   A cost is { generic, pips: ['W','B','W/B','C',...] }. It also behaves like a
   number (its total) so older arithmetic keeps working, and prints as {2}{W}{B}.
   Every mana source is expanded into units; each unit lists the colors it can
   make ('' = generic only). Payment is an exact search, so pips never fail when
   a valid tapping exists. */
const COLORS = 'WUBRG';
const BASIC_COLOR = { Plains: 'W', Island: 'U', Swamp: 'B', Mountain: 'R', Forest: 'G' };
function mkCost(generic, pips) {
  return {
    isCost: true, generic: Math.max(0, generic), pips,
    valueOf() { return this.generic + this.pips.length; },
    toString() { return costStr(this); },
  };
}
function costStr(c) {
  const g = c.generic || (!c.pips.length ? 0 : null);
  return (g != null ? `{${g}}` : '') + c.pips.map(p => `{${p}}`).join('');
}
function toCost(x) {
  if (x == null) return mkCost(0, []);
  if (x.isCost) return mkCost(x.generic, x.pips.slice());
  if (typeof x === 'number') return mkCost(x, []);
  const m = String(x).match(/\{[^}]+\}/g) || [];
  let g = 0; const pips = [];
  for (const sym of m) {
    const v = sym.slice(1, -1);
    if (/^\d+$/.test(v)) g += +v;
    else if (v === 'X') continue;
    else pips.push(v);
  }
  return mkCost(g, pips);
}
function addCost(a, b) { a = toCost(a); b = toCost(b); return mkCost(a.generic + b.generic, a.pips.concat(b.pips)); }
function identityOf(pi) {
  const cmd = [...P(pi).cz, ...P(pi).bf, ...P(pi).gy, ...P(pi).exile, ...P(pi).hand].find(c => c.isCmd && c.owner === pi);
  return cmd ? colorsOf(cmd).replace(/[^WUBRG]/g, '') || 'C' : 'C';
}
function unitsOf(c) {
  const d = c.d;
  if (d.prod === 'ident') return [identityOf(c.ctrl)];
  if (d.prod) return d.prod.slice();
  const n = typeof d.mana === 'function' ? d.mana(c) : d.mana || 0;
  const col = BASIC_COLOR[c.name] || 'C';
  return Array(n).fill(col);
}
function manaSources(pi, opts = {}) {
  const out = [];
  const forsaken = perms(pi).some(c => c.name === 'Forsaken Monument');
  const urza = perms(pi).some(c => c.name === 'Urza, Lord High Artificer');
  const used = new Set();
  for (const c of perms(pi)) {
    if (c.tapped || c === opts.exclude || c.d.treasure) continue;
    if (c.d.mana && !(isCreature(c) && c.sick && !has(c, 'haste'))) {
      const units = unitsOf(c);
      if (forsaken && c.d.colorlessMana) units.push(...units.filter(u => u === 'C'));
      out.push({ c, units, kind: isLand(c) ? 'land' : 'rock' });
      used.add(c);
    }
  }
  if (urza || opts.improvise) {
    const arts = perms(pi).filter(c => isArtifact(c) && !c.tapped && !used.has(c) && c !== opts.exclude && !c.d.treasure);
    arts.sort((a, b) => (isCreature(a) ? 1 : 0) - (isCreature(b) ? 1 : 0));
    for (const c of arts) { out.push({ c, units: [urza ? 'U' : ''], kind: 'improvise' }); used.add(c); }
  }
  if (opts.convoke) {
    for (const c of perms(pi)) if (isCreature(c) && !c.tapped && !used.has(c) && c !== opts.exclude) { out.push({ c, units: [colorsOf(c).replace(/[^WUBRG]/g, '')], kind: 'convoke' }); used.add(c); }
  }
  for (const c of perms(pi)) if (c.d.treasure && c !== opts.exclude) out.push({ c, units: ['WUBRGC'], kind: 'treasure' });
  return out;
}
function manaAvail(pi, opts = {}) { return manaSources(pi, opts).reduce((a, s) => a + s.units.length, 0); }
function manaColors(pi) {
  const r = {};
  for (const s of manaSources(pi)) for (const u of s.units) for (const ch of u) r[ch] = (r[ch] || 0) + 1;
  return r;
}
const KIND_ORDER = { land: 0, rock: 1, improvise: 2, convoke: 3, treasure: 4 };
function unitPays(opts, pip) {
  if (pip.includes('/')) return pip.split('/').some(x => opts.includes(x));
  return opts.includes(pip);
}
function planPayment(pi, cost, opts = {}) {
  cost = toCost(cost);
  if (cost.generic <= 0 && !cost.pips.length) return { srcs: [] };
  const srcs = manaSources(pi, opts);
  const units = [];
  srcs.forEach((s, si) => s.units.forEach(u => units.push({ si, opts: u, kind: s.kind })));
  if (units.length < cost.generic + cost.pips.length) return null;
  const pips = cost.pips.slice().sort((a, b) => units.filter(u => unitPays(u.opts, a)).length - units.filter(u => unitPays(u.opts, b)).length);
  const usedU = new Set();
  const tapped = new Set();
  let best = null;
  let steps = 0;
  const finishGeneric = () => {
    let need = cost.generic;
    const free = units.map((u, i) => i).filter(i => !usedU.has(i));
    // units from already-tapped sources are free, then cheapest kinds, least flexible first
    free.sort((a, b) => (tapped.has(units[a].si) ? 0 : 1) - (tapped.has(units[b].si) ? 0 : 1) || KIND_ORDER[units[a].kind] - KIND_ORDER[units[b].kind] || units[a].opts.length - units[b].opts.length);
    const extra = new Set(tapped);
    for (const i of free) { if (need <= 0) break; extra.add(units[i].si); need--; }
    if (need > 0) return null;
    return extra;
  };
  const dfs = (k) => {
    if (best || steps++ > 4000) return;
    if (k === pips.length) { const r = finishGeneric(); if (r) best = r; return; }
    const pip = pips[k];
    const cands = units.map((u, i) => i).filter(i => !usedU.has(i) && unitPays(units[i].opts, pip));
    cands.sort((a, b) => (tapped.has(units[a].si) ? 0 : 1) - (tapped.has(units[b].si) ? 0 : 1) || KIND_ORDER[units[a].kind] - KIND_ORDER[units[b].kind] || units[a].opts.length - units[b].opts.length);
    for (const i of cands) {
      const had = tapped.has(units[i].si);
      usedU.add(i); tapped.add(units[i].si);
      dfs(k + 1);
      usedU.delete(i); if (!had) tapped.delete(units[i].si);
      if (best) return;
    }
  };
  dfs(0);
  if (!best) return null;
  return { srcs: [...best].map(i => srcs[i]) };
}
function canPay(pi, cost, opts = {}) {
  cost = toCost(cost);
  if (cost.generic <= 0 && !cost.pips.length) return true;
  return !!planPayment(pi, cost, opts);
}
async function pay(pi, cost, opts = {}) {
  const plan = planPayment(pi, cost, opts);
  if (!plan) return false;
  for (const s of plan.srcs) {
    if (s.kind === 'treasure') moveTo(s.c, 'gy');
    else s.c.tapped = true;
  }
  return true;
}
async function sacrificeQuiet(c) { moveTo(c, 'gy'); }
function payOpts(c, ctx = {}) {
  const pi = ctx.p;
  const o = {};
  if (c.d.improvise) o.improvise = true;
  if (c.d.convoke) o.convoke = true;
  if (pi != null && isArtifact(c) && perms(pi).some(x => x.name === 'Chief Engineer')) o.convoke = true;
  return o;
}

/* ---------------- costs ---------------- */
function costOf(pi, c, ctx = {}) {
  const d = c.d;
  if (ctx.free) return mkCost(0, []);
  let base;
  if (ctx.alt) base = toCost(ctx.alt.mc);
  else if (ctx.from === 'exile' && d.foretellMC) base = toCost(d.foretellMC);
  else if (ctx.from === 'madness') base = toCost(d.madnessMC);
  else base = toCost(d.mc || '');
  let g = base.generic;
  const pips = base.pips.slice();
  if (ctx.from === 'cz') g += 2 * (P(pi).cmdCasts || 0);
  if (ctx.extra) { const e = toCost(ctx.extra); g += e.generic; pips.push(...e.pips); }
  if (d.xCount) g += (ctx.x || 0) * d.xCount;
  let red = 0;
  if (d.costMod && !ctx.alt) red -= d.costMod(c, pi, ctx);
  for (const s of perms(pi)) if (s.d.costReduce) red += s.d.costReduce(s, c);
  return mkCost(Math.max(0, g - red), pips);
}

/* ---------------- events ---------------- */
async function emit(evt, payload) {
  const list = allPerms();
  for (const s of list) {
    const h = s.d.on && s.d.on[evt];
    if (h && s.zone === 'bf' && !s.phased) {
      await h(s, payload);
      if (G.over) return;
    }
  }
}

/* ---------------- stack ---------------- */
function stackLabel(it) {
  const tg = it.ctx.targets && it.ctx.targets.length ? ' → ' + it.ctx.targets.map(t => t.isPlayer ? t.name : t.name).join(', ') : '';
  return it.label + tg;
}
async function announceTargets(ctx) {
  for (const t of ctx.targets) {
    if (t.isPlayer || t.zone !== 'bf') continue;
    await emit('targeted', { byPi: ctx.p, target: t, ctx });
  }
  // ward
  for (const t of ctx.targets) {
    if (t.isPlayer || t.zone !== 'bf' || t.ctrl === ctx.p) continue;
    const w = st(t).ward;
    if (w > 0) {
      const can = canPay(ctx.p, w, {});
      const yes = can && await chooseYes(ctx.p, { prompt: `${t.name} has ward ${w}. Pay ${w} or it is countered?`, card: t, ai: () => true });
      if (yes) { await pay(ctx.p, w, {}); log(`${P(ctx.p).name} pays ward ${w}.`); }
      else { ctx.countered = true; log(`Ward counters ${ctx.card ? ctx.card.name : 'it'}.`); }
    }
  }
}
async function pushAbility(src, pi, label, ctx, resolve) {
  ctx.p = pi; ctx.card = ctx.card || src; ctx.targets = ctx.targets || []; ctx.isAbility = true;
  const it = { kind: 'ability', src, p: pi, ctx, label: `${src.name}: ${label}`, resolve, id: UID++ };
  G.stack.push(it);
  await announceTargets(ctx);
  log(`${P(pi).name}: ${stackLabel(it)}`, pi === BOT ? 'bot' : 'me');
  return it;
}
/* a triggered ability with optional targets. choose returns false to skip. */
async function trigger(src, pi, label, choose, resolve) {
  const ctx = { p: pi, card: src, targets: [] };
  if (choose) { const ok = await choose(ctx); if (!ok) return null; }
  return await pushAbility(src, pi, label, ctx, resolve);
}
async function counterItem(it, by) {
  const i = G.stack.indexOf(it);
  if (i < 0) return;
  G.stack.splice(i, 1);
  log(`${it.kind === 'spell' ? it.card.name : it.label} is countered${by ? ' by ' + by : ''}.`, 'warn');
  if (it.kind === 'spell') moveTo(it.card, 'gy');
}
async function resolveItem(it) {
  const ctx = it.ctx;
  if (ctx.countered) {
    if (it.kind === 'spell') moveTo(it.card, 'gy');
    return;
  }
  if (ctx.targets.length && !ctx.noFizzle) {
    const anyOK = ctx.targets.some(t => tOK(ctx, t));
    if (!anyOK) {
      log(`${it.kind === 'spell' ? it.card.name : it.label} fizzles (no legal targets).`, 'warn');
      if (it.kind === 'spell') moveTo(it.card, 'gy');
      return;
    }
  }
  if (it.kind === 'spell') {
    const c = it.card, d = c.d;
    if (d.spell) {
      log(`${c.name} resolves.`);
      await d.spell(ctx);
      if (c.zone === 'stack') {
        if (ctx.exileAfter) { c.zone = null; moveTo(c, 'exile'); }
        else { c.zone = null; moveTo(c, 'gy'); }
      }
    } else {
      if (isAura(c)) {
        const t = ctx.targets[0];
        if (!tOK(ctx, t)) { c.zone = null; moveTo(c, 'gy'); return; }
        await enterBF(c, it.p, { cast: true, ctx, attachTo: t });
      } else {
        await enterBF(c, it.p, { cast: true, ctx, x: ctx.x });
      }
    }
  } else {
    await it.resolve(ctx);
  }
}
let stackDepthGuard = 0;
async function runStack() {
  if (stackDepthGuard > 0) return; // already running higher up
  stackDepthGuard++;
  try {
    let guard = 0;
    let lastResolved = null;
    while (G.stack.length && !G.over && guard++ < 300) {
      const top = G.stack[G.stack.length - 1];
      // the bot just resolved something in response to the human: give the human priority again
      if (lastResolved && lastResolved.p !== top.p && !P(top.p).isBot && !G.humanAuto) {
        lastResolved = null;
        if (humanCanRespond()) {
          const act = await UI.waitAction({ mode: 'instant', reason: `Your ${stackLabel(top)} is still on the stack. Respond?`, passLabel: 'Let it resolve' });
          if (act && act.type !== 'pass') { await performAction(top.p, act); continue; }
        }
      }
      const responder = opp(top.p);
      const before = G.stack.length;
      const acted = await offerResponse(responder, top);
      if (G.over) break;
      if (acted && G.stack.length > before) continue;
      if (G.stack.indexOf(top) < 0) continue; // countered or removed
      // let the controller add something on top (bot only, e.g. protection) - skip for simplicity
      G.stack.splice(G.stack.indexOf(top), 1);
      if (typeof UI !== 'undefined') UI.render();
      await resolveItem(top);
      lastResolved = top;
      await sba();
      if (typeof UI !== 'undefined') UI.render();
      if (P(top.p).isBot && SETTINGS.botDelay) await sleep(SETTINGS.botDelay / 2);
    }
  } finally { stackDepthGuard--; }
}
async function offerResponse(pi, top) {
  if (P(pi).isBot) return await AI.respond(pi, top);
  if (G.humanAuto) return false;
  if (!wantsStop(top)) return false;
  if (!humanCanRespond()) return false;
  const act = await UI.waitAction({ mode: 'instant', reason: `${P(top.p).name}: ${stackLabel(top)}. Respond?`, passLabel: 'Let it resolve' });
  if (!act || act.type === 'pass') return false;
  await performAction(HUMAN, act);
  return true;
}
function wantsStop(top) {
  if (SETTINGS.stopEverySpell) return true;
  if (top.p === HUMAN) return false;
  const c = top.kind === 'spell' ? top.card : top.src;
  const role = top.kind === 'spell' ? (c.d.role || '') : '';
  if (['removal', 'wipe'].includes(role)) return true;
  if (top.ctx.targets.some(t => (t.isPlayer ? t.pi === HUMAN : t.ctrl === HUMAN))) return true;
  if (top.ctx.threat) return true;
  return false;
}

/* ---------------- state-based actions ---------------- */
async function sba() {
  for (let loop = 0; loop < 30 && !G.over; loop++) {
    let changed = false;
    for (const pl of G.players) {
      if (pl.lost) continue;
      let why = null;
      if (pl.life <= 0) why = 'life total reached 0';
      else if (pl.drewEmpty) why = 'drew from an empty library';
      else if (Object.values(pl.cmdDmg).some(v => v >= 21)) why = 'took 21 commander damage';
      if (why) { pl.lost = true; log(`${pl.name} loses: ${why}.`, 'big'); }
    }
    const losers = G.players.filter(p => p.lost);
    if (losers.length) { G.over = true; G.winner = losers.length === 2 ? null : G.players.find(p => !p.lost).idx; return; }
    const dying = [];
    for (const c of allPerms()) {
      if (!isCreature(c)) continue;
      const s = st(c);
      if (s.t <= 0) dying.push(c);
      else if ((c.dmg >= s.t || (c.dt && c.dmg > 0)) && !s.kw.has('indestructible')) dying.push(c);
    }
    if (dying.length) { await killBatch(dying, 'sba'); changed = true; }
    for (const c of allPerms()) {
      if (isAura(c)) {
        const t = attachedTo(c);
        const okT = t && (c.d.enchant === 'artifact' ? isArtifact(t) : isCreature(t));
        if (!okT) { moveTo(c, 'gy'); log(`${c.name} goes to the graveyard (nothing to enchant).`); changed = true; }
      } else if (isEquipment(c) && c.attachedTo != null) {
        const t = attachedTo(c);
        if (!t || !isCreature(t) || isCreature(c)) { c.attachedTo = null; changed = true; }
      }
    }
    for (const pi of [0, 1]) {
      const legends = perms(pi).filter(c => isLegendary(c) && !c.token);
      const seen = {};
      const extra = [];
      for (const c of legends.sort((a, b) => b.zcc - a.zcc || b.id - a.id)) {
        if (seen[c.name]) extra.push(c); else seen[c.name] = true;
      }
      if (extra.length) { log('Legend rule.'); await killBatch(extra, 'sba'); changed = true; }
    }
    if (!changed) break;
  }
}

/* ---------------- casting ---------------- */
function isMainPhase() { return G.phase === 'main1' || G.phase === 'main2'; }
function sorceryOK(pi) { return G.active === pi && isMainPhase() && G.stack.length === 0; }
function hasFlash(pi, c) {
  if (c.d.flash || isInstant(c)) return true;
  if ((isAura(c) || isEquipment(c)) && controls(pi, "Sigarda's Aid")) return true;
  if ((isArtifact(c) || !colorsOf(c)) && controls(pi, "Liberator, Urza's Battlethopter")) return true;
  return false;
}
function castRestricted(pi) {
  // Conqueror's Flail: opponents can't cast spells during your turn
  const o = opp(pi);
  if (G.active === o && perms(o).some(c => c.name === "Conqueror's Flail" && c.attachedTo != null)) return true;
  // Sandswirl Wanderglyph: each opponent who attacked you this turn can't cast spells
  if (G.tf.attacked[pi] && perms(o).some(c => c.name === 'Sandswirl Wanderglyph')) return true;
  return false;
}
function timingOK(pi, c, from) {
  if (from === 'madness') return true;
  if (castRestricted(pi)) return false;
  if (hasFlash(pi, c)) return true;
  return sorceryOK(pi);
}
async function castSpell(pi, c, from, opt = {}) {
  const d = c.d;
  const ctx = { p: pi, card: c, from, targets: [], x: 0, extra: 0, alt: opt.alt || null, free: !!opt.free, mode: null, hint: opt.hint || null };
  if (d.canCast && !d.canCast(ctx)) { if (!P(pi).isBot) UI.toast(`${c.name}: no legal way to cast right now.`); return false; }
  if (!P(pi).isBot && d.role === 'wipe' && !['Unstable Glyphbridge', "Cloud's Limit Break"].includes(c.name)) {
    const shay = creatures(pi).find(x => x.isCmd && !has(x, 'indestructible'));
    if (shay && !(await UI.confirm(`${c.name} will also destroy ${shay.name}, so bounties will not be collected. Cast it anyway?`, shay))) return false;
  }
  if (d.choose) {
    const ok = await d.choose(ctx);
    if (!ok) return false;
  }
  if (ctx.alt && ctx.alt.choose) { const ok = await ctx.alt.choose(ctx); if (!ok) return false; }
  const cost = costOf(pi, c, ctx);
  const po = payOpts(c, ctx);
  if (!canPay(pi, cost, po)) { if (!P(pi).isBot) UI.toast(`Not enough mana for ${c.name} (needs ${cost}).`); return false; }
  await pay(pi, cost, po);
  ctx.manaSpent = cost;
  if (from === 'cz') P(pi).cmdCasts = (P(pi).cmdCasts || 0) + 1;
  removeFromZone(c);
  c.zone = 'stack'; c.zcc++;
  const it = { kind: 'spell', card: c, p: pi, ctx, label: c.name + (ctx.modeLabel ? ` (${ctx.modeLabel})` : ''), id: UID++ };
  G.stack.push(it);
  log(`${P(pi).name} casts ${stackLabel(it)}${+cost ? ` (paid ${cost})` : ''}.`, pi === BOT ? 'bot' : 'me');
  G.tf.spellsCast[pi]++;
  await announceTargets(ctx);
  await emit('cast', { pi, card: c, ctx, it });
  if (typeof UI !== 'undefined') UI.render();
  return true;
}

/* ---------------- activated abilities ---------------- */
function equipCost(eq, target) {
  const pi = eq.ctrl;
  let n = eq.d.equip;
  if (eq.d.equipLegend != null && target && isLegendary(target)) n = Math.min(n, eq.d.equipLegend);
  if (perms(pi).some(c => c.name === 'Puresteel Paladin') && metalcraft(pi)) n = 0;
  const fc = perms(pi).find(c => c.name === 'Fighter Class' && (c.perm.level || 1) >= 2);
  if (fc) n = Math.max(0, n - 2);
  return n;
}
function equipAbility(eq) {
  return {
    id: 'equip', label: `Equip`, speed: 'sorcery', equip: true,
    costFn: (c, ctx) => equipCost(c, ctx && ctx.targets[0]),
    baseCost: (c) => equipCost(c, null),
    can: (c) => creatures(c.ctrl).some(t => t.id !== c.attachedTo),
    choose: (ctx) => pickTarget(ctx, `Equip ${ctx.card.name} to which creature?`, t => isCreature(t) && t.ctrl === ctx.p && t.id !== ctx.card.attachedTo, cs => AIH.equipTarget(ctx.card, cs)),
    resolve: async (ctx) => { const t = ctx.targets[0]; if (tOK(ctx, t) && ctx.card.zone === 'bf' && t.ctrl === ctx.card.ctrl) attach(ctx.card, t); },
  };
}
function crewAbility(n) {
  return {
    id: 'crew', label: `Crew ${n}`, speed: 'instant', noStack: true, cost: 0,
    can: (c) => !c.tmp.crewed && creatures(c.ctrl).filter(x => !x.tapped && x !== c).reduce((a, x) => a + Math.max(0, pow(x)), 0) >= n,
    choose: async (ctx) => {
      const cands = creatures(ctx.p).filter(x => !x.tapped && x !== ctx.card);
      const picks = await chooseCards(ctx.p, { prompt: `Tap creatures with total power ${n} or more to crew`, cands, min: 1, max: cands.length, ai: cs => AIH.crewPick(cs, n) });
      if (picks.reduce((a, x) => a + pow(x), 0) < n) return false;
      ctx.crew = picks; return true;
    },
    resolve: async (ctx) => { ctx.crew.forEach(x => x.tapped = true); ctx.card.tmp.crewed = true; log(`${ctx.card.name} is crewed.`); },
  };
}
function abilitiesOf(c) {
  const list = c.d.abilities.slice();
  if (c.d.equip != null) list.push(equipAbility(c));
  if (c.d.crew != null) list.push(crewAbility(c.d.crew));
  for (const a of allPerms()) if (a.attachedTo === c.id && a.d.grantAbilities) list.push(...a.d.grantAbilities(a, c));
  if (c.d.extraAbilities) list.push(...c.d.extraAbilities(c));
  return list;
}
function abCost(c, ab, ctx) {
  if (ab.costFn) return ab.costFn(c, ctx);
  if (typeof ab.cost === 'function') return ab.cost(c, ctx);
  return ab.cost || 0;
}
function abilityUsable(pi, c, ab) {
  if (c.ctrl !== pi && !ab.fromGY) return false;
  if (ab.speed === 'sorcery' && !sorceryOK(pi)) return false;
  if (ab.myTurn && G.active !== pi) return false;
  if (ab.tap && (c.tapped || (isCreature(c) && c.sick && !has(c, 'haste')))) return false;
  if (ab.tapAttached) { const t = attachedTo(c); if (!t || t.tapped || (t.sick && !has(t, 'haste'))) return false; }
  if (ab.oncePerTurn && c.tmp['used_' + ab.id]) return false;
  if (ab.can && !ab.can(c)) return false;
  const cost = ab.baseCost ? ab.baseCost(c) : abCost(c, ab, null);
  if (!canPay(pi, cost, { exclude: ab.tap ? c : null })) return false;
  return true;
}
async function activate(pi, c, ab) {
  const ctx = { p: pi, card: c, targets: [], isAbility: true, ab };
  if (ab.choose) { const ok = await ab.choose(ctx); if (!ok) return false; }
  const cost = abCost(c, ab, ctx);
  const exclude = ab.tap ? c : null;
  if (!canPay(pi, cost, { exclude })) { if (!P(pi).isBot) UI.toast('Not enough mana.'); return false; }
  if (ab.tap) c.tapped = true;
  if (ab.tapAttached) { const t = attachedTo(c); if (t) t.tapped = true; }
  await pay(pi, cost, { exclude });
  if (ab.oncePerTurn) c.tmp['used_' + ab.id] = true;
  if (ab.preCost) await ab.preCost(ctx);
  if (ab.sacSelf) { ctx.lki = snap(c); await sacrifice(c); }
  if (ab.noStack) { await ab.resolve(ctx); log(`${P(pi).name}: ${c.name}: ${ab.label}.`, pi === BOT ? 'bot' : 'me'); }
  else await pushAbility(c, pi, ab.label, ctx, ab.resolve);
  if (typeof UI !== 'undefined') UI.render();
  return true;
}

/* ---------------- legal actions (used by human UI and bot) ---------------- */
function legalActionsFor(pi, c, zone) {
  const acts = [];
  const pl = P(pi);
  if (zone === 'hand') {
    if (isLand(c)) {
      if (sorceryOK(pi) && pl.landsPlayed < 1) acts.push({ type: 'land', card: c, label: 'Play land' });
    } else {
      if (timingOK(pi, c, 'hand')) {
        const cost = costOf(pi, c, { p: pi, from: 'hand' });
        acts.push({ type: 'cast', card: c, from: 'hand', label: `Cast`, cost, ok: canPay(pi, cost, payOpts(c, { p: pi })) });
        for (const alt of (c.d.alts || [])) {
          if (alt.can && !alt.can(c, pi)) continue;
          const ac = costOf(pi, c, { p: pi, from: 'hand', alt });
          acts.push({ type: 'cast', card: c, from: 'hand', alt, label: alt.label, cost: ac, ok: canPay(pi, ac, payOpts(c, { p: pi })) });
        }
      }
      if (c.d.foretell != null && G.active === pi && !castRestricted(pi)) acts.push({ type: 'foretell', card: c, label: 'Foretell', cost: 2, ok: canPay(pi, 2, {}) });
    }
  } else if (zone === 'cz') {
    if (timingOK(pi, c, 'cz')) {
      const cost = costOf(pi, c, { p: pi, from: 'cz' });
      acts.push({ type: 'cast', card: c, from: 'cz', label: 'Cast commander', cost, ok: canPay(pi, cost, payOpts(c, { p: pi })) });
    }
  } else if (zone === 'exile') {
    if (c.foretold != null && c.foretold < G.turn && timingOK(pi, c, 'exile')) {
      const cost = costOf(pi, c, { p: pi, from: 'exile' });
      acts.push({ type: 'cast', card: c, from: 'exile', label: 'Cast (foretold)', cost, ok: canPay(pi, cost, {}) });
    }
    if (c.perm && c.perm.playable && c.perm.playable === G.turn) {
      // Furious Rise / Urza style
    }
  } else if (zone === 'bf') {
    for (const ab of abilitiesOf(c)) {
      if (ab.fromGY) continue;
      const usable = abilityUsable(pi, c, ab);
      const cost = ab.baseCost ? ab.baseCost(c) : abCost(c, ab, null);
      const timing = !(ab.speed === 'sorcery' && !sorceryOK(pi));
      if (c.ctrl === pi && timing) acts.push({ type: 'ability', card: c, ab, label: ab.label, cost, ok: usable });
    }
  } else if (zone === 'gy') {
    for (const ab of c.d.abilities.filter(a => a.fromGY)) {
      if (c.owner !== pi) continue;
      const ok = (!ab.speed || ab.speed !== 'sorcery' || sorceryOK(pi)) && (!ab.can || ab.can(c)) && canPay(pi, ab.cost || 0, {});
      acts.push({ type: 'ability', card: c, ab, label: ab.label, cost: ab.cost || 0, ok });
    }
  }
  return acts;
}
function allLegalActions(pi, instantOnly) {
  const pl = P(pi);
  const out = [];
  const zones = [['hand', pl.hand], ['cz', pl.cz], ['exile', pl.exile], ['bf', pl.bf.filter(c => !c.phased)], ['gy', pl.gy]];
  for (const [z, arr] of zones) for (const c of arr) {
    for (const a of legalActionsFor(pi, c, z)) {
      if (!a.ok && a.type !== 'land') continue;
      if (instantOnly && a.type === 'land') continue;
      out.push(a);
    }
  }
  return out;
}
function humanCanRespond() {
  return allLegalActions(HUMAN, true).some(a => a.ok !== false && !(a.ab && a.ab.hideFromAutoStop));
}
async function performAction(pi, act) {
  if (act.type === 'land') {
    const c = act.card;
    if (P(pi).landsPlayed >= 1) return false;
    P(pi).landsPlayed++;
    await enterBF(c, pi, {});
    return true;
  }
  if (act.type === 'cast') return await castSpell(pi, act.card, act.from, { alt: act.alt });
  if (act.type === 'foretell') {
    if (!canPay(pi, 2, {})) return false;
    await pay(pi, 2, {});
    moveTo(act.card, 'exile');
    act.card.foretold = G.turn; act.card.faceDown = true;
    log(`${P(pi).name} foretells a card.`);
    return true;
  }
  if (act.type === 'ability') return await activate(pi, act.card, act.ab);
  return false;
}

/* ---------------- game setup ---------------- */
function mkPlayer(idx, name, isBot) {
  return {
    idx, name, isBot, life: 40, library: [], hand: [], gy: [], exile: [], cz: [], bf: [],
    cmdCasts: 0, cmdDmg: {}, landsPlayed: 0, energy: 0, lost: false, drewEmpty: false,
    protAll: false, lifeLocked: false, preventDmg: false, mulls: 0,
  };
}
function freshTurnFlags() {
  return {
    lifeGained: [0, 0], drawn: [0, 0], spellsCast: [0, 0], attacked: [false, false],
    died: false, moonglove: new Set(), cantAttack: [false, false], aiTried: new Set(),
    hitBy: {},
  };
}
function buildDeck(pi, list, commander) {
  const pl = P(pi);
  const cmd = mkCard(commander, pi);
  cmd.isCmd = true; cmd.zone = 'cz';
  pl.cz.push(cmd);
  for (const [name, n] of list) for (let i = 0; i < n; i++) {
    const c = mkCard(name, pi);
    c.zone = 'library';
    pl.library.push(c);
  }
  shuffle(pl.library);
}
function newGame(botKey, opts = {}) {
  UID = 1;
  G = {
    turn: 0, active: 0, phase: 'setup', players: [mkPlayer(0, opts.humanName || 'You', !!opts.humanIsBot), mkPlayer(1, DECKS[botKey].botName, true)],
    stack: [], log: [], over: false, winner: null, strip: {}, sephiroth: {}, tf: null,
    monarch: null, combat: null, untilNext: [], botKey, delayed: [], dungeon: [0, 0],
  };
  G.tf = freshTurnFlags();
  buildDeck(HUMAN, DECKS.shay.list, DECKS.shay.commander);
  buildDeck(BOT, DECKS[botKey].list, DECKS[botKey].commander);
  G.players[HUMAN].deckKey = 'shay';
  G.players[BOT].deckKey = botKey;
  return G;
}
async function mulligans() {
  for (const pi of [0, 1]) {
    const pl = P(pi);
    let taken = 0;
    while (true) {
      // put hand back, shuffle, draw 7
      while (pl.hand.length) { const c = pl.hand.pop(); c.zone = 'library'; pl.library.push(c); }
      shuffle(pl.library);
      for (let i = 0; i < 7; i++) { const c = pl.library.pop(); c.zone = 'hand'; pl.hand.push(c); }
      let keep;
      if (pl.isBot) keep = AI.keepHand(pi, taken);
      else keep = await UI.mulligan(pl.hand, taken);
      if (keep) break;
      taken++;
      log(`${pl.name} mulligans.`);
      if (taken >= 6) break;
    }
    const bottomN = Math.max(0, taken - 1); // first mulligan free
    if (bottomN > 0) {
      const picks = await chooseCards(pi, { prompt: `Put ${bottomN} card${bottomN > 1 ? 's' : ''} on the bottom`, cands: pl.hand.slice(), min: bottomN, max: bottomN, ai: cs => AIH.discardOrder(pi, cs).slice(0, bottomN) });
      for (const c of picks) { pl.hand.splice(pl.hand.indexOf(c), 1); c.zone = 'library'; pl.library.unshift(c); }
    }
    log(`${pl.name} keeps ${pl.hand.length} cards.`);
  }
}

/* ---------------- turn structure ---------------- */
async function gameLoop() {
  G.active = Math.random() < 0.5 ? HUMAN : BOT;
  log(`${P(G.active).name} ${G.active === HUMAN ? 'go' : 'goes'} first.`, 'big');
  await mulligans();
  while (!G.over) {
    await takeTurn(G.active);
    if (G.over) break;
    G.active = opp(G.active);
    if (G.turn > 400) { G.over = true; G.winner = null; log('Turn limit reached. Draw.'); }
  }
  if (typeof UI !== 'undefined' && UI.gameOver) UI.gameOver();
}
async function phase(name) {
  G.phase = name;
  if (typeof UI !== 'undefined') UI.render();
}
async function takeTurn(ap) {
  G.turn++;
  G.tf = freshTurnFlags();
  const pl = P(ap);
  pl.landsPlayed = 0;
  log(`— Turn ${G.turn}: ${pl.name} —`, 'turn');
  await phase('untap');
  pl.protAll = false; pl.lifeLocked = false;
  // phase in
  for (const c of pl.bf) if (c.phased) { c.phased = false; }
  // until-your-next-turn effects end
  G.untilNext = G.untilNext.filter(e => { if (e.pi === ap) { e.end(); return false; } return true; });
  for (const c of pl.bf) {
    c.sick = false;
    if (c.d.noUntap && c.d.noUntap(c)) continue;
    if (attachments(c).some(a => a.name === 'Fall from Favor') && G.monarch !== c.ctrl) continue;
    c.tapped = false;
  }
  await phase('upkeep');
  const due = G.delayed.filter(d => d.at === 'upkeep');
  G.delayed = G.delayed.filter(d => d.at !== 'upkeep');
  for (const d of due) await d.fn();
  await emit('upkeep', { pi: ap });
  await runStack(); await sba(); if (G.over) return;
  await phase('draw');
  if (G.turn > 1) await drawCards(ap, 1);
  await sba(); if (G.over) return;
  await emit('afterDraw', { pi: ap });
  await runStack(); await sba(); if (G.over) return;
  await phase('main1');
  await mainPhase(ap);
  if (G.over) return;
  G.combatNo = 0;
  do {
    G.extraCombat = false;
    await combatPhase(ap);
    G.combatNo++;
    if (G.over) return;
  } while (G.extraCombat && G.combatNo < 4);
  await phase('main2');
  await mainPhase(ap);
  if (G.over) return;
  await phase('end');
  await emit('endStep', { pi: ap });
  if (G.monarch === ap) { log(`${pl.name} draws for being the monarch.`); await drawCards(ap, 1); }
  await runStack(); await sba(); if (G.over) return;
  if (ap === BOT) await humanWindow('Bot end step: last chance this turn.', 'end');
  else await AI.opponentEndStep(BOT);
  await runStack(); await sba(); if (G.over) return;
  await phase('cleanup');
  await cleanup(ap);
}
async function mainPhase(ap) {
  if (P(ap).isBot) await AI.main(ap);
  else await humanMain();
}
async function humanMain() {
  for (let g = 0; g < 200 && !G.over; g++) {
    const nextLabel = G.phase === 'main1' ? 'To combat' : 'End turn';
    const act = await UI.waitAction({ mode: 'main', reason: G.phase === 'main1' ? 'Main phase 1' : 'Main phase 2', passLabel: nextLabel });
    if (!act || act.type === 'pass') break;
    await performAction(HUMAN, act);
    await runStack(); await sba();
  }
}
async function humanWindow(reason, kind) {
  if (G.over || P(HUMAN).isBot || G.humanAuto) return;
  for (let g = 0; g < 30; g++) {
    if (!humanCanRespond()) return;
    const act = await UI.waitAction({ mode: 'instant', reason, passLabel: 'Continue' });
    if (!act || act.type === 'pass') return;
    await performAction(HUMAN, act);
    await runStack(); await sba();
    if (G.over) return;
  }
}
async function cleanup(ap) {
  const pl = P(ap);
  const max = perms(ap).some(c => c.name === 'Thought Vessel') ? 99 : 7;
  if (pl.hand.length > max) await discardN(ap, pl.hand.length - max, { prompt: `Discard down to ${max}` });
  for (const p of G.players) for (const c of p.bf) { c.dmg = 0; c.dt = false; c.tmp = {}; c.damagedBy = []; }
  G.strip = {}; G.sephiroth = {};
  for (const p of G.players) p.preventDmg = false;
  G.delayed = G.delayed.filter(d => d.until !== 'eot');
}

/* ---------------- combat ---------------- */
function attackTax(ap) {
  const dp = opp(ap);
  return perms(dp).filter(c => c.name === 'Ghostly Prison' || c.name === 'Propaganda').length * 2;
}
function canAttack(c) {
  if (!isCreature(c) || c.tapped) return false;
  if (c.sick && !has(c, 'haste')) return false;
  if (c.tmp.cantAttack || attachments(c).some(a => a.name === 'Compulsory Rest')) return false;
  if (has(c, 'defender')) return false;
  return true;
}
function canBlock(b, a) {
  if (!isCreature(b) || b.tapped || b.phased) return false;
  if (b.tmp.cantBlock || attachments(b).some(x => x.name === 'Compulsory Rest')) return false;
  const sa = st(a), sb = st(b);
  if (sa.kw.has('unblockable') || a.tmp.unblockable) return false;
  if (sa.kw.has('onlyWalls')) return false;
  if (sa.kw.has('flying') && !sb.kw.has('flying') && !sb.kw.has('reach')) return false;
  if (sa.kw.has('skulk') && sb.p > sa.p) return false;
  if (sa.kw.has('intimidate')) {
    const shares = [...colorsOf(b)].some(x => colorsOf(a).includes(x));
    if (!isArtifact(b) && !shares) return false;
  }
  if (sa.kw.has('nonbasicLandwalk') && perms(b.ctrl).some(l => isLand(l) && !isBasic(l))) return false;
  for (const col of colorsOf(b)) if (sa.prot.has(col)) return false;
  if (sa.prot.has('all')) return false;
  return true;
}
async function combatPhase(ap) {
  const dp = opp(ap);
  await phase('combat');
  await emit('beginCombat', { pi: ap });
  await runStack(); await sba(); if (G.over) return;
  if (ap === BOT) await humanWindow('Bot beginning of combat. Tap or kill attackers now.', 'boc');
  if (G.over) return;
  await phase('attackers');
  let attackers = [];
  if (G.tf.cantAttack[ap]) { log(`${P(ap).name} can't attack this turn.`); }
  else if (P(ap).isBot) attackers = await AI.declareAttackers(ap);
  else attackers = await UI.declareAttackers();
  attackers = attackers.filter(c => c.zone === 'bf' && canAttack(c));
  // must-attack (juggernauts)
  for (const c of creatures(ap)) if (c.d.mustAttack && canAttack(c) && !attackers.includes(c)) attackers.push(c);
  const tax = attackTax(ap);
  if (tax && attackers.length) {
    const maxN = Math.floor(manaAvail(ap) / tax);
    if (attackers.length > maxN) { attackers = attackers.slice(0, maxN); }
    if (attackers.length) { await pay(ap, tax * attackers.length, {}); log(`${P(ap).name} pays ${tax * attackers.length} attack tax.`); }
  }
  if (!attackers.length) { G.combat = null; return; }
  for (const c of attackers) if (!has(c, 'vigilance')) c.tapped = true;
  G.combat = { ap, dp, atk: attackers.map(c => ({ c, blockers: [] })) };
  G.tf.attacked[ap] = true;
  log(`${P(ap).name} attacks with ${attackers.map(c => `${c.name} (${pow(c)}/${tou(c)})`).join(', ')}.`, ap === BOT ? 'bot big' : 'me big');
  for (const c of attackers) await emit('attacks', { attacker: c, pi: ap });
  await emit('attackDeclared', { pi: ap, attackers });
  await runStack(); await sba(); if (G.over) return;
  if (dp === HUMAN) await humanWindow('Bot is attacking. Respond before blocks?', 'atk');
  else await AI.defenderWindow(dp);
  await runStack(); await sba(); if (G.over) return;
  G.combat.atk = G.combat.atk.filter(a => a.c.zone === 'bf' && a.c.ctrl === ap);
  if (!G.combat.atk.length) { G.combat = null; return; }
  await phase('blockers');
  if (P(dp).isBot) await AI.declareBlockers(dp);
  else await UI.declareBlockers();
  // validate menace
  for (const a of G.combat.atk) {
    a.blockers = a.blockers.filter(b => b.zone === 'bf');
    if (has(a.c, 'menace') && a.blockers.length === 1) a.blockers = [];
    a.blocked = a.blockers.length > 0;
  }
  const blockLines = G.combat.atk.filter(a => a.blocked).map(a => `${a.blockers.map(b => b.name).join(' + ')} blocks ${a.c.name}`);
  log(blockLines.length ? blockLines.join('; ') + '.' : 'No blocks.');
  await emit('blocksDeclared', { pi: ap });
  await runStack(); await sba(); if (G.over) return;
  // after-blocks windows
  if (P(ap).isBot) { await AI.attackerTricks(ap); await runStack(); await sba(); if (G.over) return; await humanWindow('Blocks are set. Last chance before damage.', 'dmg'); }
  else { await humanWindow('Blocks are set. Combat tricks before damage?', 'dmg'); if (G.over) return; await AI.defenderTricks(dp); }
  await runStack(); await sba(); if (G.over) return;
  await phase('damage');
  const anyFS = G.combat.atk.some(a => hasFS(a.c)) || G.combat.atk.some(a => a.blockers.some(hasFS));
  if (anyFS) { await damageStep(true); await sba(); if (G.over) return; }
  await damageStep(false);
  await sba();
  G.combat = null;
}
function hasFS(c) { return has(c, 'firststrike') || has(c, 'doublestrike'); }
function dealsInStep(c, first) {
  if (first) return hasFS(c);
  return !has(c, 'firststrike') || has(c, 'doublestrike');
}
async function damageStep(first) {
  const cb = G.combat; if (!cb) return;
  const dp = cb.dp, ap = cb.ap;
  const hitPlayer = [];
  const events = [];
  for (const a of cb.atk) {
    const c = a.c;
    if (c.zone !== 'bf' || !dealsInStep(c, first)) continue;
    let dmg = pow(c);
    if (dmg <= 0) continue;
    const live = a.blockers.filter(b => b.zone === 'bf');
    if (!a.blocked) { events.push({ src: c, tgt: PL(dp), n: dmg }); continue; }
    if (!live.length) { if (has(c, 'trample')) events.push({ src: c, tgt: PL(dp), n: dmg }); continue; }
    const order = AIH.damageOrder(c, live);
    const dt = has(c, 'deathtouch');
    for (let i = 0; i < order.length && dmg > 0; i++) {
      const b = order[i];
      const need = dt ? 1 : Math.max(0, tou(b) - b.dmg);
      const last = i === order.length - 1;
      let assign = last && !has(c, 'trample') ? dmg : Math.min(dmg, Math.max(need, 0));
      if (assign > 0) events.push({ src: c, tgt: b, n: assign });
      dmg -= assign;
    }
    if (dmg > 0 && has(c, 'trample')) events.push({ src: c, tgt: PL(dp), n: dmg });
  }
  for (const a of cb.atk) {
    for (const b of a.blockers) {
      if (b.zone !== 'bf' || a.c.zone !== 'bf' || !dealsInStep(b, first)) continue;
      const n = pow(b);
      if (n > 0) events.push({ src: b, tgt: a.c, n });
    }
  }
  for (const e of events) {
    const dealt = dealDamage(e.src, e.tgt, e.n, { combat: true });
    if (dealt > 0 && e.tgt.isPlayer) { hitPlayer.push({ src: e.src, n: dealt }); G.tf.hitBy[e.src.id] = true; }
  }
  if (events.length) {
    const toP = hitPlayer.reduce((a, h) => a + h.n, 0);
    log(`Combat damage${first ? ' (first strike)' : ''}: ${toP ? `${P(dp).name} takes ${toP}` : 'no damage to players'}.`, toP ? 'dmg' : '');
  }
  for (const h of hitPlayer) await emit('combatDamagePlayer', { src: h.src, pi: dp, n: h.n });
  await emit('combatDamageDone', { pi: ap, hits: hitPlayer });
  await runStack();
}

/* ---------------- misc shared effects ---------------- */
async function venture(pi) {
  // Lost Mine of Phandelver, fixed path: Cave Entrance > Goblin Lair > Dark Pool > Temple of Dumathoin
  const room = (G.dungeon[pi] || 0) + 1;
  G.dungeon[pi] = room > 4 ? 1 : room;
  const r = G.dungeon[pi];
  if (r === 1) { log(`${P(pi).name} ventures: Cave Entrance (scry 1).`); await scry(pi, 1); }
  else if (r === 2) { log(`${P(pi).name} ventures: Goblin Lair.`); await createToken(pi, 'Goblin', 1); }
  else if (r === 3) { log(`${P(pi).name} ventures: Dark Pool (drain 1).`); loseLife(opp(pi), 1); gainLife(pi, 1); }
  else { log(`${P(pi).name} ventures: Temple of Dumathoin (draw), dungeon complete.`); await drawCards(pi, 1); }
}
function untilYourNextTurn(pi, end) { G.untilNext.push({ pi, end }); }
