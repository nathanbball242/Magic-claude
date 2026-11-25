'use strict';
/* =====================================================================
   Card scripts: Shay Cormac deck + cards shared between decks.
   ===================================================================== */

const oppCreature = (ctx) => (c) => isCreature(c) && c.ctrl !== ctx.p;
const anyCreature = () => (c) => isCreature(c);
const ownCreature = (ctx) => (c) => isCreature(c) && c.ctrl === ctx.p;
const tmpAdd = (c, o) => {
  c.tmp.p = (c.tmp.p || 0) + (o.p || 0);
  c.tmp.t = (c.tmp.t || 0) + (o.t || 0);
  if (o.kw) c.tmp.kw = (c.tmp.kw || []).concat(o.kw);
  if (o.prot) c.tmp.prot = (c.tmp.prot || []).concat(o.prot);
};
const protectHintAI = (ctx) => (cs) => {
  if (ctx.hint && ctx.hint.protect && cs.includes(ctx.hint.protect)) return ctx.hint.protect;
  return AIH.ownBest(cs, ctx);
};

/* ---------------- tokens ---------------- */
C('Thopter', { token: true, types: ['Artifact', 'Creature'], sub: 'Thopter', pt: [1, 1], kw: ['flying'], text: 'Flying' });
C('Blue Thopter', { token: true, colors: 'U', types: ['Artifact', 'Creature'], sub: 'Thopter', pt: [1, 1], kw: ['flying'], text: 'Flying' });
C('Treasure', { token: true, treasure: true, prod: ['WUBRGC'], types: ['Artifact'], sub: 'Treasure', text: '{T}, Sacrifice this artifact: Add one mana of any color.' });
C('Myr', { token: true, types: ['Artifact', 'Creature'], sub: 'Myr', pt: [1, 1], text: '' });
C('Servo', { token: true, types: ['Artifact', 'Creature'], sub: 'Servo', pt: [1, 1], text: '' });
C('Construct 4/4', { token: true, types: ['Artifact', 'Creature'], sub: 'Construct', pt: [4, 4], text: '' });
C('Urza Construct', { token: true, types: ['Artifact', 'Creature'], sub: 'Construct', pt: [0, 0], dynPT: (c) => { const n = artifactsOf(c.ctrl).length; return [n, n]; }, text: 'This token gets +1/+1 for each artifact you control.' });
C('Germ', { token: true, colors: 'B', types: ['Creature'], sub: 'Phyrexian Germ', pt: [0, 0], text: '' });
C('Rebel', { token: true, colors: 'R', types: ['Creature'], sub: 'Rebel', pt: [2, 2], text: '' });
C('Bird', { token: true, colors: 'U', types: ['Creature'], sub: 'Bird', pt: [2, 2], kw: ['flying'], text: 'Flying' });
C('Goblin', { token: true, colors: 'R', types: ['Creature'], sub: 'Goblin', pt: [1, 1], text: '' });

/* ---------------- basic lands ---------------- */
for (const [n, col] of [['Plains', 'W'], ['Swamp', 'B'], ['Island', 'U'], ['Mountain', 'R'], ['Forest', 'G']]) {
  C(n, { types: ['Basic', 'Land'], sub: n, mana: 1, text: `({T}: Add {${col}}.)` });
}

/* ---------------- commander ---------------- */
C('Shay Cormac', {
  mc: '{W}{B}', colors: 'WB', types: ['Legendary', 'Creature'], sub: 'Human Knight Rogue', pt: [1, 1], role: 'creature',
  text: "{1}: Permanents your opponents control lose hexproof, indestructible, protection, shroud, and ward until end of turn. (House rule: also put a bounty counter on each creature your opponents control.)\nWhenever a creature an opponent controls becomes the target of a spell or ability you control, put a bounty counter on that creature.\nWhenever a creature with a bounty counter on it dies, put two +1/+1 counters on Shay Cormac.",
  abilities: [{
    id: 'strip', label: "{1}: Strip opponents' protection and put a bounty counter on each of their creatures", cost: 1, speed: 'instant', hideFromAutoStop: true,
    resolve: async (ctx) => { const o = opp(ctx.p); G.strip[o] = 'full'; const ps = perms(o); const tagged = ps.filter(isCreature); for (const c of tagged) addCounters(c, 'bounty', 1); if (tagged.length) log(`Shay Cormac puts a bounty counter on every creature ${P(o).name} controls (${tagged.length}).`, 'bounty'); log(`Shay Cormac: all ${ps.length} permanents ${P(o).name} controls lose hexproof, indestructible, protection, shroud and ward until end of turn${ps.length ? ` (${ps.map(c => c.name.split(',')[0]).join(', ')})` : ''}. Permanents it plays later this turn are affected too.`, 'bounty'); },
  }],
  on: {
    targeted: async (s, { byPi, target }) => {
      if (byPi === s.ctrl && target.ctrl !== s.ctrl && isCreature(target)) {
        addCounters(target, 'bounty', 1);
        log(`Shay Cormac puts a bounty counter on ${target.name}.`, 'bounty');
      }
    },
    dies: async (s, { lki, mult }) => {
      if ((lki.counters.bounty || 0) <= 0) return;
      if (s.zone === 'bf') {
        addCounters(s, 'p1p1', 2 * mult);
        log(`Bounty collected on ${lki.name}: Shay Cormac gets ${2 * mult} +1/+1 counters${mult > 1 ? ' (Teysa)' : ''}.`, 'bounty');
      } else {
        log(`Bounty on ${lki.name} lost: Shay Cormac is not on the battlefield to collect it.`, 'warn');
      }
    },
  },
});

