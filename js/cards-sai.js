'use strict';
/* =====================================================================
   Card scripts: Keen Engineering (Sai) precon + 20 upgrades
   ===================================================================== */
const artCount = (pi) => artifactsOf(pi).length;
const otherArtCreatureBuff = (s, c) => (c !== s && c.ctrl === s.ctrl && isCreature(c) && isArtifact(c) ? { p: 1, t: 1 } : null);
async function tapArtifacts(ctx, n, prompt) {
  const cands = perms(ctx.p).filter(a => isArtifact(a) && !a.tapped && a !== ctx.card);
  const picks = await chooseCards(ctx.p, { prompt: prompt || `Tap ${n} untapped artifacts`, cands, min: n, max: n, ai: cs => AIH.cheapArtifacts(cs).slice(0, n) });
  if (picks.length < n) return false;
  ctx.tapList = picks; return true;
}
const untappedArts = (c, n) => perms(c.ctrl).filter(a => isArtifact(a) && !a.tapped && a !== c).length >= n;

/* ---------------- commander ---------------- */
C('Sai, Master Thopterist', {
  mc: '{2}{U}', colors: 'U', types: ['Legendary', 'Creature'], sub: 'Human Artificer', pt: [1, 4], role: 'creature',
  text: 'Whenever you cast an artifact spell, create a 1/1 colorless Thopter artifact creature token with flying.\n{1}{U}, Sacrifice two artifacts: Draw a card.',
  on: { cast: async (s, { pi, card }) => { if (pi === s.ctrl && isArtifact(card)) await createToken(s.ctrl, 'Thopter', 1); } },
  abilities: [{
    id: 'draw', label: '{1}{U}, Sacrifice two artifacts: Draw a card', cost: '{1}{U}', speed: 'instant', hideFromAutoStop: true,
    can: (c) => artifactsOf(c.ctrl).length >= 2,
    choose: async (ctx) => { const picks = await chooseCards(ctx.p, { prompt: 'Sacrifice two artifacts', cands: artifactsOf(ctx.p), min: 2, max: 2, ai: cs => AIH.cheapArtifacts(cs).slice(0, 2) }); if (picks.length < 2) return false; ctx.sacs = picks; return true; },
    preCost: async (ctx) => { await killBatch(ctx.sacs, 'sac'); },
    resolve: async (ctx) => { await drawCards(ctx.p, 1); },
  }],
});

