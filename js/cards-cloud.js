'use strict';
/* =====================================================================
   Card scripts: Limit Break (Cloud) precon + 20 upgrades
   ===================================================================== */
const hasSub = (c, s) => (c.d.sub || '').split(' ').includes(s);
const eqOf = (s) => (s.attachedTo != null ? findPerm(s.attachedTo) : null);
const EQ = (name, d) => { d.types = (d.types || ['Artifact']).concat(['Equipment']); d.role = d.role || 'equipment'; return C(name, d); };

/* ---------------- commander ---------------- */
C('Cloud, Ex-SOLDIER', {
  mc: '{2}{R}{G}{W}', colors: 'RGW', types: ['Legendary', 'Creature'], sub: 'Human Soldier Mercenary', pt: [4, 4], kw: ['haste'], role: 'creature',
  text: 'Haste\nWhen Cloud enters, attach up to one target Equipment you control to it.\nWhenever Cloud attacks, draw a card for each equipped attacking creature you control. Then if Cloud has power 7 or greater, create two Treasure tokens.',
  etb: async (c) => {
    if (!perms(c.ctrl).some(isEquipment)) return;
    await trigger(c, c.ctrl, 'attach Equipment', async (ctx) => {
      await pickTarget(ctx, 'Attach up to one target Equipment you control to Cloud', x => isEquipment(x) && x.ctrl === c.ctrl, cs => AIH.bestEquipFor(c, cs), true);
      return ctx.targets.length > 0;
    }, async (ctx) => { const e = ctx.targets[0]; if (tOK(ctx, e) && c.zone === 'bf') attach(e, c); });
  },
  on: {
    attacks: async (s, { attacker }) => {
      if (attacker !== s) return;
      await trigger(s, s.ctrl, 'draw for equipped attackers', null, async () => {
        const n = G.combat ? G.combat.atk.filter(a => a.c.zone === 'bf' && a.c.ctrl === s.ctrl && attachments(a.c).some(isEquipment)).length : 0;
        if (n) await drawCards(s.ctrl, n);
        if (s.zone === 'bf' && pow(s) >= 7) await createToken(s.ctrl, 'Treasure', 2);
      });
    },
  },
});

