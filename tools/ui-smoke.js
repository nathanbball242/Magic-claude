// Browser smoke test: opens index.html from disk at phone size, keeps the hand,
// plays lands and cheap creatures, passes everything else, and reports page errors.
// Usage: node tools/ui-smoke.js <screenshot-dir> [cloud|sai]
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const out = process.argv[2] || '.';
  const deck = process.argv[3] || 'cloud';
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const errs = [];
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|scryfall|ERR_/.test(m.text())) errs.push(m.text()); });
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  await p.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await p.screenshot({ path: out + '/start.png' });
  await p.selectOption('#setSpeed', '120');
  await p.click(`.opp-card[data-deck="${deck}"]`);
  await p.click('#startBtn');
  await p.waitForSelector('#mlKeep');
  await p.screenshot({ path: out + '/mull.png' });
  await p.click('#mlKeep');
  let shot = 0;
  for (let i = 0; i < 700; i++) {
    await p.waitForTimeout(120);
    if (await p.evaluate(() => G.over)) break;
    const sheetBtn = await p.$('#sheet:not([hidden]) #cfNo, #sheet:not([hidden]) #poCancel, #sheet:not([hidden]) #mpOk:not([disabled]), #sheet:not([hidden]) #mpCancel, #sheet:not([hidden]) [data-gid]');
    if (sheetBtn) { await sheetBtn.click().catch(() => {}); continue; }
    const mode = await p.evaluate(() => UI.mode);
    if (mode === 'action') {
      if (await p.evaluate(() => UI.data.mode) === 'main') {
        const did = await p.evaluate(() => {
          const acts = allLegalActions(HUMAN, false).filter(a => a.ok !== false);
          const land = acts.find(a => a.type === 'land');
          const cast = acts.filter(a => a.type === 'cast' && (isCreature(a.card) || a.from === 'cz' || isArtifact(a.card))).sort((x, y) => x.cost - y.cost)[0];
          const a = land || cast;
          if (a) { UI.resolve(a); return true; }
          return false;
        });
        if (did) continue;
      }
      if (shot < 3 && await p.evaluate(() => G.turn) >= 6 + shot * 4) { await p.screenshot({ path: out + `/game${shot}.png` }); shot++; }
      await p.click('#promptBtns .btn.primary');
    } else if (mode === 'attack') {
      await p.click('#promptBtns .btn.primary:not([disabled]), #promptBtns .btn');
    } else if (mode === 'block' || mode === 'pick') {
      await p.click('#promptBtns .btn');
    }
  }
  const st = await p.evaluate(() => ({ turn: G.turn, over: G.over, winner: G.winner, life: [P(0).life, P(1).life], log: G.log.slice(-6).map(l => l.msg) }));
  console.log(JSON.stringify(st, null, 1));
  console.log('ERRORS:', errs.slice(0, 10));
  await p.screenshot({ path: out + '/end.png' });
  await b.close();
})();
