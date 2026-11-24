// Inlines css/ and js/ into one self-contained page body (no doctype/html/head/body),
// the format the claude.ai Artifact publisher expects. Usage: node tools/build-artifact.js <out.html>
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const body = html.split('<!--BODY-->')[1].split('<!--/BODY-->')[0];
const css = fs.readFileSync(path.join(root, 'css/style.css'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => fs.readFileSync(path.join(root, m[1]), 'utf8'));
const out = `<title>Shay Cormac Duel</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Inter:wght@400;600;700&display=swap">
<style>
${css}
</style>
${body}
<script>
${scripts.join('\n;\n').replace(/<\/script/gi, '<\\/script')}
</script>
`;
fs.writeFileSync(process.argv[2] || path.join(root, 'shay-duel.html'), out);
console.log('wrote', out.length, 'bytes');
