// Build FreeCV into dist/: one minified JS file, one minified CSS file, compacted HTML.
// The source files stay unbundled so index.html still works when opened directly.
import { transform } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const ROOT = new URL('./', import.meta.url);
const DIST = new URL('./dist/', import.meta.url);
const read = (p) => readFile(new URL(p, ROOT), 'utf8');
const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 10);

const JS = ['js/data.js', 'js/preview.js', 'js/editor.js', 'js/app.js'];
const CSS = ['css/app.css', 'css/resume.css'];

await rm(DIST, { recursive: true, force: true });
await mkdir(new URL('js/', DIST), { recursive: true });
await mkdir(new URL('css/', DIST), { recursive: true });

// JS: the files are classic scripts sharing window.FreeCV, so plain concatenation in load order is safe.
const jsSrc = (await Promise.all(JS.map(read))).join('\n;\n');
const js = (await transform(jsSrc, { loader: 'js', minify: true, target: 'es2018', legalComments: 'none' })).code;

// CSS: resume.css points at ../fonts/, which still resolves from dist/css/.
const cssSrc = (await Promise.all(CSS.map(read))).join('\n');
const css = (await transform(cssSrc, { loader: 'css', minify: true, legalComments: 'none' })).code;

const jsName = `js/app.${hash(js)}.js`;
const cssName = `css/app.${hash(css)}.css`;
await writeFile(new URL(jsName, DIST), js);
await writeFile(new URL(cssName, DIST), css);

// HTML: swap in the bundles, drop comments, trim indentation (newlines are kept, so inline text spacing is unchanged).
let html = await read('index.html');
const swap = (pattern, replacement, what) => {
  if (!pattern.test(html)) throw new Error(`build: could not find ${what} in index.html`);
  html = html.replace(pattern, replacement);
};
swap(/<link rel="stylesheet" href="css\/app\.css">\s*<link rel="stylesheet" href="css\/resume\.css">/, `<link rel="stylesheet" href="${cssName}">`, 'the stylesheet links');
swap(/(<script src="js\/[a-z]+\.js"><\/script>\s*){4}/, `<script src="${jsName}"></script>\n`, 'the four script tags');
html = html.replace(/<!--[\s\S]*?-->/g, '').split('\n').map((l) => l.trim()).filter(Boolean).join('\n');
await writeFile(new URL('index.html', DIST), html);

await cp(new URL('fonts/', ROOT), new URL('fonts/', DIST), { recursive: true });
await cp(new URL('assets/', ROOT), new URL('assets/', DIST), { recursive: true });
await cp(new URL('LICENSE', ROOT), new URL('LICENSE', DIST));

// Cloudflare Pages / Netlify read _headers: hashed bundles never change, so cache them for a year.
await writeFile(new URL('_headers', DIST), [
  '/*',
  '  X-Content-Type-Options: nosniff',
  '  Referrer-Policy: no-referrer',
  '/js/*',
  '  Cache-Control: public, max-age=31536000, immutable',
  '/css/*',
  '  Cache-Control: public, max-age=31536000, immutable',
  '/fonts/*',
  '  Cache-Control: public, max-age=2592000',
  ''
].join('\n'));

const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(1) + ' KB';
const srcTotal = jsSrc + cssSrc + (await read('index.html'));
const outTotal = js + css + html;
console.log(`dist/${jsName}  ${kb(js)}  (gzip ${kb(gzipSync(js))})`);
console.log(`dist/${cssName}  ${kb(css)}  (gzip ${kb(gzipSync(css))})`);
console.log(`dist/index.html  ${kb(html)}  (gzip ${kb(gzipSync(html))})`);
console.log(`code: ${kb(srcTotal)} source → ${kb(outTotal)} minified, ${kb(gzipSync(outTotal))} gzipped`);