/* ---------------- creatures kept from the precon ---------------- */
C('Tifa, Martial Artist', {
  mc: '{1}{R}{G}{W}', colors: 'RGW', types: ['Legendary', 'Creature'], sub: 'Human Monk', pt: [4, 4], role: 'creature',
  text: 'Melee (Whenever this creature attacks, it gets +1/+1 until end of turn for each opponent you attacked this combat.)\nWhenever one or more creatures you control with power 7 or greater deal combat damage to a player, untap all creatures you control. If it\'s the first combat phase of your turn, there is an additional combat phase after this phase.',
  on: {
    attacks: async (s, { attacker }) => { if (attacker === s) tmpAdd(s, { p: 1, t: 1 }); },
    combatDamageDone: async (s, { pi, hits }) => {
      if (pi !== s.ctrl || s.tmp.tifaDone) return;
      if (!hits.some(h => h.src.ctrl === s.ctrl && h.src.zone === 'bf' && pow(h.src) >= 7)) return;
      s.tmp.tifaDone = true;
      for (const c of creatures(s.ctrl)) c.tapped = false;
      log('Tifa untaps all creatures.');
      if (G.combatNo === 0) { G.extraCombat = true; log('Tifa: an additional combat phase follows!', 'big'); }
    },
  },
});
C('Vincent, Vengeful Atoner', {
  mc: '{2}{R}', colors: 'R', types: ['Legendary', 'Creature'], sub: 'Assassin', pt: [3, 3], kw: ['menace'], role: 'creature',
  text: 'Menace\nWhenever one or more creatures you control deal combat damage to a player, put a +1/+1 counter on Vincent.\nChaos — Whenever Vincent deals combat damage to an opponent, it deals that much damage to each other opponent if Vincent\'s power is 7 or greater.',
  on: { combatDamageDone: async (s, { pi, hits }) => { if (pi === s.ctrl && hits.some(h => h.src.ctrl === s.ctrl)) { addCounters(s, 'p1p1', 1); log('Vincent gets a +1/+1 counter.'); } } },
});
C('Barret, Avalanche Leader', {
  mc: '{2}{R}{G}', colors: 'RG', types: ['Legendary', 'Creature'], sub: 'Human Rebel', pt: [4, 4], kw: ['reach'], role: 'creature',
  text: 'Reach\nAvalanche! — Whenever an Equipment you control enters, create a 2/2 red Rebel creature token.\nAt the beginning of combat on your turn, attach up to one target Equipment you control to target Rebel you control.',
  on: {
    etb: async (s, { card }) => { if (card.ctrl === s.ctrl && isEquipment(card)) await createToken(s.ctrl, 'Rebel', 1); },
    beginCombat: async (s, { pi }) => {
      if (pi !== s.ctrl) return;
      const free = perms(s.ctrl).filter(e => isEquipment(e) && e.attachedTo == null);
      if (!free.length) return;
      await trigger(s, s.ctrl, 'attach Equipment to a Rebel', async (ctx) => {
        if (!await pickTarget(ctx, 'Equipment to attach', x => isEquipment(x) && x.ctrl === s.ctrl, cs => cs.find(e => e.attachedTo == null) || null)) return false;
        if (!ctx.targets.length) return false;
        return await pickTarget(ctx, 'Rebel to attach it to', x => isCreature(x) && x.ctrl === s.ctrl && hasSub(x, 'Rebel'), cs => AIH.ownBest(cs, ctx));
      }, async (ctx) => { const [e, r] = ctx.targets; if (tOK(ctx, e) && tOK(ctx, r)) attach(e, r); });
    },
  },
});
C('Sephiroth, Fallen Hero', {
  mc: '{3}{R}{W}', colors: 'RW', types: ['Legendary', 'Creature'], sub: 'Human Avatar Soldier', pt: [7, 5], role: 'creature',
  text: 'Jenova Cells — Whenever Sephiroth attacks, you may put a cell counter on target creature. Until end of turn, each modified creature you control has base power and toughness 7/5.\nThe Reunion — {3}, Sacrifice a modified creature: Return this card from your graveyard to the battlefield tapped.',
  on: {
    attacks: async (s, { attacker }) => {
      if (attacker !== s) return;
      await trigger(s, s.ctrl, 'Jenova Cells', async (ctx) => {
        ctx.noFizzle = true;
        await pickTarget(ctx, 'Put a cell counter on target creature (optional)', c => isCreature(c), cs => AIH.cellTarget(s, cs), true);
        return true;
      }, async (ctx) => {
        const t = ctx.targets[0];
        if (t && tOK(ctx, t)) addCounters(t, 'cell', 1);
        G.sephiroth[s.ctrl] = true;
        log('Jenova Cells: modified creatures become 7/5 this turn.', 'big');
      });
    },
  },
  abilities: [{
    id: 'reunion', label: '{3}, Sacrifice a modified creature: return Sephiroth from graveyard tapped', cost: 3, fromGY: true, speed: 'instant', noStack: true,
    can: (c) => c.zone === 'gy' && creatures(c.owner).some(isModified),
    choose: async (ctx) => { const k = await chooseCard(ctx.p, { prompt: 'Sacrifice a modified creature', cands: creatures(ctx.p).filter(isModified), ai: cs => AIH.weakest(cs) }); if (!k) return false; ctx.sac = k; return true; },
    preCost: async (ctx) => { await sacrifice(ctx.sac); },
    resolve: async (ctx) => { if (ctx.card.zone === 'gy') await enterBF(ctx.card, ctx.p, { tapped: true }); },
  }],
});
C('Puresteel Paladin', {
  mc: '{W}{W}', colors: 'W', types: ['Creature'], sub: 'Human Knight', pt: [2, 2], role: 'creature',
  text: 'Whenever an Equipment you control enters, you may draw a card.\nMetalcraft — Equipment you control have equip {0} as long as you control three or more artifacts.',
  on: { etb: async (s, { card }) => { if (card.ctrl === s.ctrl && isEquipment(card)) await drawCards(s.ctrl, 1); } },
});
C('Hellkite Tyrant', {
  mc: '{4}{R}{R}', colors: 'R', types: ['Creature'], sub: 'Dragon', pt: [6, 5], kw: ['flying', 'trample'], role: 'creature',
  text: 'Flying, trample\nWhenever Hellkite Tyrant deals combat damage to a player, gain control of all artifacts that player controls.\nAt the beginning of your upkeep, if you control twenty or more artifacts, you win the game.',
  on: {
    combatDamagePlayer: async (s, { src, pi }) => {
      if (src !== s) return;
      const arts = perms(pi).filter(isArtifact);
      for (const a of arts) gainControl(a, s.ctrl);
      if (arts.length) log(`Hellkite Tyrant steals ${arts.map(a => a.name).join(', ')}.`, 'warn');
    },
    upkeep: async (s, { pi }) => { if (pi === s.ctrl && artifactsOf(pi).length >= 20) { P(opp(pi)).lost = true; log('Hellkite Tyrant: 20 artifacts. Game over.', 'big'); await sba(); } },
  },
});
async function kujataChapter(s, n) {
  if (n === 1) {
    await trigger(s, s.ctrl, 'I — Lightning: 3 damage to each of up to two target creatures', async (ctx) => {
      for (let i = 0; i < 2; i++) await pickTarget(ctx, 'Lightning: target creature (optional)', c => isCreature(c), cs => AIH.burnTarget(cs, ctx, 3), true);
      return ctx.targets.length > 0;
    }, async (ctx) => { for (const t of ctx.targets) if (tOK(ctx, t)) dealDamage(s, t, 3); });
  } else if (n === 2) {
    await trigger(s, s.ctrl, "II — Ice: up to three target creatures can't block", async (ctx) => {
      for (let i = 0; i < 3; i++) await pickTarget(ctx, "Ice: target creature can't block (optional)", c => isCreature(c) && c.ctrl !== s.ctrl, cs => AIH.oppThreat(cs, ctx), true);
      return ctx.targets.length > 0;
    }, async (ctx) => { for (const t of ctx.targets) if (tOK(ctx, t)) t.tmp.cantBlock = true; });
  } else if (n === 3) {
    await trigger(s, s.ctrl, 'III — Fire: discard, draw two, burn', null, async () => {
      const d = await discardN(s.ctrl, 1);
      await drawCards(s.ctrl, 2);
      if (d.length && mv(d[0]) > 0) { dealDamage(s, PL(opp(s.ctrl)), mv(d[0])); log(`Fire deals ${mv(d[0])} damage.`); }
      if (s.zone === 'bf') await sacrifice(s);
    });
  }
}
C('Summon: Kujata', {
  mc: '{5}{R}', colors: 'R', types: ['Enchantment', 'Creature', 'Saga'], sub: 'Saga Ox', pt: [7, 5], kw: ['trample', 'haste'], role: 'creature',
  text: '(As this Saga enters and after your draw step, add a lore counter. Sacrifice after III.)\nI — Lightning — This creature deals 3 damage to each of up to two target creatures.\nII — Ice — Up to three target creatures can\'t block this turn.\nIII — Fire — Discard a card, then draw two cards. When you discard a card this way, this creature deals damage equal to that card\'s mana value to each opponent.\nTrample, haste',
  etb: async (c) => { addCounters(c, 'lore', 1); await kujataChapter(c, 1); },
  on: { afterDraw: async (s, { pi }) => { if (pi !== s.ctrl) return; addCounters(s, 'lore', 1); await kujataChapter(s, s.counters.lore); } },
});

