'use strict';
/* =====================================================================
   Card scripts: Wakanda Forever (Marvel Super Heroes Commander) precon,
   T'Challa, the Black Panther. Oracle text from MTGJSON.
   ===================================================================== */
const bigArtifactSpell = (card) => isArtifact(card) && mv(card) >= 4;
const isCommanderOf = (c, pi) => c.isCmd && c.owner === pi;

C('Vibranium', { token: true, types: ['Artifact'], sub: 'Vibranium', kw: ['indestructible'], mana: 1, artOnly: true, text: 'Indestructible\n{T}: Add {C}. This mana can\'t be spent to cast a nonartifact spell.' });
C('Soldier', { token: true, colors: 'W', types: ['Creature'], sub: 'Soldier', pt: [1, 1], text: '' });
C('Rhino', { token: true, colors: 'G', types: ['Creature'], sub: 'Rhino', pt: [4, 4], kw: ['trample'], text: 'Trample' });
C('Elephant', { token: true, colors: 'G', types: ['Creature'], sub: 'Elephant', pt: [3, 3], text: '' });
C('Beast', { token: true, colors: 'G', types: ['Creature'], sub: 'Beast', pt: [3, 3], text: '' });
const vibranium = (pi, n = 1) => createToken(pi, 'Vibranium', n, { tapped: true });

/* ---------------- commander ---------------- */
C("T'Challa, the Black Panther", {
  mc: '{1}{G}{W}', colors: 'GW', types: ['Legendary', 'Creature'], sub: 'Human Noble Hero', pt: [2, 2], role: 'creature',
  text: 'Whenever T\'Challa enters or attacks, create a tapped Vibranium token. (It\'s an artifact with indestructible and "{T}: Add {C}. This mana can\'t be spent to cast a nonartifact spell.")\nWhenever you cast an artifact spell with mana value 4 or greater, put two +1/+1 counters on T\'Challa.',
  etb: async (c) => { await vibranium(c.ctrl); },
  on: {
    attacks: async (s, { attacker }) => { if (attacker === s) await vibranium(s.ctrl); },
    cast: async (s, { pi, card }) => { if (pi === s.ctrl && bigArtifactSpell(card)) { addCounters(s, 'p1p1', 2); log("T'Challa gets two +1/+1 counters."); } },
  },
});

