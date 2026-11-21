# FreeCV

A small, fast resume builder that is actually free, including the PDF export.

- Runs entirely in the browser: no backend, no accounts, no tracking
- Autosaves to `localStorage`; the **Backup** menu downloads a JSON backup file or restores one (or drag a file onto the page) as a new resume
- Keep several resumes in one browser (new, from example, duplicate, rename, delete with undo)
- Undo / redo for every change (Ctrl+Z, Ctrl+Shift+Z or Ctrl+Y); typing is grouped into one step
- PDF via the browser's print dialog (Save as PDF), so text stays selectable and ATS-readable
- Four ATS-friendly templates (Harbor, Ledger, Atlas, Quiet), accent colour, A4 / Letter
- Spacing (Compact / Normal / Roomy), text size (85–110%) and a one-click **Fit to 1 page**
- Add your own sections: Certifications, Awards, Volunteering, Publications, Languages, Interests, or blank ones
- **Open on another device**: a link that carries the resume after `#` (compressed), so nothing is uploaded
- No runtime dependencies: about 94 KB of minified code (27 KB gzipped), plus one 25–100 KB font for the chosen template

## Run locally

The source works as-is: open `index.html` directly, or serve the folder:

```powershell
python -m http.server 5178
```

Then visit http://localhost:5178.

## Build and test

```powershell
npm install
npx playwright install chromium
npm run check
```

- `npm run build` writes the deployable site to `dist/`: one minified, content-hashed JS file, one CSS file, compacted HTML, fonts, assets and a `_headers` file with long cache lifetimes for the hashed files.
- `npm test` prints every template to PDF in headless Chromium and checks the extracted text: name, contact details and headings intact, no letter-spaced words, the example fits on one page, no app UI in the PDF, and letter-spacing within the ATS-safe limits below. It also round-trips a share link. Add `--src` (`node tests/pdf.test.mjs --src`) to test the unbuilt source.
- GitHub Actions (`.github/workflows/check.yml`) runs both on every push to `main` and on pull requests.
- The root `_headers` file only matters if the repo root is deployed without the build: it makes browsers re-check the unhashed CSS/JS on every visit, so a new `index.html` never runs with stale cached files.

## Files

| Path | What it does |
| --- | --- |
| `index.html` | Page shell, toolbar, dialogs, icon sprite |
| `css/app.css` | Editor/app UI, mobile tabs, print rules (prints only the resume) |
| `css/resume.css` | The four resume templates and their `@font-face` rules (sizes in pt so the preview matches the PDF) |
| `fonts/` | Self-hosted OFL fonts, one family per template (see `fonts/LICENSE.md`) |
| `js/data.js` | Data model, field definitions, example resume, import validation (`normalize`) |
| `js/preview.js` | Resume data → resume HTML |
| `js/editor.js` | Resume data → editor form |
| `js/app.js` | State, autosave, multi-resume storage, undo/redo, events, export/import, print, backup reminder |
| `assets/og.png` | Share image (1200×630) used by the Open Graph / Twitter tags |
| `tools/og-image.html` | Source for the share image; the regenerate command is in its comment |
| `build.mjs` | Minifies and bundles the source into `dist/` (esbuild) |
| `tests/pdf.test.mjs` | PDF/ATS checks for every template, plus the share link round trip |

### Storage

`freecv:index:v2` lists the resumes (`active`, `items[{ id, name, person, updatedAt }]`); each resume lives at `freecv:resume:<id>`.
Data from the single-resume version (`freecv:resume:v1`) is migrated on first load and the old key is left untouched.

Scripts are plain `<script>` files that share a `window.FreeCV` namespace (not ES modules), so the app also works from `file://`.

## Notes for template work

| Template | Font | Look |
| --- | --- | --- |
| Harbor (default) | Source Sans 3 | Split header, dates in a left gutter, ink-first |
| Ledger | Source Serif 4 | Centred header, double rule, small-caps headings |
| Atlas | Manrope | Tinted header panel, accent company names |
| Quiet | IBM Plex Sans | Minimal, one grey meta line per entry |

- `preview.js` emits the same markup for every template (title, org, location, date, body, in reading order); each template only rearranges it in CSS.
- Keep real text (no images, icons or canvas) so ATS can read it.
- Vertical spacing between header, sections and entries is written as `calc(Npt * var(--sp))` so the spacing setting scales it; text size is CSS `zoom` on `.resume` (page margins stay fixed).
- Section types with `multiple: true` in `data.js` (`custom`, `list`) can be added any number of times and deleted; the built-in sections can only be hidden.
- Backups from older versions map `classic` → Ledger, `modern` → Harbor, `minimal` → Quiet (see `normalize` in `data.js`).
- Don't track names tighter than about `-0.015em`: PDF text then loses the space and reads `AisyahRahman`.
- `.r-entry` and `.r-keep` use `break-inside: avoid`, so entries and section headings never split across pages.
- Keep uppercase heading `letter-spacing` at **0.1em or less**. Wider tracking makes PDF text extract as `S U M M A R Y`.
- Page margins come from `@page { margin: 15mm }`, which `app.js` rewrites when the paper size changes.

## Deploy (Cloudflare Pages → cv.danishmasri.tech)

1. Push this folder to a GitHub repo.
2. Cloudflare dashboard → Workers & Pages → Create → Pages → connect the repo.
   Framework preset: **None**. Build command: `npm run build`. Output directory: `dist`.
   (Already connected with the old settings? Change them under the project's Settings → Builds.)
3. In the Pages project → Custom domains → add `cv.danishmasri.tech`.
   If the domain's DNS is on Cloudflare, the CNAME is created for you; otherwise add
   `CNAME cv → <project>.pages.dev` at your DNS provider.

Netlify and Vercel work the same way: build command `npm run build`, publish directory `dist`.

## License

[MIT](LICENSE). The bundled fonts are under the SIL Open Font License (see `fonts/LICENSE.md`).
