'use strict';
/* =====================================================================
   Card scripts: Revival Trance (FINAL FANTASY VI) precon, Terra, Herald
   of Hope, plus its graveyard upgrades. Oracle text from MTGJSON/Scryfall.
   Also shared dual lands used by Revival Trance and Wakanda Forever.
   ===================================================================== */
const crCards = (pi) => P(pi).gy.filter(c => c.d.types.includes('Creature'));
async function returnFromGY(pi, prompt, filter, { tapped = false, optional = true, ai } = {}) {
  const cands = P(pi).gy.filter(filter);
  if (!cands.length) return null;
  const k = await chooseCard(pi, { prompt, cands, optional, ai: ai || (cs => AIH.bestCard(cs)) });
  if (k) await enterBF(k, pi, { tapped, fromZone: 'gy' });
  return k;
}

/* ---------------- lands ---------------- */
const LAND = (name, prod, extra = {}) => C(name, { types: ['Land'], mana: prod.length, prod, ...extra });
const checkland = (a, b) => (c) => !(hasLandType(c.ctrl, a) || hasLandType(c.ctrl, b));
const snarl = (a, b) => (c) => !P(c.ctrl).hand.some(x => isLand(x) && ((x.d.sub || '').split(' ').includes(a) || (x.d.sub || '').split(' ').includes(b)));
const fetchSelf = { id: 'fetch', label: '{T}, Sacrifice: search for a basic land, put it onto the battlefield tapped', cost: 0, tap: true, sacSelf: true, speed: 'instant', hideFromAutoStop: true, resolve: async (ctx) => { await fetchBasicsToBF(ctx.p, 1, { tapped: true }); } };
LAND('Battlefield Forge', ['RWC'], { text: '{T}: Add {C}.\n{T}: Add {R} or {W}. This land deals 1 damage to you.' });
LAND('Sulfurous Springs', ['BRC'], { text: '{T}: Add {C}.\n{T}: Add {B} or {R}. This land deals 1 damage to you.' });
LAND('Clifftop Retreat', ['RW'], { entersTappedFn: checkland('Mountain', 'Plains'), text: 'This land enters tapped unless you control a Mountain or a Plains.\n{T}: Add {R} or {W}.' });
LAND('Dragonskull Summit', ['BR'], { entersTappedFn: checkland('Swamp', 'Mountain'), text: 'This land enters tapped unless you control a Swamp or a Mountain.\n{T}: Add {B} or {R}.' });
LAND('Isolated Chapel', ['WB'], { entersTappedFn: checkland('Plains', 'Swamp'), text: 'This land enters tapped unless you control a Plains or a Swamp.\n{T}: Add {W} or {B}.' });
LAND('Sunpetal Grove', ['GW'], { entersTappedFn: checkland('Forest', 'Plains'), text: 'This land enters tapped unless you control a Forest or a Plains.\n{T}: Add {G} or {W}.' });
LAND('Foreboding Ruins', ['BR'], { entersTappedFn: snarl('Swamp', 'Mountain'), text: 'As this land enters, you may reveal a Swamp or Mountain card from your hand. If you don\'t, this land enters tapped.\n{T}: Add {B} or {R}.' });
LAND('Furycalm Snarl', ['RW'], { entersTappedFn: snarl('Mountain', 'Plains'), text: 'As this land enters, you may reveal a Mountain or Plains card from your hand. If you don\'t, this land enters tapped.\n{T}: Add {R} or {W}.' });
LAND('Shineshadow Snarl', ['WB'], { entersTappedFn: snarl('Plains', 'Swamp'), text: 'As this land enters, you may reveal a Plains or Swamp card from your hand. If you don\'t, this land enters tapped.\n{T}: Add {W} or {B}.' });
LAND('Fortified Village', ['GW'], { entersTappedFn: snarl('Forest', 'Plains'), text: 'As this land enters, you may reveal a Forest or Plains card from your hand. If you don\'t, this land enters tapped.\n{T}: Add {G} or {W}.' });
LAND('Desolate Mire', ['WB'], { text: '{1}, {T}: Add {W}{B}.' });
LAND('Shadowblood Ridge', ['BR'], { text: '{1}, {T}: Add {B}{R}.' });
LAND('Sunscorched Divide', ['RW'], { text: '{1}, {T}: Add {R}{W}.' });
LAND('Sungrass Prairie', ['GW'], { text: '{1}, {T}: Add {G}{W}.' });
LAND('Fetid Heath', ['WBC'], { text: '{T}: Add {C}.\n{W/B}, {T}: Add {W}{W}, {W}{B}, or {B}{B}.' });
LAND('Graven Cairns', ['BRC'], { text: '{T}: Add {C}.\n{B/R}, {T}: Add {B}{B}, {B}{R}, or {R}{R}.' });
LAND('Rugged Prairie', ['RWC'], { text: '{T}: Add {C}.\n{R/W}, {T}: Add {R}{R}, {R}{W}, or {W}{W}.' });
LAND('Exotic Orchard', 'ident', { mana: 1, text: '{T}: Add one mana of any color that a land an opponent controls could produce.' });
LAND('High Market', ['C'], {
  text: '{T}: Add {C}.\n{T}, Sacrifice a creature: You gain 1 life.',
  abilities: [{ id: 'sac', label: '{T}, Sacrifice a creature: You gain 1 life', cost: 0, tap: true, speed: 'instant', hideFromAutoStop: true, can: c => creatures(c.ctrl).length > 0, choose: async (ctx) => { const k = await chooseCard(ctx.p, { prompt: 'Sacrifice a creature', cands: creatures(ctx.p), ai: cs => (G.aiSac && cs.includes(G.aiSac) ? G.aiSac : AIH.weakest(cs)) }); if (!k) return false; ctx.sac = k; return true; }, preCost: async (ctx) => { await sacrifice(ctx.sac); }, resolve: async (ctx) => { gainLife(ctx.p, 1); } }],
});
LAND('Demolition Field', ['C'], { text: '{T}: Add {C}.\n{2}, {T}, Sacrifice this land: Destroy target nonbasic land an opponent controls. That land\'s controller may search their library for a basic land card, put it onto the battlefield, then shuffle. You may search your library for a basic land card, put it onto the battlefield, then shuffle.' });
LAND('Scavenger Grounds', ['C'], { sub: 'Desert', text: '{T}: Add {C}.\n{2}, {T}, Sacrifice a Desert: Exile all graveyards.' });
LAND('Smoldering Marsh', ['BR'], { sub: 'Swamp Mountain', entersTappedFn: (c) => perms(c.ctrl).filter(l => isBasic(l)).length < 2, text: '({T}: Add {B} or {R}.)\nThis land enters tapped unless you control two or more basic lands.' });
LAND('Canopy Vista', ['GW'], { sub: 'Forest Plains', entersTappedFn: (c) => perms(c.ctrl).filter(l => isBasic(l)).length < 2, text: '({T}: Add {G} or {W}.)\nThis land enters tapped unless you control two or more basic lands.' });
LAND('Geothermal Bog', ['BR'], { sub: 'Swamp Mountain', entersTapped: true, text: '({T}: Add {B} or {R}.)\nThis land enters tapped.' });
LAND('Sacred Peaks', ['RW'], { sub: 'Mountain Plains', entersTapped: true, text: '({T}: Add {R} or {W}.)\nThis land enters tapped.' });
LAND('Sunlit Marsh', ['WB'], { sub: 'Plains Swamp', entersTapped: true, text: '({T}: Add {W} or {B}.)\nThis land enters tapped.' });
LAND('Scattered Groves', ['GW'], { sub: 'Forest Plains', entersTapped: true, cycling: { mc: '{2}', label: 'Cycling {2}: discard, draw a card' }, text: '({T}: Add {G} or {W}.)\nThis land enters tapped.\nCycling {2}' });
LAND('Nomad Outpost', ['RWB'], { entersTapped: true, text: 'This land enters tapped.\n{T}: Add {R}, {W}, or {B}.' });
LAND('Path of Ancestry', 'ident', { mana: 1, entersTapped: true, text: "This land enters tapped.\n{T}: Add one mana of any color in your commander's color identity. When that mana is spent to cast a creature spell that shares a creature type with your commander, scry 1." });
LAND('Bountiful Promenade', ['GW'], { entersTappedFn: (c) => opps(c.ctrl).length < 2, text: 'This land enters tapped unless you have two or more opponents.\n{T}: Add {G} or {W}.' });
LAND('Razorverge Thicket', ['GW'], { entersTappedFn: (c) => perms(c.ctrl).filter(l => isLand(l) && l !== c).length > 2, text: 'This land enters tapped unless you control two or fewer other lands.\n{T}: Add {G} or {W}.' });
LAND('Ash Barrens', ['C'], { cycling: { mc: '{1}', label: 'Basic landcycling {1}: search for a basic land card', search: c => isBasic(c) }, text: '{T}: Add {C}.\nBasic landcycling {1}' });
LAND('Evolving Wilds', [], { text: '{T}, Sacrifice this land: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.', abilities: [fetchSelf] });
LAND('Terramorphic Expanse', [], { text: '{T}, Sacrifice this land: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.', abilities: [fetchSelf] });
LAND('Throne of the High City', ['C'], { text: '{T}: Add {C}.\n{4}, {T}, Sacrifice this land: You become the monarch.', abilities: [{ id: 'mon', label: '{4}, {T}, Sacrifice: You become the monarch', cost: 4, tap: true, sacSelf: true, speed: 'instant', resolve: async (ctx) => { setMonarch(ctx.p); } }] });
C('Talisman of Conviction', { mc: '{2}', types: ['Artifact'], mana: 1, prod: ['RWC'], role: 'ramp', text: '{T}: Add {C}.\n{T}: Add {R} or {W}. This artifact deals 1 damage to you.' });
C('Talisman of Indulgence', { mc: '{2}', types: ['Artifact'], mana: 1, prod: ['BRC'], role: 'ramp', text: '{T}: Add {C}.\n{T}: Add {B} or {R}. This artifact deals 1 damage to you.' });

