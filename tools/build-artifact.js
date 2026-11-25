// Inlines css/ and js/ into one self-contained page body (no doctype/html/head/body),
// the format the claude.ai Artifact publisher expects.
// Usage: node tools/build-artifact.js <out.html> [--friend]
//   --friend  builds the shareable copy: the owner's Shay and Elenda decks are left out,
//             the five bot decks stay, and anyone can build or paste their own deck.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const friend = process.argv.includes('--friend');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let body = html.split('<!--BODY-->')[1].split('<!--/BODY-->')[0];
const css = fs.readFileSync(path.join(root, 'css/style.css'), 'utf8');
let scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => fs.readFileSync(path.join(root, m[1]), 'utf8'));
let title = 'Shay Cormac Duel';
if (friend) {
  title = 'Commander Bot Table';
  body = body
    .replace(/<h1>[\s\S]*?<\/h1>/, '<h1>Commander <span>vs the bots</span></h1>')
    .replace(/<p class="lede" id="lede">[\s\S]*?<\/p>/, '<p class="lede" id="lede">Paste your Commander deck and play it against up to four bots running upgraded precons. Every Commander-legal card is recognised; common card text is automated and anything else gets manual controls.</p>');
  // the owner's personal decklists are not shipped in the friend copy
  scripts = scripts.map(s => s.replace(/const SHAY_LIST = \[[\s\S]*?\n\];/, "const SHAY_LIST = [['Plains', 1]];"));
  scripts.unshift('window.FRIEND_BUILD = true;');
}
const out = `<title>${title}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Inter:wght@400;600;700&display=swap">
<style>
${css}
</style>
${body}
<script>
${scripts.join('\n;\n').replace(/<\/script/gi, '<\\/script')}
</script>
`;
fs.writeFileSync(process.argv[2] || path.join(root, friend ? 'commander-table.html' : 'shay-duel.html'), out);
console.log('wrote', out.length, 'bytes', friend ? '(friend build)' : '');
