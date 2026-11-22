// Does the on-screen page preview match the printed PDF, page for page?
// Runs a matrix of edge cases on A4 and Letter, prints each one to PDF in Chromium, and checks
// that every line the preview shows on page N is on page N of the PDF (and the page counts match).
//
//   npm run build && node tests/pagination.test.mjs        (tests dist/)
//   node tests/pagination.test.mjs --src                   (tests the unbuilt source)
//   node tests/pagination.test.mjs --quick                 (skip the bullet-by-bullet boundary sweep)
import { chromium } from 'playwright';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL(process.argv.includes('--src') ? '../' : '../dist/', import.meta.url));
const QUICK = process.argv.includes('--quick');
const TEMPLATES = ['harbor', 'ledger', 'atlas', 'quiet'];
const PAPERS = ['a4', 'letter'];
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png' };

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

// ---------- scenarios: built inside the app so they use its real data model ----------
// Each returns resume data. Bullets and names are unique so every line can be found in the PDF.
const SCENARIOS = {
  'example (1 page)': () => FreeCV.sample(),
  'two pages': () => withJobs(FreeCV.sample(), 3, 4),
  'five pages': () => withJobs(FreeCV.sample(), 16, 5),
  'one job taller than a page': () => { const d = FreeCV.sample(); giantJob(d, 75, false); return d; },
  'tall job right after the summary': () => { const d = FreeCV.sample(); giantJob(d, 75, true); return d; },
  'one paragraph taller than a page': () => {
    const d = FreeCV.sample();
    d.sections.find((s) => s.type === 'summary').text = Array.from({ length: 70 }, (_, i) => `Sentence ${i + 1} explains another part of my background in some detail so this summary keeps going.`).join(' ');
    return d;
  },
  'compact spacing, 85% text': () => { const d = withJobs(FreeCV.sample(), 8, 4); d.settings.spacing = 0.7; d.settings.size = 0.85; return d; },
  'roomy spacing, 110% text': () => { const d = withJobs(FreeCV.sample(), 2, 3); d.settings.spacing = 1.3; d.settings.size = 1.1; return d; },
  'custom + hidden sections': () => {
    const d = withJobs(FreeCV.sample(), 2, 3);
    const cert = FreeCV.newSection('custom', 'Certifications');
    cert.items = Array.from({ length: 6 }, (_, i) => Object.assign(FreeCV.blankItem('custom'), { name: `Certificate number ${i + 1} in cloud things`, org: `Issuer ${i + 1}`, date: '202' + i, description: `- Covered topic ${i + 1}a\n- Covered topic ${i + 1}b` }));
    const langs = FreeCV.newSection('list', 'Languages');
    langs.items = ['Bahasa Malaysia|Native', 'English|Fluent', 'Mandarin|Conversational', 'Tamil|Basic', 'Japanese|Beginner', 'Arabic|Reading'].map((x) => Object.assign(FreeCV.blankItem('list'), { name: x.split('|')[0], skills: x.split('|')[1] }));
    d.sections.push(cert, langs);
    d.sections.find((s) => s.type === 'projects').hidden = true;
    return d;
  },
  'blank resume': () => FreeCV.blank(),
  'long unbreakable links and words': () => {
    const d = withJobs(FreeCV.sample(), 2, 3);
    d.personal.links.push('https://example.com/' + 'averyveryverylongpathsegment'.repeat(4));
    d.sections.find((s) => s.type === 'experience').items[0].bullets += '\nSupercalifragilisticexpialidociousandthensomemoreletterswithoutanyspacesatallforwrapping' + 'x'.repeat(40);
    return d;
  },
  'many links in the header': () => {
    const d = withJobs(FreeCV.sample(), 2, 3);
    for (let i = 0; i < 7; i++) d.personal.links.push(`portfolio-site-number-${i + 1}.example.com/work`);
    return d;
  }
};
const HELPERS = `
  function withJobs(d, n, bullets) {
    const exp = d.sections.find((s) => s.type === 'experience');
    for (let i = 0; i < n; i++) {
      const it = FreeCV.blankItem('experience');
      Object.assign(it, { role: 'Engineer role ' + (i + 1), org: 'Company ' + (i + 1), location: 'Penang', start: '201' + (i % 10), end: '202' + (i % 10),
        bullets: Array.from({ length: bullets }, (_, k) => 'Job ' + (i + 1) + ' point ' + (k + 1) + ' improved a key product metric by a clear and measurable amount').join('\\n') });
      exp.items.push(it);
    }
    return d;
  }
  function giantJob(d, bullets, first) {
    const exp = d.sections.find((s) => s.type === 'experience');
    const it = FreeCV.blankItem('experience');
    Object.assign(it, { role: 'Very long job', org: 'Big Company', location: 'Remote', start: '2010', end: '2020',
      bullets: Array.from({ length: bullets }, (_, k) => 'Long job bullet ' + (k + 1) + (k % 3 === 0 ? ' which is deliberately written to wrap onto a second line of text in the template' : ' shipped something useful')).join('\\n') });
    if (first) exp.items.unshift(it); else exp.items.push(it);
  }
`;

// ---------- helpers ----------
let failures = 0, checks = 0;
const fail = (msg) => { failures++; console.log('  ✗ ' + msg); };
const strip = (t) => (t || '').replace(/\s+/g, '').toLowerCase();