/* ---------------- spells ---------------- */
C('Ultimate Magic: Holy', {
  mc: '{2}{W}', colors: 'W', types: ['Instant'], foretell: 3, foretellMC: '{2}{W}', role: 'protect', protect: 'team',
  text: 'Permanents you control gain indestructible until end of turn. If this spell was cast from exile, prevent all damage that would be dealt to you this turn.\nForetell {2}{W}',
  spell: async (ctx) => {
    for (const c of perms(ctx.p)) tmpAdd(c, { kw: ['indestructible'] });
    if (ctx.from === 'exile') P(ctx.p).preventDmg = true;
    log(`${P(ctx.p).name}'s permanents gain indestructible${ctx.from === 'exile' ? ' and damage to them is prevented' : ''}.`);
  },
});
C('Ultimate Magic: Meteor', {
  mc: '{5}{R}', colors: 'R', types: ['Sorcery'], foretell: 6, foretellMC: '{5}{R}', role: 'wipe',
  text: 'Ultimate Magic: Meteor deals 7 damage to each creature. If this spell was cast from exile, for each opponent, choose an artifact or land that player controls. Destroy the chosen permanents.\nForetell {5}{R}',
  spell: async (ctx) => {
    for (const c of allCreatures()) dealDamage(ctx.card, c, 7);
    if (ctx.from === 'exile') {
      const cands = perms(opp(ctx.p)).filter(c => isArtifact(c) || isLand(c));
      const k = await chooseCard(ctx.p, { prompt: 'Meteor: choose an artifact or land to destroy', cands, ai: cs => AIH.bestCard(cs) });
      if (k) await destroy(k);
    }
    await sba();
  },
});
EQ('Shuriken', {
  mc: '{1}', equip: 2, role: 'removal',
  text: 'Equipped creature has "{T}, Unattach Shuriken: Shuriken deals 2 damage to target creature. That creature\'s controller gains control of Shuriken unless it was unattached from a Ninja."\nEquip {2}',
  abilities: [{
    id: 'throw', label: '{T} equipped creature, unattach: 2 damage to target creature', cost: 0, tapAttached: true, speed: 'instant',
    can: (c) => c.attachedTo != null,
    choose: (ctx) => pickTarget(ctx, 'Shuriken: 2 damage to target creature', c => isCreature(c), cs => AIH.burnTarget(cs, ctx, 2)),
    resolve: async (ctx) => {
      const s = ctx.card; const holder = attachedTo(s);
      const ninja = holder && hasSub(holder, 'Ninja');
      s.attachedTo = null;
      const t = ctx.targets[0];
      if (tOK(ctx, t)) { dealDamage(s, t, 2); if (!ninja && t.ctrl !== s.ctrl && s.zone === 'bf') { gainControl(s, t.ctrl); log(`${P(t.ctrl).name} gains control of Shuriken.`); } }
    },
  }],
});
C('Wrecking Ball', {
  mc: '{2}{B}{R}', colors: 'BR', types: ['Instant'], role: 'removal', threat: 'destroy', text: 'Destroy target creature or land.',
  choose: (ctx) => pickTarget(ctx, 'Destroy target creature or land', c => isCreature(c) || isLand(c)),
  spell: async (ctx) => { const t = ctx.targets[0]; if (tOK(ctx, t)) await destroy(t); },
});
C('Clever Concealment', {
  mc: '{2}{W}{W}', colors: 'W', types: ['Instant'], convoke: true, role: 'protect', protect: 'phase',
  text: 'Convoke\nAny number of target nonland permanents you control phase out. (Treat them and anything attached to them as though they don\'t exist until your next turn.)',
  choose: async (ctx) => {
    const cands = perms(ctx.p).filter(c => !isLand(c) && c.attachedTo == null && canTarget(c, ctx.p, ctx.card));
    const picks = await chooseCards(ctx.p, { prompt: 'Choose permanents to phase out', cands, min: 1, max: cands.length, ai: cs => cs });
    picks.forEach(c => addTarget(ctx, c));
    return picks.length > 0;
  },
  spell: async (ctx) => { for (const t of ctx.targets) if (tOK(ctx, t)) phaseOut(t); log(`${ctx.targets.length} permanent(s) phase out.`); },
});
function phaseOut(c) {
  const att = attachments(c);
  c.phased = true;
  for (const a of att) a.phased = true;
}
C('Unfinished Business', {
  mc: '{3}{W}{W}', colors: 'W', types: ['Sorcery'], role: 'recursion',
  text: "Return target creature card from your graveyard to the battlefield, then return up to two target Aura and/or Equipment cards from your graveyard to the battlefield attached to that creature.",
  canCast: (ctx) => P(ctx.p).gy.some(isCreature),
  choose: async (ctx) => {
    const k = await chooseCard(ctx.p, { prompt: 'Return target creature card', cands: P(ctx.p).gy.filter(isCreature), ai: cs => AIH.bestCard(cs) });
    if (!k) return false; addTarget(ctx, k);
    const eqs = await chooseCards(ctx.p, { prompt: 'Up to two Aura/Equipment cards', cands: P(ctx.p).gy.filter(c => isEquipment(c) || isAura(c)), min: 0, max: 2, ai: cs => AIH.sortCards(cs).slice(0, 2) });
    eqs.forEach(e => addTarget(ctx, e));
    return true;
  },
  spell: async (ctx) => {
    const [cr, ...rest] = ctx.targets;
    if (!tOK(ctx, cr)) return;
    await enterBF(cr, ctx.p, {});
    for (const e of rest) if (tOK(ctx, e)) { await enterBF(e, ctx.p, { attachTo: cr }); }
  },
});
C('Chaos Warp', {
  mc: '{2}{R}', colors: 'R', types: ['Instant'], role: 'removal', threat: 'exile',
  text: "The owner of target permanent shuffles it into their library, then reveals the top card of their library. If it's a permanent card, they put it onto the battlefield.",
  choose: (ctx) => pickTarget(ctx, 'Target permanent', c => true, cs => AIH.oppThreat(cs, ctx)),
  spell: async (ctx) => {
    const t = ctx.targets[0]; if (!tOK(ctx, t)) return;
    const owner = t.owner;
    moveTo(t, 'library');
    shuffle(P(owner).library);
    log(`${t.name} is shuffled into ${P(owner).name}'s library.`);
    const top = P(owner).library[P(owner).library.length - 1];
    if (top) { log(`Revealed: ${top.name}.`); if (isPermanentCard(top)) await enterBF(top, owner, {}); }
  },
});
C('Decimate', {
  mc: '{2}{R}{G}', colors: 'RG', types: ['Sorcery'], role: 'removal', threat: 'destroy',
  text: 'Destroy target artifact, target creature, target enchantment, and target land.',
  canCast: (ctx) => ['Artifact', 'Creature', 'Enchantment', 'Land'].every(t => allPerms().some(c => hasType(c, t) && canTarget(c, ctx.p, ctx.card))),
  choose: async (ctx) => {
    for (const ty of ['Creature', 'Artifact', 'Enchantment', 'Land']) {
      const ok = await pickTarget(ctx, `Decimate: target ${ty.toLowerCase()}`, c => hasType(c, ty), cs => { const o = cs.filter(c => c.ctrl !== ctx.p); return o.length ? AIH.bestCard(o) : null; });
      if (!ok) return false;
    }
    return true;
  },
  spell: async (ctx) => { await destroyMany(ctx.targets.filter(t => tOK(ctx, t))); },
});
C('Furious Rise', {
  mc: '{2}{R}', colors: 'R', types: ['Enchantment'], role: 'draw',
  text: 'At the beginning of your end step, if you control a creature with power 4 or greater, exile the top card of your library. You may play that card until you exile another card with Furious Rise.',
  on: {
    endStep: async (s, { pi }) => {
      if (pi !== s.ctrl || !creatures(pi).some(c => pow(c) >= 4)) return;
      const lib = P(pi).library; const top = lib[lib.length - 1]; if (!top) return;
      for (const c of P(pi).exile) if (c.playable === 'furious') c.playable = null;
      moveTo(top, 'exile'); top.playable = 'furious';
      log(`Furious Rise exiles ${top.name} (playable).`);
    },
  },
});
C('Vandalblast', {
  mc: '{R}', colors: 'R', types: ['Sorcery'], role: 'artRemoval',
  text: 'Destroy target artifact you don\'t control.\nOverload {4}{R}',
  canCast: (ctx) => allPerms().some(c => isArtifact(c) && c.ctrl !== ctx.p),
  alts: [{ key: 'overload', label: 'Overload (destroy each artifact you don\'t control)', mc: '{4}{R}', choose: async (ctx) => { ctx.overload = true; ctx.modeLabel = 'overload'; return true; } }],
  choose: async (ctx) => { if (ctx.alt) return true; return await pickTarget(ctx, 'Destroy target artifact you don\'t control', c => isArtifact(c) && c.ctrl !== ctx.p, cs => AIH.bestCard(cs)); },
  spell: async (ctx) => {
    if (ctx.alt) await destroyMany(allPerms().filter(c => isArtifact(c) && c.ctrl !== ctx.p));
    else { const t = ctx.targets[0]; if (tOK(ctx, t)) await destroy(t); }
  },
});
async function twoLandsSplit(pi) {
  const picks = await searchLibrary(pi, c => isBasic(c), { prompt: 'Search for up to two basic lands', max: 2, ai: cs => AIH.pickLands(pi, cs, 2) });
  if (!picks.length) return;
  const toBF = picks.length === 2 ? await chooseCard(pi, { prompt: 'Which one goes onto the battlefield tapped?', cands: picks, ai: cs => cs[0] }) : picks[0];
  await enterBF(toBF, pi, { tapped: true });
  for (const c of picks) if (c !== toBF) moveTo(c, 'hand');
}
C('Cultivate', { mc: '{2}{G}', colors: 'G', types: ['Sorcery'], role: 'ramp', text: 'Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle.', spell: async (ctx) => { await twoLandsSplit(ctx.p); } });
C("Kodama's Reach", { mc: '{2}{G}', colors: 'G', types: ['Sorcery'], sub: 'Arcane', role: 'ramp', text: 'Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle.', spell: async (ctx) => { await twoLandsSplit(ctx.p); } });
C('Harmonize', { mc: '{2}{G}{G}', colors: 'G', types: ['Sorcery'], role: 'draw', text: 'Draw three cards.', spell: async (ctx) => { await drawCards(ctx.p, 3); } });
C("Nature's Lore", { mc: '{1}{G}', colors: 'G', types: ['Sorcery'], role: 'ramp', text: 'Search your library for a Forest card, put that card onto the battlefield, then shuffle.', spell: async (ctx) => { await fetchBasicsToBF(ctx.p, 1, { tapped: false, filter: c => c.name === 'Forest' }); } });
C('Three Visits', { mc: '{1}{G}', colors: 'G', types: ['Sorcery'], role: 'ramp', text: 'Search your library for a Forest card, put that card onto the battlefield, then shuffle.', spell: async (ctx) => { await fetchBasicsToBF(ctx.p, 1, { tapped: false, filter: c => c.name === 'Forest' }); } });
C('Rampant Growth', { mc: '{1}{G}', colors: 'G', types: ['Sorcery'], role: 'ramp', text: 'Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.', spell: async (ctx) => { await fetchBasicsToBF(ctx.p, 1, { tapped: true }); } });
C('Farseek', { mc: '{1}{G}', colors: 'G', types: ['Sorcery'], role: 'ramp', text: 'Search your library for a Plains, Island, Swamp, or Mountain card, put it onto the battlefield tapped, then shuffle.', spell: async (ctx) => { await fetchBasicsToBF(ctx.p, 1, { tapped: true, filter: c => ['Plains', 'Island', 'Swamp', 'Mountain'].includes(c.name) }); } });
C('Secret Rendezvous', {
  mc: '{1}{W}{W}', colors: 'W', types: ['Sorcery'], role: 'draw', text: 'You and target opponent each draw three cards.',
  choose: (ctx) => { const o = PL(opp(ctx.p)); if (!canTarget(o, ctx.p)) return false; addTarget(ctx, o); return true; },
  spell: async (ctx) => { await drawCards(ctx.p, 3); if (tOK(ctx, ctx.targets[0])) await drawCards(ctx.targets[0].pi, 3); },
});
C('Dispatch', {
  mc: '{W}', colors: 'W', types: ['Instant'], role: 'removal', threat: 'exile',
  text: 'Tap target creature.\nMetalcraft — If you control three or more artifacts, exile that creature.',
  choose: (ctx) => pickTarget(ctx, 'Tap target creature', anyCreature()),
  spell: async (ctx) => { const t = ctx.targets[0]; if (!tOK(ctx, t)) return; t.tapped = true; if (metalcraft(ctx.p)) await exileC(t); },
});