/* ---------------- wipes ---------------- */
C('Vanquish the Horde', {
  mc: '{6}{W}{W}', colors: 'W', types: ['Sorcery'], role: 'wipe',
  text: 'This spell costs {1} less to cast for each creature on the battlefield.\nDestroy all creatures.',
  costMod: () => -allCreatures().length,
  spell: async () => { await destroyMany(allCreatures()); },
});
C('Wrath of God', {
  mc: '{2}{W}{W}', colors: 'W', types: ['Sorcery'], role: 'wipe', text: "Destroy all creatures. They can't be regenerated.",
  spell: async () => { await destroyMany(allCreatures()); },
});
C('Day of Judgment', {
  mc: '{2}{W}{W}', colors: 'W', types: ['Sorcery'], role: 'wipe', text: 'Destroy all creatures.',
  spell: async () => { await destroyMany(allCreatures()); },
});
C('Fumigate', {
  mc: '{3}{W}{W}', colors: 'W', types: ['Sorcery'], role: 'wipe', text: 'Destroy all creatures. You gain 1 life for each creature destroyed this way.',
  spell: async (ctx) => { const d = await destroyMany(allCreatures()); gainLife(ctx.p, d.length); if (d.length) log(`${P(ctx.p).name} gains ${d.length} life.`); },
});
const AUSTERE_MODES = [
  { label: 'Destroy all artifacts', value: 'art', f: c => isArtifact(c) },
  { label: 'Destroy all enchantments', value: 'ench', f: c => isEnchantment(c) },
  { label: 'Destroy all creatures with mana value 3 or less', value: 'lo', f: c => isCreature(c) && mv(c) <= 3 },
  { label: 'Destroy all creatures with mana value 4 or greater', value: 'hi', f: c => isCreature(c) && mv(c) >= 4 },
];
C('Austere Command', {
  mc: '{4}{W}{W}', colors: 'W', types: ['Sorcery'], role: 'wipe',
  text: 'Choose two —\n• Destroy all artifacts.\n• Destroy all enchantments.\n• Destroy all creatures with mana value 3 or less.\n• Destroy all creatures with mana value 4 or greater.',
  choose: async (ctx) => {
    if (P(ctx.p).isBot) { ctx.modes = AIH.austereModes(ctx.p); ctx.modeLabel = ctx.modes.map(m => AUSTERE_MODES.find(x => x.value === m).label.replace('Destroy all ', '')).join(' + '); return true; }
    const a = await chooseOpt(ctx.p, { prompt: 'Austere Command: first mode', opts: AUSTERE_MODES.map(m => ({ label: m.label, value: m.value })) });
    if (!a) return false;
    const b = await chooseOpt(ctx.p, { prompt: 'Austere Command: second mode', opts: AUSTERE_MODES.filter(m => m.value !== a).map(m => ({ label: m.label, value: m.value })) });
    if (!b) return false;
    ctx.modes = [a, b];
    ctx.modeLabel = ctx.modes.map(m => AUSTERE_MODES.find(x => x.value === m).label.replace('Destroy all ', '')).join(' + ');
    return true;
  },
  spell: async (ctx) => {
    const fs = ctx.modes.map(m => AUSTERE_MODES.find(x => x.value === m).f);
    await destroyMany(allPerms().filter(c => fs.some(f => f(c))));
  },
});
C('Planar Outburst', {
  mc: '{3}{W}{W}', colors: 'W', types: ['Sorcery'], role: 'wipe',
  text: 'Destroy all nonland creatures.\nAwaken 4—{5}{W}{W}{W} (If you cast this spell for {5}{W}{W}{W}, also put four +1/+1 counters on target land you control and it becomes a 0/0 Elemental creature with haste. It\'s still a land.)',
  alts: [{
    key: 'awaken', label: 'Cast with Awaken 4', mc: '{5}{W}{W}{W}',
    choose: async (ctx) => { ctx.noFizzle = true; return await pickTarget(ctx, 'Awaken: choose a land you control', c => isLand(c) && c.ctrl === ctx.p, cs => cs[0]); },
  }],
  spell: async (ctx) => {
    await destroyMany(allCreatures().filter(c => !isLand(c)));
    if (ctx.alt && ctx.targets[0] && tOK(ctx, ctx.targets[0])) {
      const l = ctx.targets[0];
      l.animated = true; addCounters(l, 'p1p1', 4);
      log(`${l.name} awakens as a 4/4 Elemental with haste.`);
    }
  },
});
C('Hour of Revelation', {
  mc: '{3}{W}{W}{W}', colors: 'W', types: ['Sorcery'], role: 'wipe',
  text: 'This spell costs {3} less to cast if there are ten or more nonland permanents on the battlefield.\nDestroy all nonland permanents.',
  costMod: () => (allPerms().filter(c => !isLand(c)).length >= 10 ? -3 : 0),
  spell: async () => { await destroyMany(allPerms().filter(c => !isLand(c))); },
});
C('Unstable Glyphbridge', {
  mc: '{3}{W}{W}', colors: 'W', types: ['Artifact'], role: 'wipe',
  text: 'When Unstable Glyphbridge enters, if you cast it, for each player, choose a creature with power 2 or less that player controls. Then destroy all creatures except creatures chosen this way.\nCraft with artifact {3}{W}{W}',
  etb: async (c, opts) => {
    if (!opts.cast) return;
    const keep = [];
    for (const pi of [c.ctrl, opp(c.ctrl)]) {
      const cands = creatures(pi).filter(x => pow(x) <= 2);
      if (!cands.length) continue;
      const k = await chooseCard(c.ctrl, { prompt: `Glyphbridge: choose a creature with power 2 or less ${pi === c.ctrl ? 'you control' : 'your opponent controls'} to keep`, cands, ai: cs => pi === c.ctrl ? AIH.ownBest(cs, { p: c.ctrl }) : AIH.weakest(cs) });
      if (k) keep.push(k);
    }
    log(`Unstable Glyphbridge spares ${keep.map(k => k.name).join(', ') || 'nothing'}.`);
    await destroyMany(allCreatures().filter(x => !keep.includes(x)));
  },
  abilities: [{
    id: 'craft', label: 'Craft with artifact {3}{W}{W}: transform into Sandswirl Wanderglyph', cost: 5, speed: 'sorcery',
    can: (c) => perms(c.ctrl).some(a => isArtifact(a) && a !== c) || P(c.ctrl).gy.some(isArtifact),
    choose: async (ctx) => {
      const cands = [...perms(ctx.p).filter(a => isArtifact(a) && a !== ctx.card), ...P(ctx.p).gy.filter(isArtifact)];
      const m = await chooseCard(ctx.p, { prompt: 'Craft: exile which artifact?', cands, ai: cs => cs.find(x => x.zone === 'gy') || cs.find(x => x.token) || cs[0] });
      if (!m) return false;
      ctx.material = m; ctx.noFizzle = true;
      return true;
    },
    resolve: async (ctx) => {
      const c = ctx.card;
      if (c.zone !== 'bf') return;
      const m = ctx.material;
      if (m.zone === 'bf' || m.zone === 'gy') await exileC(m); else return;
      moveTo(c, 'exile');
      c.transformedFrom = 'Unstable Glyphbridge';
      c.name = 'Sandswirl Wanderglyph'; c.d = CARDS['Sandswirl Wanderglyph'];
      await enterBF(c, ctx.p, {});
    },
  }],
});
C('Sandswirl Wanderglyph', {
  mc: '', cmcOverride: 5, colors: 'W', types: ['Artifact', 'Creature'], sub: 'Golem', pt: [5, 3], kw: ['flying'], img: { name: 'Unstable Glyphbridge', face: 'back' },
  text: "Flying\nWhenever an opponent casts a spell during their turn, they can't attack you or planeswalkers you control this turn.\nEach opponent who attacked you or a planeswalker you control this turn can't cast spells.",
  on: {
    cast: async (s, { pi }) => {
      if (pi !== s.ctrl && G.active === pi && !G.tf.cantAttack[pi]) { G.tf.cantAttack[pi] = true; log(`Sandswirl Wanderglyph: ${P(pi).name} can't attack this turn.`); }
    },
  },
});
const LIMIT_TIERS = [
  { label: 'Cross-Slash (+{0}): destroy target tapped creature', value: 'cross', extra: '' },
  { label: 'Blade Beam (+{1}): destroy any number of target tapped creatures with different controllers', value: 'beam', extra: '{1}' },
  { label: 'Omnislash (+{3}{W}): destroy all tapped creatures', value: 'omni', extra: '{3}{W}' },
];
C("Cloud's Limit Break", {
  mc: '{1}{W}', colors: 'W', types: ['Instant'], role: 'removal',
  text: 'Tiered (Choose one additional cost.)\n• Cross-Slash — {0} — Destroy target tapped creature.\n• Blade Beam — {1} — Destroy any number of target tapped creatures with different controllers.\n• Omnislash — {3}{W} — Destroy all tapped creatures.',
  canCast: () => allCreatures().some(c => c.tapped),
  choose: async (ctx) => {
    const tc = (t) => costOf(ctx.p, ctx.card, { p: ctx.p, from: ctx.from, extra: t.extra });
    const opts = LIMIT_TIERS.map(t => ({ label: `${t.label} [${tc(t)}]`, value: t.value, disabled: !canPay(ctx.p, tc(t), {}) }));
    const tier = await chooseOpt(ctx.p, { prompt: "Cloud's Limit Break: choose a tier", opts, ai: () => AIH.limitTier(ctx, canPay(ctx.p, tc(LIMIT_TIERS[2]), {})) });
    if (!tier) return false;
    const T = LIMIT_TIERS.find(t => t.value === tier);
    ctx.tier = tier; ctx.extra = T.extra; ctx.modeLabel = T.label.split(' (')[0];
    if (tier === 'cross') return await pickTarget(ctx, 'Destroy target tapped creature', c => isCreature(c) && c.tapped);
    if (tier === 'beam') {
      ctx.noFizzle = false;
      for (const pi of [opp(ctx.p), ctx.p]) {
        await pickTarget(ctx, `Blade Beam: tapped creature ${pi === ctx.p ? 'you control' : 'opponent controls'} (optional)`, c => isCreature(c) && c.tapped && c.ctrl === pi, cs => (pi === ctx.p ? null : AIH.oppThreat(cs, ctx)), true);
      }
      return ctx.targets.length > 0;
    }
    return true;
  },
  spell: async (ctx) => {
    if (ctx.tier === 'omni') { await destroyMany(allCreatures().filter(c => c.tapped)); return; }
    await destroyMany(ctx.targets.filter(t => tOK(ctx, t)));
  },
});

