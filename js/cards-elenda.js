'use strict';
/* =====================================================================
   Card scripts: Elenda bot deck (W/B vampire aristocrats, precon style
   base + 20 upgrades). Elenda herself, Viscera Seer, Zulaport Cutthroat and
   Cruel Celebrant live in cards-shay.js because your Elenda build uses them too.
   ===================================================================== */
const ownDeath = (s, lki) => lki.ctrl === s.ctrl;
const drainEach = (s, n, why) => { const o = opp(s.ctrl); loseLife(o, n); gainLife(s.ctrl, n); log(`${why}: ${P(o).name} loses ${n}, ${P(s.ctrl).name} gains ${n}.`); };
const sacOutlet = (label, resolve) => ({
  id: 'sac', label, cost: 0, speed: 'instant', hideFromAutoStop: true,
  can: (c) => creatures(c.ctrl).length > 0,
  choose: async (ctx) => {
    const k = await chooseCard(ctx.p, { prompt: 'Sacrifice which creature?', cands: creatures(ctx.p), ai: cs => (G.aiSac && cs.includes(G.aiSac) ? G.aiSac : AIH.weakest(cs)) });
    if (!k) return false; ctx.sac = k; return true;
  },
  preCost: async (ctx) => { await sacrifice(ctx.sac); },
  resolve,
});

/* ---------------- tokens ---------------- */
C('Spirit', { token: true, colors: 'WB', types: ['Creature'], sub: 'Spirit', pt: [1, 1], kw: ['flying'], text: 'Flying' });
C('White Spirit', { token: true, colors: 'W', types: ['Creature'], sub: 'Spirit', pt: [1, 1], kw: ['flying'], text: 'Flying' });
C('Faerie Rogue', { token: true, colors: 'B', types: ['Creature'], sub: 'Faerie Rogue', pt: [1, 1], kw: ['flying'], text: 'Flying' });
C('Warrior', { token: true, colors: 'W', types: ['Creature'], sub: 'Warrior', pt: [1, 1], text: '' });
C('Human Soldier', { token: true, colors: 'W', types: ['Creature'], sub: 'Human Soldier', pt: [1, 1], text: '' });
C('Snake', { token: true, colors: 'B', types: ['Creature'], sub: 'Snake', pt: [1, 1], kw: ['deathtouch'], text: 'Deathtouch' });

/* ---------------- lands and mana ---------------- */
C('Command Tower', { types: ['Land'], mana: 1, prod: 'ident', text: "{T}: Add one mana of any color in your commander's color identity." });
C("Commander's Sphere", {
  mc: '{3}', types: ['Artifact'], mana: 1, prod: 'ident', role: 'ramp',
  text: "{T}: Add one mana of any color in your commander's color identity.\nSacrifice Commander's Sphere: Draw a card.",
  abilities: [{ id: 'draw', label: 'Sacrifice: Draw a card', cost: 0, sacSelf: true, speed: 'instant', hideFromAutoStop: true, resolve: async (ctx) => { await drawCards(ctx.p, 1); } }],
});
C("Wayfarer's Bauble", {
  mc: '{1}', types: ['Artifact'], role: 'ramp',
  text: '{2}, {T}, Sacrifice Wayfarer\'s Bauble: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.',
  abilities: [{ id: 'fetch', label: '{2}, {T}, Sacrifice: basic land onto the battlefield tapped', cost: 2, tap: true, sacSelf: true, speed: 'instant', hideFromAutoStop: true, resolve: async (ctx) => { await fetchBasicsToBF(ctx.p, 1, { tapped: true }); } }],
});

