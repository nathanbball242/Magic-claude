'use strict';
/* =====================================================================
   Generic Oracle-text interpreter for decks people build themselves.
   Hand-written scripts (the other cards-*.js files) always win. Any other
   card is built from its Oracle text: keywords, mana abilities, common
   triggered / activated abilities and spell effects are automated; text
   that matches no template is listed on the card as "not automated" and
   can be resolved with the manual controls in the card view.
   ===================================================================== */

/* ---------------- card database ---------------- */
const CardDB = {
  data: null, lower: null, loading: null, source: null,
  async load() {
    if (this.data) return this.data;
    if (!this.loading) this.loading = (async () => {
      for (const url of ['cards-db.json', 'data/cards-db.json']) {
        try {
          const r = await fetch(url);
          if (r.ok) { this.data = await r.json(); this.source = 'bundled'; break; }
        } catch (e) { /* try next */ }
      }
      if (!this.data) { this.data = {}; this.source = 'remote'; }
      this.index();
      return this.data;
    })();
    return this.loading;
  },
  index() { this.lower = new Map(); for (const k of Object.keys(this.data)) this.lower.set(k.toLowerCase(), k); },
  find(name) {
    if (!this.lower) return null;
    const k = this.lower.get(String(name).toLowerCase().trim());
    return k ? [k, this.data[k]] : null;
  },
  // When the bundled file is not reachable (e.g. opened from disk), ask Scryfall for missing names.
  async fetchMissing(names) {
    const missing = names.filter(n => !this.find(n) && !CARDS[n]);
    for (let i = 0; i < missing.length; i += 70) {
      const chunk = missing.slice(i, i + 70);
      try {
        const r = await fetch('https://api.scryfall.com/cards/collection', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifiers: chunk.map(name => ({ name })) }) });
        if (!r.ok) continue;
        const j = await r.json();
        for (const c of j.data || []) {
          const f = c.card_faces ? c.card_faces[0] : c;
          const rec = { m: f.mana_cost || c.mana_cost || '', t: f.type_line || c.type_line || '', o: f.oracle_text || c.oracle_text || '' };
          if (f.power != null) { rec.p = f.power; rec.d = f.toughness; }
          const cols = (f.colors || c.colors || []).join(''); if (cols) rec.c = cols;
          rec.i = (c.color_identity || []).join('');
          this.data[c.name] = rec; if (c.card_faces) this.data[c.card_faces[0].name] = rec;
        }
      } catch (e) { break; }
      this.index();
    }
  },
};

/* ---------------- decklist parsing ---------------- */
function cleanCardName(line) {
  return line.replace(/\s+\*[A-Z]+\*\s*$/g, '').replace(/\s+\([A-Za-z0-9]{2,6}\)\s*[\w-]*\s*$/, '').replace(/\s+\[[^\]]*\]\s*$/, '').replace(/\s+#.*$/, '').trim();
}
function parseDecklist(text, commanderField) {
  const out = { commander: null, cards: [], unknown: [], lines: 0 };
  let section = '';
  const add = (name, n, isCmd) => {
    const hit = CardDB.find(name) || (CARDS[name] ? [name, null] : null);
    const real = hit ? hit[0] : name;
    if (!hit) { out.unknown.push(name); return; }
    if (isCmd) { out.commander = real; return; }
    const e = out.cards.find(x => x[0] === real);
    if (e) e[1] += n; else out.cards.push([real, n]);
  };
  for (let raw of String(text).split(/\r?\n/)) {
    let line = raw.trim();
    if (!line || line.startsWith('//') && !/commander/i.test(line)) continue;
    if (/^(\/\/\s*)?(commander|command zone)s?:?\s*$/i.test(line)) { section = 'cmd'; continue; }
    if (/^(\/\/\s*)?(deck|main ?deck|mainboard|companion|sideboard|maybeboard|creatures?|lands?|instants?|sorcer(y|ies)|artifacts?|enchantments?|planeswalkers?|other)\s*(\(\d+\))?:?\s*$/i.test(line)) { section = /side|maybe/i.test(line) ? 'skip' : 'main'; continue; }
    if (section === 'skip') continue;
    let isCmd = section === 'cmd' || /\*CMDR\*/i.test(line);
    const m = line.match(/^commander:\s*(.+)$/i);
    if (m) { add(cleanCardName(m[1]), 1, true); continue; }
    const q = line.match(/^(\d+)\s*x?\s+(.+)$/i);
    const n = q ? +q[1] : 1;
    const name = cleanCardName(q ? q[2] : line);
    if (!name) continue;
    out.lines++;
    add(name, n, isCmd);
  }
  if (commanderField && commanderField.trim()) {
    const hit = CardDB.find(cleanCardName(commanderField)) || (CARDS[commanderField.trim()] ? [commanderField.trim()] : null);
    if (hit) out.commander = hit[0]; else out.unknown.push(commanderField.trim());
  }
  if (out.commander) { const e = out.cards.find(x => x[0] === out.commander); if (e) { e[1]--; if (e[1] <= 0) out.cards.splice(out.cards.indexOf(e), 1); } }
  return out;
}

/* ---------------- text helpers ---------------- */
const NUMW = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const num = (w, ctx) => (w === 'x' ? (ctx && ctx.x) || 0 : NUMW[w] != null ? NUMW[w] : (/^\d+$/.test(w) ? +w : null));
const KW_SIMPLE = { flying: 'flying', reach: 'reach', deathtouch: 'deathtouch', lifelink: 'lifelink', trample: 'trample', haste: 'haste', vigilance: 'vigilance', menace: 'menace', 'first strike': 'firststrike', 'double strike': 'doublestrike', indestructible: 'indestructible', hexproof: 'hexproof', shroud: 'shroud', defender: 'defender', intimidate: 'intimidate', skulk: 'skulk', flash: 'flash', swampwalk: 'swampwalk' };
const COLOR_WORD = { white: 'W', blue: 'U', black: 'B', red: 'R', green: 'G' };
function kwList(s) {
  const out = [];
  for (const part of s.split(/,\s*|\s+and\s+/)) {
    const p = part.trim().toLowerCase();
    if (KW_SIMPLE[p]) out.push(KW_SIMPLE[p]);
    else return null;
  }
  return out;
}
function normalizeText(name, text) {
  let t = String(text || '').replace(/\([^)]*\)/g, '').replace(/[ \t]+/g, ' ');
  const short = name.split(',')[0];
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  t = t.replace(new RegExp(esc(name), 'g'), '~');
  if (short.length > 3 && short !== name) t = t.replace(new RegExp('\\b' + esc(short) + '\\b', 'g'), '~');
  t = t.replace(/\bthis (creature|artifact|enchantment|land|equipment|vehicle|permanent|spell|aura)\b/gi, '~');
  return t.split('\n').map(x => x.trim()).filter(Boolean)
    // ability words and flavor words: "Cheer — Whenever ..." -> "Whenever ..."
    .map(x => x.replace(/^(?!Choose\b)(?:[A-Z][\w'!,.-]*(?: [\w'!,.-]+){0,5}) — (?=[A-Z{~]|\{)/, ''));
}

