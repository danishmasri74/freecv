# FreeCV

A small, fast resume builder that is actually free, including the PDF export.

- Runs entirely in the browser: no backend, no accounts, no tracking
- Autosaves to `localStorage`; **Export** downloads a JSON backup, **Import** (or drag-and-drop) restores it
- PDF via the browser's print dialog (Save as PDF), so text stays selectable and ATS-readable
- Four ATS-friendly templates (Harbor, Ledger, Atlas, Quiet), accent colour, A4 / Letter
- Spacing (Compact / Normal / Roomy), text size (85–110%) and a one-click **Fit to 1 page**
- Add your own sections: Certifications, Awards, Volunteering, Publications, Languages, Interests, or blank ones
- No build step, no dependencies: about 88 KB of code, plus one 25–100 KB font for the chosen template

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
| `css/resume.css` | The four resume templates and their `@font-face` rules (sizes in pt so the preview matches the PDF) |
| `fonts/` | Self-hosted OFL fonts, one family per template (see `fonts/LICENSE.md`) |
| `js/data.js` | Data model, field definitions, example resume, import validation (`normalize`) |
| `js/preview.js` | Resume data → resume HTML |
| `js/editor.js` | Resume data → editor form |
| `js/app.js` | State, autosave, events, export/import, print, backup reminder |

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
   Framework preset: **None**. Build command: *(empty)*. Output directory: `/`.
3. In the Pages project → Custom domains → add `cv.danishmasri.tech`.
   If the domain's DNS is on Cloudflare, the CNAME is created for you; otherwise add
   `CNAME cv → <project>.pages.dev` at your DNS provider.

Netlify and Vercel work the same way: static site, no build command, publish the repo root.