/* ---------------- creatures ---------------- */
C('Dora Milaje Elite', {
  mc: '{1}{W}', colors: 'W', types: ['Creature'], sub: 'Human Warrior', pt: [2, 2], kw: ['firststrike'], role: 'creature', protectAbility: 'legend',
  text: 'First strike\nWhen this creature enters, if an opponent controls more lands than you, create a tapped Vibranium token.\nSacrifice this creature: Legendary permanents you control gain indestructible until end of turn.',
  etb: async (c) => { const mine = perms(c.ctrl).filter(isLand).length; if (opps(c.ctrl).some(o => perms(o).filter(isLand).length > mine)) await vibranium(c.ctrl); },
  abilities: [{ id: 'sac', label: 'Sacrifice: legendary permanents you control gain indestructible', cost: 0, speed: 'instant', sacSelf: true, resolve: async (ctx) => { for (const c of perms(ctx.p).filter(isLegendary)) tmpAdd(c, { kw: ['indestructible'] }); } }],
});
C('Queen Mother Ramonda', {
  mc: '{3}{W}{W}', colors: 'W', types: ['Legendary', 'Creature'], sub: 'Human Noble', pt: [3, 5], role: 'creature',
  text: "When Queen Mother Ramonda enters, you become the monarch.\nAs long as you're the monarch, creatures with power 2 or less can't attack you.",
  etb: async (c) => { setMonarch(c.ctrl); },
});
C("M'Baku, Jabari Chieftain", {
  mc: '{1}{G}{G}', colors: 'G', types: ['Legendary', 'Creature'], sub: 'Human Noble Warrior', pt: [4, 3], role: 'creature',
  text: 'At the beginning of your end step, if there is no monarch, target opponent becomes the monarch.\nWhenever a creature attacks one of your opponents, if that player is the monarch, that creature gets +1/+1 and gains trample until end of turn.',
  on: {
    endStep: async (s, { pi }) => { if (pi === s.ctrl && G.monarch == null && opps(pi).length) setMonarch(pickOpp(pi)); },
    attacks: async (s, { attacker }) => { if (G.combat && opps(s.ctrl).includes(G.combat.dp) && G.monarch === G.combat.dp) tmpAdd(attacker, { p: 1, t: 1, kw: ['trample'] }); },
  },
});
C('Nakia, Wakandan Operative', {
  mc: '{2}{G}', colors: 'G', types: ['Legendary', 'Creature'], sub: 'Human Warrior Hero', pt: [3, 3], kw: ['reach'], role: 'creature',
  text: 'Reach\nWhenever your commander enters, you become the monarch.\n{2}, {T}: Put two +1/+1 counters on target creature or Vehicle. Activate only as a sorcery.',
  on: { etb: async (s, { card }) => { if (isCommanderOf(card, s.ctrl) && card.ctrl === s.ctrl) setMonarch(s.ctrl); } },
  abilities: [{ id: 'grow', label: '{2}, {T}: two +1/+1 counters on target creature or Vehicle', cost: 2, tap: true, speed: 'sorcery', choose: (ctx) => pickTarget(ctx, 'Target creature or Vehicle', c => isCreature(c) || hasType(c, 'Vehicle'), cs => AIH.ownBest(cs, ctx)), resolve: async (ctx) => { const t = ctx.targets[0]; if (tOK(ctx, t)) addCounters(t, 'p1p1', 2); } }],
});
C("W'Kabi, Shield of the Nation", {
  mc: '{1}{G}', colors: 'G', types: ['Legendary', 'Creature'], sub: 'Human Warrior Hero', pt: [2, 3], kw: ['vigilance'], role: 'creature',
  text: 'Vigilance\nWhenever you attack with your commander, if you control an artifact with mana value 4 or greater, create a 4/4 green Rhino creature token with trample.',
  on: { attackDeclared: async (s, { pi, attackers }) => { if (pi === s.ctrl && attackers.some(a => isCommanderOf(a, pi)) && artifactsOf(pi).some(a => mv(a) >= 4)) await createToken(pi, 'Rhino', 1); } },
});
C('Zuri, Warrior of Wakanda', {
  mc: '{1}{G}', colors: 'G', types: ['Legendary', 'Creature'], sub: 'Human Warrior Hero', pt: [2, 2], kw: ['trample'], role: 'creature',
  text: 'Trample\nWhenever you cast an artifact spell with mana value 4 or greater, put a +1/+1 counter on each creature you control.',
  on: { cast: async (s, { pi, card }) => { if (pi === s.ctrl && bigArtifactSpell(card)) { for (const c of creatures(pi)) addCounters(c, 'p1p1', 1); log('Zuri: +1/+1 counter on each creature.'); } } },
});
C('Bast, Panther Goddess', {
  mc: '{2}{G}{W}', colors: 'GW', types: ['Legendary', 'Creature'], sub: 'Cat God', pt: [4, 4], kw: ['reach', 'trample', 'indestructible'], role: 'creature',
  text: "Reach, trample, indestructible\nBast can't attack or block unless you control three or more creatures.\nWhenever you attack, target attacking creature gets +X/+X until end of turn, where X is the number of creatures you control.",
  attackIf: (c) => creatures(c.ctrl).length >= 3,
  blockIf: (c) => creatures(c.ctrl).length >= 3,
  on: {
    attackDeclared: async (s, { pi, attackers }) => {
      if (pi !== s.ctrl) return;
      await trigger(s, pi, 'target attacking creature gets +X/+X', (ctx) => pickTarget(ctx, 'Target attacking creature', c => attackers.includes(c), cs => AIH.biggest(cs)), async (ctx) => { const t = ctx.targets[0]; const x = creatures(pi).length; if (tOK(ctx, t)) tmpAdd(t, { p: x, t: x }); });
    },
  },
});
C('Okoye, Mighty and Adored', {
  mc: '{2}{G}{W}', colors: 'GW', types: ['Legendary', 'Creature'], sub: 'Human Warrior Hero', pt: [3, 3], role: 'creature',
  text: 'When Okoye enters, you become the monarch.\nAt the beginning of combat on your turn, put a +1/+1 counter on target creature. Whenever that creature attacks the monarch this turn, it gains double strike and trample until end of turn.',
  etb: async (c) => { setMonarch(c.ctrl); },
  on: {
    beginCombat: async (s, { pi }) => {
      if (pi !== s.ctrl) return;
      await trigger(s, pi, '+1/+1 counter on target creature', (ctx) => pickTarget(ctx, 'Put a +1/+1 counter on target creature', anyCreature(), cs => AIH.ownBest(cs, ctx)), async (ctx) => { const t = ctx.targets[0]; if (tOK(ctx, t)) { addCounters(t, 'p1p1', 1); t.tmp.okoye = true; } });
    },
    attacks: async (s, { attacker }) => { if (attacker.tmp.okoye && G.combat && G.monarch === G.combat.dp) tmpAdd(attacker, { kw: ['doublestrike', 'trample'] }); },
  },
});
C('Shuri, the Black Panther', {
  mc: '{G}{W}', colors: 'GW', types: ['Legendary', 'Creature'], sub: 'Human Noble Hero', pt: [2, 3], kw: ['lifelink'], role: 'creature',
  text: 'Lifelink\nWhenever Shuri attacks, draw a card if you control three or more artifacts. Then if you control six or more artifacts, creatures you control get +2/+2 until end of turn.',
  on: { attacks: async (s, { attacker }) => { if (attacker !== s) return; const n = artifactsOf(s.ctrl).length; if (n >= 3) await drawCards(s.ctrl, 1); if (n >= 6) for (const c of creatures(s.ctrl)) tmpAdd(c, { p: 2, t: 2 }); } },
});
C('Storm, Queen of Wakanda', {
  mc: '{3}{G}{W}', colors: 'GW', types: ['Legendary', 'Creature'], sub: 'Mutant Noble Hero', pt: [4, 5], kw: ['flying'], role: 'creature',
  text: "Flying\nWhenever Storm attacks, until end of turn, another target attacking creature gains flying and gets +X/+0, where X is Storm's power.\nWhenever a creature with flying attacks you, Storm deals damage equal to her power to that creature.",
  on: {
    attacks: async (s, { attacker, pi }) => {
      if (attacker === s) {
        const others = G.combat ? G.combat.atk.map(a => a.c).filter(c => c !== s) : [];
        if (!others.length) return;
        await trigger(s, s.ctrl, 'another attacker gains flying and +X/+0', (ctx) => pickTarget(ctx, 'Another target attacking creature', c => others.includes(c), cs => AIH.biggest(cs)), async (ctx) => { const t = ctx.targets[0]; if (tOK(ctx, t)) tmpAdd(t, { p: pow(s), kw: ['flying'] }); });
      } else if (G.combat && G.combat.dp === s.ctrl && has(attacker, 'flying')) {
        dealDamage(s, attacker, pow(s)); log(`Storm deals ${pow(s)} to ${attacker.name}.`);
      }
    },
  },
});
C("T'Chaka, Venerable King", {
  mc: '{G}{W}', colors: 'GW', types: ['Legendary', 'Creature'], sub: 'Human Noble Hero', pt: [2, 2], role: 'creature',
  text: 'When T\'Chaka enters, mill three cards, then you may put an artifact or land card from among the milled cards into your hand.\n{3}, Exile this card from your graveyard: You become the monarch. Activate only if you control your commander.',
  etb: async (c) => { const m = await mill(c.ctrl, 3); const k = await chooseCard(c.ctrl, { prompt: 'Put an artifact or land card into your hand (optional)', cands: m.filter(x => isArtifact(x) || isLand(x)), optional: true, ai: cs => AIH.bestCard(cs) }); if (k) moveTo(k, 'hand'); },
  abilities: [{ id: 'mon', label: '{3}, Exile from graveyard: become the monarch', cost: 3, fromGY: true, speed: 'instant', noStack: true, can: c => c.zone === 'gy' && controlsCommander(c.owner) && G.monarch !== c.owner, resolve: async (ctx) => { if (ctx.card.zone !== 'gy') return; moveTo(ctx.card, 'exile'); setMonarch(ctx.p); } }],
});
C('Loyal Guardian', {
  mc: '{4}{G}', colors: 'G', types: ['Creature'], sub: 'Rhino', pt: [4, 4], kw: ['trample'], role: 'creature',
  text: 'Trample\nLieutenant — At the beginning of combat on your turn, if you control your commander, put a +1/+1 counter on each creature you control.',
  on: { beginCombat: async (s, { pi }) => { if (pi === s.ctrl && controlsCommander(pi)) { for (const c of creatures(pi)) addCounters(c, 'p1p1', 1); log('Loyal Guardian: +1/+1 counter on each creature.'); } } },
});
C('Fleecemane Lion', {
  mc: '{G}{W}', colors: 'GW', types: ['Creature'], sub: 'Cat', pt: [3, 3], role: 'creature',
  text: '{3}{G}{W}: Monstrosity 1. (If this creature isn\'t monstrous, put a +1/+1 counter on it and it becomes monstrous.)\nAs long as this creature is monstrous, it has hexproof and indestructible.',
  self: (c) => (c.perm && c.perm.monstrous ? { kw: ['hexproof', 'indestructible'] } : null),
  abilities: [{ id: 'mon', label: '{3}{G}{W}: Monstrosity 1', cost: '{3}{G}{W}', speed: 'instant', can: c => !c.perm.monstrous, resolve: async (ctx) => { const c = ctx.card; if (c.zone !== 'bf' || c.perm.monstrous) return; addCounters(c, 'p1p1', 1); c.perm.monstrous = true; log('Fleecemane Lion becomes monstrous.'); } }],
});
C('Birds of Paradise', { mc: '{G}', colors: 'G', types: ['Creature'], sub: 'Bird', pt: [0, 1], kw: ['flying'], mana: 1, prod: ['WUBRG'], role: 'ramp', text: 'Flying\n{T}: Add one mana of any color.' });
C('Panther Robot', { mc: '{10}', types: ['Artifact', 'Creature'], sub: 'Cat Robot', pt: [8, 8], kw: ['reach', 'trample'], role: 'creature', costMod: (c, pi) => -artifactsOf(pi).length, text: 'Affinity for artifacts\nReach, trample' });