/* ---------------- equipment ---------------- */
EQ('Behemoth Sledge', { mc: '{1}{G}{W}', colors: 'GW', equip: 3, text: 'Equipped creature gets +2/+2 and has trample and lifelink.\nEquip {3}', attachBuff: () => ({ p: 2, t: 2, kw: ['trample', 'lifelink'] }) });
EQ('Colossus Hammer', { mc: '{1}', equip: 8, text: 'Equipped creature gets +10/+10 and loses flying.\nEquip {8}', attachBuff: () => ({ p: 10, t: 10, lose: ['flying'] }) });
EQ("Explorer's Scope", {
  mc: '{1}', equip: 1, text: 'Whenever equipped creature attacks, look at the top card of your library. If it\'s a land card, you may put it onto the battlefield tapped.\nEquip {1}',
  on: { attacks: async (s, { attacker }) => { if (s.attachedTo !== attacker.id) return; const lib = P(s.ctrl).library; const top = lib[lib.length - 1]; if (top && isLand(top) && await chooseYes(s.ctrl, { prompt: `Explorer's Scope: put ${top.name} onto the battlefield tapped?`, card: top, ai: () => true })) await enterBF(top, s.ctrl, { tapped: true }); } },
});
EQ("Hero's Blade", {
  mc: '{2}', equip: 4, text: "Equipped creature gets +3/+2.\nWhenever a legendary creature you control enters, you may attach Hero's Blade to it.\nEquip {4}",
  attachBuff: () => ({ p: 3, t: 2 }),
  on: { etb: async (s, { card }) => { if (card.ctrl === s.ctrl && isLegendary(card) && isCreature(card) && await chooseYes(s.ctrl, { prompt: `Attach Hero's Blade to ${card.name}?`, ai: () => !s.attachedTo || card.isCmd })) attach(s, card); } },
});
EQ("Hero's Heirloom", { mc: '{2}', equip: 2, text: 'Equipped creature gets +2/+1.\nAs long as equipped creature is legendary, it has trample and haste.\nEquip {2}', attachBuff: (s, c) => ({ p: 2, t: 1, kw: isLegendary(c) ? ['trample', 'haste'] : [] }) });
EQ('Lightning Greaves', { mc: '{2}', equip: 0, text: 'Equipped creature has haste and shroud.\nEquip {0}', attachBuff: () => ({ kw: ['haste', 'shroud'] }) });
EQ('Mask of Memory', {
  mc: '{2}', equip: 1, text: 'Whenever equipped creature deals combat damage to a player, you may draw two cards. If you do, discard a card.\nEquip {1}',
  on: { combatDamagePlayer: async (s, { src }) => { if (s.attachedTo !== src.id) return; await drawCards(s.ctrl, 2); await discardN(s.ctrl, 1); } },
});
EQ("Trailblazer's Boots", { mc: '{2}', equip: 2, text: "Equipped creature has nonbasic landwalk.\nEquip {2}", attachBuff: () => ({ kw: ['nonbasicLandwalk'] }) });
EQ("Champion's Helm", { mc: '{3}', equip: 1, text: 'Equipped creature gets +2/+2.\nAs long as equipped creature is legendary, it has hexproof.\nEquip {1}', attachBuff: (s, c) => ({ p: 2, t: 2, kw: isLegendary(c) ? ['hexproof'] : [] }) });
EQ("Conqueror's Flail", {
  mc: '{2}', equip: 2, text: "Equipped creature gets +1/+1 for each color among permanents you control.\nAs long as Conqueror's Flail is attached to a creature, your opponents can't cast spells during your turn.\nEquip {2}",
  attachBuff: (s) => { const cols = new Set(); for (const c of perms(s.ctrl)) for (const x of colorsOf(c)) cols.add(x); return { p: cols.size, t: cols.size }; },
});
EQ('Sword of the Animist', {
  mc: '{2}', types: ['Legendary', 'Artifact'], equip: 2, text: 'Equipped creature gets +1/+1.\nWhenever equipped creature attacks, you may search your library for a basic land card, put it onto the battlefield tapped, then shuffle.\nEquip {2}',
  attachBuff: () => ({ p: 1, t: 1 }),
  on: { attacks: async (s, { attacker }) => { if (s.attachedTo === attacker.id) await fetchBasicsToBF(s.ctrl, 1, { tapped: true }); } },
});
EQ('Conformer Shuriken', {
  mc: '{2}', types: ['Legendary', 'Artifact'], equip: 2, text: 'Equipped creature has "Whenever this creature attacks, tap target creature defending player controls. If that creature has greater power than this creature, put a number of +1/+1 counters on this creature equal to the difference."\nEquip {2}',
  on: {
    attacks: async (s, { attacker }) => {
      if (s.attachedTo !== attacker.id) return;
      await trigger(attacker, attacker.ctrl, 'Conformer Shuriken: tap target creature', (ctx) => pickTarget(ctx, 'Tap target creature defending player controls', c => isCreature(c) && c.ctrl !== attacker.ctrl, cs => AIH.biggest(cs)), async (ctx) => {
        const t = ctx.targets[0]; if (!tOK(ctx, t)) return;
        t.tapped = true;
        const diff = pow(t) - pow(attacker);
        if (diff > 0 && attacker.zone === 'bf') { addCounters(attacker, 'p1p1', diff); log(`${attacker.name} gets ${diff} +1/+1 counters.`); }
      });
    },
  },
});