/* ---------------- protect Shay ---------------- */
C("Professor's Warning", {
  mc: '{B}', colors: 'B', types: ['Instant'], role: 'protect', protect: 'target',
  text: 'Choose one —\n• Put a +1/+1 counter on target creature.\n• Target creature gains indestructible until end of turn.',
  choose: async (ctx) => {
    const m = await chooseOpt(ctx.p, { prompt: "Professor's Warning: choose one", opts: [{ label: 'Put a +1/+1 counter on target creature', value: 'counter' }, { label: 'Target creature gains indestructible until end of turn', value: 'ind' }], ai: () => (ctx.hint ? 'ind' : 'counter') });
    if (!m) return false;
    ctx.mode = m; ctx.modeLabel = m === 'ind' ? 'indestructible' : '+1/+1 counter';
    return await pickTarget(ctx, 'Target creature', anyCreature(), protectHintAI(ctx));
  },
  spell: async (ctx) => {
    const t = ctx.targets[0]; if (!tOK(ctx, t)) return;
    if (ctx.mode === 'ind') tmpAdd(t, { kw: ['indestructible'] }); else addCounters(t, 'p1p1', 1);
  },
});
C('Unbreakable Formation', {
  mc: '{2}{W}', colors: 'W', types: ['Instant'], role: 'protect', protect: 'team',
  text: 'Creatures you control gain indestructible until end of turn.\nAddendum — If you cast this spell during your main phase, put a +1/+1 counter on each of those creatures and they gain vigilance until end of turn.',
  spell: async (ctx) => {
    const main = G.active === ctx.p && isMainPhase();
    for (const c of creatures(ctx.p)) { tmpAdd(c, { kw: ['indestructible'].concat(main ? ['vigilance'] : []) }); if (main) addCounters(c, 'p1p1', 1); }
    log(`${P(ctx.p).name}'s creatures gain indestructible${main ? ', a +1/+1 counter and vigilance' : ''}.`);
  },
});
C('Valorous Stance', {
  mc: '{1}{W}', colors: 'W', types: ['Instant'], role: 'protect', protect: 'target',
  text: 'Choose one —\n• Target creature gains indestructible until end of turn.\n• Destroy target creature with toughness 4 or greater.',
  choose: async (ctx) => {
    const m = await chooseOpt(ctx.p, { prompt: 'Valorous Stance: choose one', opts: [{ label: 'Target creature gains indestructible', value: 'ind' }, { label: 'Destroy target creature with toughness 4 or greater', value: 'kill' }], ai: () => (ctx.hint ? 'ind' : 'kill') });
    if (!m) return false;
    ctx.mode = m; ctx.modeLabel = m === 'ind' ? 'indestructible' : 'destroy';
    if (m === 'ind') return await pickTarget(ctx, 'Target creature gains indestructible', anyCreature(), protectHintAI(ctx));
    return await pickTarget(ctx, 'Destroy target creature with toughness 4 or greater', c => isCreature(c) && tou(c) >= 4);
  },
  spell: async (ctx) => {
    const t = ctx.targets[0]; if (!tOK(ctx, t)) return;
    if (ctx.mode === 'ind') tmpAdd(t, { kw: ['indestructible'] });
    else if (tou(t) >= 4) await destroy(t);
  },
});
C('Make a Stand', {
  mc: '{2}{W}', colors: 'W', types: ['Instant'], role: 'protect', protect: 'team',
  text: 'Creatures you control get +1/+0 and gain indestructible until end of turn.',
  spell: async (ctx) => { for (const c of creatures(ctx.p)) tmpAdd(c, { p: 1, kw: ['indestructible'] }); log(`${P(ctx.p).name}'s creatures get +1/+0 and indestructible.`); },
});
C('Selfless Spirit', {
  mc: '{1}{W}', colors: 'W', types: ['Creature'], sub: 'Spirit Cleric', pt: [2, 1], kw: ['flying'], role: 'creature', protectAbility: 'team',
  text: 'Flying\nSacrifice Selfless Spirit: Creatures you control gain indestructible until end of turn.',
  abilities: [{
    id: 'sac', label: 'Sacrifice: creatures you control gain indestructible', cost: 0, speed: 'instant', sacSelf: true,
    resolve: async (ctx) => { for (const c of creatures(ctx.p)) tmpAdd(c, { kw: ['indestructible'] }); log(`${P(ctx.p).name}'s creatures gain indestructible.`); },
  }],
});
C('Sheltering Light', {
  mc: '{W}', colors: 'W', types: ['Instant'], role: 'protect', protect: 'target',
  text: 'Target creature gains indestructible until end of turn. Scry 1.',
  choose: (ctx) => pickTarget(ctx, 'Target creature gains indestructible', anyCreature(), protectHintAI(ctx)),
  spell: async (ctx) => { const t = ctx.targets[0]; if (tOK(ctx, t)) tmpAdd(t, { kw: ['indestructible'] }); await scry(ctx.p, 1); },
});
C('Zack Fair', {
  mc: '{W}', colors: 'W', types: ['Legendary', 'Creature'], sub: 'Human Soldier', pt: [0, 1], entersCounters: { p1p1: 1 }, role: 'creature', protectAbility: 'target',
  text: "Zack Fair enters with a +1/+1 counter on it.\n{1}, Sacrifice Zack Fair: Target creature you control gains indestructible until end of turn. Put Zack Fair's counters on that creature and attach an Equipment that was attached to Zack Fair to that creature.",
  abilities: [{
    id: 'sac', label: '{1}, Sacrifice: target creature you control gains indestructible', cost: 1, speed: 'instant', sacSelf: true,
    choose: (ctx) => pickTarget(ctx, 'Target creature you control', c => isCreature(c) && c.ctrl === ctx.p && c !== ctx.card, protectHintAI(ctx)),
    resolve: async (ctx) => {
      const t = ctx.targets[0]; if (!tOK(ctx, t)) return;
      tmpAdd(t, { kw: ['indestructible'] });
      for (const k in ctx.lki.counters) addCounters(t, k, ctx.lki.counters[k]);
      const eq = ctx.lki.attached.map(findPerm).find(a => a && isEquipment(a));
      if (eq) attach(eq, t);
    },
  }],
});
C('Bastion Protector', {
  mc: '{2}{W}', colors: 'W', types: ['Creature'], sub: 'Human Soldier', pt: [3, 3], role: 'creature',
  text: 'Commander creatures you control get +2/+2 and have indestructible.',
  anthem: (s, c) => (c.ctrl === s.ctrl && c.isCmd && isCreature(c) ? { p: 2, t: 2, kw: ['indestructible'] } : null),
});