/* ---------------- artifacts and vehicles ---------------- */
C('Midnight Angel Armor', {
  mc: '{3}{W}{W}', colors: 'W', types: ['Artifact', 'Equipment'], equip: 3, role: 'equipment',
  text: 'When this Equipment enters, create a 1/1 white Soldier creature token, then attach this Equipment to it.\nEquipped creature gets +3/+3 and has flying and vigilance.\nEquip {3}',
  etb: async (c) => { const [t] = await createToken(c.ctrl, 'Soldier', 1); if (t && t.zone === 'bf') attach(c, t); },
  attachBuff: () => ({ p: 3, t: 3, kw: ['flying', 'vigilance'] }),
});
C('Royal Talon Fighter Jet', {
  mc: '{X}{W}{W}', colors: 'W', types: ['Artifact', 'Vehicle'], sub: 'Vehicle', pt: [1, 1], kw: ['flying'], crew: 2, role: 'tokens',
  text: 'Flying\nThis Vehicle enters with X +1/+1 counters on it.\nWhenever this Vehicle enters or attacks, create a number of 1/1 white Soldier creature tokens equal to the number of +1/+1 counters on it.\nCrew 2',
  choose: async (ctx) => { const max = manaAvail(ctx.p, { artifact: true }) - 2; if (max < 1) return false; const x = await chooseNumber(ctx.p, { prompt: 'Choose X', min: 1, max, ai: (a, b) => b }); if (x == null) return false; ctx.x = x; return true; },
  etb: async (c, opts) => { if (opts.x) addCounters(c, 'p1p1', opts.x); await createToken(c.ctrl, 'Soldier', c.counters.p1p1 || 0); },
  on: { attacks: async (s, { attacker }) => { if (attacker === s) await createToken(s.ctrl, 'Soldier', s.counters.p1p1 || 0); } },
});
C('The Spear of Bashenga', {
  mc: '{4}{W}', colors: 'W', types: ['Legendary', 'Artifact', 'Equipment'], equip: 2, role: 'equipment',
  text: 'When The Spear of Bashenga enters, if there is no monarch, you become the monarch.\nEquipped creature gets +2/+2 and has vigilance.\nWhenever equipped creature attacks the monarch, destroy target tapped nonland permanent that player controls.\nEquip {2}',
  etb: async (c) => { if (G.monarch == null) setMonarch(c.ctrl); },
  attachBuff: () => ({ p: 2, t: 2, kw: ['vigilance'] }),
  on: {
    attacks: async (s, { attacker }) => {
      if (s.attachedTo !== attacker.id || !G.combat || G.monarch !== G.combat.dp) return;
      const dp = G.combat.dp;
      await trigger(s, s.ctrl, 'destroy target tapped nonland permanent', (ctx) => pickTarget(ctx, 'Destroy target tapped nonland permanent', c => c.ctrl === dp && c.tapped && !isLand(c), cs => AIH.bestCard(cs)), async (ctx) => { const t = ctx.targets[0]; if (tOK(ctx, t)) await destroy(t); });
    },
  },
});
C("N'Yami-Class Mother Ship", {
  mc: '{6}', types: ['Artifact', 'Vehicle'], sub: 'Vehicle', pt: [5, 7], kw: ['flying', 'vigilance', 'haste'], crew: 3, role: 'creature',
  text: 'Flying, vigilance, haste\nWhenever this Vehicle deals combat damage to a player, look at the top card of your library. If it\'s a permanent card, you may put it onto the battlefield. If you don\'t put it onto the battlefield, put it into your hand.\nCrew 3',
  on: { combatDamagePlayer: async (s, { src }) => { if (src !== s) return; const lib = P(s.ctrl).library; const top = lib[lib.length - 1]; if (!top) return; if (isPermanentCard(top) && await chooseYes(s.ctrl, { prompt: `Put ${top.name} onto the battlefield? (No = into your hand)`, card: top, ai: () => true })) await enterBF(top, s.ctrl, {}); else { moveTo(top, 'hand'); log(`${P(s.ctrl).name} puts the top card into their hand.`); } } },
});
C("Shuri's Fabricator", {
  mc: '{4}', types: ['Artifact'], role: 'ramp',
  text: 'When this artifact enters, create two tapped Vibranium tokens.\n{6}, {T}: Return target artifact card from your graveyard to the battlefield with a finality counter on it. Activate only as a sorcery.',
  etb: async (c) => { await vibranium(c.ctrl, 2); },
  abilities: [{ id: 'fab', label: '{6}, {T}: return an artifact card from your graveyard (finality counter)', cost: 6, tap: true, speed: 'sorcery', can: c => P(c.ctrl).gy.some(isArtifact), choose: async (ctx) => { const k = await chooseCard(ctx.p, { prompt: 'Target artifact card in your graveyard', cands: P(ctx.p).gy.filter(isArtifact), ai: cs => AIH.bestCard(cs) }); if (!k) return false; addTarget(ctx, k); return true; }, resolve: async (ctx) => { const t = ctx.targets[0]; if (!tOK(ctx, t)) return; await enterBF(t, ctx.p, { fromZone: 'gy' }); t.perm.finality = true; addCounters(t, 'finality', 1); } }],
});
C('Vibranium Mining Mech', {
  mc: '{4}', types: ['Artifact', 'Vehicle'], sub: 'Vehicle', pt: [6, 6], kw: ['trample'], crew: 2, role: 'creature',
  text: 'Trample\nWhenever this Vehicle enters or attacks, create a tapped Vibranium token.\n{2}: This Vehicle gets +1/+0 until end of turn.\nCrew 2',
  etb: async (c) => { await vibranium(c.ctrl); },
  on: { attacks: async (s, { attacker }) => { if (attacker === s) await vibranium(s.ctrl); } },
  abilities: [{ id: 'pump', label: '{2}: +1/+0', cost: 2, speed: 'instant', hideFromAutoStop: true, resolve: async (ctx) => { if (ctx.card.zone === 'bf') tmpAdd(ctx.card, { p: 1 }); } }],
});
C('Vibranium Strike Gauntlets', {
  mc: '{4}', types: ['Artifact', 'Equipment'], flash: true, equip: 3, role: 'equipment',
  text: 'Flash\nWhen this Equipment enters, attach it to target creature you control.\nEquipped creature gets +3/+0 and has trample and "Whenever this creature deals combat damage to a player, draw a card."\nEquip {3}',
  etb: async (c) => { await trigger(c, c.ctrl, 'attach to target creature you control', (ctx) => pickTarget(ctx, 'Attach to target creature you control', x => isCreature(x) && x.ctrl === c.ctrl, cs => AIH.equipTarget(c, cs)), async (ctx) => { const t = ctx.targets[0]; if (tOK(ctx, t)) attach(c, t); }); },
  attachBuff: () => ({ p: 3, kw: ['trample'] }),
  on: { combatDamagePlayer: async (s, { src }) => { if (s.attachedTo === src.id) await drawCards(s.ctrl, 1); } },
});
C('Hammer of Nazahn', {
  mc: '{4}', types: ['Legendary', 'Artifact', 'Equipment'], equip: 4, role: 'equipment',
  text: 'Whenever Hammer of Nazahn or another Equipment you control enters, you may attach that Equipment to target creature you control.\nEquipped creature gets +2/+0 and has indestructible.\nEquip {4}',
  attachBuff: () => ({ p: 2, kw: ['indestructible'] }),
  on: { etb: async (s, { card }) => { if (card.ctrl !== s.ctrl || !isEquipment(card)) return; await trigger(s, s.ctrl, `attach ${card.name}`, async (ctx) => { await pickTarget(ctx, `Attach ${card.name} to target creature you control (optional)`, c => isCreature(c) && c.ctrl === s.ctrl, cs => AIH.equipTarget(card, cs), true); return ctx.targets.length > 0; }, async (ctx) => { const t = ctx.targets[0]; if (tOK(ctx, t) && card.zone === 'bf') attach(card, t); }); } },
});
C('Gilded Lotus', { mc: '{5}', types: ['Artifact'], mana: 3, prod: ['WUBRG', 'WUBRG', 'WUBRG'], role: 'ramp', text: '{T}: Add three mana of any one color.' });
C('Thran Dynamo', { mc: '{4}', types: ['Artifact'], mana: 3, colorlessMana: true, role: 'ramp', text: '{T}: Add {C}{C}{C}.' });
C('The Great Mound', {
  types: ['Land'], mana: 1, prod: ['C'],
  text: '{T}: Add {C}.\n{3}, {T}: Create a tapped Vibranium token.\n{6}, {T}: Draw a card.',
  abilities: [
    { id: 'vib', label: '{3}, {T}: Create a tapped Vibranium token', cost: 3, tap: true, speed: 'instant', hideFromAutoStop: true, resolve: async (ctx) => { await vibranium(ctx.p); } },
    { id: 'draw', label: '{6}, {T}: Draw a card', cost: 6, tap: true, speed: 'instant', hideFromAutoStop: true, resolve: async (ctx) => { await drawCards(ctx.p, 1); } },
  ],
});