/* ---------------- creatures kept from the precon ---------------- */
C('Master of Etherium', { mc: '{2}{U}', colors: 'U', types: ['Artifact', 'Creature'], sub: 'Vedalken Wizard', pt: [0, 0], dynPT: c => [artCount(c.ctrl), artCount(c.ctrl)], role: 'creature', text: "Master of Etherium's power and toughness are each equal to the number of artifacts you control.\nOther artifact creatures you control get +1/+1.", anthem: otherArtCreatureBuff });
C('Chief of the Foundry', { mc: '{3}', types: ['Artifact', 'Creature'], sub: 'Construct', pt: [2, 3], role: 'creature', text: 'Other artifact creatures you control get +1/+1.', anthem: otherArtCreatureBuff });
C('Myr Battlesphere', {
  mc: '{7}', types: ['Artifact', 'Creature'], sub: 'Myr Construct', pt: [4, 7], role: 'creature',
  text: 'When Myr Battlesphere enters, create four 1/1 colorless Myr artifact creature tokens.\nWhenever Myr Battlesphere attacks, you may tap X untapped Myr you control. If you do, Myr Battlesphere gets +X/+0 until end of turn and deals X damage to the player or planeswalker it\'s attacking.',
  etb: async (c) => { await createToken(c.ctrl, 'Myr', 4); },
  on: {
    attacks: async (s, { attacker }) => {
      if (attacker !== s) return;
      const attacking = G.combat ? G.combat.atk.map(a => a.c) : [];
      const myr = creatures(s.ctrl).filter(c => hasSub(c, 'Myr') && !c.tapped && !attacking.includes(c));
      if (!myr.length) return;
      const picks = await chooseCards(s.ctrl, { prompt: 'Tap untapped Myr', cands: myr, min: 0, max: myr.length, ai: cs => cs });
      if (!picks.length) return;
      picks.forEach(m => m.tapped = true);
      tmpAdd(s, { p: picks.length });
      dealDamage(s, PL(G.combat ? G.combat.dp : opp(s.ctrl)), picks.length);
      log(`Myr Battlesphere taps ${picks.length} Myr: +${picks.length}/+0 and ${picks.length} damage.`);
    },
  },
});
C('Steel Hellkite', {
  mc: '{6}', types: ['Artifact', 'Creature'], sub: 'Dragon', pt: [5, 5], kw: ['flying'], role: 'creature',
  text: '{2}: Steel Hellkite gets +1/+0 until end of turn.\n{X}: Destroy each nonland permanent with mana value X whose controller was dealt combat damage by Steel Hellkite this turn. Activate only once each turn.',
  abilities: [
    { id: 'pump', label: '{2}: +1/+0', cost: 2, speed: 'instant', hideFromAutoStop: true, resolve: async (ctx) => { if (ctx.card.zone === 'bf') tmpAdd(ctx.card, { p: 1 }); } },
    {
      id: 'x', label: '{X}: destroy each nonland permanent with mana value X (of players it hit)', cost: 0, speed: 'instant', oncePerTurn: true,
      can: (c) => !!G.tf.hitBy[c.id],
      choose: async (ctx) => {
        const max = manaAvail(ctx.p);
        const x = await chooseNumber(ctx.p, { prompt: 'Choose X', min: 0, max: Math.min(max, 12), ai: (a, b) => AIH.hellkiteX(ctx.p, b) });
        if (x == null) return false; ctx.x = x; return true;
      },
      costFn: (c, ctx) => (ctx ? ctx.x : 0),
      resolve: async (ctx) => { const hit = G.tf.hitBy[ctx.card.id] || []; const v = (Array.isArray(hit) ? hit : opps(ctx.p)).flatMap(perms).filter(c => !isLand(c) && mv(c) === ctx.x); await destroyMany(v); },
    },
  ],
});
C('Duplicant', {
  mc: '{6}', types: ['Artifact', 'Creature'], sub: 'Shapeshifter', pt: [2, 4], role: 'creature', removalETB: true,
  text: 'Imprint — When Duplicant enters, you may exile target nontoken creature.\nAs long as a card exiled with Duplicant is a creature card, Duplicant has the power, toughness, and creature types of the last creature card exiled with Duplicant. It\'s still a Shapeshifter.',
  etb: async (c) => {
    await trigger(c, c.ctrl, 'Imprint: exile target nontoken creature', async (ctx) => { await pickTarget(ctx, 'Exile target nontoken creature (optional)', x => isCreature(x) && !x.token && x !== c, cs => AIH.oppThreat(cs, ctx), true); return ctx.targets.length > 0; }, async (ctx) => {
      const t = ctx.targets[0]; if (!tOK(ctx, t)) return;
      const pt = t.d.pt || [pow(t), tou(t)];
      await exileC(t);
      if (c.zone === 'bf') { c.perm.copyPT = pt.slice(); log(`Duplicant becomes ${pt[0]}/${pt[1]}.`); }
    });
  },
});
C('Meteor Golem', {
  mc: '{7}', types: ['Artifact', 'Creature'], sub: 'Golem', pt: [3, 3], role: 'creature', removalETB: true,
  text: 'When Meteor Golem enters, destroy target nonland permanent an opponent controls.',
  etb: async (c) => { await trigger(c, c.ctrl, 'destroy target nonland permanent', (ctx) => pickTarget(ctx, 'Destroy target nonland permanent an opponent controls', x => !isLand(x) && x.ctrl !== c.ctrl), async (ctx) => { const t = ctx.targets[0]; if (tOK(ctx, t)) await destroy(t); }); },
});
C('Kappa Cannoneer', {
  mc: '{5}{U}', colors: 'U', types: ['Artifact', 'Creature'], sub: 'Turtle Warrior', pt: [4, 4], ward: 4, improvise: true, role: 'creature',
  text: "Improvise\nWard {4}\nWhenever an artifact you control enters, put a +1/+1 counter on Kappa Cannoneer and it can't be blocked this turn.",
  on: { etb: async (s, { card }) => { if (card.ctrl === s.ctrl && isArtifact(card)) { addCounters(s, 'p1p1', 1); s.tmp.unblockable = true; } } },
});
C('Broodstar', { mc: '{8}{U}{U}', colors: 'U', types: ['Creature'], sub: 'Beast', pt: [0, 0], kw: ['flying'], role: 'creature', costMod: (c, pi) => -artCount(pi), dynPT: c => [artCount(c.ctrl), artCount(c.ctrl)], text: "Affinity for artifacts\nFlying\nBroodstar's power and toughness are each equal to the number of artifacts you control." });
C('Thought Monitor', { mc: '{6}{U}', colors: 'U', types: ['Artifact', 'Creature'], sub: 'Construct', pt: [2, 2], kw: ['flying'], role: 'creature', costMod: (c, pi) => -artCount(pi), text: 'Affinity for artifacts\nFlying\nWhen Thought Monitor enters, draw two cards.', etb: async (c) => { await drawCards(c.ctrl, 2); } });
C('Shimmer Dragon', {
  mc: '{4}{U}{U}', colors: 'U', types: ['Creature'], sub: 'Dragon', pt: [5, 6], kw: ['flying'], role: 'creature',
  text: 'Flying\nAs long as you control four or more artifacts, Shimmer Dragon has hexproof.\nTap two untapped artifacts you control: Draw a card.',
  self: (c) => (c.zone === 'bf' && artCount(c.ctrl) >= 4 ? { kw: ['hexproof'] } : null),
  abilities: [{ id: 'draw', label: 'Tap two untapped artifacts: Draw a card', cost: 0, speed: 'instant', hideFromAutoStop: true, can: c => untappedArts(c, 2), choose: ctx => tapArtifacts(ctx, 2), preCost: async (ctx) => { ctx.tapList.forEach(a => a.tapped = true); }, resolve: async (ctx) => { await drawCards(ctx.p, 1); } }],
});
C('Whirler Rogue', {
  mc: '{2}{U}{U}', colors: 'U', types: ['Creature'], sub: 'Human Rogue Artificer', pt: [2, 2], role: 'creature',
  text: "When Whirler Rogue enters, create two 1/1 colorless Thopter artifact creature tokens with flying.\nTap two untapped artifacts you control: Target creature can't be blocked this turn.",
  etb: async (c) => { await createToken(c.ctrl, 'Thopter', 2); },
  abilities: [{ id: 'unb', label: "Tap two untapped artifacts: target creature can't be blocked", cost: 0, speed: 'instant', hideFromAutoStop: true, can: c => untappedArts(c, 2), choose: async (ctx) => { if (!await pickTarget(ctx, "Target creature can't be blocked this turn", anyCreature(), cs => AIH.ownBest(cs, ctx))) return false; return await tapArtifacts(ctx, 2); }, preCost: async (ctx) => { ctx.tapList.forEach(a => a.tapped = true); }, resolve: async (ctx) => { const t = ctx.targets[0]; if (tOK(ctx, t)) t.tmp.unblockable = true; } }],
});