/* ---------------- deathtouch ---------------- */
C('Noxious Groodion', { mc: '{2}{B}', colors: 'B', types: ['Creature'], sub: 'Beast', pt: [2, 2], kw: ['deathtouch'], role: 'creature', text: 'Deathtouch' });
C('Yuan-Ti Fang-Blade', {
  mc: '{2}{B}', colors: 'B', types: ['Creature'], sub: 'Snake Rogue', pt: [2, 2], kw: ['deathtouch'], role: 'creature',
  text: 'Deathtouch\nWhenever Yuan-Ti Fang-Blade deals combat damage to a player, venture into the dungeon.',
  on: { combatDamagePlayer: async (s, { src }) => { if (src === s) await venture(s.ctrl); } },
});
C('Rancid Rats', { mc: '{1}{B}', colors: 'B', types: ['Creature'], sub: 'Zombie Rat', pt: [1, 1], kw: ['skulk', 'deathtouch'], role: 'creature', text: "Skulk (This creature can't be blocked by creatures with greater power.)\nDeathtouch" });
C('Dhund Operative', {
  mc: '{1}{B}', colors: 'B', types: ['Creature'], sub: 'Human Rogue', pt: [2, 2], role: 'creature',
  text: 'As long as you control an artifact, Dhund Operative gets +1/+0 and has deathtouch.',
  self: (c) => (c.zone === 'bf' && artifactsOf(c.ctrl).length ? { p: 1, kw: ['deathtouch'] } : null),
});
C('Touch of Moonglove', {
  mc: '{B}', colors: 'B', types: ['Instant'], role: 'trick',
  text: 'Target creature you control gets +1/+0 and gains deathtouch until end of turn. Whenever a creature dealt damage by that creature dies this turn, its controller loses 2 life.',
  choose: (ctx) => pickTarget(ctx, 'Target creature you control', ownCreature(ctx), cs => AIH.ownBest(cs, ctx)),
  spell: async (ctx) => { const t = ctx.targets[0]; if (!tOK(ctx, t)) return; tmpAdd(t, { p: 1, kw: ['deathtouch'] }); G.tf.moonglove.add(t.id); },
});
C('Typhoid Rats', { mc: '{B}', colors: 'B', types: ['Creature'], sub: 'Rat', pt: [1, 1], kw: ['deathtouch'], role: 'creature', text: 'Deathtouch' });
C('Gifted Aetherborn', { mc: '{B}{B}', colors: 'B', types: ['Creature'], sub: 'Aetherborn Vampire', pt: [2, 3], kw: ['deathtouch', 'lifelink'], role: 'creature', text: 'Deathtouch, lifelink' });
C('Vampire Nighthawk', { mc: '{1}{B}{B}', colors: 'B', types: ['Creature'], sub: 'Vampire Shaman', pt: [2, 3], kw: ['flying', 'deathtouch', 'lifelink'], role: 'creature', text: 'Flying, deathtouch, lifelink' });

