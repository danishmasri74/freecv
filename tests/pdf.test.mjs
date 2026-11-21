// End-to-end check of what FreeCV actually ships: print every template to PDF in Chromium
// and make sure the text comes out the way an applicant tracking system (ATS) needs it.
//
//   npm run build && npm test          (tests dist/, the minified build)
//   node tests/pdf.test.mjs --src      (tests the unbuilt source files)
//
// Needs Playwright's Chromium: npx playwright install chromium
import { chromium } from 'playwright';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL(process.argv.includes('--src') ? '../' : '../dist/', import.meta.url));
const TEMPLATES = ['harbor', 'ledger', 'atlas', 'quiet'];
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.json': 'application/json' };

// ---------- tiny static server ----------
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
  const file = join(ROOT, path || 'index.html');
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  try {
    const s = await stat(file);
    const target = s.isDirectory() ? join(file, 'index.html') : file;
    res.writeHead(200, { 'Content-Type': MIME[extname(target)] || 'application/octet-stream' });
    res.end(await readFile(target));
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;

// ---------- helpers ----------
let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${!ok && detail ? `\n      ${detail}` : ''}`);
};

async function pdfText(buffer) {
  const doc = await getDocument({ data: new Uint8Array(buffer), verbosity: 0 }).promise;
  let text = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const tc = await (await doc.getPage(i)).getTextContent();
    text += tc.items.map((it) => it.str + (it.hasEOL ? '\n' : '')).join('') + '\n';
  }
  return { pages: doc.numPages, text };
}

// The example resume as the app builds it (read once from the app itself).
let SAMPLE = null;
async function sample() {
  if (SAMPLE) return SAMPLE;
  const p = await browser.newPage();
  await p.goto(BASE);
  SAMPLE = await p.evaluate(() => window.FreeCV.sample());
  await p.close();
  return SAMPLE;
}

// Seed storage BEFORE the app starts (seeding after load would be overwritten by the app's
// save-on-exit when the page reloads), then open the app.
async function loadExample(page, template) {
  const data = JSON.parse(JSON.stringify(await sample()));
  data.settings.template = template;
  await page.addInitScript((json) => {
    if (sessionStorage.getItem('freecv-test-seeded')) return; // only on the first load
    sessionStorage.setItem('freecv-test-seeded', '1');
    const id = 'rtest0001';
    localStorage.clear();
    localStorage.setItem('freecv:index:v2', JSON.stringify({ active: id, items: [{ id, name: '', person: '', updatedAt: Date.now() }] }));
    localStorage.setItem('freecv:resume:' + id, json);
  }, JSON.stringify(data));
  await page.goto(BASE);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const applied = await page.evaluate(() => document.getElementById('resume').className);
  if (!applied.includes('t-' + template)) throw new Error(`test setup: expected template ${template}, page shows "${applied}"`);
}

// ---------- run ----------
const browser = await chromium.launch();
const errors = [];
try {
  for (const tpl of TEMPLATES) {
    console.log(`\n${tpl}`);
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on('pageerror', (e) => errors.push(`${tpl}: ${e.message}`));
    await loadExample(page, tpl);

    const font = await page.evaluate(() => {
      const fam = getComputedStyle(document.querySelector('.r-name')).fontFamily.split(',')[0].replace(/["']/g, '').trim();
      return { fam, loaded: document.fonts.check(`12px "${fam}"`) };
    });
    check(`template font "${font.fam}" is loaded before printing`, font.loaded);

    // Tracking rules from resume.css: tight tracking loses word spaces ("AisyahRahman"),
    // wide tracking on caps splits words ("S U M M A R Y"). Check every element on the page.
    const tracking = await page.evaluate(() => {
      const bad = [];
      document.querySelectorAll('#resume *').forEach((el) => {
        if (!el.textContent.trim()) return;
        const cs = getComputedStyle(el);
        const fs = parseFloat(cs.fontSize);
        const ls = cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing) / fs;
        if (ls < -0.0151) bad.push(`${el.className || el.tagName}: ${ls.toFixed(3)}em (tighter than -0.015em)`);
        if (cs.textTransform === 'uppercase' && ls > 0.1001) bad.push(`${el.className || el.tagName}: ${ls.toFixed(3)}em on uppercase (wider than 0.1em)`);
      });
      return [...new Set(bad)];
    });
    check('letter-spacing stays inside ATS-safe limits', tracking.length === 0, tracking.join('; '));

    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    const { pages, text } = await pdfText(pdf);
    const flat = text.replace(/\s+/g, ' ');
    check('example resume fits on one page', pages === 1, `got ${pages} pages`);
    for (const must of ['Aisyah Rahman', 'aisyah.rahman@example.com', '+60 12-345 6789', 'Senior Frontend Engineer', 'Lumen Pay',
      'Mar 2023 – Present', 'Universiti Teknologi Malaysia', 'TypeScript, JavaScript', 'github.com/aisyah-example/hujan-alert']) {
      check(`PDF text contains "${must}"`, flat.includes(must));
    }
    for (const heading of ['Summary', 'Experience', 'Education', 'Skills', 'Projects']) {
      check(`heading "${heading}" extracts as one word`, new RegExp(`\\b${heading}\\b`, 'i').test(flat));
    }
    const spaced = flat.match(/\b(?:[A-Za-z] ){4,}[A-Za-z]\b/);
    check('no letter-spaced words in the PDF text', !spaced, spaced && `found "${spaced[0]}"`);
    check('app UI does not leak into the PDF', !/Download PDF|Add section|Personal details/.test(flat));
    await page.close();
  }

  // Share link round trip: make a link in one browser profile, open it in a fresh one.
  console.log('\nshare link');
  const a = await browser.newPage();
  await loadExample(a, 'harbor');
  await a.click('#backup-menu summary');
  await a.click('[data-backup-act="share"]');
  await a.waitForFunction(() => document.getElementById('share-link').value.includes('#import='));
  const link = await a.inputValue('#share-link');
  check('share link carries the resume after #', /#import=[zj][A-Za-z0-9_-]+$/.test(link), link.slice(0, 80));
  check('share link stays reasonably short', link.length < 8000, `${link.length} characters`);
  const ctx = await browser.newContext();
  const b = await ctx.newPage();
  b.on('dialog', (d) => d.accept());
  await b.goto(link.replace(/^https?:\/\/[^/]+\//, BASE));
  await b.waitForTimeout(800);
  check('opening the link adds the resume', (await b.textContent('#switcher-name')).trim() === 'Aisyah Rahman');
  check('the link is removed from the address bar', !b.url().includes('#import='), b.url());
  await ctx.close();
} finally {
  await browser.close();
  server.close();
}

check('no JavaScript errors', errors.length === 0, errors.join(' | '));
console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
