// Assemble un build Vite en un seul fichier HTML autonome (JS et CSS intégrés), pour un test sur téléphone
// via une page partageable. Usage : node scripts/build-artifact.mjs [dossier] [fichier] [titre]
//   Échos  : npm run build:artifact   -> dist/echos.html
//   Cadran : npm run cadran:artifact  -> dist-cadran/cadran.html
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [dir = 'dist', outName = 'echos.html', title = 'Échos'] = process.argv.slice(2);
const dist = new URL(`../${dir}/`, import.meta.url).pathname;
const html = readFileSync(join(dist, 'index.html'), 'utf8');

const jsFile = /<script type="module" crossorigin src="\.\/([^"]+)"><\/script>/.exec(html)?.[1];
const cssFile = /<link rel="stylesheet" crossorigin href="\.\/([^"]+)">/.exec(html)?.[1];
if (!jsFile || !cssFile) throw new Error('Assets introuvables dans dist/index.html');
const js = readFileSync(join(dist, jsFile), 'utf8').replace(/<\/script/gi, '<\\/script');
const css = readFileSync(join(dist, cssFile), 'utf8');
const body = /<body>([\s\S]*?)<\/body>/.exec(html)?.[1]?.replace(/<script[\s\S]*?<\/script>/g, '').trim();
if (!body) throw new Error('Corps introuvable');

// Le cadre de la page ajoute déjà les marges de sécurité haut/bas : on les retire de #app.
const override = `#app{height:100%;padding-block:12px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}`;

const out = `<title>${title}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="theme-color" content="#efe4cc">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600&family=Spectral:ital,wght@0,400;0,500;0,600;1,400&display=swap" rel="stylesheet">
<style>${css}
${override}</style>
${body}
<script type="module">${js}</script>
`;
writeFileSync(join(dist, outName), out);
console.log(`${dir}/${outName} (${(out.length / 1024).toFixed(1)} Ko)`);