/* ---------------- upgrades ---------------- */
C("Sigarda's Aid", {
  mc: '{W}', colors: 'W', types: ['Enchantment'], role: 'ramp',
  text: 'You may cast Aura and Equipment spells as though they had flash.\nWhenever an Equipment you control enters, you may attach it to target creature you control.',
  on: {
    etb: async (s, { card }) => {
      if (card.ctrl !== s.ctrl || !isEquipment(card)) return;
      await trigger(s, s.ctrl, `attach ${card.name}`, (ctx) => pickTarget(ctx, `Attach ${card.name} to target creature you control`, c => isCreature(c) && c.ctrl === s.ctrl, cs => AIH.equipTarget(card, cs), true).then(() => ctx.targets.length > 0), async (ctx) => { const t = ctx.targets[0]; if (tOK(ctx, t)) attach(card, t); });
    },
  },
});
C('Stoneforge Mystic', {
  mc: '{1}{W}', colors: 'W', types: ['Creature'], sub: 'Kor Artificer', pt: [1, 2], role: 'creature',
  text: 'When Stoneforge Mystic enters, you may search your library for an Equipment card, reveal it, put it into your hand, then shuffle.\n{1}{W}, {T}: You may put an Equipment card from your hand onto the battlefield.',
  etb: async (c) => { const p = await searchLibrary(c.ctrl, isEquipment, { prompt: 'Search for an Equipment', ai: cs => [AIH.bestCard(cs)] }); for (const e of p) { moveTo(e, 'hand'); log(`${P(c.ctrl).name} reveals ${e.name}.`); } },
  abilities: [{
    id: 'put', label: '{1}{W}, {T}: put an Equipment from hand onto the battlefield', cost: '{1}{W}', tap: true, speed: 'instant',
    can: (c) => P(c.ctrl).hand.some(isEquipment),
    choose: async (ctx) => { const k = await chooseCard(ctx.p, { prompt: 'Equipment to put onto the battlefield', cands: P(ctx.p).hand.filter(isEquipment), ai: cs => AIH.bestCard(cs) }); if (!k) return false; ctx.eq = k; return true; },
    resolve: async (ctx) => { if (ctx.eq.zone === 'hand') await enterBF(ctx.eq, ctx.p, {}); },
  }],
});
EQ('Sword of Feast and Famine', {
  mc: '{3}', equip: 2, text: 'Equipped creature gets +2/+2 and has protection from black and from green.\nWhenever equipped creature deals combat damage to a player, that player discards a card and you untap all lands you control.\nEquip {2}',
  attachBuff: () => ({ p: 2, t: 2, prot: ['B', 'G'] }),
  on: { combatDamagePlayer: async (s, { src, pi }) => { if (s.attachedTo !== src.id) return; await discardN(pi, 1, { prompt: 'Sword of Feast and Famine: discard a card' }); for (const l of perms(s.ctrl)) if (isLand(l)) l.tapped = false; } },
});
EQ('Sword of Fire and Ice', {
  mc: '{3}', equip: 2, text: 'Equipped creature gets +2/+2 and has protection from red and from blue.\nWhenever equipped creature deals combat damage to a player, Sword of Fire and Ice deals 2 damage to any target and you draw a card.\nEquip {2}',
  attachBuff: () => ({ p: 2, t: 2, prot: ['R', 'U'] }),
  on: {
    combatDamagePlayer: async (s, { src, pi }) => {
      if (s.attachedTo !== src.id) return;
      await trigger(s, s.ctrl, '2 damage and draw', async (ctx) => {
        ctx.noFizzle = true;
        const cs = allCreatures().filter(c => c.ctrl !== s.ctrl && canTarget(c, s.ctrl, s));
        const k = await chooseCard(s.ctrl, { prompt: '2 damage to which creature? (cancel = opponent)', cands: cs, optional: true, ai: x => AIH.burnTarget(x, ctx, 2) });
        addTarget(ctx, k || PL(pi)); return true;
      }, async (ctx) => { const t = ctx.targets[0]; if (tOK(ctx, t)) dealDamage(s, t, 2); await drawCards(s.ctrl, 1); });
    },
  },
});
EQ('Embercleave', {
  mc: '{4}{R}{R}', colors: 'R', types: ['Legendary', 'Artifact'], flash: true, equip: 3,
  text: 'Flash\nThis spell costs {1} less to cast for each attacking creature you control.\nWhen Embercleave enters, attach it to target creature you control.\nEquipped creature gets +1/+1 and has double strike and trample.\nEquip {3}',
  costMod: (c, pi) => -(G.combat && G.combat.ap === pi ? G.combat.atk.filter(a => a.c.zone === 'bf').length : 0),
  attachBuff: () => ({ p: 1, t: 1, kw: ['doublestrike', 'trample'] }),
  etb: async (c) => { await trigger(c, c.ctrl, 'attach to target creature', (ctx) => pickTarget(ctx, 'Attach Embercleave to target creature you control', x => isCreature(x) && x.ctrl === c.ctrl, cs => AIH.equipTarget(c, cs)), async (ctx) => { const t = ctx.targets[0]; if (tOK(ctx, t)) attach(c, t); }); },
});
C('Swords to Plowshares', {
  mc: '{W}', colors: 'W', types: ['Instant'], role: 'removal', threat: 'exile', text: 'Exile target creature. Its controller gains life equal to its power.',
  choose: (ctx) => pickTarget(ctx, 'Exile target creature', anyCreature()),
  spell: async (ctx) => { const t = ctx.targets[0]; if (!tOK(ctx, t)) return; const p = Math.max(0, pow(t)), ct = t.ctrl; await exileC(t); gainLife(ct, p); },
});
C('Path to Exile', {
  mc: '{W}', colors: 'W', types: ['Instant'], role: 'removal', threat: 'exile', text: 'Exile target creature. Its controller may search their library for a basic land card, put that card onto the battlefield tapped, then shuffle.',
  choose: (ctx) => pickTarget(ctx, 'Exile target creature', anyCreature()),
  spell: async (ctx) => { const t = ctx.targets[0]; if (!tOK(ctx, t)) return; const ct = t.ctrl; await exileC(t); if (await chooseYes(ct, { prompt: 'Path to Exile: search for a basic land?', ai: () => true })) await fetchBasicsToBF(ct, 1, { tapped: true }); },
});
C("Teferi's Protection", {
  mc: '{2}{W}', colors: 'W', types: ['Instant'], role: 'protect', protect: 'all',
  text: "Until your next turn, your life total can't change and you gain protection from everything. All permanents you control phase out.\nExile Teferi's Protection.",
  spell: async (ctx) => {
    const pl = P(ctx.p);
    pl.lifeLocked = true; pl.protAll = true;
    for (const c of perms(ctx.p)) c.phased = true;
    ctx.exileAfter = true;
    log(`${pl.name} is protected until their next turn; their permanents phase out.`, 'big');
  },
});
C('Heroic Intervention', {
  mc: '{1}{G}', colors: 'G', types: ['Instant'], role: 'protect', protect: 'team',
  text: 'Permanents you control gain hexproof and indestructible until end of turn.',
  spell: async (ctx) => { for (const c of perms(ctx.p)) tmpAdd(c, { kw: ['hexproof', 'indestructible'] }); log(`${P(ctx.p).name}'s permanents gain hexproof and indestructible.`); },
});
C('Boros Charm', {
  mc: '{R}{W}', colors: 'RW', types: ['Instant'], role: 'protect', protect: 'team',
  text: 'Choose one —\n• Boros Charm deals 4 damage to target player or planeswalker.\n• Permanents you control gain indestructible until end of turn.\n• Target creature gains double strike until end of turn.',
  choose: async (ctx) => {
    const m = await chooseOpt(ctx.p, { prompt: 'Boros Charm: choose one', opts: [{ label: '4 damage to target player', value: 'burn' }, { label: 'Permanents you control gain indestructible', value: 'ind' }, { label: 'Target creature gains double strike', value: 'ds' }], ai: () => (ctx.hint && ctx.hint.mode) || 'ind' });
    if (!m) return false; ctx.mode = m; ctx.modeLabel = { burn: '4 damage', ind: 'indestructible', ds: 'double strike' }[m];
    if (m === 'burn') return await pickPlayerTarget(ctx, 'Target player');
    if (m === 'ds') return await pickTarget(ctx, 'Target creature gains double strike', anyCreature(), cs => AIH.ownBest(cs, ctx));
    return true;
  },
  spell: async (ctx) => {
    if (ctx.mode === 'burn') { const t = ctx.targets[0]; if (tOK(ctx, t)) dealDamage(ctx.card, t, 4); }
    else if (ctx.mode === 'ind') { for (const c of perms(ctx.p)) tmpAdd(c, { kw: ['indestructible'] }); }
    else { const t = ctx.targets[0]; if (tOK(ctx, t)) tmpAdd(t, { kw: ['doublestrike'] }); }
  },
});
C('Smothering Tithe', {
  mc: '{3}{W}', colors: 'W', types: ['Enchantment'], role: 'ramp',
  text: 'Whenever an opponent draws a card, that player may pay {2}. If the player doesn\'t, you create a Treasure token.',
  on: {
    draw: async (s, { pi }) => {
      if (pi === s.ctrl) return;
      let paid = false;
      if (canPay(pi, 2, {}) && (P(pi).isBot || SETTINGS.askTithe)) {
        paid = await chooseYes(pi, { prompt: 'Smothering Tithe: pay {2} to deny the Treasure?', ai: () => false });
        if (paid) { await pay(pi, 2, {}); log(`${P(pi).name} pays 2 for Smothering Tithe.`); }
      }
      if (!paid) await createToken(s.ctrl, 'Treasure', 1);
    },
  },
});
EQ('Sunforger', {
  mc: '{3}', equip: 3, text: 'Equipped creature gets +4/+0.\n{R}{W}, Unattach Sunforger: Search your library for a red or white instant card with mana value 4 or less and cast that card without paying its mana cost. Then shuffle.\nEquip {3}',
  attachBuff: () => ({ p: 4 }),
  abilities: [{
    id: 'forge', label: '{R}{W}, Unattach: cast a red or white instant (MV 4 or less) from library free', cost: '{R}{W}', speed: 'instant',
    can: (c) => c.attachedTo != null,
    preCost: async (ctx) => { ctx.card.attachedTo = null; },
    resolve: async (ctx) => {
      const pi = ctx.p;
      const picks = await searchLibrary(pi, c => isInstant(c) && mv(c) <= 4 && /[RW]/.test(colorsOf(c)), { prompt: 'Sunforger: choose an instant', ai: cs => [AIH.sunforgerPick(pi, cs)].filter(Boolean) });
      if (picks[0]) { log(`Sunforger finds ${picks[0].name}.`); P(pi).library.splice(P(pi).library.indexOf(picks[0]), 1); picks[0].zone = 'hand'; P(pi).hand.push(picks[0]); const ok = await castSpell(pi, picks[0], 'hand', { free: true, hint: ctx.hint }); if (!ok) { /* stays in hand */ } }
    },
  }],
});
C('Fighter Class', {
  mc: '{R}{W}', colors: 'RW', types: ['Enchantment', 'Class'], role: 'tutor',
  text: '(Gain the next level as a sorcery to add its ability.)\nWhen Fighter Class enters, search your library for an Equipment card, reveal it, put it into your hand, then shuffle.\n{1}{R}{W}: Level 2 — Equip abilities you activate cost {2} less to activate.\n{3}{R}{W}: Level 3 — Whenever a creature you control attacks, up to one target creature blocks it this combat if able.',
  etb: async (c) => { c.perm.level = 1; const p = await searchLibrary(c.ctrl, isEquipment, { prompt: 'Search for an Equipment', ai: cs => [AIH.bestCard(cs)] }); for (const e of p) { moveTo(e, 'hand'); log(`${P(c.ctrl).name} reveals ${e.name}.`); } },
  abilities: [
    { id: 'l2', label: 'Level 2 ({1}{R}{W})', cost: '{1}{R}{W}', speed: 'sorcery', noStack: true, can: c => (c.perm.level || 1) === 1, resolve: async (ctx) => { ctx.card.perm.level = 2; } },
    { id: 'l3', label: 'Level 3 ({3}{R}{W})', cost: '{3}{R}{W}', speed: 'sorcery', noStack: true, can: c => c.perm.level === 2, resolve: async (ctx) => { ctx.card.perm.level = 3; } },
  ],
  on: {
    attacks: async (s, { attacker }) => {
      if ((s.perm.level || 1) < 3 || attacker.ctrl !== s.ctrl) return;
      await trigger(s, s.ctrl, `force a block on ${attacker.name}`, async (ctx) => {
        await pickTarget(ctx, 'Target creature blocks it if able', c => isCreature(c) && c.ctrl !== s.ctrl && !c.tapped, cs => AIH.forcedBlockTarget(attacker, cs), true);
        return ctx.targets.length > 0;
      }, async (ctx) => { const t = ctx.targets[0]; if (tOK(ctx, t) && G.combat) { G.combat.forced = G.combat.forced || {}; G.combat.forced[t.id] = attacker.id; } });
    },
  },
});
C("Kemba's Skyguard", { mc: '{1}{W}{W}', colors: 'W', types: ['Creature'], sub: 'Cat Knight', pt: [2, 2], kw: ['flying'], role: 'creature', text: "Flying\nWhen Kemba's Skyguard enters, you gain 2 life.", etb: async (c) => { gainLife(c.ctrl, 2); } });
C("Akroma's Will", {
  mc: '{3}{W}', colors: 'W', types: ['Instant'], role: 'protect', protect: 'team',
  text: 'Choose one. If you control a commander as you cast this spell, you may choose both.\n• Creatures you control gain flying, vigilance, and double strike until end of turn.\n• Creatures you control gain lifelink, indestructible, and protection from each color until end of turn.',
  choose: async (ctx) => {
    const both = controlsCommander(ctx.p);
    const opts = [{ label: 'Flying, vigilance, double strike', value: 'atk' }, { label: 'Lifelink, indestructible, protection from each color', value: 'def' }];
    if (both) opts.push({ label: 'Both', value: 'both' });
    const m = await chooseOpt(ctx.p, { prompt: "Akroma's Will", opts, ai: () => (both ? 'both' : (ctx.hint && ctx.hint.mode) || 'def') });
    if (!m) return false; ctx.mode = m; ctx.modeLabel = m; return true;
  },
  spell: async (ctx) => {
    for (const c of creatures(ctx.p)) {
      if (ctx.mode !== 'def') tmpAdd(c, { kw: ['flying', 'vigilance', 'doublestrike'] });
      if (ctx.mode !== 'atk') tmpAdd(c, { kw: ['lifelink', 'indestructible'], prot: ['W', 'U', 'B', 'R', 'G'] });
    }
  },
});
EQ('Shadowspear', {
  mc: '{1}', types: ['Legendary', 'Artifact'], equip: 2, text: 'Equipped creature gets +1/+1 and has trample and lifelink.\n{1}: Permanents your opponents control lose hexproof and indestructible until end of turn.\nEquip {2}',
  attachBuff: () => ({ p: 1, t: 1, kw: ['trample', 'lifelink'] }),
  abilities: [{ id: 'strip', label: '{1}: Opponents lose hexproof and indestructible', cost: 1, speed: 'instant', hideFromAutoStop: true, resolve: async (ctx) => { if (G.strip[opp(ctx.p)] !== 'full') G.strip[opp(ctx.p)] = 'hi'; log('Shadowspear: opponents\' permanents lose hexproof and indestructible.'); } }],
});
EQ('Blackblade Reforged', {
  mc: '{2}', types: ['Legendary', 'Artifact'], equip: 7, equipLegend: 3, text: 'Equipped creature gets +1/+1 for each land you control.\nEquip legendary creature {3}\nEquip {7}',
  attachBuff: (s) => { const n = perms(s.ctrl).filter(isLand).length; return { p: n, t: n }; },
});