/* ---------------- creatures ---------------- */
C('Carrion Feeder', {
  mc: '{B}', colors: 'B', types: ['Creature'], sub: 'Zombie', pt: [1, 1], cantBlock: true, role: 'creature',
  text: "Carrion Feeder can't block.\nSacrifice a creature: Put a +1/+1 counter on Carrion Feeder.",
  abilities: [sacOutlet('Sacrifice a creature: +1/+1 counter on Carrion Feeder', async (ctx) => { if (ctx.card.zone === 'bf') addCounters(ctx.card, 'p1p1', 1); })],
});
C('Vampire of the Dire Moon', { mc: '{B}', colors: 'B', types: ['Creature'], sub: 'Vampire', pt: [1, 1], kw: ['deathtouch', 'lifelink'], role: 'creature', text: 'Deathtouch, lifelink' });
C('Indulgent Aristocrat', {
  mc: '{B}', colors: 'B', types: ['Creature'], sub: 'Vampire', pt: [1, 1], kw: ['lifelink'], role: 'creature',
  text: 'Lifelink\n{2}, Sacrifice a creature: Put a +1/+1 counter on each Vampire you control.',
  abilities: [Object.assign(sacOutlet('{2}, Sacrifice a creature: +1/+1 counter on each Vampire you control', async (ctx) => { for (const v of creatures(ctx.p).filter(c => hasSub(c, 'Vampire'))) addCounters(v, 'p1p1', 1); }), { id: 'sac2', cost: 2 })],
});
C('Legion Lieutenant', { mc: '{W}{B}', colors: 'WB', types: ['Creature'], sub: 'Vampire Knight', pt: [2, 2], role: 'creature', text: 'Other Vampires you control get +1/+1.', anthem: (s, c) => (c !== s && c.ctrl === s.ctrl && isCreature(c) && hasSub(c, 'Vampire') ? { p: 1, t: 1 } : null) });
C('Kalastria Highborn', {
  mc: '{B}{B}', colors: 'B', types: ['Creature'], sub: 'Vampire Shaman', pt: [2, 2], role: 'creature',
  text: 'Whenever Kalastria Highborn or another Vampire you control dies, you may pay {B}. If you do, target player loses 2 life and you gain 2 life.',
  on: {
    dies: async (s, { lki }) => {
      if (!ownDeath(s, lki) || !(lki.d.sub || '').split(' ').includes('Vampire')) return;
      if (!canPay(s.ctrl, '{B}', {})) return;
      if (!(await chooseYes(s.ctrl, { prompt: 'Kalastria Highborn: pay {B} to drain 2?', ai: () => true }))) return;
      await pay(s.ctrl, '{B}', {});
      drainEach(s, 2, 'Kalastria Highborn');
    },
  },
});
C('Elas il-Kor, Sadistic Pilgrim', {
  mc: '{1}{W}{B}', colors: 'WB', types: ['Legendary', 'Creature'], sub: 'Phyrexian Human Cleric', pt: [2, 2], kw: ['deathtouch'], role: 'creature',
  text: 'Deathtouch\nWhenever another creature you control enters, you gain 1 life.\nWhenever another creature you control dies, each opponent loses 1 life.',
  on: {
    etb: async (s, { card }) => { if (card !== s && card.ctrl === s.ctrl && isCreature(card)) gainLife(s.ctrl, 1); },
    dies: async (s, { dead, lki, mult }) => { if (dead !== s && ownDeath(s, lki)) { loseLife(opp(s.ctrl), mult); log(`Elas il-Kor: ${P(opp(s.ctrl)).name} loses ${mult}.`); } },
  },
});
C('Ministrant of Obligation', {
  mc: '{2}{W}', colors: 'W', types: ['Creature'], sub: 'Human Cleric', pt: [2, 1], role: 'creature',
  text: 'Afterlife 2 (When this creature dies, create two 1/1 white and black Spirit creature tokens with flying.)',
  on: { dies: async (s, { dead, lki, mult }) => { if (dead === s) await createToken(lki.ctrl, 'Spirit', 2 * mult); } },
});
C('Midnight Reaper', {
  mc: '{2}{B}', colors: 'B', types: ['Creature'], sub: 'Zombie Knight', pt: [3, 2], role: 'creature',
  text: 'Whenever a nontoken creature you control dies, Midnight Reaper deals 1 damage to you and you draw a card.',
  on: { dies: async (s, { lki, mult }) => { if (!ownDeath(s, lki) || lki.token) return; for (let i = 0; i < mult; i++) { dealDamage(s, PL(s.ctrl), 1); await drawCards(s.ctrl, 1); } } },
});
C('Falkenrath Noble', {
  mc: '{3}{B}', colors: 'B', types: ['Creature'], sub: 'Vampire Warrior', pt: [2, 2], kw: ['flying'], role: 'creature',
  text: 'Flying\nWhenever Falkenrath Noble or another creature dies, target player loses 1 life and you gain 1 life.',
  on: { dies: async (s, { mult }) => { drainEach(s, mult, 'Falkenrath Noble'); } },
});
C('Pitiless Plunderer', {
  mc: '{3}{B}', colors: 'B', types: ['Creature'], sub: 'Human Pirate', pt: [1, 4], role: 'creature',
  text: 'Whenever another creature you control dies, create a Treasure token.',
  on: { dies: async (s, { dead, lki, mult }) => { if (dead !== s && ownDeath(s, lki) && s.zone === 'bf') await createToken(s.ctrl, 'Treasure', mult); } },
});
C('Champion of Dusk', {
  mc: '{3}{B}{B}', colors: 'B', types: ['Creature'], sub: 'Vampire Knight', pt: [4, 4], role: 'creature',
  text: 'When Champion of Dusk enters, you draw X cards and you lose X life, where X is the number of Vampires you control.',
  etb: async (c) => { const x = creatures(c.ctrl).filter(v => hasSub(v, 'Vampire')).length; await drawCards(c.ctrl, x); loseLife(c.ctrl, x); },
});
C('Butcher of Malakir', {
  mc: '{5}{B}{B}', colors: 'B', types: ['Creature'], sub: 'Vampire Warrior', pt: [5, 4], kw: ['flying'], role: 'creature',
  text: 'Flying\nWhenever Butcher of Malakir or another creature you control dies, each opponent sacrifices a creature.',
  on: {
    dies: async (s, { lki, mult }) => {
      if (!ownDeath(s, lki)) return;
      const o = opp(s.ctrl);
      for (let i = 0; i < mult; i++) {
        const cs = creatures(o);
        if (!cs.length) return;
        const k = await chooseCard(o, { prompt: 'Butcher of Malakir: sacrifice a creature', cands: cs, ai: x => AIH.weakest(x) });
        if (k) await sacrifice(k);
      }
    },
  },
});
C('Requiem Angel', {
  mc: '{5}{W}{W}', colors: 'W', types: ['Creature'], sub: 'Angel', pt: [5, 5], kw: ['flying'], role: 'creature',
  text: 'Flying\nWhenever another non-Spirit creature you control dies, create a 1/1 white Spirit creature token with flying.',
  on: { dies: async (s, { dead, lki, mult }) => { if (dead !== s && ownDeath(s, lki) && !(lki.d.sub || '').split(' ').includes('Spirit') && s.zone === 'bf') await createToken(s.ctrl, 'White Spirit', mult); } },
});
async function sunTitanTrigger(c) {
  const cands = P(c.ctrl).gy.filter(x => isPermanentCard(x) && mv(x) <= 3);
  if (!cands.length) return;
  await trigger(c, c.ctrl, 'return a permanent card (MV 3 or less)', async (ctx) => {
    const k = await chooseCard(c.ctrl, { prompt: 'Sun Titan: return target permanent card with mana value 3 or less (optional)', cands, optional: true, ai: cs => AIH.bestCard(cs.filter(x => !isLand(x))) || cs[0] });
    if (!k) return false; addTarget(ctx, k); return true;
  }, async (ctx) => { const t = ctx.targets[0]; if (tOK(ctx, t)) await enterBF(t, c.ctrl, {}); });
}
C('Sun Titan', {
  mc: '{4}{W}{W}', colors: 'W', types: ['Creature'], sub: 'Giant', pt: [6, 6], kw: ['vigilance'], role: 'creature',
  text: 'Vigilance\nWhenever Sun Titan enters or attacks, you may return target permanent card with mana value 3 or less from your graveyard to the battlefield.',
  etb: async (c) => { await sunTitanTrigger(c); },
  on: { attacks: async (s, { attacker }) => { if (attacker === s) await sunTitanTrigger(s); } },
});
C('Massacre Wurm', {
  mc: '{3}{B}{B}{B}', colors: 'B', types: ['Creature'], sub: 'Phyrexian Wurm', pt: [6, 5], role: 'creature',
  text: 'When Massacre Wurm enters, creatures your opponents control get -2/-2 until end of turn.\nWhenever a creature an opponent controls dies, that player loses 2 life.',
  etb: async (c) => { for (const x of creatures(opp(c.ctrl))) tmpAdd(x, { p: -2, t: -2 }); log('Massacre Wurm: opposing creatures get -2/-2.', 'warn'); await sba(); },
  on: { dies: async (s, { lki, mult }) => { if (lki.ctrl !== s.ctrl) { loseLife(lki.ctrl, 2 * mult); log(`Massacre Wurm: ${P(lki.ctrl).name} loses ${2 * mult}.`); } } },
});
C('Morbid Opportunist', {
  mc: '{2}{B}', colors: 'B', types: ['Creature'], sub: 'Human Rogue', pt: [1, 1], role: 'creature',
  text: 'Whenever one or more other creatures die, draw a card. This ability triggers only once each turn.',
  on: { dies: async (s, { dead }) => { if (dead === s || G.tf['morbid' + s.id] || s.zone !== 'bf') return; G.tf['morbid' + s.id] = true; await drawCards(s.ctrl, 1); } },
});
C('Ophiomancer', {
  mc: '{2}{B}', colors: 'B', types: ['Creature'], sub: 'Human Shaman', pt: [2, 2], role: 'creature',
  text: 'At the beginning of each upkeep, if you control no Snakes, create a 1/1 black Snake creature token with deathtouch.',
  on: { upkeep: async (s) => { if (!creatures(s.ctrl).some(c => hasSub(c, 'Snake'))) await createToken(s.ctrl, 'Snake', 1); } },
});