/* ---------------- commander ---------------- */
C('Terra, Herald of Hope', {
  mc: '{R}{W}{B}', colors: 'RWB', types: ['Legendary', 'Creature'], sub: 'Human Wizard Warrior', pt: [3, 3], role: 'creature',
  text: 'Trance — At the beginning of combat on your turn, mill two cards. Terra gains flying until end of turn.\nWhenever Terra deals combat damage to a player, you may pay {2}. When you do, return target creature card with power 3 or less from your graveyard to the battlefield tapped.',
  on: {
    beginCombat: async (s, { pi }) => { if (pi !== s.ctrl) return; await mill(pi, 2); tmpAdd(s, { kw: ['flying'] }); },
    combatDamagePlayer: async (s, { src }) => {
      if (src !== s) return;
      const cands = crCards(s.ctrl).filter(c => (c.d.pt ? c.d.pt[0] : 0) <= 3);
      if (!cands.length || !canPay(s.ctrl, 2, {})) return;
      if (!(await chooseYes(s.ctrl, { prompt: 'Terra: pay {2} to return a creature card with power 3 or less?', ai: () => true }))) return;
      await pay(s.ctrl, 2, {});
      await trigger(s, s.ctrl, 'return a creature card (power 3 or less)', async (ctx) => { const k = await chooseCard(s.ctrl, { prompt: 'Return target creature card with power 3 or less', cands: crCards(s.ctrl).filter(c => (c.d.pt ? c.d.pt[0] : 0) <= 3), ai: cs => AIH.bestCard(cs) }); if (!k) return false; addTarget(ctx, k); return true; },
        async (ctx) => { const t = ctx.targets[0]; if (tOK(ctx, t)) await enterBF(t, s.ctrl, { tapped: true, fromZone: 'gy' }); });
    },
  },
});