/* ---------------- artifacts ---------------- */
C('Adaptive Omnitool', {
  mc: '{2}', types: ['Artifact', 'Equipment'], equip: 3, role: 'equipment',
  text: 'Equipped creature gets +1/+1 for each artifact you control.\nWhenever equipped creature attacks, look at the top six cards of your library. You may reveal an artifact card from among them and put it into your hand. Put the rest on the bottom of your library in a random order.\nEquip {3}',
  attachBuff: (s) => { const n = artCount(s.ctrl); return { p: n, t: n }; },
  on: {
    attacks: async (s, { attacker }) => {
      if (s.attachedTo !== attacker.id) return;
      const lib = P(s.ctrl).library; const top = lib.splice(Math.max(0, lib.length - 6));
      const arts = top.filter(isArtifact);
      const k = await chooseCard(s.ctrl, { prompt: 'Adaptive Omnitool: take an artifact (optional)', cands: arts, optional: true, ai: cs => AIH.bestCard(cs) });
      for (const c of shuffle(top)) { if (c === k) { c.zone = 'hand'; P(s.ctrl).hand.push(c); log(`${P(s.ctrl).name} reveals ${c.name}.`); } else lib.unshift(c); }
    },
  },
});
C('Aether Spellbomb', {
  mc: '{1}', types: ['Artifact'], role: 'utility',
  text: "{U}, Sacrifice Aether Spellbomb: Return target creature to its owner's hand.\n{1}, Sacrifice Aether Spellbomb: Draw a card.",
  abilities: [
    { id: 'bounce', label: "{U}, Sacrifice: return target creature to owner's hand", cost: '{U}', sacSelf: true, speed: 'instant', choose: (ctx) => pickTarget(ctx, 'Return target creature', anyCreature()), resolve: async (ctx) => { const t = ctx.targets[0]; if (tOK(ctx, t)) await bounce(t); } },
    { id: 'draw', label: '{1}, Sacrifice: Draw a card', cost: 1, sacSelf: true, speed: 'instant', hideFromAutoStop: true, resolve: async (ctx) => { await drawCards(ctx.p, 1); } },
  ],
});
C("Cultivator's Caravan", { mc: '{3}', types: ['Artifact', 'Vehicle'], sub: 'Vehicle', pt: [5, 5], mana: 1, prod: ['WUBRG'], crew: 3, role: 'ramp', text: '{T}: Add one mana of any color.\nCrew 3' });
C('Forsaken Monument', {
  mc: '{5}', types: ['Legendary', 'Artifact'], role: 'pump',
  text: 'Colorless creatures you control get +2/+2.\nWhenever you tap a permanent for {C}, add an additional {C}.\nWhenever you cast a colorless spell, you gain 2 life.',
  anthem: (s, c) => (c.ctrl === s.ctrl && isCreature(c) && !colorsOf(c) ? { p: 2, t: 2 } : null),
  on: { cast: async (s, { pi, card }) => { if (pi === s.ctrl && !colorsOf(card)) gainLife(pi, 2); } },
});
C('Hedron Archive', {
  mc: '{4}', types: ['Artifact'], mana: 2, colorlessMana: true, role: 'ramp', text: '{T}: Add {C}{C}.\n{2}, {T}, Sacrifice Hedron Archive: Draw two cards.',
  abilities: [{ id: 'draw', label: '{2}, {T}, Sacrifice: Draw two cards', cost: 2, tap: true, sacSelf: true, speed: 'instant', hideFromAutoStop: true, resolve: async (ctx) => { await drawCards(ctx.p, 2); } }],
});
C('Ichor Wellspring', { mc: '{2}', types: ['Artifact'], role: 'draw', text: 'When Ichor Wellspring enters or is put into a graveyard from the battlefield, draw a card.', etb: async (c) => { await drawCards(c.ctrl, 1); }, ltbToGY: async (c, lki) => { await drawCards(lki.ctrl, 1); } });
C('Mazemind Tome', {
  mc: '{2}', types: ['Artifact'], sub: 'Book', role: 'draw',
  text: '{T}, Put a page counter on Mazemind Tome: Scry 1.\n{2}, {T}, Put a page counter on Mazemind Tome: Draw a card.\nWhen there are four or more page counters on Mazemind Tome, exile it. If you do, you gain 4 life.',
  abilities: [
    { id: 'scry', label: '{T}, page counter: Scry 1', cost: 0, tap: true, speed: 'instant', hideFromAutoStop: true, preCost: async (ctx) => addCounters(ctx.card, 'page', 1), resolve: async (ctx) => { await scry(ctx.p, 1); await tomeCheck(ctx.card); } },
    { id: 'draw', label: '{2}, {T}, page counter: Draw a card', cost: 2, tap: true, speed: 'instant', hideFromAutoStop: true, preCost: async (ctx) => addCounters(ctx.card, 'page', 1), resolve: async (ctx) => { await drawCards(ctx.p, 1); await tomeCheck(ctx.card); } },
  ],
});
async function tomeCheck(c) { if (c.zone === 'bf' && (c.counters.page || 0) >= 4) { const pi = c.ctrl; await exileC(c); gainLife(pi, 4); } }
C("Mind's Eye", {
  mc: '{5}', types: ['Artifact'], role: 'draw', text: 'Whenever an opponent draws a card, you may pay {1}. If you do, draw a card.',
  on: { draw: async (s, { pi }) => { if (pi === s.ctrl || !canPay(s.ctrl, 1, {})) return; if (await chooseYes(s.ctrl, { prompt: "Mind's Eye: pay 1 to draw?", ai: () => G.active !== s.ctrl || manaAvail(s.ctrl) > 3 })) { await pay(s.ctrl, 1, {}); await drawCards(s.ctrl, 1); } } },
});
C('Misleading Signpost', { mc: '{2}{U}', colors: 'U', types: ['Artifact'], flash: true, mana: 1, prod: ['U'], role: 'ramp', text: 'Flash\nWhen Misleading Signpost enters during the declare attackers step, you may reselect which player or permanent target attacking creature is attacking. (It can\'t attack its controller or their permanents.)\n{T}: Add {U}.' });
C('Nettlecyst', {
  mc: '{3}', types: ['Artifact', 'Equipment'], equip: 2, role: 'equipment',
  text: 'Living weapon (When this Equipment enters, create a 0/0 black Phyrexian Germ creature token, then attach this to it.)\nEquipped creature gets +1/+1 for each artifact and/or enchantment you control.\nEquip {2}',
  etb: async (c) => { const [g] = await createToken(c.ctrl, 'Germ', 1); if (g && g.zone === 'bf') attach(c, g); },
  attachBuff: (s) => { const n = perms(s.ctrl).filter(x => isArtifact(x) || isEnchantment(x)).length; return { p: n, t: n }; },
});
C("Nevinyrral's Disk", {
  mc: '{4}', types: ['Artifact'], entersTapped: true, role: 'wipeAbility',
  text: "Nevinyrral's Disk enters tapped.\n{1}, {T}: Destroy all artifacts, creatures, and enchantments.",
  abilities: [{ id: 'boom', label: '{1}, {T}: Destroy all artifacts, creatures, and enchantments', cost: 1, tap: true, speed: 'instant', resolve: async () => { await destroyMany(allPerms().filter(c => isArtifact(c) || isCreature(c) || isEnchantment(c))); } }],
});
C('Skysovereign, Consul Flagship', {
  mc: '{5}', types: ['Legendary', 'Artifact', 'Vehicle'], sub: 'Vehicle', pt: [6, 5], kw: ['flying'], crew: 3, role: 'removal',
  text: 'Flying\nWhenever Skysovereign, Consul Flagship enters or attacks, it deals 3 damage to target creature or planeswalker an opponent controls.\nCrew 3',
  etb: async (c) => { await skyShot(c); },
  on: { attacks: async (s, { attacker }) => { if (attacker === s) await skyShot(s); } },
});
async function skyShot(c) { await trigger(c, c.ctrl, '3 damage to target creature', (ctx) => pickTarget(ctx, '3 damage to target creature an opponent controls', x => isCreature(x) && x.ctrl !== c.ctrl, cs => AIH.burnTarget(cs, ctx, 3)), async (ctx) => { const t = ctx.targets[0]; if (tOK(ctx, t)) dealDamage(c, t, 3); }); }
C('Soul-Guide Lantern', {
  mc: '{1}', types: ['Artifact'], role: 'utility',
  text: "When Soul-Guide Lantern enters, exile target card from a graveyard.\n{T}, Sacrifice Soul-Guide Lantern: Exile each opponent's graveyard.\n{1}, {T}, Sacrifice Soul-Guide Lantern: Draw a card.",
  etb: async (c) => {
    const cands = [...opps(c.ctrl).flatMap(o => P(o).gy), ...P(c.ctrl).gy];
    if (!cands.length) return;
    await trigger(c, c.ctrl, 'exile target card from a graveyard', async (ctx) => { const k = await chooseCard(c.ctrl, { prompt: 'Exile target card from a graveyard', cands, ai: cs => AIH.bestCard(cs.filter(x => x.owner !== c.ctrl)) || null }); if (!k) return false; addTarget(ctx, k); return true; }, async (ctx) => { const t = ctx.targets[0]; if (tOK(ctx, t)) await exileC(t); });
  },
  abilities: [
    { id: 'gy', label: "{T}, Sacrifice: Exile each opponent's graveyard", cost: 0, tap: true, sacSelf: true, speed: 'instant', resolve: async (ctx) => { for (const o of opps(ctx.p)) for (const c of P(o).gy.slice()) moveTo(c, 'exile'); log('Opponents\' graveyards exiled.'); } },
    { id: 'draw', label: '{1}, {T}, Sacrifice: Draw a card', cost: 1, tap: true, sacSelf: true, speed: 'instant', hideFromAutoStop: true, resolve: async (ctx) => { await drawCards(ctx.p, 1); } },
  ],
});
C("Tamiyo's Logbook", {
  mc: '{2}{U}', colors: 'U', types: ['Artifact'], sub: 'Book', role: 'draw',
  text: '{5}{U}, {T}: Draw a card. This ability costs {1} less to activate for each other artifact you control.',
  abilities: [{ id: 'draw', label: '{5}{U}, {T}: Draw a card (costs less per artifact)', tap: true, speed: 'instant', hideFromAutoStop: true, cost: (c) => `{${Math.max(0, 5 - (artCount(c.ctrl) - 1))}}{U}`, resolve: async (ctx) => { await drawCards(ctx.p, 1); } }],
});
C('Thopter Fabricator', {
  mc: '{2}{U}', colors: 'U', types: ['Artifact', 'Vehicle'], sub: 'Vehicle', pt: [4, 4], kw: ['flying'], crew: 2, role: 'ramp',
  text: 'Flying\nWhenever you draw your second card each turn, create a 1/1 colorless Thopter artifact creature token with flying.\nCrew 2',
  on: { draw: async (s, { pi, nth }) => { if (pi === s.ctrl && nth === 2) await createToken(pi, 'Thopter', 1); } },
});
C('Thought Vessel', { mc: '{2}', types: ['Artifact'], mana: 1, colorlessMana: true, role: 'ramp', text: 'You have no maximum hand size.\n{T}: Add {C}.' });
C('All Is Dust', {
  mc: '{7}', types: ['Kindred', 'Sorcery'], sub: 'Eldrazi', role: 'wipe',
  text: 'Each player sacrifices all permanents they control that are one or more colors.',
  spell: async () => { await killBatch(allPerms().filter(c => colorsOf(c)), 'sac'); },
});
C('Thoughtcast', { mc: '{4}{U}', colors: 'U', types: ['Sorcery'], role: 'draw', costMod: (c, pi) => -artCount(pi), text: 'Affinity for artifacts\nDraw two cards.', spell: async (ctx) => { await drawCards(ctx.p, 2); } });
C('Aetherize', {
  mc: '{3}{U}', colors: 'U', types: ['Instant'], role: 'combatWipe', text: "Return all attacking creatures to their owner's hand.",
  canCast: () => !!G.combat,
  spell: async () => { const atk = G.combat ? G.combat.atk.map(a => a.c).filter(c => c.zone === 'bf') : []; for (const c of atk) await bounce(c); },
});
C('Counterspell', { mc: '{U}{U}', colors: 'U', types: ['Instant'], role: 'counter', counters: 'any', text: 'Counter target spell.' });
C('Launch Mishap', { mc: '{2}{U}', colors: 'U', types: ['Instant'], role: 'counter', counters: 'creature', text: 'Counter target creature or planeswalker spell. Create a 1/1 colorless Thopter artifact creature token with flying.', afterCounter: async (ctx) => { await createToken(ctx.p, 'Thopter', 1); } });
C('Negate', { mc: '{1}{U}', colors: 'U', types: ['Instant'], role: 'counter', counters: 'noncreature', text: 'Counter target noncreature spell.' });
C('Pull from Tomorrow', {
  mc: '{X}{U}{U}', colors: 'U', types: ['Instant'], role: 'draw', text: 'Draw X cards, then discard a card.',
  choose: async (ctx) => { const max = manaAvail(ctx.p) - 2; if (max < 1) return false; const x = await chooseNumber(ctx.p, { prompt: 'Choose X', min: 1, max, ai: (a, b) => b }); if (x == null) return false; ctx.x = x; return true; },
  spell: async (ctx) => { await drawCards(ctx.p, ctx.x); await discardN(ctx.p, 1); },
});
C('Thirst for Knowledge', {
  mc: '{2}{U}', colors: 'U', types: ['Instant'], role: 'draw', text: 'Draw three cards. Then discard two cards unless you discard an artifact card.',
  spell: async (ctx) => {
    await drawCards(ctx.p, 3);
    const arts = P(ctx.p).hand.filter(isArtifact);
    const a = arts.length ? await chooseCard(ctx.p, { prompt: 'Discard an artifact card? (cancel = discard two cards)', cands: arts, optional: true, ai: cs => AIH.discardOrder(ctx.p, cs)[0] }) : null;
    if (a) await discardCard(ctx.p, a); else await discardN(ctx.p, 2);
  },
});
C('Fall from Favor', {
  mc: '{2}{U}', colors: 'U', types: ['Enchantment', 'Aura'], enchant: 'creature', role: 'removal', threat: 'aura',
  text: "Enchant creature\nWhen Fall from Favor enters, tap enchanted creature and you become the monarch.\nEnchanted creature doesn't untap during its controller's untap step unless that player is the monarch.",
  choose: (ctx) => pickTarget(ctx, 'Enchant creature', anyCreature()),
  etb: async (c) => { const t = attachedTo(c); if (t) t.tapped = true; setMonarch(c.ctrl); },
});
C('Propaganda', { mc: '{2}{U}', colors: 'U', types: ['Enchantment'], role: 'tax', text: "Creatures can't attack you unless their controller pays {2} for each creature they control that's attacking you." });
C('Thopter Spy Network', {
  mc: '{2}{U}{U}', colors: 'U', types: ['Enchantment'], role: 'engine',
  text: 'At the beginning of your upkeep, if you control an artifact, create a 1/1 colorless Thopter artifact creature token with flying.\nWhenever one or more artifact creatures you control deal combat damage to a player, draw a card.',
  on: {
    upkeep: async (s, { pi }) => { if (pi === s.ctrl && artCount(pi) > 0) await createToken(pi, 'Thopter', 1); },
    combatDamageDone: async (s, { pi, hits }) => { if (pi === s.ctrl && hits.some(h => isArtifact(h.src) && h.src.ctrl === s.ctrl)) await drawCards(pi, 1); },
  },
});

