// Scripted UI test of targeting, bounty counters and blocking through real taps.
// Usage: node tools/ui-flow.js <screenshot-dir>
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const out = process.argv[2] || '.';
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_/.test(m.text())) errs.push(m.text()); });
  await p.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await p.selectOption('#setSpeed', '120');
  await p.click('#startBtn');
  await p.waitForSelector('#mlKeep'); await p.click('#mlKeep');
  // get to a human main phase
  for (let i = 0; i < 200; i++) {
    const ok = await p.evaluate(() => UI.mode === 'action' && UI.data.mode === 'main' && G.active === HUMAN);
    if (ok) break;
    const m = await p.evaluate(() => UI.mode);
    if (m === 'action') await p.click('#promptBtns .btn.primary');
    else if (m === 'attack' || m === 'block') await p.click('#promptBtns .btn');
    else if (await p.$('#sheet:not([hidden]) #cfNo')) await p.click('#cfNo');
    await p.waitForTimeout(100);
  }
  const ids = await p.evaluate(async () => {
    const me = P(HUMAN);
    for (let i = 0; i < 6; i++) { const l = mkCard('Swamp', HUMAN); await enterBF(l, HUMAN, { quiet: true }); }
    const shay = me.cz[0]; await enterBF(shay, HUMAN, {}); shay.sick = false;
    const rats = mkCard('Typhoid Rats', HUMAN); await enterBF(rats, HUMAN, {}); rats.sick = false;
    const db = mkCard('Doom Blade', HUMAN); db.zone = 'hand'; me.hand.push(db);
    const v = mkCard('Vincent, Vengeful Atoner', BOT); await enterBF(v, BOT, {});
    UI.render();
    return { db: db.id, v: v.id, shay: shay.id };
  });
  await p.waitForTimeout(200);
  await p.click(`#hand [data-id="${ids.db}"]`);
  await p.waitForSelector('#sheet:not([hidden]) [data-ai]');
  await p.screenshot({ path: out + '/flow-sheet.png' });
  await p.click('#sheet [data-ai="0"]');
  await p.waitForFunction(() => UI.mode === 'pick');
  await p.screenshot({ path: out + '/flow-pick.png' });
  await p.click(`#oppCreatures [data-id="${ids.v}"]`);
  // a response window can appear; pass any
  for (let i = 0; i < 20; i++) {
    await p.waitForTimeout(150);
    const r = await p.evaluate((ids) => ({ vz: findAny(ids.v).zone, mode: UI.mode, dm: UI.data && UI.data.mode, stack: G.stack.length }), ids);
    if (r.vz !== 'bf' && r.stack === 0 && r.mode === 'action' && r.dm === 'main') break;
    if (r.mode === 'action' && r.dm === 'instant') await p.click('#promptBtns .btn.primary');
  }
  const res = await p.evaluate((ids) => { const s = findAny(ids.shay); return { vincentZone: findAny(ids.v).zone, shayCounters: s.counters, shayPT: [pow(s), tou(s)], log: G.log.slice(-6).map(l => l.msg) }; }, ids);
  console.log('AFTER DOOM BLADE:', JSON.stringify(res, null, 1));
  await p.screenshot({ path: out + '/flow-after.png' });
  // block test: give bot a hasty attacker, end my turn, block it with the rats
  await p.evaluate(async () => { const r = mkCard('Barret, Avalanche Leader', BOT); await enterBF(r, BOT, { quiet: true }); r.sick = false; const rat = creatures(HUMAN).find(c => c.name === 'Typhoid Rats'); if (rat) moveTo(rat, 'gy'); UI.render(); });
  await p.click('#promptBtns .btn.primary'); // to combat
  for (let i = 0; i < 300; i++) {
    await p.waitForTimeout(120);
    const m = await p.evaluate(() => UI.mode);
    if (m === 'attack') { await p.click('#promptBtns .btn:not(.primary)'); continue; }
    if (m === 'block') {
      const pair = await p.evaluate(() => { const a = G.combat.atk[0].c; const bl = creatures(HUMAN).find(x => canBlock(x, a)); return bl ? [bl.id, a.id] : null; });
      if (pair) {
        await p.click(`#myCreatures [data-id="${pair[0]}"]`);
        await p.click(`#oppCreatures [data-id="${pair[1]}"]`);
        await p.screenshot({ path: out + '/flow-block.png' });
      }
      await p.click('#promptBtns .btn.primary');
      await p.waitForTimeout(800);
      console.log('BLOCK LOG:', await p.evaluate(() => G.log.slice(-8).map(l => l.msg)));
      break;
    }
    if (m === 'action') await p.click('#promptBtns .btn.primary');
    if (await p.$('#sheet:not([hidden]) #cfNo')) await p.click('#cfNo');
  }
  console.log('ERRORS:', errs);
  await b.close();
})();
