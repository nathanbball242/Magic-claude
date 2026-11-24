// Headless bot-vs-bot smoke test. Usage: node tools/sim.js [games] [cloud|sai|both] [seed-ish]
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', 'js');
const files = ['engine.js', 'cards-shay.js', 'cards-cloud.js', 'cards-sai.js', 'decks.js', 'ai.js'];
const ctx = vm.createContext({ console, setTimeout, Math, Date, Set, Map, JSON, Promise });
vm.runInContext('var UI = { render(){}, onLog(){}, toast(){}, gameOver(){} };', ctx);
for (const f of files) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });

const N = +(process.argv[2] || 20);
const which = process.argv[3] || 'both';
const verbose = process.argv.includes('-v');

(async () => {
  const keys = which === 'both' ? ['cloud', 'sai'] : [which];
  for (const key of keys) {
    const res = { win: 0, loss: 0, draw: 0, err: 0, turns: [] };
    for (let i = 0; i < N; i++) {
      try {
        vm.runInContext(`SETTINGS.botDelay = 0; newGame(${JSON.stringify(key)}, { humanIsBot: true });`, ctx);
        await vm.runInContext('gameLoop()', ctx);
        const G = vm.runInContext('G', ctx);
        if (G.winner === 0) res.win++; else if (G.winner === 1) res.loss++; else res.draw++;
        res.turns.push(G.turn);
        if (verbose) console.log(`game ${i}: winner ${G.winner} turn ${G.turn}`);
      } catch (e) {
        res.err++;
        const G = vm.runInContext('G', ctx);
        console.log(`ERROR in ${key} game ${i} (turn ${G && G.turn}, phase ${G && G.phase}):`, e.stack.split('\n').slice(0, 6).join('\n'));
        if (G) console.log(G.log.slice(-12).map(l => '   ' + l.msg).join('\n'));
      }
    }
    const avg = res.turns.length ? (res.turns.reduce((a, b) => a + b, 0) / res.turns.length).toFixed(1) : '-';
    console.log(`${key}: Shay wins ${res.win}, bot wins ${res.loss}, draws ${res.draw}, errors ${res.err}, avg turns ${avg}`);
  }
})();