/* ---------------- precon cards kept ---------------- */
C('Celes, Rune Knight', {
  mc: '{1}{R}{W}{B}', colors: 'RWB', types: ['Legendary', 'Creature'], sub: 'Human Wizard Knight', pt: [4, 4], role: 'creature',
  text: 'When Celes enters, discard any number of cards, then draw that many cards plus one.\nWhenever one or more other creatures you control enter, if one or more of them entered from a graveyard or was cast from a graveyard, put a +1/+1 counter on each creature you control.',
  etb: async (c) => {
    const pl = P(c.ctrl);
    const picks = await chooseCards(c.ctrl, { prompt: 'Celes: discard any number of cards (you draw that many plus one)', cands: pl.hand.slice(), min: 0, max: pl.hand.length, ai: cs => { const lands = perms(c.ctrl).filter(isLand).length; return cs.filter(x => (isLand(x) && lands >= 5) || mv(x) >= 8); } });
    for (const x of picks) await discardCard(c.ctrl, x);
    await drawCards(c.ctrl, picks.length + 1);
  },
  on: { etb: async (s, { card, opts }) => { if (card !== s && card.ctrl === s.ctrl && isCreature(card) && opts && opts.fromZone === 'gy') { for (const x of creatures(s.ctrl)) addCounters(x, 'p1p1', 1); log('Celes: +1/+1 counter on each creature.'); } } },
});
C('Cyan, Vengeful Samurai', {
  mc: '{6}{W}', colors: 'W', types: ['Legendary', 'Creature'], sub: 'Human Samurai', pt: [3, 3], kw: ['doublestrike'], role: 'creature',
  text: 'This spell costs {1} less to cast for each creature card in your graveyard.\nDouble strike\nWhenever one or more creature cards leave your graveyard, put a +1/+1 counter on Cyan.',
  costMod: (c, pi) => -crCards(pi).length,
  onGyCreatureLeave: (s) => { if (G.tf['cyan' + s.id] === G.stack.length + ':' + G.log.length) return; G.tf['cyan' + s.id] = G.stack.length + ':' + G.log.length; addCounters(s, 'p1p1', 1); },
});
C('General Leo Cristophe', {
  mc: '{4}{W}', colors: 'W', types: ['Legendary', 'Creature'], sub: 'Human Soldier', pt: [2, 2], role: 'creature',
  text: 'When General Leo Cristophe enters, return up to one target creature card with mana value 3 or less from your graveyard to the battlefield. Then put a +1/+1 counter on General Leo Cristophe for each creature you control.',
  etb: async (c) => {
    await trigger(c, c.ctrl, 'return a creature card (MV 3 or less), then grow', async (ctx) => { ctx.noFizzle = true; const k = await chooseCard(c.ctrl, { prompt: 'Return up to one creature card with mana value 3 or less', cands: crCards(c.ctrl).filter(x => mv(x) <= 3), optional: true, ai: cs => AIH.bestCard(cs) }); if (k) addTarget(ctx, k); return true; },
      async (ctx) => { const t = ctx.targets[0]; if (t && tOK(ctx, t)) await enterBF(t, c.ctrl, { fromZone: 'gy' }); if (c.zone === 'bf') addCounters(c, 'p1p1', creatures(c.ctrl).length); });
  },
});
C('The Falcon, Airship Restored', {
  mc: '{2}{B}', colors: 'B', types: ['Legendary', 'Artifact', 'Vehicle'], sub: 'Vehicle', pt: [4, 3], kw: ['flying'], crew: 2, role: 'recursion',
  text: 'Flying\nWhenever The Falcon deals combat damage to a player, you may sacrifice it. When you do, return target creature card from your graveyard to the battlefield.\n{4}{B}: Return this card from your graveyard to the battlefield tapped.\nCrew 2',
  on: {
    combatDamagePlayer: async (s, { src }) => {
      if (src !== s || !crCards(s.ctrl).length) return;
      if (!(await chooseYes(s.ctrl, { prompt: 'The Falcon: sacrifice it to return a creature card from your graveyard?', ai: () => crCards(s.ctrl).some(c => mv(c) >= 4) }))) return;
      const pi = s.ctrl; await sacrifice(s);
      await returnFromGY(pi, 'Return target creature card from your graveyard', isCreature, { optional: false });
    },
  },
  abilities: [{ id: 'back', label: '{4}{B}: Return The Falcon from your graveyard tapped', cost: '{4}{B}', fromGY: true, speed: 'instant', noStack: true, can: c => c.zone === 'gy', resolve: async (ctx) => { if (ctx.card.zone === 'gy') await enterBF(ctx.card, ctx.p, { tapped: true }); } }],
});
C('Interceptor, Shadow\'s Hound', {
  mc: '{2}{B}{B}', colors: 'B', types: ['Legendary', 'Creature'], sub: 'Dog', pt: [4, 3], kw: ['menace'], role: 'creature',
  text: 'Menace\nAssassins you control have menace.\nWhenever you attack with one or more legendary creatures, you may pay {2}{B}. If you do, return this card from your graveyard to the battlefield tapped and attacking.',
  anthem: (s, c) => (c.ctrl === s.ctrl && hasSub(c, 'Assassin') ? { kw: ['menace'] } : null),
  gyOn: {
    attackDeclared: async (s, { pi, attackers }) => {
      if (pi !== s.owner || !attackers.some(isLegendary) || !canPay(pi, '{2}{B}', {})) return;
      if (!(await chooseYes(pi, { prompt: 'Interceptor: pay {2}{B} to return it tapped and attacking?', card: s, ai: () => true }))) return;
      await pay(pi, '{2}{B}', {});
      await enterBF(s, pi, { tapped: true, fromZone: 'gy' });
      if (G.combat) G.combat.atk.push({ c: s, blockers: [] });
      log('Interceptor returns tapped and attacking.');
    },
  },
});
C('Shadow, Mysterious Assassin', {
  mc: '{2}{B}', colors: 'B', types: ['Legendary', 'Creature'], sub: 'Human Assassin', pt: [3, 3], kw: ['deathtouch'], role: 'creature',
  text: 'Deathtouch\nThrow — Whenever Shadow deals combat damage to a player, you may sacrifice another nonland permanent. If you do, draw two cards and each opponent loses life equal to the mana value of the sacrificed permanent.',
  on: {
    combatDamagePlayer: async (s, { src }) => {
      if (src !== s) return;
      const cands = perms(s.ctrl).filter(c => c !== s && !isLand(c));
      const k = await chooseCard(s.ctrl, { prompt: 'Throw: sacrifice another nonland permanent to draw two (optional)', cands, optional: true, ai: cs => cs.filter(c => c.token || c.d.treasure).sort((a, b) => mv(b) - mv(a))[0] || null });
      if (!k) return;
      const v = mv(k); await sacrifice(k);
      await drawCards(s.ctrl, 2);
      for (const o of opps(s.ctrl)) loseLife(o, v);
      if (v) log(`Throw: each opponent loses ${v}.`);
    },
  },
});
C('Siegfried, Famed Swordsman', {
  mc: '{3}{B}', colors: 'B', types: ['Legendary', 'Creature'], sub: 'Human Warrior Rogue', pt: [2, 2], kw: ['menace'], role: 'creature',
  text: 'Menace\nWhen Siegfried enters, mill three cards. Then put X +1/+1 counters on Siegfried, where X is twice the number of creature cards in your graveyard.',
  etb: async (c) => { await mill(c.ctrl, 3); if (c.zone === 'bf') addCounters(c, 'p1p1', 2 * crCards(c.ctrl).length); },
});
C('Sabin, Master Monk', {
  mc: '{4}{R}', colors: 'R', types: ['Legendary', 'Creature'], sub: 'Human Noble Monk', pt: [4, 3], kw: ['doublestrike'], role: 'creature',
  text: 'Double strike\nBlitz—{2}{R}{R}, Discard a card. (If you cast this spell for its blitz cost, it gains haste and "When this creature dies, draw a card." Sacrifice it at the beginning of the next end step.)\nYou may cast this card from your graveyard using its blitz ability.',
  alts: [{
    key: 'blitz', label: 'Blitz (discard a card)', mc: '{2}{R}{R}', fromGY: true,
    can: (c, pi) => P(pi).hand.some(x => x !== c),
    choose: async (ctx) => { const cs = P(ctx.p).hand.filter(x => x !== ctx.card); const k = await chooseCard(ctx.p, { prompt: 'Blitz: discard a card', cands: cs, ai: x => AIH.discardOrder(ctx.p, x)[0] }); if (!k) return false; await discardCard(ctx.p, k); return true; },
  }],
});
C('Umaro, Raging Yeti', {
  mc: '{5}{R}', colors: 'R', types: ['Legendary', 'Creature'], sub: 'Yeti Berserker', pt: [6, 6], kw: ['trample'], role: 'creature',
  text: 'Trample\nAt the beginning of combat on your turn, choose one at random —\n• Other creatures you control get +3/+0 and gain trample until end of turn.\n• Discard your hand, then draw four cards.\n• Umaro deals 5 damage to any target.',
  on: {
    beginCombat: async (s, { pi }) => {
      if (pi !== s.ctrl) return;
      const r = Math.floor(Math.random() * 3);
      if (r === 0) { for (const c of creatures(pi)) if (c !== s) tmpAdd(c, { p: 3, kw: ['trample'] }); log('Umaro (random): other creatures get +3/+0 and trample.'); }
      else if (r === 1) { log('Umaro (random): discard hand, draw four.'); for (const c of P(pi).hand.slice()) await discardCard(pi, c); await drawCards(pi, 4); }
      else {
        log('Umaro (random): 5 damage to any target.');
        await trigger(s, pi, '5 damage to any target', async (ctx) => {
          const cs = opps(pi).flatMap(creatures).filter(c => canTarget(c, pi, s));
          const k = await chooseCard(pi, { prompt: 'Umaro: 5 damage to which creature? (cancel = an opponent)', cands: cs, optional: true, ai: x => AIH.burnTarget(x, ctx, 5) });
          addTarget(ctx, k || PL(pickOpp(pi))); ctx.noFizzle = true; return true;
        }, async (ctx) => { const t = ctx.targets[0]; if (tOK(ctx, t)) dealDamage(s, t, 5); });
      }
    },
  },
});
C('Archfiend of Depravity', {
  mc: '{3}{B}{B}', colors: 'B', types: ['Creature'], sub: 'Demon', pt: [5, 4], kw: ['flying'], role: 'creature',
  text: "Flying\nAt the beginning of each opponent's end step, that player chooses up to two creatures they control, then sacrifices the rest.",
  on: {
    endStep: async (s, { pi }) => {
      if (pi === s.ctrl || !opps(s.ctrl).includes(pi)) return;
      const cs = creatures(pi);
      if (cs.length <= 2) return;
      const keep = await chooseCards(pi, { prompt: 'Archfiend of Depravity: choose up to two creatures to keep', cands: cs, min: Math.min(2, cs.length), max: 2, ai: x => AIH.sortByValue(x).slice(0, 2) });
      log(`Archfiend of Depravity: ${P(pi).name} keeps ${keep.map(c => c.name).join(' and ')}.`, 'warn');
      await killBatch(cs.filter(c => !keep.includes(c)), 'sac');
    },
  },
});
C('Reanimate', {
  mc: '{B}', colors: 'B', types: ['Sorcery'], role: 'recursion', text: "Put target creature card from a graveyard onto the battlefield under your control. You lose life equal to that card's mana value.",
  canCast: () => G.players.some(p => p.gy.some(isCreature)),
  choose: async (ctx) => { const cs = G.players.flatMap(p => p.gy.filter(isCreature)); const k = await chooseCard(ctx.p, { prompt: 'Reanimate: target creature card in any graveyard', cands: cs, ai: x => AIH.reanimateTarget(ctx.p, x) }); if (!k) return false; addTarget(ctx, k); return true; },
  spell: async (ctx) => { const t = ctx.targets[0]; if (!tOK(ctx, t)) return; const v = mv(t); await enterBF(t, ctx.p, { fromZone: 'gy' }); loseLife(ctx.p, v); },
});
C('Rise of the Dark Realms', {
  mc: '{7}{B}{B}', colors: 'B', types: ['Sorcery'], role: 'recursion', text: 'Put all creature cards from all graveyards onto the battlefield under your control.',
  spell: async (ctx) => { const cs = G.players.flatMap(p => p.gy.filter(isCreature)); for (const c of cs) await enterBF(c, ctx.p, { fromZone: 'gy' }); log(`Rise of the Dark Realms returns ${cs.length} creatures.`, 'big'); },
});
C('Sepulchral Primordial', {
  mc: '{5}{B}{B}', colors: 'B', types: ['Creature'], sub: 'Avatar', pt: [5, 4], kw: ['intimidate'], role: 'creature',
  text: "Intimidate\nWhen this creature enters, for each opponent, you may put up to one target creature card from that player's graveyard onto the battlefield under your control.",
  etb: async (c) => {
    for (const o of opps(c.ctrl)) {
      const cs = P(o).gy.filter(isCreature);
      if (!cs.length) continue;
      const k = await chooseCard(c.ctrl, { prompt: `Sepulchral Primordial: creature card from ${P(o).name}'s graveyard (optional)`, cands: cs, optional: true, ai: x => AIH.reanimateTarget(c.ctrl, x) });
      if (k) await enterBF(k, c.ctrl, { fromZone: 'gy' });
    }
  },
});
C('Combustible Gearhulk', {
  mc: '{4}{R}{R}', colors: 'R', types: ['Artifact', 'Creature'], sub: 'Construct', pt: [6, 6], kw: ['firststrike'], role: 'creature',
  text: 'First strike\nWhen this creature enters, target opponent may have you draw three cards. If the player doesn\'t, you mill three cards, then this creature deals damage to that player equal to the total mana value of those cards.',
  etb: async (c) => {
    const o = pickOpp(c.ctrl);
    const letDraw = await chooseYes(o, { prompt: `Combustible Gearhulk: let ${P(c.ctrl).name} draw three cards? (No = they mill three and you take damage equal to the total mana value)`, card: c, ai: () => P(o).life <= 15 });
    if (letDraw) { log(`${P(o).name} lets ${P(c.ctrl).name} draw three.`); await drawCards(c.ctrl, 3); }
    else { const m = await mill(c.ctrl, 3); const dmg = m.reduce((a, x) => a + mv(x), 0); dealDamage(c, PL(o), dmg); log(`Combustible Gearhulk deals ${dmg} to ${P(o).name}.`, 'warn'); }
  },
});
C('Flayer of the Hatebound', {
  mc: '{5}{R}', colors: 'R', types: ['Creature'], sub: 'Devil', pt: [4, 2], role: 'creature',
  text: 'Undying (When this creature dies, if it had no +1/+1 counters on it, return it to the battlefield under its owner\'s control with a +1/+1 counter on it.)\nWhenever this creature or another creature enters from your graveyard, that creature deals damage equal to its power to any target.',
  on: {
    dies: async (s, { dead, lki }) => { if (dead === s && !(lki.counters.p1p1 > 0) && s.zone === 'gy') { log('Undying: Flayer of the Hatebound returns.'); await enterBF(s, s.owner, { fromZone: 'gy' }); addCounters(s, 'p1p1', 1); } },
    etb: async (s, { card, opts }) => {
      if (card.ctrl !== s.ctrl || !isCreature(card) || !opts || opts.fromZone !== 'gy' || card.owner !== s.ctrl) return;
      await trigger(s, s.ctrl, `${card.name} deals damage equal to its power`, async (ctx) => {
        const cs = opps(s.ctrl).flatMap(creatures).filter(c => canTarget(c, s.ctrl, card));
        const k = await chooseCard(s.ctrl, { prompt: `${card.name} deals ${pow(card)} damage: which creature? (cancel = an opponent)`, cands: cs, optional: true, ai: x => AIH.burnTarget(x, ctx, pow(card)) });
        addTarget(ctx, k || PL(pickOpp(s.ctrl))); ctx.noFizzle = true; return true;
      }, async (ctx) => { const t = ctx.targets[0]; if (tOK(ctx, t) && card.zone === 'bf') dealDamage(card, t, pow(card)); });
    },
  },
});
C('Ruin Grinder', {
  mc: '{5}{R}', colors: 'R', types: ['Artifact', 'Creature'], sub: 'Construct', pt: [7, 4], kw: ['menace'], role: 'creature',
  cycling: { mc: '{2}', label: 'Mountaincycling {2}: search for a Mountain card', search: c => (c.d.sub || '').split(' ').includes('Mountain') },
  text: 'Menace\nWhen this creature dies, each player may discard their hand and draw seven cards.\nMountaincycling {2}',
  on: {
    dies: async (s, { dead }) => {
      if (dead !== s) return;
      for (const pi of apnap()) {
        const pl = P(pi);
        if (await chooseYes(pi, { prompt: 'Ruin Grinder died: discard your hand and draw seven?', ai: () => pl.hand.length <= 3 })) { for (const c of pl.hand.slice()) await discardCard(pi, c); await drawCards(pi, 7); }
      }
    },
  },
});
C('Bedevil', {
  mc: '{B}{B}{R}', colors: 'BR', types: ['Instant'], role: 'removal', threat: 'destroy', text: 'Destroy target artifact, creature, or planeswalker.',
  choose: (ctx) => pickTarget(ctx, 'Destroy target artifact or creature', c => isCreature(c) || isArtifact(c)),
  spell: async (ctx) => { const t = ctx.targets[0]; if (tOK(ctx, t)) await destroy(t); },
});
C('Legions to Ashes', {
  mc: '{1}{W}{B}', colors: 'WB', types: ['Sorcery'], role: 'removal', threat: 'exile', text: 'Exile target nonland permanent an opponent controls and all tokens that player controls with the same name as that permanent.',
  choose: (ctx) => pickTarget(ctx, 'Exile target nonland permanent an opponent controls', c => !isLand(c) && c.ctrl !== ctx.p),
  spell: async (ctx) => { const t = ctx.targets[0]; if (!tOK(ctx, t)) return; const pi = t.ctrl, n = t.name; await exileC(t); for (const x of perms(pi).filter(x => x.token && x.name === n)) await exileC(x); },
});
C('Priest of Fell Rites', {
  mc: '{W}{B}', colors: 'WB', types: ['Creature'], sub: 'Human Warlock', pt: [2, 2], role: 'creature',
  text: '{T}, Pay 3 life, Sacrifice this creature: Return target creature card from your graveyard to the battlefield. Activate only as a sorcery.\nUnearth {3}{W}{B}',
  abilities: [
    {
      id: 'rite', label: '{T}, Pay 3 life, Sacrifice: return a creature card from your graveyard', cost: 0, tap: true, sacSelf: true, speed: 'sorcery',
      can: c => P(c.ctrl).gy.some(x => isCreature(x) && x !== c) && P(c.ctrl).life > 3,
      choose: async (ctx) => { const k = await chooseCard(ctx.p, { prompt: 'Return target creature card', cands: crCards(ctx.p), ai: cs => AIH.bestCard(cs) }); if (!k) return false; addTarget(ctx, k); loseLife(ctx.p, 3); return true; },
      resolve: async (ctx) => { const t = ctx.targets[0]; if (tOK(ctx, t)) await enterBF(t, ctx.p, { fromZone: 'gy' }); },
    },
    { id: 'unearth', label: 'Unearth {3}{W}{B}', cost: '{3}{W}{B}', fromGY: true, speed: 'sorcery', noStack: true, can: c => c.zone === 'gy', resolve: async (ctx) => { const c = ctx.card; if (c.zone !== 'gy') return; await enterBF(c, ctx.p, { fromZone: 'gy' }); c.perm.unearth = true; G.delayed.push({ at: 'endStep', fn: async () => { if (c.zone === 'bf' && c.perm.unearth) await exileC(c); } }); } },
  ],
});
C('Ruinous Ultimatum', {
  mc: '{R}{R}{W}{W}{W}{B}{B}', colors: 'RWB', types: ['Sorcery'], role: 'wipe', text: 'Destroy all nonland permanents your opponents control.',
  spell: async (ctx) => { await destroyMany(opps(ctx.p).flatMap(perms).filter(c => !isLand(c))); },
});
C('Solemn Simulacrum', {
  mc: '{4}', types: ['Artifact', 'Creature'], sub: 'Golem', pt: [2, 2], role: 'ramp',
  text: 'When this creature enters, you may search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.\nWhen this creature dies, you may draw a card.',
  etb: async (c) => { await fetchBasicsToBF(c.ctrl, 1, { tapped: true }); },
  on: { dies: async (s, { dead, lki }) => { if (dead === s) await drawCards(lki.ctrl, 1); } },
});
C('Phoenix Down', {
  mc: '{W}', colors: 'W', types: ['Artifact'], role: 'recursion',
  text: '{1}{W}, {T}, Exile this artifact: Choose one —\n• Return target creature card with mana value 4 or less from your graveyard to the battlefield tapped.\n• Exile target Skeleton, Spirit, or Zombie.',
  abilities: [{
    id: 'down', label: '{1}{W}, {T}, Exile: return a creature card (MV 4 or less) tapped, or exile a Skeleton/Spirit/Zombie', cost: '{1}{W}', tap: true, speed: 'instant',
    can: c => P(c.ctrl).gy.some(x => isCreature(x) && mv(x) <= 4) || allCreatures().some(x => ['Skeleton', 'Spirit', 'Zombie'].some(t => hasSub(x, t)) && x.ctrl !== c.ctrl),
    choose: async (ctx) => {
      const gy = crCards(ctx.p).filter(x => mv(x) <= 4);
      const undead = allCreatures().filter(x => ['Skeleton', 'Spirit', 'Zombie'].some(t => hasSub(x, t)) && canTarget(x, ctx.p, ctx.card));
      const m = await chooseOpt(ctx.p, { prompt: 'Phoenix Down: choose one', opts: [{ label: 'Return a creature card (MV 4 or less) tapped', value: 'ret', disabled: !gy.length }, { label: 'Exile target Skeleton, Spirit, or Zombie', value: 'ex', disabled: !undead.length }], ai: () => (gy.length ? 'ret' : 'ex') });
      if (!m) return false; ctx.mode = m;
      if (m === 'ret') { const k = await chooseCard(ctx.p, { prompt: 'Return which creature card?', cands: gy, ai: cs => AIH.bestCard(cs) }); if (!k) return false; addTarget(ctx, k); }
      else { const k = await chooseCard(ctx.p, { prompt: 'Exile which creature?', cands: undead, ai: cs => AIH.oppThreat(cs, ctx) }); if (!k) return false; addTarget(ctx, k); }
      return true;
    },
    preCost: async (ctx) => { await exileC(ctx.card); },
    resolve: async (ctx) => { const t = ctx.targets[0]; if (!tOK(ctx, t)) return; if (ctx.mode === 'ret') await enterBF(t, ctx.p, { tapped: true, fromZone: 'gy' }); else await exileC(t); },
  }],
});
C('Angel of the Ruins', {
  mc: '{5}{W}{W}', colors: 'W', types: ['Artifact', 'Creature'], sub: 'Angel', pt: [5, 7], kw: ['flying'], role: 'creature',
  cycling: { mc: '{2}', label: 'Plainscycling {2}: search for a Plains card', search: c => (c.d.sub || '').split(' ').includes('Plains') },
  text: 'Flying\nWhen this creature enters, exile up to two target artifacts and/or enchantments.\nPlainscycling {2}',
  etb: async (c) => {
    await trigger(c, c.ctrl, 'exile up to two artifacts/enchantments', async (ctx) => {
      for (let i = 0; i < 2; i++) await pickTarget(ctx, 'Exile target artifact or enchantment (optional)', x => (isArtifact(x) || isEnchantment(x)) && x !== c, cs => { const o = cs.filter(x => x.ctrl !== ctx.p); return o.length ? AIH.bestCard(o) : null; }, true);
      return ctx.targets.length > 0;
    }, async (ctx) => { for (const t of ctx.targets) if (tOK(ctx, t)) await exileC(t); });
  },
});
C('Palace Jailer', {
  mc: '{2}{W}{W}', colors: 'W', types: ['Creature'], sub: 'Human Soldier', pt: [2, 2], role: 'creature', removalETB: true,
  text: 'When this creature enters, you become the monarch.\nWhen this creature enters, exile target creature an opponent controls until an opponent becomes the monarch.',
  etb: async (c) => {
    setMonarch(c.ctrl);
    await trigger(c, c.ctrl, 'exile target creature until an opponent becomes the monarch', (ctx) => pickTarget(ctx, 'Exile target creature an opponent controls', x => isCreature(x) && x.ctrl !== c.ctrl), async (ctx) => {
      const t = ctx.targets[0]; if (!tOK(ctx, t)) return;
      await exileC(t);
      if (!t.isCmd || t.zone === 'exile') { G.jailed = G.jailed || []; G.jailed.push({ card: t, by: c.ctrl }); }
    });
  },
});
C('Stitch Together', {
  mc: '{B}{B}', colors: 'B', types: ['Sorcery'], role: 'recursion', text: 'Return target creature card from your graveyard to your hand.\nThreshold — Return that card from your graveyard to the battlefield instead if there are seven or more cards in your graveyard.',
  canCast: (ctx) => crCards(ctx.p).length > 0,
  choose: async (ctx) => { const k = await chooseCard(ctx.p, { prompt: 'Target creature card in your graveyard', cands: crCards(ctx.p), ai: cs => AIH.bestCard(cs) }); if (!k) return false; addTarget(ctx, k); return true; },
  spell: async (ctx) => { const t = ctx.targets[0]; if (!tOK(ctx, t)) return; if (P(ctx.p).gy.length >= 7) await enterBF(t, ctx.p, { fromZone: 'gy' }); else { moveTo(t, 'hand'); log(`${t.name} returns to hand.`); } },
});
C("Stitcher's Supplier", {
  mc: '{B}', colors: 'B', types: ['Creature'], sub: 'Zombie', pt: [1, 1], role: 'creature', text: 'When this creature enters or dies, mill three cards.',
  etb: async (c) => { await mill(c.ctrl, 3); },
  on: { dies: async (s, { dead, lki }) => { if (dead === s) await mill(lki.ctrl, 3); } },
});
C('Anger', { mc: '{3}{R}', colors: 'R', types: ['Creature'], sub: 'Incarnation', pt: [2, 2], kw: ['haste'], role: 'creature', text: 'Haste\nAs long as this card is in your graveyard and you control a Mountain, creatures you control have haste.' });
C('Crackling Doom', {
  mc: '{R}{W}{B}', colors: 'RWB', types: ['Instant'], role: 'removal', threat: 'edict', text: 'Crackling Doom deals 2 damage to each opponent. Each opponent sacrifices a creature with the greatest power among creatures that player controls.',
  spell: async (ctx) => {
    for (const o of opps(ctx.p)) {
      dealDamage(ctx.card, PL(o), 2);
      const cs = creatures(o); if (!cs.length) continue;
      const top = Math.max(...cs.map(pow));
      const big = cs.filter(c => pow(c) === top);
      const k = big.length === 1 ? big[0] : await chooseCard(o, { prompt: 'Crackling Doom: sacrifice one of your greatest-power creatures', cands: big, ai: x => AIH.weakest(x) });
      if (k) await sacrifice(k);
    }
  },
});