/* ---------------- spells ---------------- */
C('Wakanda Forever!', {
  mc: '{4}{G}{G}', colors: 'G', types: ['Sorcery'], role: 'draw',
  text: 'Reveal the top six cards of your library. You may put a permanent card from among them onto the battlefield with an indestructible counter on it. You may put a permanent card from among them into your hand. Put the rest into your graveyard.',
  spell: async (ctx) => {
    const lib = P(ctx.p).library; const top = lib.splice(Math.max(0, lib.length - 6)).reverse();
    top.forEach(c => { c.zone = 'reveal'; });
    log(`Revealed: ${top.map(c => c.name).join(', ')}.`);
    const perm = top.filter(isPermanentCard);
    const a = await chooseCard(ctx.p, { prompt: 'Put a permanent card onto the battlefield with an indestructible counter (optional)', cands: perm.filter(x => !isLand(x)).concat(perm.filter(isLand)), optional: true, ai: cs => AIH.bestCard(cs.filter(x => !isLand(x))) || cs[0] });
    if (a) { a.zone = null; await enterBF(a, ctx.p, {}); addCounters(a, 'indestructible', 1); }
    const rest = top.filter(c => c !== a);
    const b = await chooseCard(ctx.p, { prompt: 'Put a permanent card into your hand (optional)', cands: rest.filter(isPermanentCard), optional: true, ai: cs => AIH.bestCard(cs) });
    for (const c of rest) { c.zone = null; if (c === b) { c.zone = 'hand'; P(ctx.p).hand.push(c); } else { c.zone = 'gy'; P(ctx.p).gy.push(c); } }
  },
});
C('Martial Coup', {
  mc: '{X}{W}{W}', colors: 'W', types: ['Sorcery'], role: 'tokens', text: 'Create X 1/1 white Soldier creature tokens. If X is 5 or more, destroy all other creatures.',
  choose: async (ctx) => { const max = manaAvail(ctx.p) - 2; if (max < 1) return false; const x = await chooseNumber(ctx.p, { prompt: 'Choose X (5 or more also destroys all other creatures)', min: 1, max, ai: (a, b) => AIH.martialX(ctx.p, b) }); if (x == null) return false; ctx.x = x; ctx.modeLabel = `X = ${x}`; return true; },
  spell: async (ctx) => {
    const made = await createToken(ctx.p, 'Soldier', ctx.x);
    if (ctx.x >= 5) await destroyMany(allCreatures().filter(c => !made.includes(c)));
  },
});
C('Overwhelming Stampede', {
  mc: '{3}{G}{G}', colors: 'G', types: ['Sorcery'], role: 'pump', text: 'Until end of turn, creatures you control gain trample and get +X/+X, where X is the greatest power among creatures you control.',
  spell: async (ctx) => { const x = Math.max(0, ...creatures(ctx.p).map(pow)); for (const c of creatures(ctx.p)) tmpAdd(c, { p: x, t: x, kw: ['trample'] }); log(`Creatures get +${x}/+${x} and trample.`); },
});
const destroyGive = (name, mc, token) => C(name, {
  mc, colors: mc.includes('W') ? 'W' : 'G', types: ['Instant'], role: 'removal', threat: 'destroy',
  text: `Destroy target permanent. Its controller creates a 3/3 green ${token} creature token.`,
  choose: (ctx) => pickTarget(ctx, 'Destroy target permanent', () => true),
  spell: async (ctx) => { const t = ctx.targets[0]; if (!tOK(ctx, t)) return; const pi = t.ctrl; await destroy(t); await createToken(pi, token, 1); },
});
destroyGive('Generous Gift', '{2}{W}', 'Elephant');
destroyGive('Beast Within', '{2}{G}', 'Beast');