/* ---------------- taggers & removal ---------------- */
C('Bleed Dry', {
  mc: '{2}{B}{B}', colors: 'B', types: ['Instant'], role: 'removal', threat: 'exile',
  text: 'Target creature gets -13/-13 until end of turn. If that creature would die this turn, exile it instead.',
  choose: (ctx) => pickTarget(ctx, 'Target creature gets -13/-13', anyCreature()),
  spell: async (ctx) => { const t = ctx.targets[0]; if (!tOK(ctx, t)) return; tmpAdd(t, { p: -13, t: -13 }); t.tmp.exileIfDies = true; },
});
C('Sorceress Queen', {
  mc: '{1}{B}{B}', colors: 'B', types: ['Creature'], sub: 'Human Wizard Sorcerer', pt: [1, 1], role: 'creature',
  text: '{T}: Target creature other than Sorceress Queen has base power and toughness 0/2 until end of turn.',
  abilities: [{
    id: 'shrink', label: '{T}: target creature becomes 0/2', cost: 0, tap: true, speed: 'instant',
    choose: (ctx) => pickTarget(ctx, 'Target creature other than Sorceress Queen has base 0/2', c => isCreature(c) && c !== ctx.card),
    resolve: async (ctx) => { const t = ctx.targets[0]; if (tOK(ctx, t)) { t.tmp.basePT = [0, 2]; log(`${t.name} has base power and toughness 0/2 this turn.`); } },
  }],
});
C('Tidy Conclusion', {
  mc: '{3}{B}{B}', colors: 'B', types: ['Instant'], role: 'removal', threat: 'destroy',
  text: 'Destroy target creature. You gain 1 life for each artifact you control.',
  choose: (ctx) => pickTarget(ctx, 'Destroy target creature', anyCreature()),
  spell: async (ctx) => { const t = ctx.targets[0]; if (tOK(ctx, t)) await destroy(t); gainLife(ctx.p, artifactsOf(ctx.p).length); },
});
C('Flesh to Dust', {
  mc: '{3}{B}{B}', colors: 'B', types: ['Instant'], role: 'removal', threat: 'destroy',
  text: "Destroy target creature. It can't be regenerated.",
  choose: (ctx) => pickTarget(ctx, 'Destroy target creature', anyCreature()),
  spell: async (ctx) => { const t = ctx.targets[0]; if (tOK(ctx, t)) await destroy(t); },
});
C('Murderous Compulsion', {
  mc: '{1}{B}', colors: 'B', types: ['Sorcery'], role: 'removal', threat: 'destroy', madness: 2, madnessMC: '{1}{B}',
  text: 'Destroy target tapped creature.\nMadness {1}{B} (If you discard this card, discard it into exile. When you do, cast it for its madness cost or put it into your graveyard.)',
  canCast: () => allCreatures().some(c => c.tapped),
  choose: (ctx) => pickTarget(ctx, 'Destroy target tapped creature', c => isCreature(c) && c.tapped),
  spell: async (ctx) => { const t = ctx.targets[0]; if (tOK(ctx, t)) await destroy(t); },
});
C('Compulsory Rest', {
  mc: '{1}{W}', colors: 'W', types: ['Enchantment', 'Aura'], enchant: 'creature', role: 'removal', threat: 'aura',
  text: 'Enchant creature\nEnchanted creature can\'t attack or block.\nEnchanted creature has "{2}, Sacrifice this creature: You gain 2 life."',
  choose: (ctx) => pickTarget(ctx, 'Enchant creature', anyCreature()),
  grantAbilities: (a, c) => [{ id: 'crest', label: '{2}, Sacrifice this creature: You gain 2 life', cost: 2, speed: 'instant', sacSelf: true, resolve: async (ctx) => { gainLife(ctx.p, 2); } }],
});
C('Jarl of the Forsaken', {
  mc: '{3}{B}', colors: 'B', types: ['Creature'], sub: 'Zombie Cleric', pt: [3, 2], flash: true, foretell: 2, foretellMC: '{1}{B}', role: 'creature',
  text: 'Flash\nWhen Jarl of the Forsaken enters, destroy target creature or planeswalker an opponent controls that was dealt damage this turn.\nForetell {1}{B}',
  etb: async (c) => {
    await trigger(c, c.ctrl, 'destroy target damaged creature', (ctx) => pickTarget(ctx, 'Destroy target creature an opponent controls that was dealt damage this turn', x => isCreature(x) && x.ctrl !== c.ctrl && x.perm.damagedTurn === G.turn), async (ctx) => { const t = ctx.targets[0]; if (tOK(ctx, t)) await destroy(t); });
  },
});
C('Tragic Banshee', {
  mc: '{4}{B}', colors: 'B', types: ['Creature'], sub: 'Spirit', pt: [5, 3], role: 'creature',
  text: 'Morbid — When this creature enters, target creature an opponent controls gets -1/-1 until end of turn. If a creature died this turn, that creature gets -13/-13 instead.',
  etb: async (c) => {
    await trigger(c, c.ctrl, 'Morbid shrink', (ctx) => pickTarget(ctx, 'Target creature an opponent controls', x => isCreature(x) && x.ctrl !== c.ctrl), async (ctx) => {
      const t = ctx.targets[0]; if (!tOK(ctx, t)) return;
      if (G.tf.died) tmpAdd(t, { p: -13, t: -13 }); else tmpAdd(t, { p: -1, t: -1 });
    });
  },
});
const tapperAbility = {
  id: 'tap', label: '{W}, {T}: Tap target creature', cost: '{W}', tap: true, speed: 'instant',
  choose: (ctx) => pickTarget(ctx, 'Tap target creature', c => isCreature(c), cs => AIH.oppThreat(cs.filter(c => !c.tapped), ctx)),
  resolve: async (ctx) => { const t = ctx.targets[0]; if (tOK(ctx, t)) { t.tapped = true; log(`${t.name} becomes tapped.`); } },
};
C("Gideon's Lawkeeper", { mc: '{W}', colors: 'W', types: ['Creature'], sub: 'Human Soldier', pt: [1, 1], role: 'creature', text: '{W}, {T}: Tap target creature.', abilities: [tapperAbility] });
C('Goldmeadow Harrier', { mc: '{W}', colors: 'W', types: ['Creature'], sub: 'Kithkin Soldier', pt: [1, 1], role: 'creature', text: '{W}, {T}: Tap target creature.', abilities: [tapperAbility] });
C('Blinding Mage', { mc: '{1}{W}', colors: 'W', types: ['Creature'], sub: 'Human Wizard', pt: [1, 2], role: 'creature', text: '{W}, {T}: Tap target creature.', abilities: [tapperAbility] });
C('Ravenous Chupacabra', {
  mc: '{2}{B}{B}', colors: 'B', types: ['Creature'], sub: 'Beast Horror', pt: [2, 2], role: 'creature', removalETB: true,
  text: 'When Ravenous Chupacabra enters, destroy target creature an opponent controls.',
  etb: async (c) => { await trigger(c, c.ctrl, 'destroy target creature', (ctx) => pickTarget(ctx, 'Destroy target creature an opponent controls', x => isCreature(x) && x.ctrl !== c.ctrl), async (ctx) => { const t = ctx.targets[0]; if (tOK(ctx, t)) await destroy(t); }); },
});
C('Skinrender', {
  mc: '{2}{B}{B}', colors: 'B', types: ['Creature'], sub: 'Phyrexian Zombie', pt: [3, 3], role: 'creature', removalETB: true,
  text: 'When Skinrender enters, put three -1/-1 counters on target creature.',
  etb: async (c) => { await trigger(c, c.ctrl, 'three -1/-1 counters', (ctx) => pickTarget(ctx, 'Put three -1/-1 counters on target creature', anyCreature()), async (ctx) => { const t = ctx.targets[0]; if (tOK(ctx, t)) addCounters(t, 'm1m1', 3); }); },
});
C('Go for the Throat', {
  mc: '{1}{B}', colors: 'B', types: ['Instant'], role: 'removal', threat: 'destroy', text: 'Destroy target nonartifact creature.',
  choose: (ctx) => pickTarget(ctx, 'Destroy target nonartifact creature', c => isCreature(c) && !isArtifact(c)),
  spell: async (ctx) => { const t = ctx.targets[0]; if (tOK(ctx, t)) await destroy(t); },
});
C('Doom Blade', {
  mc: '{1}{B}', colors: 'B', types: ['Instant'], role: 'removal', threat: 'destroy', text: 'Destroy target nonblack creature.',
  choose: (ctx) => pickTarget(ctx, 'Destroy target nonblack creature', c => isCreature(c) && !colorsOf(c).includes('B')),
  spell: async (ctx) => { const t = ctx.targets[0]; if (tOK(ctx, t)) await destroy(t); },
});
C('Hex', {
  mc: '{4}{B}{B}', colors: 'B', types: ['Sorcery'], role: 'removal', threat: 'destroy', text: 'Destroy six target creatures.',
  canCast: (ctx) => allCreatures().filter(c => canTarget(c, ctx.p, ctx.card)).length >= 6,
  choose: async (ctx) => {
    const cands = allCreatures().filter(c => canTarget(c, ctx.p, ctx.card));
    const picks = await chooseCards(ctx.p, { prompt: 'Hex: choose exactly six target creatures', cands, min: 6, max: 6, ai: cs => AIH.hexPick(ctx.p, cs) });
    if (picks.length !== 6) return false;
    picks.forEach(c => addTarget(ctx, c));
    return true;
  },
  spell: async (ctx) => { await destroyMany(ctx.targets.filter(t => tOK(ctx, t))); },
});

