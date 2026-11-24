'use strict';
/* =====================================================================
   Bot AI. Rules from the handoff:
   - Cast commander as soon as affordable, then cheapest spells first.
   - Hold protection/counter spells for the opponent's removal or wipes.
   - Removal: hit the biggest threat (power 3+ or the commander).
   - Wipe only when opp power >= 2x own + 8 and >= 10.
   - Don't attack into more deathtouch blockers than attackers unless evasive.
   - Pay Ghostly Prison / Propaganda tax only with spare mana.
   ===================================================================== */

const AIH = {
  value(c) {
    if (!c || c.isPlayer) return 0;
    let v = mv(c) + (c.isCmd ? 30 : 0);
    if (isCreature(c)) {
      const s = st(c);
      v += s.p * 2 + s.t;
      if (s.kw.has('flying')) v += 2;
      if (s.kw.has('deathtouch')) v += 3;
      if (s.kw.has('doublestrike')) v += s.p;
      v += attachments(c).length * 3;
    }
    if (c.token) v -= 2;
    if (isLand(c)) v -= 3;
    return v;
  },
  sortByValue(cs) { return cs.slice().sort((a, b) => AIH.value(b) - AIH.value(a)); },
  oppThreat(cs, ctx) {
    const o = cs.filter(c => c.ctrl !== ctx.p);
    if (!o.length) return null;
    return AIH.sortByValue(o)[0];
  },
  ownBest(cs, ctx) { const o = cs.filter(c => c.ctrl === ctx.p); return o.length ? AIH.sortByValue(o)[0] : null; },
  weakest(cs) { return cs.length ? AIH.sortByValue(cs)[cs.length - 1] : null; },
  biggest(cs) { return cs.length ? cs.slice().sort((a, b) => pow(b) - pow(a))[0] : null; },
  bestCard(cs) { return cs.length ? cs.slice().sort((a, b) => AIH.cardValue(b) - AIH.cardValue(a))[0] : null; },
  sortCards(cs) { return cs.slice().sort((a, b) => AIH.cardValue(b) - AIH.cardValue(a)); },
  cardValue(c) {
    if (!c) return 0;
    let v = mv(c);
    if (c.d.pt && isCreature(c)) v += c.d.pt[0] + c.d.pt[1] / 2;
    if (c.isCmd) v += 30;
    if (isLand(c)) v -= 2;
    if (['wipe', 'removal'].includes(c.d.role)) v += 2;
    return v;
  },
  equipTarget(eq, cs) {
    const own = cs.filter(c => c.ctrl === eq.ctrl);
    if (!own.length) return null;
    const cloud = own.find(c => c.name === 'Cloud, Ex-SOLDIER');
    if (cloud) return cloud;
    const cmd = own.find(c => c.isCmd);
    if (cmd) return cmd;
    return own.slice().sort((a, b) => (AIH.value(b) + (isLegendary(b) ? 3 : 0) - (b.token ? 4 : 0)) - (AIH.value(a) + (isLegendary(a) ? 3 : 0) - (a.token ? 4 : 0)))[0];
  },
  bestEquipFor(cr, cs) {
    const rank = (e) => ({ 'Colossus Hammer': 20, Embercleave: 12, 'Sword of Feast and Famine': 10, 'Sword of Fire and Ice': 10, 'Blackblade Reforged': 9, 'Behemoth Sledge': 8, Sunforger: 7, "Hero's Blade": 7, "Champion's Helm": 7, 'Darksteel Plate': 6 }[e.name] || 3) - (e.attachedTo ? 5 : 0);
    return cs.length ? cs.slice().sort((a, b) => rank(b) - rank(a))[0] : null;
  },
  crewPick(cs, n) {
    const sorted = cs.slice().sort((a, b) => (a.sick ? 0 : 1) - (b.sick ? 0 : 1) || pow(a) - pow(b));
    const out = []; let sum = 0;
    for (const c of sorted) { if (sum >= n) break; if (pow(c) <= 0) continue; out.push(c); sum += pow(c); }
    return out;
  },
  discardOrder(pi, cs) {
    const lands = perms(pi).filter(isLand).length + cs.filter(isLand).length;
    return cs.slice().sort((a, b) => AIH.discardScore(pi, b, lands) - AIH.discardScore(pi, a, lands));
  },
  discardScore(pi, c, lands) {
    if (isLand(c)) return lands > 6 ? 10 : -5;
    return mv(c) - (c.d.role === 'wipe' || c.d.role === 'removal' ? 3 : 0);
  },
  scryBottom(pi, c) {
    const lands = perms(pi).filter(isLand).length;
    if (isLand(c)) return lands >= 6;
    return lands < 3 && mv(c) > 4;
  },
  // which colors does this player's hand want but can't make yet
  colorNeed(pi) {
    const have = manaColors(pi);
    for (const l of perms(pi)) if (isLand(l) && l.tapped) for (const u of unitsOf(l)) for (const ch of u) have[ch] = (have[ch] || 0) + 1;
    const need = {};
    for (const c of P(pi).hand.concat(P(pi).cz)) {
      const cnt = {};
      for (const p of toCost(c.d.mc || '').pips) for (const ch of p.split('/')) if (COLORS.includes(ch)) cnt[ch] = (cnt[ch] || 0) + (p.includes('/') ? 0.5 : 1);
      for (const ch in cnt) need[ch] = (need[ch] || 0) + Math.max(0, cnt[ch] - (have[ch] || 0)) * (c.isCmd ? 3 : 1) + 0.2;
    }
    return need;
  },
  landScore(pi, l, need) {
    const cols = unitsOf(Object.assign(Object.create(l), { ctrl: pi })).join('');
    let v = 0;
    for (const ch of new Set(cols)) v += need[ch] || 0;
    if (l.d.entersTapped) v -= 0.3;
    return v;
  },
  bestLand(pi, lands) {
    if (!lands.length) return null;
    const need = AIH.colorNeed(pi);
    return lands.slice().sort((a, b) => AIH.landScore(pi, b, need) - AIH.landScore(pi, a, need))[0];
  },
  pickLands(pi, cs, n) {
    const need = AIH.colorNeed(pi);
    const order = cs.slice().sort((a, b) => AIH.landScore(pi, b, need) - AIH.landScore(pi, a, need));
    const out = [];
    for (const c of order) {
      if (out.length >= n) break;
      if (out.some(o => o.name === c.name) && order.some(o => !out.includes(o) && o.name !== c.name && !out.some(x => x.name === o.name))) continue;
      out.push(c);
      const col = BASIC_COLOR[c.name]; if (col && need[col]) need[col] -= 1;
    }
    for (const c of order) { if (out.length >= n) break; if (!out.includes(c)) out.push(c); }
    return out;
  },
  pickLandsOld(pi, cs, n) {
    const out = [];
    const counts = {};
    for (const l of perms(pi).filter(isLand)) counts[l.name] = (counts[l.name] || 0) + 1;
    const sorted = cs.slice().sort((a, b) => (counts[a.name] || 0) - (counts[b.name] || 0));
    const seen = new Set();
    for (const c of sorted) { if (out.length >= n) break; if (!seen.has(c.name)) { out.push(c); seen.add(c.name); } }
    for (const c of sorted) { if (out.length >= n) break; if (!out.includes(c)) out.push(c); }
    return out;
  },
  damageOrder(attacker, blockers) {
    return blockers.slice().sort((a, b) => (tou(a) - a.dmg) - (tou(b) - b.dmg) || AIH.value(b) - AIH.value(a));
  },
  austereModes(pi) {
    const score = (f) => allPerms().filter(c => f(c) && !has(c, 'indestructible')).reduce((a, c) => a + (c.ctrl === pi ? -AIH.value(c) : AIH.value(c)), 0);
    return AUSTERE_MODES.map(m => ({ v: m.value, s: score(m.f) })).sort((a, b) => b.s - a.s).slice(0, 2).map(x => x.v);
  },
  limitTier(ctx, canOmni) {
    const oppTapped = allCreatures().filter(c => c.tapped && c.ctrl !== ctx.p);
    const ownTapped = allCreatures().filter(c => c.tapped && c.ctrl === ctx.p);
    if (canOmni && oppTapped.length >= 2 && oppTapped.reduce((a, c) => a + AIH.value(c), 0) > ownTapped.reduce((a, c) => a + AIH.value(c), 0) * 2) return 'omni';
    return 'cross';
  },
  hexPick(pi, cs) {
    const o = AIH.sortByValue(cs.filter(c => c.ctrl !== pi));
    const m = AIH.sortByValue(cs.filter(c => c.ctrl === pi)).reverse();
    return [...o, ...m].slice(0, 6);
  },
  tutorPick(pi, cs) {
    const want = ['Teysa Karlov', 'Darksteel Plate', 'Swiftfoot Boots', 'Wrath of God', 'Day of Judgment', 'Whispersilk Cloak'];
    for (const n of want) { const c = cs.find(x => x.name === n); if (c) return c; }
    return AIH.bestCard(cs.filter(c => !isLand(c))) || cs[0];
  },
  burnTarget(cs, ctx, n) {
    const o = cs.filter(c => c.ctrl !== ctx.p);
    const kills = o.filter(c => tou(c) - c.dmg <= n && !has(c, 'indestructible'));
    if (kills.length) return AIH.sortByValue(kills)[0];
    return o.length ? AIH.sortByValue(o)[0] : null;
  },
  cellTarget(seph, cs) {
    const own = cs.filter(c => c.ctrl === seph.ctrl && c !== seph && !isModified(c) && pow(c) < 7);
    return own.length ? own.sort((a, b) => pow(a) - pow(b))[0] : null;
  },
  forcedBlockTarget(attacker, cs) {
    const ok = cs.filter(b => canBlock(b, attacker) && !has(b, 'deathtouch') && pow(b) < tou(attacker));
    return ok.length ? AIH.sortByValue(ok)[0] : null;
  },
  hellkiteX(pi, max) {
    let best = 0, bestV = 0;
    for (let x = 0; x <= max; x++) {
      const v = perms(opp(pi)).filter(c => !isLand(c) && mv(c) === x).reduce((a, c) => a + AIH.value(c), 0);
      if (v > bestV) { bestV = v; best = x; }
    }
    return best;
  },
  sunforgerPick(pi, cs) {
    const threat = AI.threats(pi).length;
    const order = threat ? ['Swords to Plowshares', 'Path to Exile', 'Chaos Warp', 'Wrecking Ball', 'Boros Charm'] : ['Boros Charm', 'Swords to Plowshares'];
    for (const n of order) { const c = cs.find(x => x.name === n); if (c) return c; }
    return null;
  },
  cheapArtifacts(cs) {
    const score = (a) => (a.d.treasure ? 0 : a.token ? 1 : isLand(a) ? 5 : 2 + mv(a)) + (isCreature(a) && !a.sick ? 1 : 0);
    return cs.slice().sort((a, b) => score(a) - score(b));
  },
  gauntletTarget(pi, cs) {
    const own = cs.filter(c => c.ctrl === pi && (c.counters.p1p1 || 0) > 0);
    if (own.length) return AIH.sortByValue(own)[0];
    const theirs = cs.filter(c => c.ctrl !== pi && (c.counters.m1m1 || 0) > 0);
    return theirs[0] || null;
  },
  productionTarget(cs) { return cs.slice().sort((a, b) => mv(b) - mv(a))[0]; },
};

