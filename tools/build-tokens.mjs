// Genera src/styles/_tokens.scss (variables CSS) y _tokens-maps.scss (mapas Sass) a partir de design-tokens/emsafe.tokens.json.
// Uso: node tools/build-tokens.mjs          (escribe el archivo)
//      node tools/build-tokens.mjs --check  (falla si el archivo no está al día)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tokens = JSON.parse(readFileSync(resolve(root, 'design-tokens/emsafe.tokens.json'), 'utf8'));
const out = resolve(root, 'src/styles/_tokens.scss');
const outMaps = resolve(root, 'src/styles/_tokens-maps.scss');

const px = (n) => (n === 0 ? '0' : `${n}px`);
const fallback = { heading: "'Arial Narrow', sans-serif", body: 'system-ui, sans-serif', mono: 'ui-monospace, monospace' };
const scrim = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

const colorVars = (set, scrimAlpha) =>
  Object.entries(set)
    .map(([k, v]) => `  --ems-${k}: ${k === 'scrim' ? scrim(v, scrimAlpha) : v};`)
    .join('\n');

const lines = [];
lines.push(`// Archivo generado por tools/build-tokens.mjs (tokens v${tokens.$version}). No editar a mano.`);
lines.push('');
lines.push(':root {');
for (const [k, v] of Object.entries(tokens.font)) lines.push(`  --ems-font-${k}: '${v}', ${fallback[k]};`);
for (const [k, v] of Object.entries(tokens.space)) lines.push(`  --ems-space-${k}: ${px(v)};`);
for (const [k, v] of Object.entries(tokens.radius)) lines.push(`  --ems-radius-${k}: ${px(v)};`);
for (const [k, v] of Object.entries(tokens.border)) lines.push(`  --ems-border-${k}: ${px(v)};`);
for (const [k, v] of Object.entries(tokens.size)) lines.push(`  --ems-size-${k}: ${px(v)};`);
for (const [k, v] of Object.entries(tokens.motion.duration)) lines.push(`  --ems-duration-${k}: ${v}ms;`);
for (const [k, v] of Object.entries(tokens.motion.easing)) lines.push(`  --ems-ease-${k}: cubic-bezier(${v.join(', ')});`);
for (const [k, v] of Object.entries(tokens.elevation)) lines.push(`  --ems-elevation-${k}: ${v};`);
lines.push('');
lines.push(colorVars(tokens.color.light, 0.48));
lines.push('  color-scheme: light;');
lines.push('}');
lines.push('');
lines.push(':root.theme-dark {');
lines.push(colorVars(tokens.color.dark, 0.62));
lines.push('  color-scheme: dark;');
lines.push('}');
lines.push('');
const maps = [lines[0], ''];
maps.push('$ems-breakpoints: (');
for (const [k, v] of Object.entries(tokens.breakpoint)) maps.push(`  ${k}: ${v}px,`);
maps.push(');');
maps.push('');
maps.push('$ems-type: (');
for (const [k, t] of Object.entries(tokens.type)) {
  maps.push(
    `  ${k}: (font: ${t.font}, size: ${t.size}px, line: ${t.line}px, weight: ${t.weight}, tracking: ${t.tracking}px),`,
  );
}
maps.push(');');
maps.push('');

const content = lines.join('\n');
const mapsContent = maps.join('\n');
if (process.argv.includes('--check')) {
  // Sin distinguir fin de línea: con core.autocrlf, Git deja los archivos en CRLF en Windows.
  const lf = (text) => text.replace(/\r\n/g, '\n');
  const same = (file, expected) => lf(readFileSync(file, 'utf8')) === lf(expected);
  if (!same(out, content) || !same(outMaps, mapsContent)) {
    console.error('src/styles/_tokens.scss no coincide con design-tokens/emsafe.tokens.json. Ejecuta: node tools/build-tokens.mjs');
    process.exit(1);
  }
  console.log('Tokens al día.');
} else {
  writeFileSync(out, content);
  writeFileSync(outMaps, mapsContent);
  console.log('Tokens escritos en src/styles/_tokens.scss y _tokens-maps.scss');
}