async function pdfPages(buffer) {
  const doc = await getDocument({ data: new Uint8Array(buffer), verbosity: 0 }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const tc = await (await doc.getPage(i)).getTextContent();
    pages.push(strip(tc.items.map((it) => it.str).join(' ')));
  }
  return pages;
}

const browser = await chromium.launch();
const builder = await browser.newPage();
await builder.goto(BASE);
async function build(name, mutate) {
  return builder.evaluate(([helpers, fnSrc, m]) => {
    const fn = new Function('FreeCV', helpers + '; return (' + fnSrc + ')();');
    const d = fn(window.FreeCV);
    Object.assign(d.settings, m);
    return d;
  }, [HELPERS, SCENARIOS[name] ? SCENARIOS[name].toString() : mutate, {}]);
}

// Load data in a fresh page, then compare the preview's pages with the printed PDF.
async function compare(label, data) {
  checks++;
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((json) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.clear();
    localStorage.setItem('freecv:index:v2', JSON.stringify({ active: 'rtest0001', items: [{ id: 'rtest0001', name: '', person: '', updatedAt: Date.now() }] }));
    localStorage.setItem('freecv:resume:rtest0001', json);
  }, JSON.stringify(data));
  await page.goto(BASE);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);

  // Every text "leaf" in the preview, and which page shows it fully, partly, or not at all.
  const preview = await page.evaluate(() => {
    const LEAF = 'li, p, h1, h2, h3, .r-org, .r-loc, .r-date, .r-link, .r-skill, .r-contact';
    const sheets = [...document.querySelectorAll('#pages .page-sheet')];
    const out = sheets.map(() => ({ full: [] }));
    const seen = new Map();
    sheets.forEach((sheet, i) => {
      const clip = sheet.querySelector('.page-clip').getBoundingClientRect();
      sheet.querySelectorAll(LEAF).forEach((el, idx) => {
        if (el.querySelector(LEAF) || el.classList.contains('r-empty')) return; // the empty-state hint is screen-only
        const text = el.innerText.trim();
        if (!text) return;
        const r = el.getBoundingClientRect();
        const inside = r.top >= clip.top - 1 && r.bottom <= clip.bottom + 1;
        const overlap = r.bottom > clip.top + 1 && r.top < clip.bottom - 1;
        if (inside) out[i].full.push(text);
        if (inside || overlap) seen.set(idx, true); else if (!seen.has(idx)) seen.set(idx, false);
      });
    });
    const lost = [...seen.values()].filter((v) => !v).length;
    return { pages: out, lost, count: sheets.length, meta: document.getElementById('preview-meta').innerText.split('\n')[0] };
  });

  const pdf = await pdfPages(await page.pdf({ preferCSSPageSize: true, printBackground: true }));
  const problems = [];
  if (preview.count !== pdf.length) problems.push(`preview ${preview.count} page(s), PDF ${pdf.length}`);
  if (!preview.meta.startsWith(preview.count + ' page')) problems.push(`toolbar says "${preview.meta}"`);
  if (preview.lost) problems.push(`${preview.lost} line(s) not visible on any preview page`);
  preview.pages.forEach((pg, i) => {
    for (const t of pg.full) {
      if (strip(t).length < 4) continue;
      if (!(pdf[i] || '').includes(strip(t))) { problems.push(`page ${i + 1}: "${t.slice(0, 60)}" is not on PDF page ${i + 1}`); break; }
    }
  });
  if (errors.length) problems.push('JS errors: ' + errors.join(' | '));
  if (problems.length) fail(`${label}: ${problems.join('; ')}`);
  await page.close();
  const firstOfPage2 = preview.pages[1] && preview.pages[1].full[0];
  return { pages: preview.count, ok: !problems.length, firstOfPage2 };
}

try {
  for (const paper of PAPERS) {
    for (const tpl of TEMPLATES) {
      console.log(`\n${paper.toUpperCase()} · ${tpl}`);
      for (const name of Object.keys(SCENARIOS)) {
        const data = await build(name);
        data.settings.template = tpl;
        data.settings.paper = paper;
        const r = await compare(`${paper} ${tpl} "${name}"`, data);
        if (r.ok) console.log(`  ✓ ${name} (${r.pages} page${r.pages > 1 ? 's' : ''})`);
      }
    }
  }

  if (!QUICK) {
    // Boundary sweep: grow the summary one sentence (about one line) per step, so everything below it
    // slides down line by line and every block crosses the bottom of the page at a different point.
    for (const paper of PAPERS) {
      for (const tpl of TEMPLATES) {
        let changes = 0, prev = null, bad = 0;
        const steps = 34;
        for (let k = 0; k < steps; k++) {
          const data = await build(null, `() => { const d = withJobs(FreeCV.sample(), 1, 3); d.sections.find((s) => s.type === 'summary').text = Array.from({ length: ${k} }, (_, i) => 'Extra line ' + (i + 1) + ' of the summary adds roughly one line.').join('\\n'); return d; }`);
          data.settings.template = tpl;
          data.settings.paper = paper;
          const r = await compare(`${paper} ${tpl} sweep step ${k}`, data);
          if (!r.ok) bad++;
          if (prev !== null && r.firstOfPage2 !== prev) changes++;
          prev = r.firstOfPage2;
        }
        console.log(`${bad ? '  ✗' : '  ✓'} boundary sweep ${paper} ${tpl}: ${steps} steps, page 2 started at ${changes + 1} different places`);
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}
console.log(failures ? `\n${failures} of ${checks} comparisons failed` : `\nAll ${checks} comparisons match the PDF`);
process.exit(failures ? 1 : 0);