const AI = {
  keepHand(pi, taken) {
    if (taken >= 2) return true;
    const lands = P(pi).hand.filter(isLand).length;
    return lands >= 2 && lands <= 5;
  },

  /* ---------- helpers ---------- */
  threats(pi) {
    return creatures(opp(pi)).filter(c => (c.isCmd || pow(c) >= 3));
  },
  boardPower(pi) { return creatures(pi).reduce((a, c) => a + Math.max(0, pow(c)), 0); },
  wipeWanted(pi) {
    const mine = AI.boardPower(pi), theirs = AI.boardPower(opp(pi));
    return theirs >= 2 * mine + 8 && theirs >= 10;
  },
  heldInstants(pi) {
    return P(pi).hand.filter(c => ['protect', 'counter', 'combatWipe'].includes(c.d.role));
  },
  reserve(pi) {
    const held = AI.heldInstants(pi);
    if (!held.length) return 0;
    // only hold mana back once there is a board worth protecting
    const board = creatures(pi).filter(c => !c.token);
    if (!controlsCommander(pi) && board.length < 2) return 0;
    const costs = held.map(c => (c.d.freeWithCommander && controlsCommander(pi)) ? 0 : costOf(pi, c, { p: pi, from: 'hand' }));
    return Math.min(...costs);
  },
  castCost(pi, c, from) { return costOf(pi, c, { p: pi, from }); },
  canCastNow(pi, c, from) {
    if (!timingOK(pi, c, from)) return false;
    const ctx = { p: pi, card: c, from, targets: [] };
    if (c.d.canCast && !c.d.canCast(ctx)) return false;
    let cost = AI.castCost(pi, c, from);
    if (c.d.freeWithCommander && controlsCommander(pi)) cost = 0;
    if (c.d.xCount) cost = addCost(cost, c.d.xCount); // need at least X=1
    return canPay(pi, cost, payOpts(c, { p: pi }));
  },
  tried(pi, key) { return G.tf.aiTried.has(pi + ':' + key); },
  mark(pi, key) { G.tf.aiTried.add(pi + ':' + key); },
  async act(pi, key, fn) {
    AI.mark(pi, key);
    if (SETTINGS.botDelay && !P(HUMAN).isBot) await sleep(SETTINGS.botDelay);
    return await fn();
  },

  /* ---------- main phase ---------- */
  async main(pi) {
    for (let i = 0; i < 60 && !G.over; i++) {
      const a = AI.pickMain(pi);
      if (!a) break;
      await AI.act(pi, a.key, a.run);
      await runStack(); await sba();
      if (typeof UI !== 'undefined') UI.render();
    }
  },
  playableExile(pi) {
    return P(pi).exile.filter(c => (c.playable === 'furious') || (c.playable === 'urza' && c.playTurn === G.turn));
  },
  pickMain(pi) {
    const pl = P(pi);
    const hand = pl.hand;
    const avail = () => manaAvail(pi);
    // 1. land
    if (sorceryOK(pi) && pl.landsPlayed < 1) {
      const lands = [...hand.filter(isLand), ...AI.playableExile(pi).filter(isLand)];
      let l = AIH.bestLand(pi, lands.filter(c => c.name !== 'Glimmervoid' || artifactsOf(pi).length)) || lands[0];
      if (l && !AI.tried(pi, 'land' + l.id)) return { key: 'land' + l.id, run: async () => { pl.landsPlayed++; if (l.zone === 'exile') l.playable = null; await enterBF(l, pi, {}); return true; } };
    }
    if (!sorceryOK(pi)) return null;
    // 2. commander
    for (const c of pl.cz) {
      if (!AI.tried(pi, 'cmd' + c.id) && AI.canCastNow(pi, c, 'cz')) return { key: 'cmd' + c.id, run: () => castSpell(pi, c, 'cz') };
    }
    // 3. wipes
    if (AI.wipeWanted(pi)) {
      for (const c of hand.filter(c => c.d.role === 'wipe')) {
        if (!AI.tried(pi, 'w' + c.id) && AI.canCastNow(pi, c, 'hand') && AI.wipeIsGood(pi, c)) return { key: 'w' + c.id, run: () => castSpell(pi, c, 'hand') };
      }
      const rift = hand.find(c => c.name === 'Cyclonic Rift');
      if (rift && !AI.tried(pi, 'rift') && canPay(pi, costOf(pi, rift, { p: pi, alt: rift.d.alts[0] }), {})) return { key: 'rift', run: () => castSpell(pi, rift, 'hand', { alt: rift.d.alts[0] }) };
      const disk = perms(pi).find(c => c.name === "Nevinyrral's Disk" && !c.tapped);
      if (disk && !AI.tried(pi, 'disk') && canPay(pi, 1, { exclude: disk }) && AI.wipeIsGood(pi, disk)) return { key: 'disk', run: () => activate(pi, disk, disk.d.abilities[0]) };
      for (const c of pl.exile.filter(x => x.foretold != null && x.foretold < G.turn && x.d.role === 'wipe')) {
        if (!AI.tried(pi, 'fw' + c.id) && canPay(pi, costOf(pi, c, { p: pi, from: 'exile' }), {})) return { key: 'fw' + c.id, run: () => castSpell(pi, c, 'exile') };
      }
    }
    // 4. removal on the biggest threat
    const threats = AI.threats(pi).filter(t => canTarget(t, pi));
    if (threats.length) {
      const rem = hand.filter(c => c.d.role === 'removal' && !['Cloud\'s Limit Break', 'Dispatch', 'Shuriken', 'Aether Spellbomb', 'Skysovereign, Consul Flagship', 'Cyclonic Rift'].includes(c.name)).sort((a, b) => AI.castCost(pi, a, 'hand') - AI.castCost(pi, b, 'hand'));
      for (const c of rem) {
        if (AI.tried(pi, 'r' + c.id) || !AI.canCastNow(pi, c, 'hand')) continue;
        return { key: 'r' + c.id, run: () => castSpell(pi, c, 'hand') };
      }
      const disp = hand.find(c => c.name === 'Dispatch');
      if (disp && metalcraft(pi) && !AI.tried(pi, 'disp') && AI.canCastNow(pi, disp, 'hand')) return { key: 'disp', run: () => castSpell(pi, disp, 'hand') };
    }
    // 4b. artifact hate
    const vb = hand.find(c => c.name === 'Vandalblast');
    if (vb && !AI.tried(pi, 'vb')) {
      const theirs = perms(opp(pi)).filter(isArtifact);
      if (theirs.length >= 2 && canPay(pi, costOf(pi, vb, { p: pi, alt: vb.d.alts[0] }), {})) return { key: 'vb', run: () => castSpell(pi, vb, 'hand', { alt: vb.d.alts[0] }) };
      if (theirs.length && canPay(pi, costOf(pi, vb, { p: pi, from: 'hand' }), {})) return { key: 'vb', run: () => castSpell(pi, vb, 'hand') };
    }
    // 5. development, cheapest first, keep reserve for held instants
    const reserve = AI.reserve(pi);
    const devRoles = ['creature', 'ramp', 'draw', 'equipment', 'evasion', 'engine', 'tutor', 'pump', 'utility', 'tax', 'recursion', 'removal'];
    const dev = [...hand, ...AI.playableExile(pi)].filter(c => !isLand(c) && (devRoles.includes(c.d.role || 'creature')) && (isPermanentCard(c) || ['draw', 'ramp', 'tutor', 'recursion'].includes(c.d.role)))
      .filter(c => !(isInstant(c) && c.d.role === 'draw'));
    dev.sort((a, b) => AI.castCost(pi, a, a.zone) - AI.castCost(pi, b, b.zone));
    for (const c of dev) {
      const key = 'd' + c.id;
      if (AI.tried(pi, key)) continue;
      if (c.d.role === 'removal' && !c.d.removalETB && !isPermanentCard(c)) continue;
      const from = c.zone === 'exile' ? 'exile' : 'hand';
      const free = c.zone === 'exile' && c.playable === 'urza';
      if (!free && !AI.canCastNow(pi, c, from)) continue;
      if (c.zone === 'exile' && c.playable === 'furious' && !AI.canCastNow(pi, c, 'hand')) continue;
      const cost = free ? 0 : AI.castCost(pi, c, from === 'exile' && c.playable ? 'hand' : from);
      if (avail() - cost < reserve && G.turn > 2) continue;
      if (c.d.role === 'removal' && isAura(c) && !threats.length) continue;
      if (c.name === 'Mechanized Production' && !artifactsOf(pi).length) continue;
      return { key, run: async () => { if (c.zone === 'exile') c.playable = null; return await castSpell(pi, c, from === 'exile' && !c.foretold ? 'hand' : from, { free }); } };
    }
    // 6. equip
    const eqs = perms(pi).filter(e => isEquipment(e) && e.d.equip != null).sort((a, b) => (a.name === 'Lightning Greaves' ? 1 : 0) - (b.name === 'Lightning Greaves' ? 1 : 0));
    for (const e of eqs) {
      const key = 'eq' + e.id;
      if (AI.tried(pi, key)) continue;
      const own = creatures(pi).filter(c => canTarget(c, pi, e));
      const tgt = AIH.equipTarget(e, own);
      if (!tgt || e.attachedTo === tgt.id) continue;
      if (e.attachedTo != null) { const cur = attachedTo(e); if (cur && (cur.isCmd || cur.name === 'Cloud, Ex-SOLDIER') ) continue; if (cur && AIH.value(cur) >= AIH.value(tgt)) continue; }
      if (e.name === 'Colossus Hammer' && has(tgt, 'flying') && tgt.name !== 'Cloud, Ex-SOLDIER') continue;
      const cost = equipCost(e, tgt);
      if (avail() - cost < reserve && G.turn > 2) continue;
      if (!canPay(pi, cost, {})) continue;
      const ab = equipAbility(e);
      return { key, run: async () => { const ctx = { p: pi, card: e, targets: [] }; addTarget(ctx, tgt); if (!canPay(pi, equipCost(e, tgt), {})) return false; await pay(pi, equipCost(e, tgt), {}); await pushAbility(e, pi, 'Equip', ctx, ab.resolve); return true; } };
    }
    // 7. abilities
    return AI.pickAbility(pi, reserve, true);
  },
  wipeIsGood(pi, c) {
    // compare value lost on each side with a rough simulation
    let f;
    if (c.name === 'All Is Dust') f = x => colorsOf(x);
    else if (c.name === "Nevinyrral's Disk") f = x => isArtifact(x) || isCreature(x) || isEnchantment(x);
    else if (c.name === 'Hour of Revelation') f = x => !isLand(x);
    else if (c.name === 'Ultimate Magic: Meteor') f = x => isCreature(x) && tou(x) <= 7;
    else f = x => isCreature(x);
    const lose = (p) => perms(p).filter(x => f(x) && !has(x, 'indestructible')).reduce((a, x) => a + AIH.value(x), 0);
    return lose(opp(pi)) > lose(pi) * 1.3;
  },
  pickAbility(pi, reserve, mainPhase) {
    const spare = () => manaAvail(pi) - reserve;
    for (const c of perms(pi)) {
      for (const ab of abilitiesOf(c)) {
        if (ab.equip || ab.id === 'crew') continue;
        const key = 'ab' + c.id + ab.id;
        if (AI.tried(pi, key) || !abilityUsable(pi, c, ab)) continue;
        const cost = ab.baseCost ? ab.baseCost(c) : abCost(c, ab, null);
        const want = AI.wantAbility(pi, c, ab, cost, spare(), mainPhase);
        if (want) return { key, run: () => activate(pi, c, ab) };
      }
    }
    if (mainPhase && sorceryOK(pi)) {
      for (const c of P(pi).gy) for (const ab of c.d.abilities.filter(a => a.fromGY)) {
        const key = 'gy' + c.id + ab.id;
        if (AI.tried(pi, key)) continue;
        if ((!ab.can || ab.can(c)) && canPay(pi, ab.cost || 0, {}) && spare() >= (ab.cost || 0)) return { key, run: () => activate(pi, c, ab) };
      }
    }
    return null;
  },
  wantAbility(pi, c, ab, cost, spare, mainPhase) {
    const n = c.name, id = ab.id;
    if (cost > spare) return false;
    const myTurn = G.active === pi;
    if (n === 'Stoneforge Mystic' && id === 'put') return P(pi).hand.some(e => isEquipment(e) && mv(e) > 2);
    if (n === 'Fighter Class') return mainPhase && myTurn;
    if (n === 'Whirler Virtuoso') return true;
    if (n === 'Steel Hellkite' && id === 'x') return AIH.hellkiteX(pi, spare) > 0;
    if (n === 'Urza, Lord High Artificer') return mainPhase && myTurn && G.phase === 'main2' && spare >= 5;
    if (!myTurn || G.phase === 'end') {
      if (n === 'Retrofitter Foundry') return true;
      if (n === 'Hangarback Walker') return true;
      if (n === 'Mazemind Tome' && id === 'draw') return true;
      if (n === "Tamiyo's Logbook") return true;
      if (n === 'Shimmer Dragon') return perms(pi).filter(a => isArtifact(a) && !a.tapped && !isCreature(a)).length >= 2;
      if (n === 'Sai, Master Thopterist') return artifactsOf(pi).filter(a => a.d.treasure || (a.token && !isCreature(a))).length >= 2 || artifactsOf(pi).filter(a => a.token).length >= 6;
      if (n === 'Thopter Foundry') return false;
      if (n === 'Hedron Archive') return P(pi).hand.length <= 1 && perms(pi).filter(isLand).length >= 7;
      if (n === 'Mind Stone') return P(pi).hand.length === 0 && perms(pi).filter(isLand).length >= 6;
      if (n === 'Aether Spellbomb' && id === 'draw') return P(pi).hand.length === 0;
      if (n === 'Soul-Guide Lantern' && id === 'draw') return P(pi).hand.length === 0;
    }
    if (n === 'Shuriken' && id === 'throw') return allCreatures().some(x => x.ctrl !== pi && tou(x) - x.dmg <= 2 && canTarget(x, pi, c) && (x.isCmd || AIH.value(x) >= 6));
    return false;
  },

  /* ---------- responding to the opponent ---------- */
  assess(pi, top) {
    const me = pi;
    if (top.p === me) return null;
    const src = top.kind === 'spell' ? top.card : top.src;
    const role = top.kind === 'spell' ? (src.d.role || '') : (src.d.removalETB ? 'removal' : '');
    const myTargets = top.ctx.targets.filter(t => !t.isPlayer && t.ctrl === me && t.zone === 'bf');
    if (role === 'wipe') {
      const victims = AI.wipeVictims(me, top);
      const v = victims.reduce((a, c) => a + AIH.value(c), 0);
      if (victims.some(c => c.isCmd) || victims.length >= 2 || v >= 12) return { kind: 'wipe', victims, how: 'destroy', value: v };
      return null;
    }
    if (role === 'combatWipe' && top.ctx.targets.some(t => t.isPlayer && t.pi === me)) {
      const victims = G.combat ? G.combat.atk.map(a => a.c).filter(c => c.ctrl === me) : [];
      if (victims.length) return { kind: 'targeted', victims, how: 'exile', value: victims.reduce((a, c) => a + AIH.value(c), 0), playerTarget: true };
    }
    if (myTargets.length && (role === 'removal' || top.kind === 'ability')) {
      const how = src.d.threat || (top.kind === 'ability' ? 'destroy' : 'destroy');
      const important = myTargets.filter(c => c.isCmd || mv(c) >= 4 || (isCreature(c) && pow(c) >= 3) || attachments(c).length >= 2);
      if (!important.length) return null;
      if (top.kind === 'ability' && !src.d.removalETB) return null;
      return { kind: 'targeted', victims: important, how, value: important.reduce((a, c) => a + AIH.value(c), 0) };
    }
    if (top.kind === 'spell' && isCreature(src) && (src.isCmd || mv(src) >= 5)) return { kind: 'bigCreature', victims: [], how: null, value: 5 };
    return null;
  },
  wipeVictims(me, top) {
    const c = top.card;
    const n = c.name;
    let f;
    if (n === 'Hour of Revelation') f = x => !isLand(x);
    else if (n === 'Austere Command') { const ms = top.ctx.modes || []; const fs = ms.map(m => AUSTERE_MODES.find(x => x.value === m).f); f = x => fs.some(g => g(x)); }
    else if (n === 'Planar Outburst') f = x => isCreature(x) && !isLand(x);
    else if (n === "Cloud's Limit Break") f = x => isCreature(x) && x.tapped;
    else f = x => isCreature(x);
    return perms(me).filter(x => f(x) && !has(x, 'indestructible'));
  },
  async respond(pi, top) {
    if (castRestricted(pi)) return false;
    const th = AI.assess(pi, top);
    if (!th) return false;
    const hand = P(pi).hand;
    // counterspells
    if (top.kind === 'spell') {
      const counters = hand.filter(c => c.d.role === 'counter' && counterFits(c, top));
      const usable = counters.filter(c => (c.d.freeWithCommander && controlsCommander(pi)) || canPay(pi, costOf(pi, c, { p: pi, from: 'hand' }), {}));
      usable.sort((a, b) => ((a.d.freeWithCommander && controlsCommander(pi)) ? 0 : costOf(pi, a, { p: pi })) - ((b.d.freeWithCommander && controlsCommander(pi)) ? 0 : costOf(pi, b, { p: pi })));
      const worth = th.kind !== 'bigCreature' || counters.length >= 2 || (top.card.isCmd && counters.length >= 1 && G.turn >= 6);
      if (usable.length && worth) {
        if (SETTINGS.botDelay && !P(HUMAN).isBot) await sleep(SETTINGS.botDelay);
        const ok = await castSpell(pi, usable[0], 'hand');
        if (ok) return true;
      }
    }
    if (th.kind === 'bigCreature') return false;
    // protection
    const prot = AI.pickProtection(pi, th);
    if (prot) {
      if (SETTINGS.botDelay && !P(HUMAN).isBot) await sleep(SETTINGS.botDelay);
      const ok = await castSpell(pi, prot.card, prot.from || 'hand', { hint: { protect: th.victims[0], mode: 'ind' } });
      if (ok) return true;
    }
    return false;
  },
  pickProtection(pi, th) {
    const cands = [...P(pi).hand.map(c => ({ card: c, from: 'hand' })), ...P(pi).exile.filter(c => c.foretold != null && c.foretold < G.turn).map(c => ({ card: c, from: 'exile' }))]
      .filter(x => x.card.d.role === 'protect');
    const fits = (x) => {
      const p = x.card.d.protect;
      const n = x.card.name;
      if (th.playerTarget) return p === 'all' || n === 'Clever Concealment';
      if (th.how === 'destroy' || th.how === 'damage') return true;
      // exile, -X/-X, bounce, aura: need hexproof, phasing, or protection from colors
      return n === 'Heroic Intervention' || n === "Teferi's Protection" || n === 'Clever Concealment' || n === "Akroma's Will";
    };
    const ok = cands.filter(fits).filter(x => timingOK(pi, x.card, x.from) && canPay(pi, costOf(pi, x.card, { p: pi, from: x.from }), payOpts(x.card, { p: pi })));
    if (!ok.length) return null;
    // prefer cheap, and keep Teferi's Protection for big moments
    ok.sort((a, b) => (a.card.name === "Teferi's Protection" ? 5 : 0) + costOf(pi, a.card, { p: pi, from: a.from }) - ((b.card.name === "Teferi's Protection" ? 5 : 0) + costOf(pi, b.card, { p: pi, from: b.from })));
    if (ok[0].card.name === "Teferi's Protection" && th.value < 25) return null;
    return ok[0];
  },

  /* ---------- combat ---------- */
  async declareAttackers(pi) {
    const dp = opp(pi);
    // crew vehicles with creatures that won't attack well anyway
    for (const v of perms(pi).filter(c => c.d.crew != null && !c.tmp.crewed && !c.sick)) {
      const crewers = creatures(pi).filter(c => !c.tapped && c !== v && (c.sick || pow(c) <= 1 || c.name === 'Sai, Master Thopterist' || c.name === 'Urza, Lord High Artificer'));
      const sum = crewers.reduce((a, c) => a + Math.max(0, pow(c)), 0);
      if (sum >= v.d.crew) {
        const ab = crewAbility(v.d.crew);
        const ctx = { p: pi, card: v, targets: [], crew: AIH.crewPick(crewers, v.d.crew) };
        await ab.resolve(ctx);
      }
    }
    // Whirler Rogue: make the best attacker unblockable using spare artifacts
    const blockers = creatures(dp).filter(b => !b.tapped);
    let cands = creatures(pi).filter(c => canAttack(c) && pow(c) > 0);
    cands = cands.filter(c => !['Sai, Master Thopterist', 'Urza, Lord High Artificer', 'Chief Engineer'].includes(c.name) || blockers.length === 0);
    const evasive = (c) => c.tmp.unblockable || !blockers.some(b => canBlock(b, c));
    const killers = (c) => blockers.filter(b => canBlock(b, c) && (has(b, 'deathtouch') || pow(b) >= tou(c)) && !has(c, 'indestructible'));
    const life = P(dp).life;
    const totalEvasive = cands.filter(evasive).reduce((a, c) => a + pow(c), 0);
    let atk;
    if (totalEvasive >= life) atk = cands.filter(evasive);
    else {
      atk = cands.filter(c => {
        if (evasive(c)) return true;
        const k = killers(c);
        if (!k.length) return true;
        // trade if every killer dies too and we are not risking the commander
        if (c.isCmd) return false;
        const allDie = k.every(b => has(c, 'deathtouch') || pow(c) >= tou(b));
        return allDie && AIH.value(c) <= Math.min(...k.map(AIH.value)) + 2;
      });
      // all-out if total power is lethal through available blockers
      const totalPow = cands.reduce((a, c) => a + pow(c), 0);
      const blockable = blockers.length;
      const sorted = cands.slice().sort((a, b) => pow(b) - pow(a));
      const throughPow = sorted.slice(blockable).reduce((a, c) => a + pow(c), 0);
      if (throughPow >= life && totalPow >= life) atk = cands;
    }
    // deathtouch rule
    const dtBlockers = blockers.filter(b => has(b, 'deathtouch')).length;
    const nonEv = atk.filter(c => !evasive(c));
    if (dtBlockers > nonEv.length && nonEv.length) atk = atk.filter(evasive);
    // attack tax with spare mana only
    const tax = attackTax(pi);
    if (tax && atk.length) {
      const spare = manaAvail(pi) - AI.reserve(pi);
      const n = Math.max(0, Math.floor(spare / tax));
      atk = atk.sort((a, b) => pow(b) - pow(a)).slice(0, n);
    }
    // Whirler Rogue unblockable
    const wr = perms(pi).find(c => c.name === 'Whirler Rogue');
    if (wr && atk.length) {
      const best = atk.filter(c => !evasive(c)).sort((a, b) => pow(b) - pow(a))[0];
      const spareArts = perms(pi).filter(a => isArtifact(a) && !a.tapped && !atk.includes(a));
      if (best && spareArts.length >= 2) { const s2 = AIH.cheapArtifacts(spareArts).slice(0, 2); s2.forEach(a => a.tapped = true); best.tmp.unblockable = true; log(`Whirler Rogue makes ${best.name} unblockable.`); }
    }
    if (SETTINGS.botDelay && !P(HUMAN).isBot) await sleep(SETTINGS.botDelay);
    return atk;
  },
  async declareBlockers(pi) {
    const cb = G.combat;
    const pool = creatures(pi).filter(b => !b.tapped);
    const used = new Set();
    const life = P(pi).life;
    const atks = cb.atk.slice().sort((a, b) => AIH.value(b.c) - AIH.value(a.c));
    const kills = (b, a) => has(b, 'deathtouch') || pow(b) >= tou(a) - a.c?.dmg;
    for (const A of atks) {
      const a = A.c;
      const opts = pool.filter(b => !used.has(b) && canBlock(b, a));
      if (!opts.length) continue;
      if (has(a, 'menace')) continue;
      const killsA = (b) => !has(a, 'indestructible') && (has(b, 'deathtouch') || pow(b) >= tou(a));
      const survives = (b) => has(b, 'indestructible') || (!has(a, 'deathtouch') && pow(a) < tou(b));
      let pick = opts.filter(b => killsA(b) && survives(b)).sort((x, y) => AIH.value(x) - AIH.value(y))[0];
      if (!pick) pick = opts.filter(b => survives(b) && !b.isCmd).sort((x, y) => AIH.value(x) - AIH.value(y))[0];
      if (!pick) pick = opts.filter(b => killsA(b) && AIH.value(a) >= AIH.value(b) && !b.isCmd).sort((x, y) => AIH.value(x) - AIH.value(y))[0];
      if (pick) { A.blockers.push(pick); used.add(pick); }
    }
    // chump if lethal
    const incoming = () => cb.atk.filter(A => !A.blockers.length).reduce((s, A) => s + pow(A.c), 0);
    const cmdIncoming = () => cb.atk.filter(A => !A.blockers.length && A.c.isCmd).reduce((s, A) => s + pow(A.c), 0);
    const cmdDmg = Object.values(P(pi).cmdDmg)[0] || 0;
    for (const A of cb.atk.slice().sort((a, b) => pow(b.c) - pow(a.c))) {
      if (incoming() < life && cmdDmg + cmdIncoming() < 21) break;
      if (A.blockers.length || has(A.c, 'menace')) continue;
      const ch = pool.filter(b => !used.has(b) && canBlock(b, A.c)).sort((x, y) => AIH.value(x) - AIH.value(y))[0];
      if (ch) { A.blockers.push(ch); used.add(ch); }
    }
    if (SETTINGS.botDelay && !P(HUMAN).isBot) await sleep(SETTINGS.botDelay);
  },
  async defenderWindow(pi) {
    if (!G.combat || castRestricted(pi)) return;
    const hand = P(pi).hand;
    const atk = G.combat.atk.map(a => a.c).filter(c => c.zone === 'bf');
    const atkPow = atk.reduce((a, c) => a + pow(c), 0);
    const life = P(pi).life;
    const cast = async (c, opt) => { if (SETTINGS.botDelay && !P(HUMAN).isBot) await sleep(SETTINGS.botDelay); const ok = await castSpell(pi, c, 'hand', opt); if (ok) await runStack(); return ok; };
    // Aetherize
    const ae = hand.find(c => c.name === 'Aetherize');
    if (ae && AI.canCastNow(pi, ae, 'hand') && (atkPow >= 8 || atkPow >= life * 0.4 || atk.some(c => c.isCmd && pow(c) >= 5))) { await cast(ae); return; }
    // Limit Break on tapped attackers
    const lb = hand.find(c => c.name === "Cloud's Limit Break");
    if (lb && AI.canCastNow(pi, lb, 'hand') && atk.some(c => c.tapped && (c.isCmd || pow(c) >= 3) && canTarget(c, pi, lb))) { await cast(lb); }
    // instant removal on a scary attacker
    const scary = atk.filter(c => (c.isCmd || pow(c) >= 4) && canTarget(c, pi)).sort((a, b) => AIH.value(b) - AIH.value(a))[0];
    if (scary) {
      const rem = hand.filter(c => isInstant(c) && c.d.role === 'removal' && c.name !== "Cloud's Limit Break" && c.name !== 'Cyclonic Rift' && AI.canCastNow(pi, c, 'hand'));
      if (rem[0]) await cast(rem[0]);
    }
    // Teferi's Protection when facing lethal
    const left = G.combat ? G.combat.atk.filter(a => a.c.zone === 'bf').reduce((s, a) => s + pow(a.c), 0) : 0;
    const blockersPow = creatures(pi).filter(b => !b.tapped).length;
    if (left >= life && blockersPow < 2) {
      const tp = hand.find(c => c.name === "Teferi's Protection");
      if (tp && AI.canCastNow(pi, tp, 'hand')) await cast(tp);
    }
  },
  async attackerTricks(pi) {
    if (!G.combat || castRestricted(pi)) return;
    const hand = P(pi).hand;
    const atk = G.combat.atk.filter(a => a.c.zone === 'bf');
    const cast = async (c, opt) => { if (SETTINGS.botDelay && !P(HUMAN).isBot) await sleep(SETTINGS.botDelay); const ok = await castSpell(pi, c, 'hand', opt); if (ok) await runStack(); return ok; };
    const ec = hand.find(c => c.name === 'Embercleave');
    if (ec && AI.canCastNow(pi, ec, 'hand')) await cast(ec);
    const aw = hand.find(c => c.name === "Akroma's Will");
    const unblocked = atk.filter(a => !a.blocked);
    if (aw && controlsCommander(pi) && unblocked.length >= 2 && AI.canCastNow(pi, aw, 'hand')) {
      const dmg = unblocked.reduce((s, a) => s + pow(a.c) * 2, 0);
      if (dmg >= P(opp(pi)).life * 0.6) await cast(aw);
    }
  },
  async defenderTricks(pi) {
    // bot defending after blocks: nothing fancy yet
  },
  async opponentEndStep(pi) {
    if (G.over || castRestricted(pi)) return;
    const hand = P(pi).hand;
    const cast = async (c, from = 'hand', opt) => { if (SETTINGS.botDelay && !P(HUMAN).isBot) await sleep(SETTINGS.botDelay); const ok = await castSpell(pi, c, from, opt); if (ok) { await runStack(); await sba(); } return ok; };
    // instant removal on threats while we still have it
    const threats = AI.threats(pi).filter(t => canTarget(t, pi));
    if (threats.length) {
      for (const c of hand.filter(c => isInstant(c) && c.d.role === 'removal' && !["Cloud's Limit Break", 'Dispatch'].includes(c.name))) {
        if (AI.canCastNow(pi, c, 'hand')) { await cast(c); break; }
      }
    }
    // flash permanents
    for (const c of hand.filter(c => !isLand(c) && isPermanentCard(c) && hasFlash(pi, c) && c.d.role !== 'counter')) {
      if (G.over) return;
      if (AI.canCastNow(pi, c, 'hand')) await cast(c);
    }
    // instant card draw / tutors with everything left
    for (const n of ['Whir of Invention', 'Pull from Tomorrow', 'Thirst for Knowledge']) {
      const c = hand.find(x => x.name === n);
      if (c && AI.canCastNow(pi, c, 'hand')) await cast(c);
    }
    // activated abilities
    for (let i = 0; i < 12 && !G.over; i++) {
      const a = AI.pickAbility(pi, 0, false);
      if (!a) break;
      await AI.act(pi, a.key, a.run);
      await runStack(); await sba();
    }
  },
};