/* ---------------- graveyard upgrades ---------------- */
C('Entomb', {
  mc: '{B}', colors: 'B', types: ['Instant'], role: 'tutor', text: 'Search your library for a card, put that card into your graveyard, then shuffle.',
  spell: async (ctx) => { const p = await searchLibrary(ctx.p, () => true, { prompt: 'Entomb: put a card into your graveyard', ai: cs => [AIH.reanimateTarget(ctx.p, cs.filter(isCreature)) || cs[0]] }); for (const c of p) { moveTo(c, 'gy'); log(`${P(ctx.p).name} puts ${c.name} into their graveyard.`); } },
});
C('Buried Alive', {
  mc: '{2}{B}', colors: 'B', types: ['Sorcery'], role: 'tutor', text: 'Search your library for up to three creature cards, put them into your graveyard, then shuffle.',
  spell: async (ctx) => { const p = await searchLibrary(ctx.p, isCreature, { prompt: 'Buried Alive: up to three creature cards', max: 3, ai: cs => AIH.sortCards(cs).slice(0, 3) }); for (const c of p) moveTo(c, 'gy'); if (p.length) log(`${P(ctx.p).name} buries ${p.map(c => c.name).join(', ')}.`); },
});
C('Exhume', {
  mc: '{1}{B}', colors: 'B', types: ['Sorcery'], role: 'recursion', text: 'Each player puts a creature card from their graveyard onto the battlefield.',
  canCast: (ctx) => crCards(ctx.p).length > 0,
  spell: async (ctx) => {
    for (const pi of apnap()) {
      const cs = crCards(pi); if (!cs.length) continue;
      const k = await chooseCard(pi, { prompt: 'Exhume: put a creature card from your graveyard onto the battlefield', cands: cs, ai: x => AIH.bestCard(x) });
      if (k) await enterBF(k, pi, { fromZone: 'gy' });
    }
  },
});
C('Persist', {
  mc: '{1}{B}', colors: 'B', types: ['Sorcery'], role: 'recursion', text: 'Return target nonlegendary creature card from your graveyard to the battlefield with a -1/-1 counter on it.',
  canCast: (ctx) => crCards(ctx.p).some(c => !isLegendary(c)),
  choose: async (ctx) => { const k = await chooseCard(ctx.p, { prompt: 'Target nonlegendary creature card', cands: crCards(ctx.p).filter(c => !isLegendary(c)), ai: cs => AIH.bestCard(cs) }); if (!k) return false; addTarget(ctx, k); return true; },
  spell: async (ctx) => { const t = ctx.targets[0]; if (!tOK(ctx, t)) return; await enterBF(t, ctx.p, { fromZone: 'gy' }); addCounters(t, 'm1m1', 1); },
});
C('Victimize', {
  mc: '{2}{B}', colors: 'B', types: ['Sorcery'], role: 'recursion', text: 'Choose two target creature cards in your graveyard. Sacrifice a creature. If you do, return the chosen cards to the battlefield tapped.',
  canCast: (ctx) => crCards(ctx.p).length >= 2 && creatures(ctx.p).length > 0,
  choose: async (ctx) => { const ks = await chooseCards(ctx.p, { prompt: 'Choose two target creature cards in your graveyard', cands: crCards(ctx.p), min: 2, max: 2, ai: cs => AIH.sortCards(cs).slice(0, 2) }); if (ks.length < 2) return false; ks.forEach(k => addTarget(ctx, k)); return true; },
  spell: async (ctx) => {
    const cs = creatures(ctx.p); if (!cs.length) return;
    const s = await chooseCard(ctx.p, { prompt: 'Victimize: sacrifice a creature', cands: cs, ai: x => AIH.weakest(x) });
    if (!s) return; await sacrifice(s);
    for (const t of ctx.targets) if (tOK(ctx, t)) await enterBF(t, ctx.p, { tapped: true, fromZone: 'gy' });
  },
});
C('Living Death', {
  mc: '{3}{B}{B}', colors: 'B', types: ['Sorcery'], role: 'wipe', text: 'Each player exiles all creature cards from their graveyard, then sacrifices all creatures they control, then puts all cards they exiled this way onto the battlefield.',
  spell: async () => {
    const back = {};
    for (const pi of apnap()) { back[pi] = crCards(pi); for (const c of back[pi]) moveTo(c, 'exile'); }
    await killBatch(allCreatures(), 'sac');
    for (const pi of apnap()) for (const c of back[pi]) if (c.zone === 'exile') await enterBF(c, pi, { fromZone: 'exile' });
    log('Living Death: graveyards and battlefields swap.', 'big');
  },
});
C('Unburial Rites', {
  mc: '{4}{B}', colors: 'B', types: ['Sorcery'], role: 'recursion', flashbackMC: '{3}{W}', text: 'Return target creature card from your graveyard to the battlefield.\nFlashback {3}{W}',
  canCast: (ctx) => crCards(ctx.p).length > 0,
  choose: async (ctx) => { const k = await chooseCard(ctx.p, { prompt: 'Target creature card in your graveyard', cands: crCards(ctx.p), ai: cs => AIH.bestCard(cs) }); if (!k) return false; addTarget(ctx, k); return true; },
  spell: async (ctx) => { const t = ctx.targets[0]; if (tOK(ctx, t)) await enterBF(t, ctx.p, { fromZone: 'gy' }); },
});
C('Sheoldred, Whispering One', {
  mc: '{5}{B}{B}', colors: 'B', types: ['Legendary', 'Creature'], sub: 'Phyrexian Praetor', pt: [6, 6], kw: ['swampwalk'], role: 'creature',
  text: "Swampwalk\nAt the beginning of your upkeep, return target creature card from your graveyard to the battlefield.\nAt the beginning of each opponent's upkeep, that player sacrifices a creature of their choice.",
  on: {
    upkeep: async (s, { pi }) => {
      if (pi === s.ctrl) {
        if (!crCards(pi).length) return;
        await trigger(s, pi, 'return a creature card', async (ctx) => { const k = await chooseCard(pi, { prompt: 'Sheoldred: return target creature card', cands: crCards(pi), ai: cs => AIH.bestCard(cs) }); if (!k) return false; addTarget(ctx, k); return true; }, async (ctx) => { const t = ctx.targets[0]; if (tOK(ctx, t)) await enterBF(t, pi, { fromZone: 'gy' }); });
      } else if (opps(s.ctrl).includes(pi)) {
        const cs = creatures(pi); if (!cs.length) return;
        const k = await chooseCard(pi, { prompt: 'Sheoldred: sacrifice a creature', cands: cs, ai: x => AIH.weakest(x) });
        if (k) await sacrifice(k);
      }
    },
  },
});
async function archonTrigger(s) {
  await trigger(s, s.ctrl, 'opponent sacrifices, discards, loses 3', (ctx) => { addTarget(ctx, PL(pickOpp(s.ctrl))); return true; }, async (ctx) => {
    const t = ctx.targets[0]; if (!tOK(ctx, t)) return;
    const o = t.pi;
    const cs = creatures(o);
    if (cs.length) { const k = await chooseCard(o, { prompt: 'Archon of Cruelty: sacrifice a creature', cands: cs, ai: x => AIH.weakest(x) }); if (k) await sacrifice(k); }
    await discardN(o, 1, { prompt: 'Archon of Cruelty: discard a card' });
    loseLife(o, 3);
    await drawCards(s.ctrl, 1); gainLife(s.ctrl, 3);
    log(`Archon of Cruelty: ${P(o).name} loses 3, ${P(s.ctrl).name} draws and gains 3.`, 'warn');
  });
}
C('Archon of Cruelty', {
  mc: '{6}{B}{B}', colors: 'B', types: ['Creature'], sub: 'Archon', pt: [6, 6], kw: ['flying'], role: 'creature',
  text: 'Flying\nWhenever this creature enters or attacks, target opponent sacrifices a creature or planeswalker of their choice, discards a card, and loses 3 life. You draw a card and gain 3 life.',
  etb: async (c) => { await archonTrigger(c); },
  on: { attacks: async (s, { attacker }) => { if (attacker === s) await archonTrigger(s); } },
});
C('Deadly Rollick', {
  mc: '{3}{B}', colors: 'B', types: ['Instant'], role: 'removal', threat: 'exile', freeWithCommander: true,
  text: 'If you control a commander, you may cast this spell without paying its mana cost.\nExile target creature.',
  choose: async (ctx) => { if (!(await pickTarget(ctx, 'Exile target creature', anyCreature()))) return false; if (controlsCommander(ctx.p)) ctx.free = true; return true; },
  spell: async (ctx) => { const t = ctx.targets[0]; if (tOK(ctx, t)) await exileC(t); },
});