/* ---------------- upgrades ---------------- */
C('Ornithopter', { mc: '{0}', types: ['Artifact', 'Creature'], sub: 'Thopter', pt: [0, 2], kw: ['flying'], role: 'creature', text: 'Flying' });
C('Memnite', { mc: '{0}', types: ['Artifact', 'Creature'], sub: 'Construct', pt: [1, 1], role: 'creature', text: '' });
C('Hangarback Walker', {
  mc: '{X}{X}', types: ['Artifact', 'Creature'], sub: 'Construct', pt: [0, 0], role: 'creature',
  text: 'Hangarback Walker enters with X +1/+1 counters on it.\nWhen Hangarback Walker dies, create a 1/1 colorless Thopter artifact creature token with flying for each +1/+1 counter on Hangarback Walker.\n{1}, {T}: Put a +1/+1 counter on Hangarback Walker.',
  choose: async (ctx) => { const max = Math.floor(manaAvail(ctx.p, payOpts(ctx.card, ctx)) / 2); if (max < 1) return false; const x = await chooseNumber(ctx.p, { prompt: 'Choose X', min: 1, max, ai: (a, b) => b }); if (x == null) return false; ctx.x = x; return true; },
  etb: async (c, opts) => { if (opts.x) addCounters(c, 'p1p1', opts.x); },
  on: { dies: async (s, { dead, lki }) => { if (dead === s && lki.counters.p1p1) await createToken(lki.ctrl, 'Thopter', lki.counters.p1p1); } },
  abilities: [{ id: 'grow', label: '{1}, {T}: +1/+1 counter', cost: 1, tap: true, speed: 'instant', hideFromAutoStop: true, resolve: async (ctx) => { if (ctx.card.zone === 'bf') addCounters(ctx.card, 'p1p1', 1); } }],
});
C('Thopter Foundry', {
  mc: '{W/B}{U}', colors: 'WBU', types: ['Artifact'], role: 'engine',
  text: '{1}, Sacrifice a nontoken artifact: Create a 1/1 blue Thopter artifact creature token with flying. You gain 1 life.',
  abilities: [{ id: 'sac', label: '{1}, Sacrifice a nontoken artifact: blue Thopter and 1 life', cost: 1, speed: 'instant', hideFromAutoStop: true, can: c => artifactsOf(c.ctrl).some(a => !a.token), choose: async (ctx) => { const k = await chooseCard(ctx.p, { prompt: 'Sacrifice a nontoken artifact', cands: artifactsOf(ctx.p).filter(a => !a.token), ai: cs => AIH.cheapArtifacts(cs)[0] }); if (!k) return false; ctx.sac = k; return true; }, preCost: async (ctx) => { await sacrifice(ctx.sac); }, resolve: async (ctx) => { await createToken(ctx.p, 'Blue Thopter', 1); gainLife(ctx.p, 1); } }],
});
C('Whir of Invention', {
  mc: '{X}{U}{U}{U}', colors: 'U', types: ['Instant'], improvise: true, role: 'tutor',
  text: 'Improvise\nSearch your library for an artifact card with mana value X or less, put it onto the battlefield, then shuffle.',
  choose: async (ctx) => { const max = manaAvail(ctx.p, { improvise: true }) - 3; if (max < 0) return false; const x = await chooseNumber(ctx.p, { prompt: 'Choose X', min: 0, max, ai: (a, b) => b }); if (x == null) return false; ctx.x = x; return true; },
  spell: async (ctx) => { const p = await searchLibrary(ctx.p, c => isArtifact(c) && mv(c) <= ctx.x, { prompt: 'Choose an artifact', ai: cs => [AIH.bestCard(cs)] }); for (const c of p) await enterBF(c, ctx.p, {}); },
});
C('Urza, Lord High Artificer', {
  mc: '{2}{U}{U}', colors: 'U', types: ['Legendary', 'Creature'], sub: 'Human Artificer', pt: [1, 4], role: 'creature',
  text: 'When Urza, Lord High Artificer enters, create a 0/0 colorless Construct artifact creature token with "This token gets +1/+1 for each artifact you control."\nTap an untapped artifact you control: Add {U}.\n{5}: Shuffle your library, then exile the top card. Until end of turn, you may play that card without paying its mana cost.',
  etb: async (c) => { await createToken(c.ctrl, 'Urza Construct', 1); },
  abilities: [{
    id: 'urza', label: '{5}: Shuffle, exile top card, play it free this turn', cost: 5, speed: 'instant', noStack: true,
    resolve: async (ctx) => { const lib = P(ctx.p).library; shuffle(lib); const top = lib[lib.length - 1]; if (!top) return; moveTo(top, 'exile'); top.playable = 'urza'; top.playTurn = G.turn; log(`Urza exiles ${top.name} (free to play this turn).`); },
  }],
});
C('Cyclonic Rift', {
  mc: '{1}{U}', colors: 'U', types: ['Instant'], role: 'removal', threat: 'bounce',
  text: "Return target nonland permanent you don't control to its owner's hand.\nOverload {6}{U}",
  alts: [{ key: 'overload', label: "Overload (return each nonland permanent you don't control)", mc: '{6}{U}', choose: async (ctx) => { ctx.modeLabel = 'overload'; return true; } }],
  choose: async (ctx) => { if (ctx.alt) return true; return await pickTarget(ctx, "Return target nonland permanent you don't control", c => !isLand(c) && c.ctrl !== ctx.p); },
  spell: async (ctx) => {
    if (ctx.alt) { for (const c of allPerms().filter(c => !isLand(c) && c.ctrl !== ctx.p)) await bounce(c); }
    else { const t = ctx.targets[0]; if (tOK(ctx, t)) await bounce(t); }
  },
});
C('Rhystic Study', {
  mc: '{2}{U}', colors: 'U', types: ['Enchantment'], role: 'draw', text: 'Whenever an opponent casts a spell, you may draw a card unless that player pays {1}.',
  on: { cast: async (s, { pi }) => { if (pi === s.ctrl) return; let paid = false; if (canPay(pi, 1, {}) && (P(pi).isBot || SETTINGS.askTithe)) { paid = await chooseYes(pi, { prompt: 'Rhystic Study: pay {1} so the bot does not draw?', ai: () => false }); if (paid) { await pay(pi, 1, {}); log(`${P(pi).name} pays 1 for Rhystic Study.`); } } if (!paid) { log('Rhystic Study triggers.'); await drawCards(s.ctrl, 1); } } },
});
C('Mystic Remora', {
  mc: '{U}', colors: 'U', types: ['Enchantment'], role: 'draw',
  text: 'Cumulative upkeep {1}\nWhenever an opponent casts a noncreature spell, you may draw a card unless that player pays {4}.',
  on: {
    upkeep: async (s, { pi }) => { if (pi !== s.ctrl) return; addCounters(s, 'age', 1); const n = s.counters.age; if (canPay(pi, n, {}) && await chooseYes(pi, { prompt: `Mystic Remora: pay ${n}?`, ai: () => n <= 3 })) { await pay(pi, n, {}); log(`Mystic Remora upkeep paid (${n}).`); } else await sacrifice(s); },
    cast: async (s, { pi, card }) => { if (pi === s.ctrl || isCreature(card)) return; let paid = false; if (canPay(pi, 4, {}) && (P(pi).isBot || SETTINGS.askTithe)) { paid = await chooseYes(pi, { prompt: 'Mystic Remora: pay {4} so the bot does not draw?', ai: () => false }); if (paid) { await pay(pi, 4, {}); } } if (!paid) await drawCards(s.ctrl, 1); },
  },
});
C('Fierce Guardianship', { mc: '{2}{U}', colors: 'U', types: ['Instant'], role: 'counter', counters: 'noncreature', freeWithCommander: true, text: 'If you control a commander, you may cast this spell without paying its mana cost.\nCounter target noncreature spell.' });
C('Arcane Denial', { mc: '{1}{U}', colors: 'U', types: ['Instant'], role: 'counter', counters: 'any', text: "Counter target spell. Its controller may draw up to two cards at the beginning of the next turn's upkeep.\nYou draw a card at the beginning of the next turn's upkeep.", afterCounter: async (ctx, target) => { const them = target.p; G.delayed.push({ at: 'upkeep', fn: async () => { await drawCards(them, 2); await drawCards(ctx.p, 1); } }); } });
C('Swan Song', { mc: '{U}', colors: 'U', types: ['Instant'], role: 'counter', counters: 'swan', text: 'Counter target enchantment, instant, or sorcery spell. Its controller creates a 2/2 blue Bird creature token with flying.', afterCounter: async (ctx, target) => { await createToken(target.p, 'Bird', 1); } });
C('Retrofitter Foundry', {
  mc: '{1}', types: ['Artifact'], role: 'engine',
  text: '{3}: Untap Retrofitter Foundry.\n{2}, {T}: Create a 1/1 colorless Servo artifact creature token.\n{1}, {T}, Sacrifice a Servo: Create a 1/1 colorless Thopter artifact creature token with flying.\n{T}, Sacrifice a Thopter: Create a 4/4 colorless Construct artifact creature token.',
  abilities: [
    { id: 'untap', label: '{3}: Untap', cost: 3, speed: 'instant', hideFromAutoStop: true, can: c => c.tapped, noStack: true, resolve: async (ctx) => { ctx.card.tapped = false; } },
    { id: 'servo', label: '{2}, {T}: Servo token', cost: 2, tap: true, speed: 'instant', hideFromAutoStop: true, resolve: async (ctx) => { await createToken(ctx.p, 'Servo', 1); } },
    { id: 'thop', label: '{1}, {T}, Sacrifice a Servo: Thopter token', cost: 1, tap: true, speed: 'instant', hideFromAutoStop: true, can: c => creatures(c.ctrl).some(x => hasSub(x, 'Servo')), preCost: async (ctx) => { await sacrifice(creatures(ctx.p).find(x => hasSub(x, 'Servo'))); }, resolve: async (ctx) => { await createToken(ctx.p, 'Thopter', 1); } },
    { id: 'big', label: '{T}, Sacrifice a Thopter: 4/4 Construct token', cost: 0, tap: true, speed: 'instant', hideFromAutoStop: true, can: c => creatures(c.ctrl).some(x => hasSub(x, 'Thopter') && x.token), preCost: async (ctx) => { await sacrifice(creatures(ctx.p).find(x => hasSub(x, 'Thopter') && x.token)); }, resolve: async (ctx) => { await createToken(ctx.p, 'Construct 4/4', 1); } },
  ],
});
C('Glimmervoid', { types: ['Land'], mana: 1, prod: ['WUBRG'], text: 'At the beginning of the end step, if you control no artifacts, sacrifice Glimmervoid.\n{T}: Add one mana of any color.', on: { endStep: async (s) => { if (!artCount(s.ctrl)) await sacrifice(s); } } });
C('Cranial Plating', {
  mc: '{2}', types: ['Artifact', 'Equipment'], equip: 1, role: 'equipment',
  text: 'Equipped creature gets +1/+0 for each artifact you control.\n{B}{B}: Attach Cranial Plating to target creature you control.\nEquip {1}',
  attachBuff: (s) => ({ p: artCount(s.ctrl) }),
  abilities: [{ id: 'bb', label: '{B}{B}: Attach to target creature you control', cost: '{B}{B}', speed: 'instant', hideFromAutoStop: true, choose: (ctx) => pickTarget(ctx, 'Attach to target creature you control', c => isCreature(c) && c.ctrl === ctx.p, cs => AIH.equipTarget(ctx.card, cs)), resolve: async (ctx) => { const t = ctx.targets[0]; if (tOK(ctx, t)) attach(ctx.card, t); } }],
});
C("Liberator, Urza's Battlethopter", {
  mc: '{3}', types: ['Legendary', 'Artifact', 'Creature'], sub: 'Thopter', pt: [1, 2], kw: ['flying'], flash: true, role: 'creature',
  text: "Flash\nFlying\nYou may cast colorless spells and artifact spells as though they had flash.\nWhenever you cast a spell, if the amount of mana spent to cast that spell is greater than Liberator, Urza's Battlethopter's power, put a +1/+1 counter on Liberator.",
  on: { cast: async (s, { pi, ctx }) => { if (pi === s.ctrl && (ctx.manaSpent || 0) > pow(s)) addCounters(s, 'p1p1', 1); } },
});
C('Ichormoon Gauntlet', {
  mc: '{2}{U}', colors: 'U', types: ['Artifact'], role: 'engine',
  text: 'Planeswalkers you control have "[0]: Proliferate" and "[-12]: Take an extra turn after this one."\nWhenever you cast a noncreature spell, choose a counter on target permanent. Put an additional counter of that kind on that permanent.',
  on: {
    cast: async (s, { pi, card }) => {
      if (pi !== s.ctrl || isCreature(card)) return;
      await trigger(s, pi, 'add a counter', async (ctx) => { await pickTarget(ctx, 'Target permanent with a counter', c => Object.values(c.counters).some(v => v > 0), cs => AIH.gauntletTarget(pi, cs), true); return ctx.targets.length > 0; }, async (ctx) => {
        const t = ctx.targets[0]; if (!tOK(ctx, t)) return;
        const kinds = Object.keys(t.counters).filter(k => t.counters[k] > 0);
        const k = t.ctrl === pi ? (kinds.includes('p1p1') ? 'p1p1' : kinds[0]) : (kinds.includes('m1m1') ? 'm1m1' : kinds.includes('age') ? 'age' : kinds[0]);
        addCounters(t, k, 1); log(`Ichormoon Gauntlet adds a ${k} counter to ${t.name}.`);
      });
    },
  },
});
C('Chief Engineer', { mc: '{1}{U}', colors: 'U', types: ['Creature'], sub: 'Vedalken Artificer', pt: [1, 3], role: 'creature', text: 'Artifact spells you cast have convoke.' });
C('Mechanized Production', {
  mc: '{2}{U}{U}', colors: 'U', types: ['Enchantment', 'Aura'], enchant: 'artifact', role: 'engine',
  text: 'Enchant artifact you control\nAt the beginning of your upkeep, create a token that\'s a copy of enchanted artifact. Then if you control eight or more artifacts with the same name as one another, you win the game.',
  canCast: (ctx) => artifactsOf(ctx.p).length > 0,
  choose: (ctx) => pickTarget(ctx, 'Enchant artifact you control', c => isArtifact(c) && c.ctrl === ctx.p, cs => AIH.productionTarget(cs)),
  on: {
    upkeep: async (s, { pi }) => {
      if (pi !== s.ctrl) return;
      const t = attachedTo(s); if (!t) return;
      const tok = mkCard(t.name, pi, { token: true });
      await enterBF(tok, pi, { quiet: true });
      log(`Mechanized Production copies ${t.name}.`);
      const counts = {};
      for (const a of artifactsOf(pi)) counts[a.name] = (counts[a.name] || 0) + 1;
      if (Object.values(counts).some(v => v >= 8)) { for (const o of opps(pi)) P(o).lost = true; log('Mechanized Production: eight identical artifacts. Game over.', 'big'); await sba(); }
    },
  },
});
C('Whirler Virtuoso', {
  mc: '{1}{U}{R}', colors: 'UR', types: ['Creature'], sub: 'Vedalken Artificer', pt: [2, 3], role: 'creature',
  text: 'When Whirler Virtuoso enters, you get {E}{E}{E} (three energy counters).\nPay {E}{E}{E}: Create a 1/1 colorless Thopter artifact creature token with flying.',
  etb: async (c) => { P(c.ctrl).energy += 3; },
  abilities: [{ id: 'thop', label: 'Pay {E}{E}{E}: Thopter token', cost: 0, speed: 'instant', noStack: true, hideFromAutoStop: true, can: c => P(c.ctrl).energy >= 3, resolve: async (ctx) => { P(ctx.p).energy -= 3; await createToken(ctx.p, 'Thopter', 1); } }],
});