/* ---------------- target noun phrases ---------------- */
function nounFilter(phrase) {
  let p = phrase.toLowerCase().trim();
  const conds = [];
  let m;
  if ((m = p.match(/\s+an opponent controls$/)) || (m = p.match(/\s+you don't control$/))) { conds.push((c, ctx) => c.ctrl !== ctx.p); p = p.slice(0, m.index); }
  else if ((m = p.match(/\s+you control$/))) { conds.push((c, ctx) => c.ctrl === ctx.p); p = p.slice(0, m.index); }
  if ((m = p.match(/\s+with (power|toughness|mana value) (\d+) or (greater|less)$/))) {
    const [, stat, n, dir] = m; const v = +n;
    const get = (c) => (stat === 'power' ? pow(c) : stat === 'toughness' ? tou(c) : mv(c));
    conds.push((c) => (dir === 'greater' ? get(c) >= v : get(c) <= v)); p = p.slice(0, m.index);
  }
  if ((m = p.match(/\s+with flying$/))) { conds.push(c => has(c, 'flying')); p = p.slice(0, m.index); }
  const adj = [];
  for (;;) {
    if ((m = p.match(/^(tapped|untapped|attacking|blocking|attacking or blocking|legendary)\s+/))) { adj.push(m[1]); p = p.slice(m[0].length); continue; }
    if ((m = p.match(/^non(\w+)\s+/))) { adj.push('non' + m[1]); p = p.slice(m[0].length); continue; }
    break;
  }
  const typeTest = {
    creature: isCreature, artifact: isArtifact, enchantment: isEnchantment, land: isLand, permanent: () => true, planeswalker: () => false,
    'creature or planeswalker': isCreature, 'artifact or enchantment': c => isArtifact(c) || isEnchantment(c), 'artifact or creature': c => isArtifact(c) || isCreature(c),
    'creature or vehicle': c => isCreature(c) || hasType(c, 'Vehicle'), 'artifact, enchantment, or planeswalker': c => isArtifact(c) || isEnchantment(c),
    'artifact, creature, or enchantment': c => isArtifact(c) || isCreature(c) || isEnchantment(c),
  };
  const base = typeTest[p];
  if (!base) return null;
  for (const a of adj) {
    if (a === 'tapped') conds.push(c => c.tapped);
    else if (a === 'untapped') conds.push(c => !c.tapped);
    else if (a === 'attacking') conds.push(c => !!(G.combat && G.combat.atk.some(x => x.c === c)));
    else if (a === 'blocking') conds.push(c => !!(G.combat && G.combat.atk.some(x => x.blockers.includes(c))));
    else if (a === 'attacking or blocking') conds.push(c => !!(G.combat && G.combat.atk.some(x => x.c === c || x.blockers.includes(c))));
    else if (a === 'legendary') conds.push(isLegendary);
    else if (a === 'nonland') conds.push(c => !isLand(c));
    else if (a === 'noncreature') conds.push(c => !isCreature(c));
    else if (a === 'nonartifact') conds.push(c => !isArtifact(c));
    else if (a === 'nontoken') conds.push(c => !c.token);
    else if (a === 'nonlegendary') conds.push(c => !isLegendary(c));
    else { const col = COLOR_WORD[a.slice(3)]; if (col) conds.push(c => !colorsOf(c).includes(col)); else return null; }
  }
  return (c, ctx) => base(c) && conds.every(f => f(c, ctx));
}

/* ---------------- effects ---------------- */
// Each compiled step: { target?: {kind, filter, harmful, optional, prompt}, run: async (ctx, t, src) }
function compileSentence(s) {
  let t = s.toLowerCase().replace(/\.$/, '').trim();
  let optional = false;
  t = t.replace(/^then,?\s+/, '');
  let ifDo = false;
  if (/^(if you do|when you do),\s*/.test(t)) { ifDo = true; t = t.replace(/^(if you do|when you do),\s*/, ''); }
  if (/^you may /.test(t)) { optional = true; t = t.replace(/^you may /, ''); }
  let m;
  const step = (o) => Object.assign({ optional, ifDo }, o);
  const self = (ctx) => ctx.card;
  // draw
  if ((m = t.match(/^(?:you )?draws? (a|an|one|two|three|four|five|six|seven|x|\d+) cards?$/))) return step({ run: async (ctx) => drawCards(ctx.p, num(m[1], ctx)) });
  if ((m = t.match(/^(?:you )?draw (\w+) cards? and (?:you )?lose (\w+) life$/))) return step({ run: async (ctx) => { await drawCards(ctx.p, num(m[1], ctx)); loseLife(ctx.p, num(m[2], ctx)); } });
  if ((m = t.match(/^(?:you )?draw (\w+) cards?, then discard (\w+) cards?$/))) return step({ run: async (ctx) => { await drawCards(ctx.p, num(m[1], ctx)); await discardN(ctx.p, num(m[2], ctx)); } });
  if ((m = t.match(/^target player draws (\w+) cards?$/))) return step({ target: { kind: 'player', harmful: false }, run: async (ctx, tg) => drawCards(tg.pi, num(m[1], ctx)) });
  if ((m = t.match(/^each player draws (\w+) cards?$/))) return step({ run: async (ctx) => { for (const pi of apnap()) await drawCards(pi, num(m[1], ctx)); } });
  // life
  if ((m = t.match(/^(?:you )?gain (\w+) life$/))) return step({ run: async (ctx) => gainLife(ctx.p, num(m[1], ctx)) });
  if ((m = t.match(/^(?:you )?lose (\w+) life$/))) return step({ run: async (ctx) => loseLife(ctx.p, num(m[1], ctx)) });
  if ((m = t.match(/^each opponent loses (\w+) life(?: and you gain (\w+) life)?$/))) return step({ run: async (ctx) => { for (const o of opps(ctx.p)) loseLife(o, num(m[1], ctx)); if (m[2]) gainLife(ctx.p, num(m[2], ctx)); } });
  if ((m = t.match(/^target (?:player|opponent) loses (\w+) life(?: and you gain (\w+) life)?$/))) return step({ target: { kind: 'player', harmful: true }, run: async (ctx, tg) => { loseLife(tg.pi, num(m[1], ctx)); if (m[2]) gainLife(ctx.p, num(m[2], ctx)); } });
  // damage
  if ((m = t.match(/^~ deals (\w+) damage to (.+)$/))) {
    const n = m[1], who = m[2];
    const dmg = (ctx, tg) => dealDamage(ctx.card, tg, num(n, ctx));
    if (who === 'any target' || who === 'target creature or player' || who === 'target player or planeswalker' || who === 'target creature, player, or planeswalker') return step({ target: { kind: 'any', harmful: true, filter: isCreature }, run: async (ctx, tg) => dmg(ctx, tg) });
    if (who === 'target player' || who === 'target opponent' || who === 'target player or planeswalker' || who === 'target opponent or planeswalker') return step({ target: { kind: 'player', harmful: true }, run: async (ctx, tg) => dmg(ctx, tg) });
    if (who === 'each opponent') return step({ run: async (ctx) => { for (const o of opps(ctx.p)) dmg(ctx, PL(o)); } });
    if (who === 'each player') return step({ run: async (ctx) => { for (const o of apnap()) dmg(ctx, PL(o)); } });
    if (who === 'each creature') return step({ run: async (ctx) => { for (const c of allCreatures()) dmg(ctx, c); await sba(); } });
    if (who === 'each creature and each player' || who === 'each creature and each opponent') return step({ run: async (ctx) => { for (const c of allCreatures()) dmg(ctx, c); for (const o of (who.endsWith('player') ? apnap() : opps(ctx.p))) dmg(ctx, PL(o)); await sba(); } });
    if (who === 'each creature your opponents control' || who === 'each creature you don\'t control') return step({ run: async (ctx) => { for (const c of opps(ctx.p).flatMap(creatures)) dmg(ctx, c); await sba(); } });
    let tm = who.match(/^target (.+)$/);
    if (tm) { const f = nounFilter(tm[1]); if (f) return step({ target: { kind: 'perm', filter: f, harmful: true }, run: async (ctx, tg) => dmg(ctx, tg) }); }
    return null;
  }
  // destroy / exile / bounce
  if ((m = t.match(/^(destroy|exile) target (.+?)(?:\. it can't be regenerated)?$/))) {
    const verb = m[1]; let phrase = m[2];
    const f = nounFilter(phrase);
    if (!f) return null;
    return step({ target: { kind: 'perm', filter: f, harmful: true }, role: isCreatureNoun(phrase) ? 'removal' : 'removal', run: async (ctx, tg) => (verb === 'destroy' ? destroy(tg) : exileC(tg)) });
  }
  if ((m = t.match(/^(destroy|exile) all (creatures|artifacts|enchantments|nonland permanents|other creatures|creatures your opponents control|creatures you don't control|artifacts and enchantments|tapped creatures|attacking creatures|creatures with power (\d+) or (greater|less))$/))) {
    const verb = m[1], what = m[2];
    const pick = (ctx) => {
      if (what === 'creatures') return allCreatures();
      if (what === 'other creatures') return allCreatures().filter(c => c !== ctx.card);
      if (what === 'artifacts') return allPerms().filter(isArtifact);
      if (what === 'enchantments') return allPerms().filter(isEnchantment);
      if (what === 'artifacts and enchantments') return allPerms().filter(c => isArtifact(c) || isEnchantment(c));
      if (what === 'nonland permanents') return allPerms().filter(c => !isLand(c));
      if (what === 'tapped creatures') return allCreatures().filter(c => c.tapped);
      if (what === 'attacking creatures') return G.combat ? G.combat.atk.map(a => a.c).filter(c => c.zone === 'bf') : [];
      if (m[3]) return allCreatures().filter(c => (m[4] === 'greater' ? pow(c) >= +m[3] : pow(c) <= +m[3]));
      return opps(ctx.p).flatMap(creatures);
    };
    return step({ role: 'wipe', run: async (ctx) => { const v = pick(ctx); if (verb === 'destroy') await destroyMany(v); else for (const c of v) await exileC(c); } });
  }
  if ((m = t.match(/^return target (.+?) to (?:its owner's|their owners'|its owners') hands?$/))) {
    const f = nounFilter(m[1]); if (!f) return null;
    return step({ target: { kind: 'perm', filter: f, harmful: true }, run: async (ctx, tg) => bounce(tg) });
  }
  // pump / shrink
  if ((m = t.match(/^(target creature(?: you control)?|~) gets ([+-]\d+)\/([+-]\d+)(?: and gains ([a-z ,]+?))? until end of turn$/))) {
    const p = +m[2], q = +m[3], kws = m[4] ? kwList(m[4]) : [];
    if (kws === null) return null;
    const harmful = p < 0 || q < 0;
    const own = /you control/.test(m[1]);
    if (m[1] === '~') return step({ run: async (ctx) => { if (ctx.card.zone === 'bf') tmpAdd(ctx.card, { p, t: q, kw: kws }); } });
    return step({ target: { kind: 'perm', filter: own ? (c, ctx) => isCreature(c) && c.ctrl === ctx.p : isCreature, harmful }, run: async (ctx, tg) => tmpAdd(tg, { p, t: q, kw: kws }) });
  }
  if ((m = t.match(/^(target creature(?: you control)?|~) gains ([a-z ,]+?) until end of turn$/))) {
    const kws = kwList(m[2]); if (!kws) return null;
    if (m[1] === '~') return step({ run: async (ctx) => { if (ctx.card.zone === 'bf') tmpAdd(ctx.card, { kw: kws }); } });
    return step({ target: { kind: 'perm', filter: isCreature, harmful: false }, run: async (ctx, tg) => tmpAdd(tg, { kw: kws }) });
  }
  if ((m = t.match(/^(other )?creatures you control get ([+-]\d+)\/([+-]\d+)(?: and gain ([a-z ,]+?))? until end of turn$/))) {
    const p = +m[2], q = +m[3], kws = m[4] ? kwList(m[4]) : []; if (kws === null) return null;
    return step({ run: async (ctx) => { for (const c of creatures(ctx.p)) if (!m[1] || c !== ctx.card) tmpAdd(c, { p, t: q, kw: kws }); } });
  }
  if ((m = t.match(/^creatures you control gain ([a-z ,]+?) until end of turn$/))) { const kws = kwList(m[1]); if (!kws) return null; return step({ role: 'protect', run: async (ctx) => { for (const c of creatures(ctx.p)) tmpAdd(c, { kw: kws }); } }); }
  if ((m = t.match(/^target creature can't block this turn$/))) return step({ target: { kind: 'perm', filter: isCreature, harmful: true }, run: async (ctx, tg) => { tg.tmp.cantBlock = true; } });
  if ((m = t.match(/^target creature can't be blocked this turn$/))) return step({ target: { kind: 'perm', filter: isCreature, harmful: false }, run: async (ctx, tg) => { tg.tmp.unblockable = true; } });
  // counters
  if ((m = t.match(/^put (a|an|one|two|three|four|five|x|\d+) \+1\/\+1 counters? on (target creature(?: you control)?|~|each creature you control|each other creature you control)$/))) {
    const who = m[2];
    if (who === '~') return step({ run: async (ctx) => { if (ctx.card.zone === 'bf') addCounters(ctx.card, 'p1p1', num(m[1], ctx)); } });
    if (who.startsWith('each')) return step({ run: async (ctx) => { for (const c of creatures(ctx.p)) if (who === 'each creature you control' || c !== ctx.card) addCounters(c, 'p1p1', num(m[1], ctx)); } });
    return step({ target: { kind: 'perm', filter: /you control/.test(who) ? (c, ctx) => isCreature(c) && c.ctrl === ctx.p : isCreature, harmful: false }, run: async (ctx, tg) => addCounters(tg, 'p1p1', num(m[1], ctx)) });
  }
  if ((m = t.match(/^put (a|an|one|two|three|x|\d+) -1\/-1 counters? on target (.+)$/))) { const f = nounFilter(m[2]); if (!f) return null; return step({ target: { kind: 'perm', filter: f, harmful: true }, run: async (ctx, tg) => addCounters(tg, 'm1m1', num(m[1], ctx)) }); }
  if (t === 'proliferate') return step({ run: async (ctx) => { for (const c of allPerms()) { const own = c.ctrl === ctx.p; for (const k of Object.keys(c.counters)) if (c.counters[k] > 0 && ((own && k !== 'm1m1') || (!own && k === 'm1m1'))) addCounters(c, k, 1); } } });
  // tokens
  if ((m = t.match(/^create (a|an|one|two|three|four|five|x|\d+) (?:tapped )?(treasure|clue|food|blood) tokens?$/))) {
    const kind = m[2][0].toUpperCase() + m[2].slice(1);
    return step({ run: async (ctx) => createToken(ctx.p, kind === 'Treasure' ? 'Treasure' : kind, num(m[1], ctx), { tapped: /tapped/.test(t) }) });
  }
  if ((m = t.match(/^create (a|an|one|two|three|four|five|x|\d+) (tapped )?(\d+)\/(\d+) ([a-z ]+?) (artifact )?creature tokens?(?: with ([a-z ,]+?))?(?: named [^,]+)?$/))) {
    const n = m[1], p = +m[3], q = +m[4], words = m[5].split(' '), art = !!m[6];
    const kws = m[7] ? kwList(m[7]) : []; if (kws === null) return null;
    let colors = ''; const sub = [];
    for (const w of words) { if (COLOR_WORD[w]) colors += COLOR_WORD[w]; else if (w !== 'colorless' && w !== 'and') sub.push(w[0].toUpperCase() + w.slice(1)); }
    const tname = `${sub.join(' ') || 'Token'} ${p}/${q}${kws.length ? ' ' + kws.join(' ') : ''}${colors ? ' ' + colors : ''}`;
    if (!CARDS[tname]) C(tname, { token: true, colors, types: art ? ['Artifact', 'Creature'] : ['Creature'], sub: sub.join(' '), pt: [p, q], kw: kws, text: kws.map(k => k[0].toUpperCase() + k.slice(1)).join(', ') });
    return step({ role: 'tokens', run: async (ctx) => createToken(ctx.p, tname, num(n, ctx), { tapped: !!m[2] }) });
  }
  if (t === 'investigate') return step({ run: async (ctx) => createToken(ctx.p, 'Clue', 1) });
  // lands
  if ((m = t.match(/^search your library for (a|up to two|up to three) basic land cards?(?:,| and) (?:reveal (?:it|them|those cards), )?put (?:it|them|that card|those cards) (onto the battlefield( tapped)?|into your hand)(?:, then shuffle)?$/))) {
    const n = m[1] === 'a' ? 1 : m[1] === 'up to two' ? 2 : 3;
    if (m[2] === 'into your hand') return step({ role: 'ramp', run: async (ctx) => { const ps = await searchLibrary(ctx.p, isBasic, { prompt: 'Search for a basic land', max: n, ai: cs => AIH.pickLands(ctx.p, cs, n) }); for (const c of ps) moveTo(c, 'hand'); } });
    return step({ role: 'ramp', run: async (ctx) => fetchBasicsToBF(ctx.p, n, { tapped: !!m[3] }) });
  }
  if ((m = t.match(/^search your library for an? (forest|plains|island|swamp|mountain) card, put (?:it|that card) onto the battlefield( tapped)?, then shuffle$/))) {
    const type = m[1][0].toUpperCase() + m[1].slice(1);
    return step({ role: 'ramp', run: async (ctx) => fetchBasicsToBF(ctx.p, 1, { tapped: !!m[2], filter: c => (c.d.sub || '').split(' ').includes(type) }) });
  }
  if ((m = t.match(/^search your library for an? (card|creature card|artifact card|enchantment card|instant card|sorcery card|equipment card|land card)(?:, reveal it)?, put (?:it|that card) into your hand(?:, then shuffle)?$/))) {
    const kind = m[1];
    const f = kind === 'card' ? () => true : kind === 'equipment card' ? isEquipment : (c) => c.d.types.includes(kind.split(' ')[0][0].toUpperCase() + kind.split(' ')[0].slice(1));
    return step({ role: 'tutor', run: async (ctx) => { const ps = await searchLibrary(ctx.p, f, { prompt: 'Search your library', ai: cs => [AIH.tutorPick(ctx.p, cs)] }); for (const c of ps) { moveTo(c, 'hand'); log(`${P(ctx.p).name} tutors a card.`); } } });
  }
  // graveyard recursion
  if ((m = t.match(/^return (?:up to one )?target (creature|permanent|artifact|enchantment|land|nonland permanent|instant or sorcery|)\s*card(?: with mana value (\d+) or less)? from your graveyard to (your hand|the battlefield)( tapped)?$/))) {
    const kind = m[1] || 'card';
    const f = (c) => (kind === 'card' || kind === '' ? true : kind === 'permanent' ? isPermanentCard(c) : kind === 'nonland permanent' ? isPermanentCard(c) && !isLand(c) : kind === 'instant or sorcery' ? (isInstant(c) || isSorcery(c)) : c.d.types.includes(kind[0].toUpperCase() + kind.slice(1))) && (!m[2] || mv(c) <= +m[2]);
    const toBF = m[3] === 'the battlefield';
    return step({ role: 'recursion', target: { kind: 'gy', filter: f, harmful: false }, run: async (ctx, tg) => { if (toBF) await enterBF(tg, ctx.p, { tapped: !!m[4], fromZone: 'gy' }); else { moveTo(tg, 'hand'); log(`${tg.name} returns to hand.`); } } });
  }
  // counterspells
  if ((m = t.match(/^counter target (spell|noncreature spell|creature spell|instant or sorcery spell|artifact or enchantment spell|activated or triggered ability)$/))) {
    const k = { spell: 'any', 'noncreature spell': 'noncreature', 'creature spell': 'creature', 'instant or sorcery spell': 'instsorc', 'artifact or enchantment spell': 'artench' }[m[1]];
    if (!k) return null;
    return step({ counter: k });
  }
  // tap / untap
  if ((m = t.match(/^tap target (.+)$/))) { const f = nounFilter(m[1]); if (!f) return null; return step({ target: { kind: 'perm', filter: f, harmful: true }, run: async (ctx, tg) => { tg.tapped = true; } }); }
  if ((m = t.match(/^untap target (.+)$/))) { const f = nounFilter(m[1]); if (!f) return null; return step({ target: { kind: 'perm', filter: f, harmful: false }, run: async (ctx, tg) => { tg.tapped = false; } }); }
  if (t === 'untap ~') return step({ run: async (ctx) => { ctx.card.tapped = false; } });
  if (t === 'tap all creatures your opponents control') return step({ run: async (ctx) => { for (const c of opps(ctx.p).flatMap(creatures)) c.tapped = true; } });
  // library manipulation
  if ((m = t.match(/^(scry|surveil) (\w+)$/))) return step({ run: async (ctx) => scry(ctx.p, num(m[2], ctx)) });
  if ((m = t.match(/^(?:you )?mill (\w+) cards?$/))) return step({ run: async (ctx) => mill(ctx.p, num(m[1], ctx)) });
  if ((m = t.match(/^target player mills (\w+) cards?$/))) return step({ target: { kind: 'player', harmful: true }, run: async (ctx, tg) => mill(tg.pi, num(m[1], ctx)) });
  // sacrifice / discard
  if ((m = t.match(/^(target opponent|each opponent|each player|target player) sacrifices (a|an) (creature|artifact|enchantment|nonland permanent|creature or planeswalker)(?: of their choice)?$/))) {
    const who = m[1], kind = m[3];
    const f = kind === 'creature' || kind === 'creature or planeswalker' ? isCreature : kind === 'artifact' ? isArtifact : kind === 'enchantment' ? isEnchantment : (c) => !isLand(c);
    const edict = async (pi) => { const cs = perms(pi).filter(f); if (!cs.length) return; const k = await chooseCard(pi, { prompt: `Sacrifice a ${kind}`, cands: cs, ai: x => AIH.weakest(x) }); if (k) await sacrifice(k); };
    if (who.startsWith('target')) return step({ target: { kind: 'player', harmful: true }, run: async (ctx, tg) => edict(tg.pi) });
    return step({ run: async (ctx) => { for (const pi of (who === 'each player' ? apnap() : opps(ctx.p))) await edict(pi); } });
  }
  if ((m = t.match(/^(target player|target opponent|each opponent) discards (a|an|one|two|three|\d+) cards?$/))) {
    if (m[1] === 'each opponent') return step({ run: async (ctx) => { for (const o of opps(ctx.p)) await discardN(o, num(m[2], ctx)); } });
    return step({ target: { kind: 'player', harmful: true }, run: async (ctx, tg) => discardN(tg.pi, num(m[2], ctx)) });
  }
  if ((m = t.match(/^discard (a|an|one|two|\d+) cards?$/))) return step({ run: async (ctx) => discardN(ctx.p, num(m[1], ctx)) });
  // fight
  if ((m = t.match(/^~ fights (?:up to one )?target creature (?:you don't control|an opponent controls)$/))) return step({ target: { kind: 'perm', filter: (c, ctx) => isCreature(c) && c.ctrl !== ctx.p, harmful: true }, run: async (ctx, tg) => { const me = ctx.card; if (me.zone !== 'bf') return; dealDamage(me, tg, pow(me)); dealDamage(tg, me, pow(tg)); await sba(); } });
  // counters of other kinds
  if ((m = t.match(/^put a (shield|stun) counter on (target creature(?: you control)?|~|each creature you control)$/))) {
    const k = m[1], who = m[2];
    if (who === '~') return step({ run: async (ctx) => addCounters(ctx.card, k, 1) });
    if (who.startsWith('each')) return step({ run: async (ctx) => { for (const c of creatures(ctx.p)) addCounters(c, k, 1); } });
    return step({ target: { kind: 'perm', filter: /you control/.test(who) ? (c, ctx) => isCreature(c) && c.ctrl === ctx.p : isCreature, harmful: k === 'stun' }, run: async (ctx, tg) => addCounters(tg, k, 1) });
  }
  if ((m = t.match(/^tap (?:up to one )?target (creature|permanent)(?: an opponent controls)? and put a stun counter on it$/))) return step({ target: { kind: 'perm', filter: (c, ctx) => (m[1] === 'creature' ? isCreature(c) : true) && c.ctrl !== ctx.p, harmful: true }, run: async (ctx, tg) => { tg.tapped = true; addCounters(tg, 'stun', 1); } });
  if ((m = t.match(/^exile (?:up to one )?target (.+?) until ~ leaves the battlefield$/))) {
    const f = nounFilter(m[1]); if (!f) return null;
    return step({ target: { kind: 'perm', filter: f, harmful: true }, role: 'removal', run: async (ctx, tg) => { const src = ctx.card; await exileC(tg); if (src.zone === 'bf') { src.perm.oring = (src.perm.oring || []).concat([tg]); } } });
  }
  if ((m = t.match(/^support (\w+)$/))) return step({ run: async (ctx) => { const n = num(m[1], ctx); const cs = creatures(ctx.p).filter(c => c !== ctx.card); const ks = await chooseCards(ctx.p, { prompt: `Support ${n}: up to ${n} other creatures get a +1/+1 counter`, cands: cs, min: 0, max: n, ai: x => AIH.sortByValue(x).slice(0, n) }); for (const k of ks) addCounters(k, 'p1p1', 1); } });
  if ((m = t.match(/^(monstrosity|adapt) (\w+)$/))) return step({ run: async (ctx) => { const c = ctx.card; if (c.zone !== 'bf') return; if (m[1] === 'monstrosity' ? c.perm.monstrous : (c.counters.p1p1 || 0) > 0) return; addCounters(c, 'p1p1', num(m[2], ctx)); c.perm.monstrous = true; log(`${c.name} becomes ${m[1] === 'monstrosity' ? 'monstrous' : 'adapted'}.`); } });
  if (t === 'it explores' || t === '~ explores') return step({ run: async (ctx) => explore(ctx.p, ctx.card) });
  if ((m = t.match(/^(?:you )?draw a card for each (creature|artifact|land) you control$/))) return step({ run: async (ctx) => drawCards(ctx.p, perms(ctx.p).filter(c => c.d.types.includes(m[1][0].toUpperCase() + m[1].slice(1))).length) });
  if ((m = t.match(/^destroy all creatures with no counters on them$/))) return step({ role: 'wipe', run: async () => destroyMany(allCreatures().filter(c => !Object.values(c.counters).some(v => v > 0))) });
  if ((m = t.match(/^return target creature to its owner's hand$/))) return step({ target: { kind: 'perm', filter: isCreature, harmful: true }, run: async (ctx, tg) => bounce(tg) });
  // misc
  if (t === 'you become the monarch') return step({ run: async (ctx) => setMonarch(ctx.p) });
  if (t === 'shuffle your library' || t === 'then shuffle') return step({ run: async () => {} });
  if ((m = t.match(/^exile target card from a graveyard$/))) return step({ target: { kind: 'anygy', harmful: true }, run: async (ctx, tg) => exileC(tg) });
  if ((m = t.match(/^exile (?:target player's|each opponent's) graveyard$/))) return step({ run: async (ctx) => { for (const o of opps(ctx.p)) for (const c of P(o).gy.slice()) moveTo(c, 'exile'); } });
  return null;
}
function isCreatureNoun(p) { return /creature/.test(p); }
function splitSentences(text) {
  return text.split(/(?<=\.)\s+(?=[A-Z~])/).map(s => s.trim()).filter(Boolean);
}
function compileEffect(text) {
  const steps = [], manual = [];
  for (const s of splitSentences(text)) {
    if (/^activate only as a sorcery\.?$/i.test(s) || /^activate only once each turn\.?$/i.test(s)) continue;
    const st = compileSentence(s);
    if (st) steps.push(st); else manual.push(s);
  }
  return { steps, manual };
}
function aiForTarget(spec, ctx) {
  return (cs) => {
    if (spec.harmful) { const o = cs.filter(c => c.ctrl !== ctx.p); return o.length ? AIH.sortByValue(o)[0] : (spec.optional ? null : cs[0]); }
    const own = cs.filter(c => c.ctrl === ctx.p); return own.length ? AIH.sortByValue(own)[0] : (spec.optional ? null : cs[0]);
  };
}
async function chooseStepTargets(ctx, steps) {
  ctx.stepT = [];
  for (const st of steps) {
    if (!st.target) { ctx.stepT.push(null); continue; }
    const spec = st.target, before = ctx.targets.length;
    let ok = true;
    if (spec.kind === 'player') {
      const cands = living().map(PL).filter(p => canTarget(p, ctx.p));
      if (P(ctx.p).isBot) addTarget(ctx, PL(spec.harmful ? pickOpp(ctx.p) : ctx.p));
      else { const v = await UI.pickOpt('Choose target player', cands.map(c => ({ label: c.pi === ctx.p ? 'Yourself' : `${c.name} (${P(c.pi).life} life)`, value: c.pi }))); if (v == null) ok = false; else addTarget(ctx, PL(v)); }
    } else if (spec.kind === 'any') {
      const cs = allCreatures().filter(c => canTarget(c, ctx.p, ctx.card));
      const k = await chooseCard(ctx.p, { prompt: 'Choose a creature, or cancel to target a player', cands: cs, optional: true, ai: x => AIH.burnTarget(x, ctx, 3) });
      if (k) addTarget(ctx, k);
      else if (P(ctx.p).isBot) addTarget(ctx, PL(pickOpp(ctx.p)));
      else { const v = await UI.pickOpt('Target player', living().map(pi => ({ label: pi === ctx.p ? 'Yourself' : `${P(pi).name} (${P(pi).life} life)`, value: pi }))); if (v == null) ok = false; else addTarget(ctx, PL(v)); }
    } else if (spec.kind === 'gy') {
      const cs = P(ctx.p).gy.filter(spec.filter);
      const k = await chooseCard(ctx.p, { prompt: 'Choose a card in your graveyard', cands: cs, optional: st.optional, ai: x => AIH.bestCard(x) });
      if (k) addTarget(ctx, k); else ok = st.optional;
    } else if (spec.kind === 'anygy') {
      const cs = G.players.flatMap(p => p.gy);
      const k = await chooseCard(ctx.p, { prompt: 'Choose a card in a graveyard', cands: cs, optional: true, ai: x => AIH.bestCard(x.filter(c => c.owner !== ctx.p)) || null });
      if (k) addTarget(ctx, k); else ok = st.optional;
    } else {
      ok = await pickTarget(ctx, (spec.harmful ? 'Target: ' : 'Target: ') + (st.label || 'choose'), (c) => spec.filter(c, ctx), aiForTarget(spec, ctx), st.optional);
    }
    if (!ok) return false;
    ctx.stepT.push(ctx.targets.length > before ? ctx.targets[ctx.targets.length - 1] : null);
  }
  return true;
}
async function runSteps(ctx, steps, manual, src) {
  let lastDone = true;
  for (let i = 0; i < steps.length; i++) {
    const st = steps[i];
    if (st.counter) continue;
    if (st.ifDo && !lastDone) continue;
    lastDone = false;
    const tg = ctx.stepT ? ctx.stepT[i] : null;
    if (st.target && !tOK(ctx, tg)) continue;
    if (st.optional && !(await chooseYes(ctx.p, { prompt: `${(src || ctx.card).name}: do this? (optional)`, ai: () => true }))) continue;
    await st.run(ctx, tg, src);
    lastDone = true;
    await sba();
  }
  if (manual && manual.length && !P(ctx.p).isBot) log(`Not automated on ${(src || ctx.card).name}: "${manual.join(' ')}" Use the card's manual actions if needed.`, 'warn');
}

/* ---------------- building a definition ---------------- */
function parseTypeLine(tl) {
  const [left, right] = String(tl || '').split(/\s+[—-]\s+/);
  const types = left.split(/\s+/).filter(w => ['Legendary', 'Basic', 'Snow', 'World', 'Artifact', 'Creature', 'Enchantment', 'Land', 'Instant', 'Sorcery', 'Planeswalker', 'Battle', 'Kindred', 'Tribal'].includes(w)).map(w => (w === 'Tribal' ? 'Kindred' : w));
  return { types, sub: right || '' };
}
function parseManaProd(s) {
  // "{T}: Add {G}." "{T}: Add {R} or {G}." "{T}: Add {C}{C}." "{T}: Add one mana of any color."
  let m;
  if (/add one mana of any color in your commander's color identity/i.test(s)) return 'ident';
  if (/add (one|two|three) mana of any (one )?color/i.test(s)) { const n = NUMW[s.match(/add (one|two|three)/i)[1].toLowerCase()]; return Array(n).fill('WUBRG'); }
  if ((m = s.match(/add ((?:\{[WUBRGC]\})+)(?: or ((?:\{[WUBRGC]\})+))?(?:,? or ((?:\{[WUBRGC]\})+))?/i))) {
    const a = m[1].match(/[WUBRGC]/g);
    if (!m[2]) return a;
    const opts = [m[1], m[2], m[3]].filter(Boolean).map(x => x.match(/[WUBRGC]/g));
    const len = Math.max(...opts.map(o => o.length));
    return Array.from({ length: len }, (_, i) => [...new Set(opts.map(o => o[i] || o[0]))].join(''));
  }
  return null;
}
function parseCostPart(costStr) {
  const out = { mana: '', tap: false, sacSelf: false, other: [] };
  for (const part of costStr.split(/,\s*/)) {
    const p = part.trim();
    if (/^\{T\}$/i.test(p)) out.tap = true;
    else if (/^(\{[^}]+\})+$/.test(p)) out.mana += p;
    else if (/^sacrifice ~$/i.test(p)) out.sacSelf = true;
    else if (/^pay (\d+) life$/i.test(p)) out.life = +p.match(/\d+/)[0];
    else if (/^discard a card$/i.test(p)) out.discard = 1;
    else out.other.push(p);
  }
  return out;
}
function buildGenericDef(name, rec) {
  if (CARDS[name]) return CARDS[name];
  const { types, sub } = parseTypeLine(rec.t);
  const d = { mc: rec.m || '', colors: rec.c || '', types, sub, text: rec.o || '', generic: true, manual: [], kw: [], abilities: [], on: {} };
  if (rec.b && rec.b.n) d.text += `\n\n(Back face: ${rec.b.n} — ${rec.b.t}${rec.b.o ? '\n' + rec.b.o : ''})`;
  if (rec.p != null) d.pt = [/^\d+$/.test(rec.p) ? +rec.p : 0, /^\d+$/.test(rec.d) ? +rec.d : 0];
  if (rec.p != null && (!/^\d+$/.test(rec.p) || !/^\d+$/.test(rec.d))) d.manual.push(`Power/toughness ${rec.p}/${rec.d} is not calculated (treated as ${d.pt[0]}/${d.pt[1]}).`);
  const isLandCard = types.includes('Land');
  const isSpell = types.includes('Instant') || types.includes('Sorcery');
  const lines = normalizeText(name, rec.o);
  const anthems = [], attachBuffs = [];
  const spellText = [];
  for (const line of lines) {
    const low = line.toLowerCase();
    let m;
    // keyword lines
    const kws = kwList(line.replace(/\.$/, ''));
    if (kws) { kws.forEach(k => (k === 'flash' ? (d.flash = true) : d.kw.push(k))); continue; }
    if ((m = low.match(/^ward \{(\d+)\}$/))) { d.ward = +m[1]; continue; }
    if ((m = low.match(/^protection from (white|blue|black|red|green)(?: and from (white|blue|black|red|green))?$/))) { d.prot = [COLOR_WORD[m[1]], m[2] && COLOR_WORD[m[2]]].filter(Boolean); continue; }
    if ((m = low.match(/^equip \{(\d+)\}$/))) { d.equip = +m[1]; continue; }
    if ((m = low.match(/^crew (\d+)$/))) { d.crew = +m[1]; continue; }
    if (/^enchant creature$/.test(low)) { d.enchant = 'creature'; continue; }
    if (/^enchant (artifact|land|permanent|player)/.test(low)) { d.enchant = low.split(' ')[1]; d.manual.push(line); continue; }
    if (/^~ enters tapped\.?$/.test(low)) { d.entersTapped = true; continue; }
    if (/^~ can't block\.?$/.test(low)) { d.cantBlock = true; continue; }
    if (/^~ attacks each combat if able\.?$/.test(low)) { d.mustAttack = true; continue; }
    // mana abilities
    if (/^\{t\}: add /.test(low) || /^\{\d+\}, \{t\}: add /.test(low)) { const prod = parseManaProd(line); if (prod) { d.prod = d.prod ? (Array.isArray(d.prod) && Array.isArray(prod) ? mergeProd(d.prod, prod) : d.prod) : prod; d.mana = prod === 'ident' ? 1 : prod.length; if (/^\{t\}: add \{c\}/.test(low)) d.colorlessMana = true; if (/damage to you/.test(low)) {} continue; } }
    // equipment / aura statics
    if ((m = low.match(/^(equipped|enchanted) creature gets ([+-]\d+)\/([+-]\d+)(?: and (?:has|gains) ([a-z ,]+?))?\.?$/))) { const k = m[4] ? kwList(m[4]) : []; if (k !== null) { attachBuffs.push({ p: +m[2], t: +m[3], kw: k }); continue; } }
    if ((m = low.match(/^(equipped|enchanted) creature has ([a-z ,]+?)\.?$/))) { const k = kwList(m[2]); if (k) { attachBuffs.push({ kw: k }); continue; } }
    if (/^enchanted creature can't attack or block\.?$/.test(low)) { attachBuffs.push({ kw: ['cantAttack', 'cantBlock'] }); d.auraHarm = true; continue; }
    if (/^enchanted creature can't attack\.?$/.test(low)) { attachBuffs.push({ kw: ['cantAttack'] }); d.auraHarm = true; continue; }
    if (/^enchanted creature doesn't untap during its controller's untap step\.?$/.test(low)) { attachBuffs.push({ noUntap: true }); d.auraHarm = true; continue; }
    // anthems
    if ((m = low.match(/^(other )?creatures you control get ([+-]\d+)\/([+-]\d+)(?: and have ([a-z ,]+?))?\.?$/))) { const k = m[4] ? kwList(m[4]) : []; if (k !== null) { anthems.push({ other: !!m[1], p: +m[2], t: +m[3], kw: k }); continue; } }
    if ((m = low.match(/^(other )?creatures you control have ([a-z ,]+?)\.?$/))) { const k = kwList(m[2]); if (k) { anthems.push({ other: !!m[1], kw: k }); continue; } }
    if ((m = low.match(/^~ enters with (a|an|one|two|three|four|five|x|\d+) \+1\/\+1 counters? on it\.?$/))) { const w = m[1]; if (w === 'x') d.xCounters = true; else d.entersCounters = { p1p1: num(w) }; continue; }
    if ((m = low.match(/^~ enters tapped unless you control (?:an? |two or more )?(.+?)\.?$/))) {
      const what = m[1];
      if (/basic lands/.test(what)) d.entersTappedFn = (c) => perms(c.ctrl).filter(isBasic).length < 2;
      else if (/two or fewer other lands/.test(what)) d.entersTappedFn = (c) => perms(c.ctrl).filter(l => isLand(l) && l !== c).length > 2;
      else { const types2 = what.split(/ or an? | or /).map(x => x.trim().replace(/^an? /, '')); d.entersTappedFn = (c) => !types2.some(t2 => hasLandType(c.ctrl, t2[0].toUpperCase() + t2.slice(1))); }
      continue;
    }
    if ((m = low.match(/^as ~ enters, you may reveal an? (\w+) or (\w+) card from your hand\. if you don't, ~ enters tapped\.?$/))) { const a = m[1][0].toUpperCase() + m[1].slice(1), b2 = m[2][0].toUpperCase() + m[2].slice(1); d.entersTappedFn = (c) => !P(c.ctrl).hand.some(x => isLand(x) && (x.d.sub || '').split(' ').some(t2 => t2 === a || t2 === b2)); continue; }
    if ((m = line.match(/^\{([WUBRG])\/([WUBRG])\}, \{T\}: Add /))) { d.prod = [m[1] + m[2] + 'C']; d.mana = 1; continue; }
    if (/^(partner|partner with .+|~ can't be countered\.?|this spell can't be countered\.?)$/i.test(low)) continue;
    if (/^job select$/.test(low)) { d.jobSelect = true; continue; }
    if (/^evolve$/.test(low)) { d.on.etb = chain(d.on.etb, async (s, { card }) => { if (card !== s && card.ctrl === s.ctrl && isCreature(card) && (pow(card) > pow(s) || tou(card) > tou(s))) { addCounters(s, 'p1p1', 1); log(`${s.name} evolves.`); } }); continue; }
    if ((m = low.match(/^(?:each creature you control with a \+1\/\+1 counter on it has|creatures you control with \+1\/\+1 counters on them have) ([a-z ,]+?)\.?$/))) { const k = kwList(m[1]); if (k) { anthems.push({ kw: k, cond: c => (c.counters.p1p1 || 0) > 0 }); continue; } }
    // sagas: "I — ...", "II, III — ..."
    if ((m = line.match(/^([IVX]+(?:, [IVX]+)*) — (.+)$/))) {
      const nums = m[1].split(', ').map(r => ({ I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6 }[r]));
      const eff = compileEffect(m[2]);
      d.saga = d.saga || {}; d.sagaMax = Math.max(d.sagaMax || 0, ...nums);
      for (const n of nums) d.saga[n] = eff;
      if (!eff.steps.length || eff.manual.length) d.manual.push(line);
      continue;
    }
    // triggers
    if ((m = line.match(/^(When|Whenever|At the beginning of) ([^,]+), (.+)$/))) {
      const cond = m[2].toLowerCase(), eff = compileEffect(m[3]);
      if (!eff.steps.length) { d.manual.push(line); continue; }
      if (eff.manual.length) d.manual.push(`Part of: "${line}" (${eff.manual.join(' ')})`);
      const label = m[3].length > 60 ? m[3].slice(0, 57) + '…' : m[3];
      const fire = async (s) => { await trigger(s, s.ctrl, label, (ctx) => chooseStepTargets(ctx, eff.steps), async (ctx) => runSteps(ctx, eff.steps, eff.manual, s)); };
      if (/^~ enters(?: the battlefield)?$/.test(cond) || /^~ enters or attacks$/.test(cond)) { const prev = d.etb; d.etb = async (c) => { if (prev) await prev(c); await fire(c); }; if (/attacks/.test(cond)) d.on.attacks = async (s, { attacker }) => { if (attacker === s) await fire(s); }; if (eff.steps.some(s2 => s2.target && s2.target.harmful)) d.removalETB = true; continue; }
      if (cond === '~ attacks') { d.on.attacks = async (s, { attacker }) => { if (attacker === s) await fire(s); }; continue; }
      if (cond === '~ deals combat damage to a player') { d.on.combatDamagePlayer = async (s, { src }) => { if (src === s) await fire(s); }; continue; }
      if (cond === '~ dies') { d.on.dies = async (s, { dead, lki }) => { if (dead === s) await trigger(s, lki.ctrl, label, (ctx) => chooseStepTargets(ctx, eff.steps), async (ctx) => runSteps(ctx, eff.steps, eff.manual, s)); }; continue; }
      if (cond === 'your upkeep') { d.on.upkeep = async (s, { pi }) => { if (pi === s.ctrl) await fire(s); }; continue; }
      if (cond === 'your end step') { d.on.endStep = async (s, { pi }) => { if (pi === s.ctrl) await fire(s); }; continue; }
      if (cond === 'combat on your turn') { d.on.beginCombat = async (s, { pi }) => { if (pi === s.ctrl) await fire(s); }; continue; }
      if (cond === 'equipped creature attacks') { d.on.attacks = async (s, { attacker }) => { if (s.attachedTo === attacker.id) await fire(s); }; continue; }
      if (cond === 'equipped creature deals combat damage to a player') { d.on.combatDamagePlayer = async (s, { src }) => { if (s.attachedTo === src.id) await fire(s); }; continue; }
      if (cond === 'another creature you control dies' || cond === 'a creature you control dies' || cond === 'another creature dies' || cond === 'a creature dies') {
        const anyC = /^a(nother)? creature dies$/.test(cond), other = /another/.test(cond);
        d.on.dies = async (s, { dead, lki }) => { if ((other && dead === s) || (!anyC && lki.ctrl !== s.ctrl) || s.zone !== 'bf') return; await fire(s); }; continue;
      }
      if (cond === 'you cast a noncreature spell' || cond === 'you cast an instant or sorcery spell' || cond === 'you cast a creature spell' || cond === 'you cast a spell') {
        const f = cond.includes('noncreature') ? c => !isCreature(c) : cond.includes('instant') ? c => isInstant(c) || isSorcery(c) : cond.includes('creature spell') ? isCreature : () => true;
        d.on.cast = async (s, { pi, card }) => { if (pi === s.ctrl && f(card)) await fire(s); }; continue;
      }
      if (cond === 'a land you control enters' || cond === 'a land enters under your control') { d.on.etb = chain(d.on.etb, async (s, { card }) => { if (card.ctrl === s.ctrl && isLand(card)) await fire(s); }); continue; }
      if (cond === 'you attack' || cond === 'you attack with one or more creatures') { d.on.attackDeclared = chain(d.on.attackDeclared, async (s, { pi }) => { if (pi === s.ctrl) await fire(s); }); continue; }
      if (cond === 'another creature you control enters' || cond === 'a creature you control enters' || cond === 'another creature enters under your control' || cond === 'a creature enters under your control') { const other = /another/.test(cond); d.on.etb = chain(d.on.etb, async (s, { card }) => { if (card.ctrl === s.ctrl && isCreature(card) && (!other || card !== s)) await fire(s); }); continue; }
      if (cond === 'an opponent casts a spell') { d.on.cast = chain(d.on.cast, async (s, { pi }) => { if (pi !== s.ctrl) await fire(s); }); continue; }
      if (cond === 'each end step' || cond === 'the end step') { d.on.endStep = chain(d.on.endStep, async (s) => { await fire(s); }); continue; }
      if (cond === "each upkeep") { d.on.upkeep = chain(d.on.upkeep, async (s) => { await fire(s); }); continue; }
      if (cond === 'a creature you control deals combat damage to a player' || cond === 'one or more creatures you control deal combat damage to a player') { const once = /one or more/.test(cond); d.on[once ? 'combatDamageDone' : 'combatDamagePlayer'] = chain(d.on[once ? 'combatDamageDone' : 'combatDamagePlayer'], async (s, pl) => { if (once ? pl.pi === s.ctrl && pl.hits.some(h => h.src.ctrl === s.ctrl) : pl.src.ctrl === s.ctrl) await fire(s); }); continue; }
      if (cond === '~ deals combat damage to a player or planeswalker') { d.on.combatDamagePlayer = async (s, { src }) => { if (src === s) await fire(s); }; continue; }
      d.manual.push(line); continue;
    }
    // activated abilities
    if ((m = line.match(/^([^:"]+): (.+)$/)) && /\{|sacrifice|pay|discard|tap|untap/i.test(m[1]) && !isSpell) {
      const cost = parseCostPart(m[1]);
      const eff = compileEffect(m[2]);
      if (cost.other.length || !eff.steps.length) { d.manual.push(line); continue; }
      if (eff.manual.length) d.manual.push(`Part of: "${line}"`);
      const sorcery = /activate only as a sorcery/i.test(m[2]);
      d.abilities.push({
        id: 'g' + d.abilities.length, label: line.length > 70 ? line.slice(0, 67) + '…' : line, cost: cost.mana || 0, tap: cost.tap, sacSelf: cost.sacSelf, speed: sorcery ? 'sorcery' : 'instant',
        can: (c) => (!cost.life || P(c.ctrl).life > cost.life) && (!cost.discard || P(c.ctrl).hand.length > 0),
        choose: async (ctx) => { const ok = await chooseStepTargets(ctx, eff.steps); if (!ok) return false; if (cost.life) loseLife(ctx.p, cost.life); if (cost.discard) await discardN(ctx.p, 1); return true; },
        resolve: async (ctx) => runSteps(ctx, eff.steps, eff.manual, ctx.card),
      });
      continue;
    }
    if (isSpell) { spellText.push(line); continue; }
    if (isLandCard && /^\{t\}/i.test(line)) { d.manual.push(line); continue; }
    d.manual.push(line);
  }
  // modal spells: "Choose one — • A. • B."
  const joined = spellText.join(' ');
  const modal = joined.match(/^Choose (one|two|one or more|one or both) —\s*(.+)$/i);
  if (isSpell && modal) {
    const opts = modal[2].split(/\s*•\s*/).map(x => x.trim()).filter(Boolean).map(x => ({ text: x.replace(/^[A-Z][\w' !-]* — /, ''), eff: compileEffect(x.replace(/^[A-Z][\w' !-]* — /, '')) }));
    const usable = opts.filter(o => o.eff.steps.length && !o.eff.manual.length);
    if (usable.length) {
      const many = /two|more|both/i.test(modal[1]);
      d.choose = async (ctx) => {
        const list = opts.map((o, i) => ({ label: o.text, value: i, disabled: !o.eff.steps.length }));
        let picks = [];
        if (P(ctx.p).isBot) picks = [opts.indexOf(AIH.genericMode(ctx, usable) || usable[0])];
        else {
          const a = await chooseOpt(ctx.p, { prompt: `${name}: choose ${many ? 'a mode (you can add another next)' : 'one'}`, opts: list });
          if (a == null) return false; picks.push(a);
          if (many) { const b = await chooseOpt(ctx.p, { prompt: 'Add a second mode? (cancel to skip)', opts: list.filter(x => x.value !== a) }); if (b != null) picks.push(b); }
        }
        ctx.modes = picks; ctx.modeLabel = picks.map(i => opts[i].text.slice(0, 30)).join(' + ');
        ctx.modeSteps = picks.flatMap(i => opts[i].eff.steps);
        return chooseStepTargets(ctx, ctx.modeSteps);
      };
      d.spell = async (ctx) => runSteps(ctx, ctx.modeSteps, [], ctx.card);
      d.role = usable.some(o => o.eff.steps.some(s => s.target && s.target.harmful)) ? 'removal' : 'utility';
      if (opts.length !== usable.length) d.manual.push('Some modes are not automated: ' + opts.filter(o => !usable.includes(o)).map(o => o.text).join(' / '));
      spellText.length = 0;
    }
  }
  // spells
  if (isSpell && spellText.length) {
    const eff = compileEffect(spellText.join(' '));
    if (eff.manual.length) d.manual.push(...eff.manual);
    const ctr = eff.steps.find(s => s.counter);
    if (ctr) {
      d.role = 'counter'; d.counters = ctr.counter;
      d.canCast = (ctx) => G.stack.some(it => it.p !== ctx.p && genericCounterFits(d.counters, it));
      d.choose = async (ctx) => {
        const cands = G.stack.filter(it => it.p !== ctx.p && genericCounterFits(d.counters, it));
        if (!cands.length) return false;
        let it = cands[cands.length - 1];
        if (!P(ctx.p).isBot && cands.length > 1) { const v = await chooseOpt(ctx.p, { prompt: 'Counter which?', opts: cands.map((x, i) => ({ label: x.label, value: i })) }); if (v == null) return false; it = cands[v]; }
        ctx.counterTarget = it; ctx.modeLabel = 'targeting ' + it.label; return chooseStepTargets(ctx, eff.steps.filter(s => !s.counter));
      };
      d.spell = async (ctx) => { const it = ctx.counterTarget; if (G.stack.includes(it)) await counterItem(it, d.name); await runSteps(ctx, eff.steps.filter(s => !s.counter), [], ctx.card); };
    } else {
      d.choose = async (ctx) => chooseStepTargets(ctx, eff.steps);
      d.spell = async (ctx) => runSteps(ctx, eff.steps, eff.manual, ctx.card);
      if (eff.steps.some(s => s.role === 'wipe')) d.role = 'wipe';
      else if (eff.steps.some(s => s.target && s.target.harmful && s.target.kind !== 'player')) { d.role = 'removal'; d.threat = /exile/i.test(d.text) ? 'exile' : 'destroy'; }
      else if (eff.steps.some(s => s.role === 'protect')) { d.role = 'protect'; d.protect = 'team'; }
      else if (eff.steps.some(s => s.role === 'ramp')) d.role = 'ramp';
      else if (eff.steps.some(s => s.role === 'recursion')) d.role = 'recursion';
      else if (eff.steps.some(s => s.role === 'tutor')) d.role = 'tutor';
      else d.role = isInstant({ d }) ? 'trick' : 'draw';
      if (!eff.steps.length) d.role = 'utility';
    }
  } else if (types.includes('Aura')) {
    d.enchant = d.enchant || 'creature';
    const harm = d.auraHarm || attachBuffs.some(a => (a.p || 0) < 0);
    d.choose = (ctx) => pickTarget(ctx, 'Enchant creature', isCreature, harm ? (cs => AIH.oppThreat(cs, ctx)) : (cs => AIH.ownBest(cs, ctx)));
    d.role = harm ? 'removal' : 'evasion'; if (harm) d.threat = 'aura';
  }
  if (attachBuffs.length) {
    d.attachBuff = () => attachBuffs.reduce((a, x) => ({ p: (a.p || 0) + (x.p || 0), t: (a.t || 0) + (x.t || 0), kw: [...(a.kw || []), ...(x.kw || [])] }), {});
    if (attachBuffs.some(a => a.noUntap)) d.noUntapAttached = true;
  }
  if (anthems.length) d.anthem = (s, c) => { if (c.ctrl !== s.ctrl || !isCreature(c)) return null; let r = { p: 0, t: 0, kw: [] }; for (const a of anthems) { if (a.other && c === s) continue; if (a.cond && !a.cond(c)) continue; r.p += a.p || 0; r.t += a.t || 0; r.kw.push(...a.kw); } return r; };
  if (types.includes('Equipment') && d.equip == null) d.equip = 0;
  if (!d.role) d.role = types.includes('Creature') ? 'creature' : (d.mana ? 'ramp' : types.includes('Equipment') ? 'equipment' : 'utility');
  if (isLandCard && !d.prod && !d.mana) {
    const basics = sub.split(' ').map(w => BASIC_COLOR[w]).filter(Boolean);
    if (basics.length) { d.prod = [basics.join('')]; d.mana = 1; }
  }
  if (d.saga) {
    const chapter = async (c, n) => { const eff = d.saga[n]; if (!eff || !eff.steps.length) { if (n >= d.sagaMax && c.zone === 'bf') await sacrifice(c); return; } await trigger(c, c.ctrl, `Chapter ${n}`, (ctx) => chooseStepTargets(ctx, eff.steps), async (ctx) => { await runSteps(ctx, eff.steps, eff.manual, c); if (n >= d.sagaMax && c.zone === 'bf') await sacrifice(c); }); };
    d.etb = chain2(d.etb, async (c) => { addCounters(c, 'lore', 1); await chapter(c, 1); });
    d.on.afterDraw = chain(d.on.afterDraw, async (s, { pi }) => { if (pi !== s.ctrl) return; addCounters(s, 'lore', 1); await chapter(s, s.counters.lore); });
  }
  if (d.jobSelect) d.etb = chain2(d.etb, async (c) => { if (!CARDS.Hero) C('Hero', { token: true, types: ['Creature'], sub: 'Hero', pt: [1, 1], text: '' }); const [h] = await createToken(c.ctrl, 'Hero', 1); if (h) attach(c, h); });
  if (d.xCounters) d.etb = chain2(d.etb, async (c, opts) => { if (opts && opts.x) addCounters(c, 'p1p1', opts.x); });
  if (/until ~ leaves the battlefield/i.test(lines.join(' '))) d.ltbToGY = async (c, lki) => { for (const x of (lki.perm.oring || [])) if (x.zone === 'exile') { await enterBF(x, x.owner, {}); log(`${x.name} returns.`); } };
  if (types.includes('Planeswalker')) d.manual.push('Planeswalkers are not automated: use manual actions for loyalty abilities.');
  if (types.includes('Vehicle') || sub.split(' ').includes('Vehicle')) { if (!d.types.includes('Vehicle')) d.types.push('Vehicle'); }
  d.manual = [...new Set(d.manual)];
  return C(name, d);
}
function chain(prev, fn) { return prev ? async (s, p) => { await prev(s, p); await fn(s, p); } : fn; }
function chain2(prev, fn) { return prev ? async (c, o) => { await prev(c, o); await fn(c, o); } : fn; }
async function explore(pi, c) {
  const lib = P(pi).library; const top = lib[lib.length - 1]; if (!top) return;
  log(`${c.name} explores: ${top.name}.`);
  if (isLand(top)) moveTo(top, 'hand');
  else { if (c.zone === 'bf') addCounters(c, 'p1p1', 1); if (await chooseYes(pi, { prompt: `Explore: put ${top.name} into your graveyard?`, card: top, ai: () => AIH.scryBottom(pi, top) })) moveTo(top, 'gy'); }
}
function mergeProd(a, b) { if (a.length !== b.length) return a.length >= b.length ? a : b; return a.map((x, i) => [...new Set((x + b[i]).split(''))].join('')); }
function genericCounterFits(kind, it) {
  if (!it || it.kind !== 'spell') return false;
  const c = it.card;
  if (kind === 'any') return true;
  if (kind === 'creature') return isCreature(c);
  if (kind === 'noncreature') return !isCreature(c);
  if (kind === 'instsorc') return isInstant(c) || isSorcery(c);
  if (kind === 'artench') return isArtifact(c) || isEnchantment(c);
  return false;
}
// extra tokens referenced by generic effects
C('Clue', { token: true, types: ['Artifact'], sub: 'Clue', text: '{2}, Sacrifice this artifact: Draw a card.', abilities: [{ id: 'clue', label: '{2}, Sacrifice: Draw a card', cost: 2, sacSelf: true, speed: 'instant', hideFromAutoStop: true, resolve: async (ctx) => { await drawCards(ctx.p, 1); } }] });
C('Food', { token: true, types: ['Artifact'], sub: 'Food', text: '{2}, {T}, Sacrifice this artifact: You gain 3 life.', abilities: [{ id: 'food', label: '{2}, {T}, Sacrifice: gain 3 life', cost: 2, tap: true, sacSelf: true, speed: 'instant', hideFromAutoStop: true, resolve: async (ctx) => { gainLife(ctx.p, 3); } }] });
C('Blood', { token: true, types: ['Artifact'], sub: 'Blood', text: '{1}, {T}, Discard a card, Sacrifice this artifact: Draw a card.', abilities: [{ id: 'blood', label: '{1}, {T}, Discard, Sacrifice: Draw a card', cost: 1, tap: true, sacSelf: true, speed: 'instant', hideFromAutoStop: true, can: c => P(c.ctrl).hand.length > 0, choose: async (ctx) => { await discardN(ctx.p, 1); return true; }, resolve: async (ctx) => { await drawCards(ctx.p, 1); } }] });

/* ---------------- custom decks ---------------- */
async function ensureDeckDefs(list, commander) {
  await CardDB.load();
  const names = [commander, ...list.map(x => x[0])].filter(Boolean);
  if (CardDB.source === 'remote') await CardDB.fetchMissing(names);
  const missing = [];
  for (const n of names) {
    if (CARDS[n]) continue;
    const hit = CardDB.find(n);
    if (hit) buildGenericDef(hit[0], hit[1]); else missing.push(n);
  }
  return missing;
}
function registerCustomDeck(deck) {
  const key = 'custom:' + deck.id;
  DECKS[key] = { name: deck.name, short: deck.name.slice(0, 14), botName: 'Bot', commander: deck.commander, list: deck.cards.map(x => [x[0], x[1]]), custom: true };
  return key;
}
function automationReport(names) {
  let full = 0, partial = 0, scripted = 0;
  const notes = [];
  for (const n of names) {
    const d = CARDS[n];
    if (!d) continue;
    if (!d.generic) scripted++;
    else if (d.manual && d.manual.length) { partial++; notes.push(n); }
    else full++;
  }
  return { full, partial, scripted, notes };
}
