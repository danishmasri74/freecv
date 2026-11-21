/* FreeCV — state, autosave, events, PDF/JSON export. */
(function () {
  'use strict';

  var FreeCV = window.FreeCV;
  var KEY = 'freecv:resume:v1';
  var META_KEY = 'freecv:meta:v1';
  var DAY = 864e5;
  var MM = 96 / 25.4; // CSS px per mm

  var $ = function (id) { return document.getElementById(id); };
  var els = {
    editor: $('editor'), resume: $('resume'), sheet: $('sheet'), frame: $('sheet-frame'),
    preview: $('preview'), guides: $('guides'), meta: $('preview-meta'), workspace: $('workspace'),
    template: $('template'), paper: $('paper'), swatches: $('swatches'), pageStyle: $('page-style'),
    banner: $('banner'), bannerText: $('banner-text'), toast: $('toast'), toastText: $('toast-text'), toastAction: $('toast-action'),
    file: $('file-import'), menu: $('more-menu'), dlgPrint: $('dlg-print'), dlgAbout: $('dlg-about')
  };

  /* ---------- Storage (every access guarded: private mode can throw) ---------- */

  var storageOk = true;
  function readJSON(key) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : null; }
    catch (e) { storageOk = false; return null; }
  }
  function writeJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (e) { storageOk = false; return false; }
  }

  var meta = readJSON(META_KEY) || {};
  function saveMeta() { writeJSON(META_KEY, meta); }

  var state;
  (function load() {
    var stored = readJSON(KEY);
    if (stored) {
      try { state = FreeCV.normalize(stored); } catch (e) { state = null; }
    }
    if (!state) state = FreeCV.sample();
  })();
  // Probe once so we can warn early if nothing will be saved.
  try { localStorage.setItem('freecv:probe', '1'); localStorage.removeItem('freecv:probe'); } catch (e) { storageOk = false; }

  var ui = { closed: new Set(), openEntries: new Set() };

  var saveTimer = 0;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { writeJSON(KEY, state); }, 250);
  }
  function flushSave() { clearTimeout(saveTimer); writeJSON(KEY, state); }
  window.addEventListener('pagehide', flushSave);
  document.addEventListener('visibilitychange', function () { if (document.hidden) flushSave(); });

  function edited() {
    var now = Date.now();
    if (!meta.firstEditAt) meta.firstEditAt = now;
    meta.lastEditAt = now;
    saveMeta();
    save();
    schedulePreview();
    checkBanner();
  }

  /* ---------- Lookups ---------- */

  function secById(id) { return state.sections.find(function (s) { return s.id === id; }); }
  function itemIn(sec, id) { return sec && sec.items ? sec.items.find(function (i) { return i.id === id; }) : null; }
  function move(arr, from, to) {
    if (to < 0 || to >= arr.length) return false;
    arr.splice(to, 0, arr.splice(from, 1)[0]);
    return true;
  }

  /* ---------- Rendering ---------- */

  function renderEditor() {
    var scroll = els.editor.scrollTop;
    els.editor.innerHTML = FreeCV.renderEditor(state, ui);
    els.editor.scrollTop = scroll;
  }

  var previewQueued = false;
  function schedulePreview() {
    if (previewQueued) return;
    previewQueued = true;
    requestAnimationFrame(function () { previewQueued = false; renderPreview(); });
  }

  function renderPreview() {
    els.resume.innerHTML = FreeCV.renderResume(state);
    layoutSheet();
  }

  function paperDims() {
    return state.settings.paper === 'letter' ? { w: 215.9, h: 279.4, label: 'Letter' } : { w: 210, h: 297, label: 'A4' };
  }

  // Fit the paper to the preview column and draw approximate page-break lines.
  function layoutSheet() {
    var d = paperDims(), m = 15;
    var sheet = els.sheet;
    sheet.style.transform = '';
    var sheetW = sheet.offsetWidth;
    var contentH = (d.h - 2 * m) * MM;
    var resumeH = els.resume.offsetHeight;
    var pages = Math.max(1, Math.ceil((resumeH - 2) / contentH));

    sheet.style.minHeight = (pages * d.h) + 'mm';
    var guides = '';
    for (var i = 1; i < pages; i++) {
      guides += '<div class="guide" style="top:' + (m * MM + i * contentH) + 'px"><span>Page ' + (i + 1) + '</span></div>';
    }
    els.guides.innerHTML = guides;

    var cs = getComputedStyle(els.preview);
    var avail = els.preview.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    var scale = Math.min(1, avail / sheetW);
    sheet.style.transform = scale < 1 ? 'scale(' + scale + ')' : '';
    els.frame.style.width = (sheetW * scale) + 'px';
    els.frame.style.height = (sheet.offsetHeight * scale) + 'px';

    els.meta.innerHTML = '<span>' + d.label + ' · about ' + pages + ' page' + (pages > 1 ? 's' : '') + '</span>' +
      (pages > 1 ? '<span>Dashed lines show roughly where pages break</span>' : '<span></span>');
  }

  function applySettings() {
    var s = state.settings;
    els.resume.className = 'resume t-' + s.template;
    els.resume.style.setProperty('--accent', s.accent);
    els.sheet.classList.toggle('paper-letter', s.paper === 'letter');
    els.pageStyle.textContent = '@page { size: ' + (s.paper === 'letter' ? 'letter' : 'A4') + '; margin: 15mm; }';
    els.template.value = s.template;
    els.paper.value = s.paper;
    renderSwatches();
  }

  function renderSwatches() {
    var cur = state.settings.accent.toLowerCase();
    var isPreset = false;
    var html = FreeCV.ACCENTS.map(function (a) {
      var on = a.value.toLowerCase() === cur;
      if (on) isPreset = true;
      return '<button type="button" class="swatch" role="radio" aria-checked="' + on + '" aria-label="' + a.name + '" title="' + a.name +
        '" data-accent="' + a.value + '" style="background:' + a.value + '"></button>';
    }).join('');
    html += '<label class="swatch swatch-custom" role="radio" aria-checked="' + !isPreset + '" title="Custom colour"' +
      (!isPreset ? ' style="background:' + cur + '"' : '') + '>' +
      '<input type="color" id="accent-custom" value="' + cur + '" aria-label="Custom accent colour"></label>';
    els.swatches.innerHTML = html;
  }

  function renderAll() {
    applySettings();
    renderEditor();
    renderPreview();
    checkBanner();
  }

  /* ---------- Toast with optional undo ---------- */

  var toastTimer = 0, undoSnapshot = null;
  function toast(msg, undoable) {
    els.toastText.textContent = msg;
    els.toastAction.hidden = !undoable;
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { els.toast.hidden = true; undoSnapshot = null; }, undoable ? 7000 : 3000);
  }
  function snapshot() { undoSnapshot = JSON.stringify(state); }
  els.toastAction.addEventListener('click', function () {
    if (!undoSnapshot) return;
    state = JSON.parse(undoSnapshot);
    undoSnapshot = null;
    els.toast.hidden = true;
    renderAll();
    edited();
  });

  /* ---------- Backup reminder ---------- */

  function checkBanner() {
    var now = Date.now(), msg = '';
    if (!storageOk) {
      msg = 'This browser is not saving your changes (private window or storage blocked). Export a backup before you close this tab.';
    } else if (meta.firstEditAt && now - meta.firstEditAt > 10 * 60e3 &&
      (!meta.lastExportAt || (meta.lastEditAt > meta.lastExportAt && now - meta.lastExportAt > 7 * DAY)) &&
      (!meta.snoozeUntil || now > meta.snoozeUntil)) {
      msg = meta.lastExportAt
        ? 'You have changes since your last backup. Your resume is saved only in this browser, so export a fresh copy now and then.'
        : 'Your resume is saved only in this browser. Clearing site data or switching devices will lose it, so export a backup file to keep it safe.';
    }
    els.bannerText.textContent = msg;
    els.banner.hidden = !msg;
  }
  $('banner-dismiss').addEventListener('click', function () {
    meta.snoozeUntil = Date.now() + 3 * DAY;
    saveMeta();
    els.banner.hidden = true;
  });
  $('banner-export').addEventListener('click', exportJSON);

  /* ---------- Editor: typing ---------- */

  els.editor.addEventListener('input', function (e) {
    var el = e.target, d = el.dataset;
    if (!d.field && d.link == null) return;
    var v = el.value;

    if (d.scope === 'personal') {
      if (d.link != null) state.personal.links[+d.link] = v;
      else state.personal[d.field] = v;
    } else if (d.sec) {
      var sec = secById(d.sec);
      if (!sec) return;
      if (d.item) {
        var item = itemIn(sec, d.item);
        if (!item) return;
        item[d.field] = v;
        var lbl = els.editor.querySelector('[data-label-for="' + d.item + '"]');
        if (lbl) {
          var l = FreeCV.entryLabel(sec.type, item);
          lbl.textContent = l.text;
          lbl.classList.toggle('empty', l.empty);
        }
      } else {
        sec[d.field] = v;
      }
    }
    edited();
  });

  /* ---------- Editor: buttons ---------- */

  els.editor.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled) return;
    var d = btn.dataset, a = d.action;
    var sec = d.sec ? secById(d.sec) : null;
    var idx, focusSel = null;

    switch (a) {
      case 'toggle-card':
        if (ui.closed.has(d.cardId)) ui.closed.delete(d.cardId); else ui.closed.add(d.cardId);
        var card = btn.closest('.card');
        card.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', card.classList.contains('is-open'));
        return;

      case 'toggle-entry':
        if (ui.openEntries.has(d.item)) ui.openEntries.delete(d.item); else ui.openEntries.add(d.item);
        var entry = btn.closest('.entry');
        entry.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', entry.classList.contains('is-open'));
        return;

      case 'add-link':
        state.personal.links.push('');
        focusSel = '[data-link="' + (state.personal.links.length - 1) + '"]';
        break;

      case 'del-link':
        state.personal.links.splice(+d.link, 1);
        if (!state.personal.links.length) state.personal.links.push('');
        break;

      case 'add-item':
        var item = FreeCV.blankItem(sec.type);
        sec.items.push(item);
        ui.openEntries.add(item.id);
        focusSel = '[data-item="' + item.id + '"][data-field]';
        break;

      case 'del-item':
        snapshot();
        idx = sec.items.findIndex(function (i) { return i.id === d.item; });
        sec.items.splice(idx, 1);
        toast('Entry deleted.', true);
        break;

      case 'up-item':
      case 'down-item':
        idx = sec.items.findIndex(function (i) { return i.id === d.item; });
        if (!move(sec.items, idx, idx + (a === 'up-item' ? -1 : 1))) return;
        focusSel = '[data-action="' + a + '"][data-item="' + d.item + '"]';
        break;

      case 'up-sec':
      case 'down-sec':
        idx = state.sections.indexOf(sec);
        if (!move(state.sections, idx, idx + (a === 'up-sec' ? -1 : 1))) return;
        focusSel = '[data-action="' + a + '"][data-sec="' + sec.id + '"]';
        break;

      case 'toggle-hide':
        sec.hidden = !sec.hidden;
        focusSel = '[data-action="toggle-hide"][data-sec="' + sec.id + '"]';
        break;

      default:
        return;
    }

    renderEditor();
    if (focusSel) {
      var target = els.editor.querySelector(focusSel);
      // A move button can become disabled at the edge; fall back to its sibling.
      if (target && target.disabled) target = target.parentElement.querySelector('.icon-btn:not(:disabled)');
      if (target) target.focus();
    }
    edited();
  });

  /* ---------- Design controls ---------- */

  els.template.addEventListener('change', function () {
    state.settings.template = els.template.value;
    applySettings(); edited();
  });
  els.paper.addEventListener('change', function () {
    state.settings.paper = els.paper.value;
    applySettings(); edited();
  });
  els.swatches.addEventListener('click', function (e) {
    var b = e.target.closest('[data-accent]');
    if (!b) return;
    state.settings.accent = b.dataset.accent;
    applySettings(); edited();
  });
  els.swatches.addEventListener('input', function (e) {
    if (e.target.id !== 'accent-custom') return;
    state.settings.accent = e.target.value;
    els.resume.style.setProperty('--accent', e.target.value);
    e.target.parentElement.style.background = e.target.value;
    edited();
  });
  els.swatches.addEventListener('change', function (e) {
    if (e.target.id === 'accent-custom') renderSwatches();
  });

  /* ---------- Export / import ---------- */

  function slug(s) {
    return (s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').slice(0, 40);
  }
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function exportJSON() {
    flushSave();
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'freecv-' + (slug(state.personal.name) || 'resume') + '-' + today() + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    meta.lastExportAt = Date.now();
    saveMeta();
    checkBanner();
    toast('Backup saved. Use Import to load it later.');
  }

  function importFile(file) {
    if (!file) return;
    if (file.size > 2e6) { toast('That file is too large to be a FreeCV backup.'); return; }
    var reader = new FileReader();
    reader.onload = function () {
      var next;
      try { next = FreeCV.normalize(JSON.parse(reader.result)); }
      catch (err) { toast(err instanceof SyntaxError ? 'That file is not valid JSON.' : err.message); return; }
      if (!confirm('Replace the resume in the editor with “' + (next.personal.name || file.name) + '”?\n\nThis can be undone right after.')) return;
      snapshot();
      state = next;
      ui.openEntries.clear();
      renderAll();
      edited();
      meta.lastExportAt = Date.now(); // the imported file is itself a backup
      saveMeta();
      checkBanner();
      toast('Resume imported.', true);
    };
    reader.onerror = function () { toast('Could not read that file.'); };
    reader.readAsText(file);
  }

  $('btn-export').addEventListener('click', exportJSON);
  $('btn-import').addEventListener('click', function () { els.file.click(); });
  els.file.addEventListener('change', function () { importFile(els.file.files[0]); els.file.value = ''; });

  // Drag a backup file anywhere onto the page to import it.
  document.addEventListener('dragover', function (e) {
    if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') >= 0) e.preventDefault();
  });
  document.addEventListener('drop', function (e) {
    var f = e.dataTransfer && e.dataTransfer.files[0];
    if (!f) return;
    e.preventDefault();
    importFile(f);
  });

  /* ---------- More menu ---------- */

  els.menu.addEventListener('click', function (e) {
    var b = e.target.closest('[data-menu]');
    if (!b) return;
    els.menu.open = false;
    var m = b.dataset.menu;
    if (m === 'import') els.file.click();
    else if (m === 'export') exportJSON();
    else if (m === 'about') els.dlgAbout.showModal();
    else if (m === 'blank' || m === 'sample') {
      snapshot();
      state = m === 'blank' ? FreeCV.blank(state.settings) : FreeCV.sample(state.settings);
      ui.openEntries.clear();
      if (m === 'blank') state.sections.forEach(function (s) { (s.items || []).forEach(function (i) { ui.openEntries.add(i.id); }); });
      renderAll();
      edited();
      toast(m === 'blank' ? 'Started a blank resume.' : 'Example resume loaded.', true);
    }
  });
  document.addEventListener('click', function (e) {
    if (els.menu.open && !els.menu.contains(e.target)) els.menu.open = false;
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && els.menu.open) { els.menu.open = false; els.menu.querySelector('summary').focus(); }
  });

  /* ---------- Dialogs ---------- */

  document.querySelectorAll('dialog').forEach(function (dlg) {
    dlg.addEventListener('click', function (e) {
      if (e.target === dlg || e.target.closest('[data-close]')) dlg.close();
    });
  });

  /* ---------- PDF (browser print → Save as PDF) ---------- */

  var savedTitle = document.title;
  function doPrint() {
    flushSave();
    renderPreview();
    window.print();
  }
  // The PDF file name defaults to the document title.
  window.addEventListener('beforeprint', function () {
    savedTitle = document.title;
    var n = (state.personal.name || '').trim();
    document.title = n ? n + ' - Resume' : 'Resume';
  });
  window.addEventListener('afterprint', function () { document.title = savedTitle; });

  $('btn-pdf').addEventListener('click', function () {
    if (meta.printTipSeen) { doPrint(); return; }
    $('print-tip-off').checked = false;
    els.dlgPrint.showModal();
  });
  $('print-go').addEventListener('click', function () {
    if ($('print-tip-off').checked) { meta.printTipSeen = true; saveMeta(); }
    els.dlgPrint.close();
    setTimeout(doPrint, 50); // let the dialog close before the print snapshot
  });

  /* ---------- Mobile tabs ---------- */

  document.querySelector('.tabs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-view]');
    if (!b) return;
    els.workspace.dataset.view = b.dataset.view;
    document.querySelectorAll('.tabs [data-view]').forEach(function (t) { t.setAttribute('aria-selected', t === b); });
    if (b.dataset.view === 'preview') layoutSheet();
    window.scrollTo(0, 0);
  });

  /* ---------- Resize ---------- */

  if (window.ResizeObserver) new ResizeObserver(function () { layoutSheet(); }).observe(els.preview);
  else window.addEventListener('resize', layoutSheet);

  // Re-measure once web fonts / system fonts have settled.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutSheet);

  renderAll();
  // Entries start collapsed; open the first job so newcomers see how fields work.
  var exp = secById('experience');
  if (exp && exp.items[0] && !meta.firstEditAt) { ui.openEntries.add(exp.items[0].id); renderEditor(); }
})();