/* ---------------- blockers, recursion, draw ---------------- */
C('Unhallowed Phalanx', { mc: '{4}{B}', colors: 'B', types: ['Creature'], sub: 'Zombie Soldier', pt: [1, 13], entersTapped: true, role: 'creature', text: 'Unhallowed Phalanx enters tapped.' });
C('Gravedigger', {
  mc: '{3}{B}', colors: 'B', types: ['Creature'], sub: 'Zombie', pt: [2, 2], role: 'creature',
  text: 'When Gravedigger enters, you may return target creature card from your graveyard to your hand.',
  etb: async (c) => {
    await trigger(c, c.ctrl, 'return creature card', async (ctx) => {
      const cands = P(c.ctrl).gy.filter(x => isCreature(x));
      const k = await chooseCard(c.ctrl, { prompt: 'Gravedigger: return target creature card from your graveyard (optional)', cands, optional: true, ai: cs => AIH.bestCard(cs) });
      if (!k) return false; addTarget(ctx, k); return true;
    }, async (ctx) => { const t = ctx.targets[0]; if (tOK(ctx, t)) { moveTo(t, 'hand'); log(`${t.name} returns to hand.`); } });
  },
});
C('March of the Returned', {
  mc: '{3}{B}', colors: 'B', types: ['Sorcery'], role: 'recursion',
  text: 'Return up to two target creature cards from your graveyard to your hand.',
  canCast: (ctx) => P(ctx.p).gy.some(isCreature),
  choose: async (ctx) => {
    const picks = await chooseCards(ctx.p, { prompt: 'Return up to two creature cards', cands: P(ctx.p).gy.filter(isCreature), min: 1, max: 2, ai: cs => AIH.sortCards(cs).slice(0, 2) });
    picks.forEach(c => addTarget(ctx, c));
    return picks.length > 0;
  },
  spell: async (ctx) => { for (const t of ctx.targets) if (tOK(ctx, t)) moveTo(t, 'hand'); },
});
C('Grisly Transformation', {
  mc: '{2}{B}', colors: 'B', types: ['Enchantment', 'Aura'], enchant: 'creature', role: 'evasion',
  text: 'Enchant creature\nWhen Grisly Transformation enters, draw a card.\nEnchanted creature has intimidate.',
  choose: (ctx) => pickTarget(ctx, 'Enchant creature', anyCreature(), cs => AIH.ownBest(cs, ctx)),
  etb: async (c) => { await drawCards(c.ctrl, 1); },
  attachBuff: () => ({ kw: ['intimidate'] }),
});