/* counterspell resolution shared */
function counterFits(c, target) {
  if (!target || target.kind !== 'spell') return false;
  const k = c.d.counters;
  const tc = target.card;
  if (k === 'any') return true;
  if (k === 'creature') return isCreature(tc);
  if (k === 'noncreature') return !isCreature(tc);
  if (k === 'swan') return isEnchantment(tc) || isInstant(tc) || isSorcery(tc);
  return false;
}
for (const n of ['Counterspell', 'Launch Mishap', 'Negate', 'Fierce Guardianship', 'Arcane Denial', 'Swan Song']) {
  const d = CARDS[n];
  d.canCast = (ctx) => G.stack.some(it => it.p !== ctx.p && counterFits(ctx.card, it));
  d.choose = async (ctx) => {
    const cands = G.stack.filter(it => it.p !== ctx.p && counterFits(ctx.card, it));
    if (!cands.length) return false;
    let it = cands[cands.length - 1];
    if (!P(ctx.p).isBot && cands.length > 1) {
      const v = await chooseOpt(ctx.p, { prompt: 'Counter which spell?', opts: cands.map((x, i) => ({ label: x.card.name, value: i })) });
      if (v == null) return false; it = cands[v];
    }
    ctx.counterTarget = it; ctx.modeLabel = 'targeting ' + it.card.name;
    if (d.freeWithCommander && controlsCommander(ctx.p)) ctx.free = true;
    return true;
  };
  d.spell = async (ctx) => {
    const it = ctx.counterTarget;
    if (G.stack.includes(it)) { await counterItem(it, n); if (d.afterCounter) await d.afterCounter(ctx, it); }
    else log(`${n} fizzles.`);
  };
}