/* ---------------- spells ---------------- */
C('Sign in Blood', {
  mc: '{B}{B}', colors: 'B', types: ['Sorcery'], role: 'draw', text: 'Target player draws two cards and loses 2 life.',
  choose: (ctx) => { addTarget(ctx, PL(ctx.p)); return true; },
  spell: async (ctx) => { const t = ctx.targets[0]; if (!tOK(ctx, t)) return; await drawCards(t.pi, 2); loseLife(t.pi, 2); },
});
const killSpell = (name, mc, type, text, filter, after, extra = {}) => C(name, {
  mc, colors: 'WB'.split('').filter(x => mc.includes(x)).join(''), types: [type], role: 'removal', threat: /Exile/.test(text) ? 'exile' : 'destroy', text,
  choose: (ctx) => pickTarget(ctx, text.split('.')[0], filter),
  spell: async (ctx) => { const t = ctx.targets[0]; if (tOK(ctx, t)) { if (/^Exile/.test(text)) await exileC(t); else await destroy(t); } if (after) after(ctx); },
  ...extra,
});
killSpell('Mortify', '{1}{W}{B}', 'Instant', 'Destroy target creature or enchantment.', c => isCreature(c) || isEnchantment(c));
killSpell('Anguished Unmaking', '{1}{W}{B}', 'Instant', 'Exile target nonland permanent. You lose 3 life.', c => !isLand(c), (ctx) => loseLife(ctx.p, 3));
killSpell('Vindicate', '{1}{W}{B}', 'Sorcery', 'Destroy target permanent.', () => true);
killSpell('Utter End', '{2}{W}{B}', 'Instant', 'Exile target nonland permanent.', c => !isLand(c));
killSpell('Infernal Grasp', '{1}{B}', 'Instant', 'Destroy target creature. You lose 2 life.', c => isCreature(c), (ctx) => loseLife(ctx.p, 2));
killSpell('Despark', '{W}{B}', 'Instant', 'Exile target permanent with mana value 4 or greater.', c => mv(c) >= 4);
C('Damnation', { mc: '{2}{B}{B}', colors: 'B', types: ['Sorcery'], role: 'wipe', text: "Destroy all creatures. They can't be regenerated.", spell: async () => { await destroyMany(allCreatures()); } });
C('Toxic Deluge', {
  mc: '{2}{B}', colors: 'B', types: ['Sorcery'], role: 'wipe', text: 'As an additional cost to cast this spell, pay X life.\nAll creatures get -X/-X until end of turn.',
  choose: async (ctx) => {
    const max = P(ctx.p).life - 1; if (max < 1) return false;
    const want = Math.max(1, ...creatures(opp(ctx.p)).map(c => tou(c)));
    const x = await chooseNumber(ctx.p, { prompt: 'Toxic Deluge: pay how much life (X)?', min: 1, max: Math.min(max, 20), ai: () => Math.min(want, max) });
    if (x == null) return false; ctx.x = x; ctx.modeLabel = `X = ${x}`; return true;
  },
  spell: async (ctx) => { loseLife(ctx.p, ctx.x); for (const c of allCreatures()) tmpAdd(c, { p: -ctx.x, t: -ctx.x }); await sba(); },
});
C('Bastion of Remembrance', {
  mc: '{2}{B}', colors: 'B', types: ['Enchantment'], role: 'engine',
  text: 'When Bastion of Remembrance enters, create a 1/1 white Human Soldier creature token.\nWhenever a creature you control dies, each opponent loses 1 life and you gain 1 life.',
  etb: async (c) => { await createToken(c.ctrl, 'Human Soldier', 1); },
  on: { dies: async (s, { lki, mult }) => { if (ownDeath(s, lki)) drainEach(s, mult, 'Bastion of Remembrance'); } },
});
C('Phyrexian Arena', { mc: '{1}{B}{B}', colors: 'B', types: ['Enchantment'], role: 'draw', text: 'At the beginning of your upkeep, you draw a card and you lose 1 life.', on: { upkeep: async (s, { pi }) => { if (pi === s.ctrl) { await drawCards(pi, 1); loseLife(pi, 1); } } } });
C('Bitterblossom', { mc: '{1}{B}', colors: 'B', types: ['Kindred', 'Enchantment'], sub: 'Faerie', role: 'engine', text: 'At the beginning of your upkeep, you lose 1 life and create a 1/1 black Faerie Rogue creature token with flying.', on: { upkeep: async (s, { pi }) => { if (pi === s.ctrl) { loseLife(pi, 1); await createToken(pi, 'Faerie Rogue', 1); } } } });
C('Sanguine Bond', { mc: '{3}{B}{B}', colors: 'B', types: ['Enchantment'], role: 'engine', text: 'Whenever you gain life, target opponent loses that much life.' });
C('Dark Prophecy', { mc: '{B}{B}{B}', colors: 'B', types: ['Enchantment'], role: 'draw', text: 'Whenever a creature you control dies, you draw a card and you lose 1 life.', on: { dies: async (s, { lki, mult }) => { if (!ownDeath(s, lki)) return; await drawCards(s.ctrl, mult); loseLife(s.ctrl, mult); } } });
C('Flawless Maneuver', {
  mc: '{2}{W}', colors: 'W', types: ['Instant'], role: 'protect', protect: 'team', freeWithCommander: true,
  text: 'If you control a commander, you may cast this spell without paying its mana cost.\nCreatures you control gain indestructible until end of turn.',
  choose: async (ctx) => { if (controlsCommander(ctx.p)) ctx.free = true; return true; },
  spell: async (ctx) => { for (const c of creatures(ctx.p)) tmpAdd(c, { kw: ['indestructible'] }); log(`${P(ctx.p).name}'s creatures gain indestructible.`); },
});
C('Demonic Tutor', {
  mc: '{1}{B}', colors: 'B', types: ['Sorcery'], role: 'tutor', text: 'Search your library for a card, put that card into your hand, then shuffle.',
  spell: async (ctx) => { const p = await searchLibrary(ctx.p, () => true, { prompt: 'Demonic Tutor: choose any card', ai: cs => [AIH.tutorPick(ctx.p, cs)] }); for (const c of p) { moveTo(c, 'hand'); log(`${P(ctx.p).name} tutors a card.`); } },
});
C('Vampiric Tutor', {
  mc: '{B}', colors: 'B', types: ['Instant'], role: 'tutor', text: 'Search your library for a card, then shuffle and put that card on top. You lose 2 life.',
  spell: async (ctx) => {
    const p = await searchLibrary(ctx.p, () => true, { prompt: 'Vampiric Tutor: choose a card for the top', ai: cs => [AIH.tutorPick(ctx.p, cs)] });
    const lib = P(ctx.p).library;
    for (const c of p) { lib.splice(lib.indexOf(c), 1); lib.push(c); log(`${P(ctx.p).name} puts a card on top of their library.`); }
    loseLife(ctx.p, 2);
  },
});
C('Secure the Wastes', {
  mc: '{X}{W}', colors: 'W', types: ['Instant'], role: 'tokens', text: 'Create X 1/1 white Warrior creature tokens.',
  choose: async (ctx) => { const max = manaAvail(ctx.p) - 1; if (max < 1) return false; const x = await chooseNumber(ctx.p, { prompt: 'Choose X', min: 1, max, ai: (a, b) => b }); if (x == null) return false; ctx.x = x; return true; },
  spell: async (ctx) => { await createToken(ctx.p, 'Warrior', ctx.x); },
});