/* ---------------- ramp ---------------- */
C('Arcane Signet', { mc: '{2}', types: ['Artifact'], mana: 1, prod: 'ident', role: 'ramp', text: "{T}: Add one mana of any color in your commander's color identity." });
C('Orzhov Signet', { mc: '{2}', types: ['Artifact'], mana: 1, prod: ['WB'], role: 'ramp', text: '{1}, {T}: Add {W}{B}.' });
C('Mind Stone', {
  mc: '{2}', types: ['Artifact'], mana: 1, colorlessMana: true, role: 'ramp', text: '{T}: Add {C}.\n{1}, {T}, Sacrifice Mind Stone: Draw a card.',
  abilities: [{ id: 'draw', label: '{1}, {T}, Sacrifice: Draw a card', cost: 1, tap: true, sacSelf: true, speed: 'instant', hideFromAutoStop: true, resolve: async (ctx) => { await drawCards(ctx.p, 1); } }],
});
C('Talisman of Hierarchy', { mc: '{2}', types: ['Artifact'], mana: 1, prod: ['WBC'], role: 'ramp', text: '{T}: Add {C}.\n{T}: Add {W} or {B}. Talisman of Hierarchy deals 1 damage to you.' });
C('Sol Ring', { mc: '{1}', types: ['Artifact'], mana: 2, colorlessMana: true, role: 'ramp', text: '{T}: Add {C}{C}.' });

/* ---------------- evasion ---------------- */
C('Whispersilk Cloak', {
  mc: '{3}', types: ['Artifact'], equip: 2, role: 'equipment', text: "Equipped creature can't be blocked and has shroud.\nEquip {2}",
  attachBuff: () => ({ kw: ['unblockable', 'shroud'] }),
}); CARDS['Whispersilk Cloak'].types.push('Equipment');
C('Gift of Orzhova', {
  mc: '{1}{W/B}{W/B}', colors: 'WB', types: ['Enchantment', 'Aura'], enchant: 'creature', role: 'evasion',
  text: 'Enchant creature\nEnchanted creature gets +1/+1 and has flying and lifelink.',
  choose: (ctx) => pickTarget(ctx, 'Enchant creature', anyCreature(), cs => AIH.ownBest(cs, ctx)),
  attachBuff: () => ({ p: 1, t: 1, kw: ['flying', 'lifelink'] }),
});
C('Behind the Scenes', {
  mc: '{2}{B}', colors: 'B', types: ['Enchantment'], role: 'evasion',
  text: "Creatures you control have skulk. (They can't be blocked by creatures with greater power.)\n{4}{W}: Creatures you control get +1/+1 until end of turn.",
  anthem: (s, c) => (c.ctrl === s.ctrl && isCreature(c) ? { kw: ['skulk'] } : null),
  abilities: [{ id: 'pump', label: '{4}{W}: Creatures you control get +1/+1', cost: '{4}{W}', speed: 'instant', hideFromAutoStop: true, resolve: async (ctx) => { for (const c of creatures(ctx.p)) tmpAdd(c, { p: 1, t: 1 }); } }],
});
C("Prowler's Helm", {
  mc: '{2}', types: ['Artifact', 'Equipment'], equip: 2, role: 'equipment', text: "Equipped creature can't be blocked except by Walls.\nEquip {2}",
  attachBuff: () => ({ kw: ['onlyWalls'] }),
});

