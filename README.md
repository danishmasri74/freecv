# FreeCV

A small, fast resume builder that is actually free, including the PDF export.

- Runs entirely in the browser: no backend, no accounts, no tracking
- Autosaves to `localStorage`; **Export** downloads a JSON backup, **Import** (or drag-and-drop) restores it
- PDF via the browser's print dialog (Save as PDF), so text stays selectable and ATS-readable
- Three single-column templates (Classic, Modern, Minimal), accent colour, A4 / Letter
- No build step, no dependencies, about 66 KB total

## Run locally

Open `index.html` directly, or serve the folder:

```powershell
python -m http.server 5178
```

Then visit http://localhost:5178.

## Files

| Path | What it does |
| --- | --- |
| `index.html` | Page shell, toolbar, dialogs, icon sprite |
| `css/app.css` | Editor/app UI, mobile tabs, print rules (prints only the resume) |
| `css/resume.css` | The three resume templates (sizes in pt so the preview matches the PDF) |
| `js/data.js` | Data model, field definitions, example resume, import validation (`normalize`) |
| `js/preview.js` | Resume data → resume HTML |
| `js/editor.js` | Resume data → editor form |
| `js/app.js` | State, autosave, events, export/import, print, backup reminder |

Scripts are plain `<script>` files that share a `window.FreeCV` namespace (not ES modules), so the app also works from `file://`.

## Notes for template work

- Keep everything single-column, and keep real text (no images or canvas) so ATS can read it.
- `.r-entry` and `.r-keep` use `break-inside: avoid`, so entries and section headings never split across pages.
- Keep uppercase heading `letter-spacing` at **0.1em or less**. Wider tracking makes PDF text extract as `S U M M A R Y`.
- Page margins come from `@page { margin: 15mm }`, which `app.js` rewrites when the paper size changes.

## Deploy (Cloudflare Pages → cv.danishmasri.tech)

1. Push this folder to a GitHub repo.
2. Cloudflare dashboard → Workers & Pages → Create → Pages → connect the repo.
   Framework preset: **None**. Build command: *(empty)*. Output directory: `/`.
3. In the Pages project → Custom domains → add `cv.danishmasri.tech`.
   If the domain's DNS is on Cloudflare, the CNAME is created for you; otherwise add
   `CNAME cv → <project>.pages.dev` at your DNS provider.

Netlify and Vercel work the same way: static site, no build command, publish the repo root.