/* ---------------- engine, draw, tutors ---------------- */
C('Teysa Karlov', {
  mc: '{2}{W}{B}', colors: 'WB', types: ['Legendary', 'Creature'], sub: 'Human Advisor', pt: [2, 4], role: 'creature',
  text: 'If a creature dying causes a triggered ability of a permanent you control to trigger, that ability triggers an additional time.\nCreature tokens you control have vigilance and lifelink.',
  anthem: (s, c) => (c.ctrl === s.ctrl && c.token && isCreature(c) ? { kw: ['vigilance', 'lifelink'] } : null),
});
C("Night's Whisper", { mc: '{1}{B}', colors: 'B', types: ['Sorcery'], role: 'draw', text: 'You draw two cards and you lose 2 life.', spell: async (ctx) => { await drawCards(ctx.p, 2); loseLife(ctx.p, 2); } });
C('Diabolic Tutor', {
  mc: '{2}{B}{B}', colors: 'B', types: ['Sorcery'], role: 'tutor', text: 'Search your library for a card, put that card into your hand, then shuffle.',
  spell: async (ctx) => { const p = await searchLibrary(ctx.p, () => true, { prompt: 'Diabolic Tutor: choose any card', ai: cs => [AIH.tutorPick(ctx.p, cs)] }); for (const c of p) { moveTo(c, 'hand'); log(`${P(ctx.p).name} tutors a card.`); } },
});
C("Steelshaper's Gift", {
  mc: '{W}', colors: 'W', types: ['Sorcery'], role: 'tutor', text: 'Search your library for an Equipment card, reveal that card, put it into your hand, then shuffle.',
  spell: async (ctx) => { const p = await searchLibrary(ctx.p, isEquipment, { prompt: 'Choose an Equipment', ai: cs => [AIH.bestCard(cs)] }); for (const c of p) { moveTo(c, 'hand'); log(`${P(ctx.p).name} reveals ${c.name}.`); } },
});
C('Settle the Wreckage', {
  mc: '{2}{W}{W}', colors: 'W', types: ['Instant'], role: 'combatWipe',
  text: 'Exile all attacking creatures target player controls. That player may search their library for that many basic land cards, put those cards onto the battlefield tapped, then shuffle.',
  choose: (ctx) => pickPlayerTarget(ctx, 'Settle the Wreckage: target player', cs => cs.find(x => x.pi !== ctx.p)),
  spell: async (ctx) => {
    const t = ctx.targets[0]; if (!tOK(ctx, t)) return;
    const atk = G.combat ? G.combat.atk.map(a => a.c).filter(c => c.zone === 'bf' && c.ctrl === t.pi) : [];
    for (const c of atk) await exileC(c);
    if (atk.length) await fetchBasicsToBF(t.pi, atk.length, { tapped: true });
  },
});

/* ---------------- upgrades ---------------- */
C('Ghostly Prison', { mc: '{2}{W}', colors: 'W', types: ['Enchantment'], role: 'tax', text: "Creatures can't attack you unless their controller pays {2} for each creature they control that's attacking you." });
C('Skullclamp', {
  mc: '{1}', types: ['Artifact', 'Equipment'], equip: 1, role: 'equipment', text: 'Equipped creature gets +1/-1.\nWhenever equipped creature dies, draw two cards.\nEquip {1}',
  attachBuff: () => ({ p: 1, t: -1 }),
  on: { dies: async (s, { lki, mult }) => { if (lki.attached.includes(s.id)) { log(`Skullclamp: ${P(s.ctrl).name} draws ${2 * mult}.`); await drawCards(s.ctrl, 2 * mult); } } },
});
C('Blood Artist', {
  mc: '{1}{B}', colors: 'B', types: ['Creature'], sub: 'Vampire', pt: [0, 1], role: 'creature',
  text: 'Whenever Blood Artist or another creature dies, target player loses 1 life and you gain 1 life.',
  on: { dies: async (s, { mult }) => { const o = opp(s.ctrl); for (let i = 0; i < mult; i++) { loseLife(o, 1); gainLife(s.ctrl, 1); } log(`Blood Artist drains ${mult}.`); } },
});
C('Swiftfoot Boots', { mc: '{2}', types: ['Artifact', 'Equipment'], equip: 1, role: 'equipment', text: 'Equipped creature has hexproof and haste.\nEquip {1}', attachBuff: () => ({ kw: ['hexproof', 'haste'] }) });
C('Darksteel Plate', { mc: '{3}', types: ['Artifact', 'Equipment'], equip: 2, kw: ['indestructible'], role: 'equipment', text: 'Indestructible\nEquipped creature has indestructible.\nEquip {2}', attachBuff: () => ({ kw: ['indestructible'] }) });

/* ---------------- lands ---------------- */
C("Rogue's Passage", {
  types: ['Land'], mana: 1, colorlessMana: true, text: "{T}: Add {C}.\n{4}, {T}: Target creature can't be blocked this turn.",
  abilities: [{ id: 'unb', label: "{4}, {T}: Target creature can't be blocked this turn", cost: 4, tap: true, speed: 'instant', hideFromAutoStop: true, choose: (ctx) => pickTarget(ctx, "Target creature can't be blocked this turn", anyCreature(), cs => AIH.ownBest(cs, ctx)), resolve: async (ctx) => { const t = ctx.targets[0]; if (tOK(ctx, t)) t.tmp.unblockable = true; } }],
});
C('Scoured Barrens', { types: ['Land'], mana: 1, prod: ['WB'], entersTapped: true, text: 'Scoured Barrens enters tapped.\nWhen Scoured Barrens enters, you gain 1 life.\n{T}: Add {W} or {B}.', etb: async (c) => { gainLife(c.ctrl, 1); } });
C('Orzhov Basilica', {
  types: ['Land'], mana: 2, prod: ['W', 'B'], entersTapped: true, text: "Orzhov Basilica enters tapped.\nWhen Orzhov Basilica enters, return a land you control to its owner's hand.\n{T}: Add {W}{B}.",
  etb: async (c) => {
    const lands = perms(c.ctrl).filter(isLand);
    const k = await chooseCard(c.ctrl, { prompt: 'Orzhov Basilica: return a land you control to hand', cands: lands, ai: cs => cs.find(l => l !== c && l.tapped && isBasic(l)) || cs.find(l => l !== c && isBasic(l)) || cs[0] });
    if (k) { moveTo(k, 'hand'); log(`${k.name} returns to hand.`); }
  },
});
