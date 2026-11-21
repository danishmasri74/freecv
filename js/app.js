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
    editor: $('editor'), outline: $('outline-list'), resume: $('resume'), sheet: $('sheet'), frame: $('sheet-frame'),
    preview: $('preview'), guides: $('guides'), meta: $('preview-meta'), workspace: $('workspace'),
    templateSeg: $('template-seg'), paperSeg: $('paper-seg'), swatches: $('swatches'), pageStyle: $('page-style'),
    saveStatus: $('save-status'), toast: $('toast'), toastText: $('toast-text'), toastAction: $('toast-action'),
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

  var state = null;
  var stored = readJSON(KEY);
  if (stored) { try { state = FreeCV.normalize(stored); } catch (e) { state = null; } }
  if (!state) state = FreeCV.sample();
  try { localStorage.setItem('freecv:probe', '1'); localStorage.removeItem('freecv:probe'); } catch (e) { storageOk = false; }

  var ui = { openEntries: new Set(), active: 'personal' };

  var saveTimer = 0;
  function setStatus(text, warn) {
    els.saveStatus.textContent = text;
    els.saveStatus.classList.toggle('is-warn', !!warn);
  }
  function save() {
    if (storageOk) setStatus('Saving…');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave, 300);
  }
  function flushSave() {
    clearTimeout(saveTimer);
    var ok = writeJSON(KEY, state);
    if (ok) setStatus('Saved in this browser');
    else setStatus('Not saved: storage is blocked', true);
  }
  window.addEventListener('pagehide', flushSave);
  document.addEventListener('visibilitychange', function () { if (document.hidden) flushSave(); });

  function edited() {
    var now = Date.now();
    if (!meta.firstEditAt) meta.firstEditAt = now;
    meta.lastEditAt = now;
    saveMeta();
    save();
    schedulePreview();
    renderBackup();
  }

  /* ---------- Lookups ---------- */

  function secById(id) { return state.sections.find(function (s) { return s.id === id; }); }
  function itemIn(sec, id) { return sec && sec.items ? sec.items.find(function (i) { return i.id === id; }) : null; }
  function move(arr, from, to) {
    if (from < 0 || to < 0 || to >= arr.length || from === to) return false;
    arr.splice(to, 0, arr.splice(from, 1)[0]);
    return true;
  }

  /* ---------- Rendering ---------- */

  function autoGrow(el) {
    if (CSS.supports && CSS.supports('field-sizing', 'content')) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }

  function renderEditor(focus) {
    var scroll = els.editor.scrollTop;
    els.editor.innerHTML = FreeCV.renderEditor(state, ui);
    els.editor.scrollTop = scroll;
    els.editor.querySelectorAll('.bullet-input').forEach(autoGrow);
    renderBackup();
    if (focus) {
      var target = els.editor.querySelector(focus.sel);
      // A move button can become disabled at an edge; fall back to an enabled sibling.
      if (target && target.disabled) target = target.parentElement.querySelector('.icon-btn:not(:disabled)');
      if (target) {
        target.focus();
        if (focus.caret != null && target.setSelectionRange) target.setSelectionRange(focus.caret, focus.caret);
      }
    }
  }

  function renderOutline(focusSec) {
    els.outline.innerHTML = FreeCV.renderOutline(state, ui);
    if (focusSec) {
      var a = els.outline.querySelector('.o-item[data-sec="' + focusSec + '"]');
      if (a) a.focus();
    }
  }

  var previewQueued = false;
  function schedulePreview() {
    if (previewQueued) return;
    previewQueued = true;
    requestAnimationFrame(function () { previewQueued = false; renderPreview(); renderOutlineCounts(); });
  }

  // Cheap outline refresh while typing (titles and counts), without stealing focus.
  function renderOutlineCounts() {
    if (els.outline.contains(document.activeElement)) return;
    renderOutline();
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
    if (!els.preview.offsetParent) return; // hidden (mobile edit tab)
    var d = paperDims(), m = 15;
    var sheet = els.sheet;
    sheet.style.transform = '';
    var sheetW = sheet.offsetWidth;
    var contentH = (d.h - 2 * m) * MM;
    var pages = Math.max(1, Math.ceil((els.resume.offsetHeight - 2) / contentH));

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

    els.meta.textContent = d.label + ' · ' + pages + ' page' + (pages > 1 ? 's' : '') +
      (pages > 1 ? ' · dashed lines show roughly where pages break' : '');
  }

  function applySettings() {
    var s = state.settings;
    els.resume.className = 'resume t-' + s.template;
    els.resume.style.setProperty('--accent', s.accent);
    els.sheet.classList.toggle('paper-letter', s.paper === 'letter');
    els.pageStyle.textContent = '@page { size: ' + (s.paper === 'letter' ? 'letter' : 'A4') + '; margin: 15mm; }';
    els.templateSeg.querySelectorAll('[data-template]').forEach(function (b) { b.setAttribute('aria-checked', b.dataset.template === s.template); });
    els.paperSeg.querySelectorAll('[data-paper]').forEach(function (b) { b.setAttribute('aria-checked', b.dataset.paper === s.paper); });
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
    renderOutline();
    renderEditor();
    renderPreview();
  }

  /* ---------- Backup note (sidebar, or under the form on narrow screens) ---------- */

  function ago(t) {
    var days = Math.floor((Date.now() - t) / DAY);
    return days <= 0 ? 'today' : days === 1 ? 'yesterday' : days + ' days ago';
  }

  function renderBackup() {
    var now = Date.now(), warn = false, text;
    if (!storageOk) {
      warn = true;
      text = 'Changes are not being saved in this browser (private window or storage blocked). Export a backup before you close this tab.';
    } else {
      var stale = meta.firstEditAt && now - meta.firstEditAt > 10 * 60e3 &&
        (!meta.lastExportAt || (meta.lastEditAt > meta.lastExportAt && now - meta.lastExportAt > 7 * DAY));
      warn = !!stale;
      text = 'Your resume lives only in this browser. Last backup: ' + (meta.lastExportAt ? ago(meta.lastExportAt) : 'never') + '.';
    }
    document.querySelectorAll('[data-backup]').forEach(function (el) {
      el.classList.toggle('is-warn', warn);
      el.innerHTML = '<span class="backup-text"></span><button type="button" data-export>Export a backup</button>';
      el.firstChild.textContent = text;
    });
  }
  document.addEventListener('click', function (e) { if (e.target.closest('[data-export]')) exportJSON(); });

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

  /* ---------- Bullet rows (newline-separated text edited one line per row) ---------- */

  var BULLET_MARK = /^\s*[-*•–·]\s+/;

  function bulletLines(sec, item, field) {
    return (item[field] || '').split('\n');
  }
  function bulletSel(d, line) {
    return '.bullet-input[data-item="' + d.item + '"][data-field="' + d.field + '"][data-line="' + line + '"]';
  }

  function onBulletInput(el, sec, item) {
    var d = el.dataset, i = +d.line;
    var lines = bulletLines(sec, item, d.field);
    var v = el.value;
    if (v.indexOf('\n') < 0) {
      lines[i] = v;
      item[d.field] = lines.join('\n');
      autoGrow(el);
      return;
    }
    // Enter or a multi-line paste: split into rows and keep the caret where the user expects it.
    var caret = el.selectionStart;
    var before = v.slice(0, caret);
    var row = before.split('\n').length - 1;
    var col = caret - (before.lastIndexOf('\n') + 1);
    var parts = v.split('\n');
    if (parts.length > 2) parts = parts.map(function (p) { return p.replace(BULLET_MARK, ''); }); // pasted list
    lines.splice.apply(lines, [i, 1].concat(parts));
    item[d.field] = lines.join('\n');
    renderEditor({ sel: bulletSel(d, i + row), caret: Math.min(col, parts[row].length) });
  }

  els.editor.addEventListener('keydown', function (e) {
    var el = e.target;
    if (!el.classList || !el.classList.contains('bullet-input')) return;
    var d = el.dataset, i = +d.line;
    var sec = secById(d.sec), item = itemIn(sec, d.item);
    if (!item) return;
    var lines = bulletLines(sec, item, d.field);
    var atStart = el.selectionStart === 0 && el.selectionEnd === 0;
    var atEnd = el.selectionStart === el.value.length;

    if (e.key === 'Backspace' && atStart && i > 0) {
      e.preventDefault();
      var caret = lines[i - 1].length;
      lines[i - 1] += lines[i];
      lines.splice(i, 1);
      item[d.field] = lines.join('\n');
      renderEditor({ sel: bulletSel(d, i - 1), caret: caret });
      edited();
    } else if (e.key === 'ArrowUp' && atStart && i > 0) {
      e.preventDefault();
      var prev = els.editor.querySelector(bulletSel(d, i - 1));
      if (prev) { prev.focus(); prev.setSelectionRange(prev.value.length, prev.value.length); }
    } else if (e.key === 'ArrowDown' && atEnd && i < lines.length - 1) {
      e.preventDefault();
      var next = els.editor.querySelector(bulletSel(d, i + 1));
      if (next) { next.focus(); next.setSelectionRange(0, 0); }
    }
  });

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
        if (d.line != null) onBulletInput(el, sec, item);
        else item[d.field] = v;
        var type = FreeCV.TYPES[sec.type];
        var lbl = els.editor.querySelector('[data-label-for="' + d.item + '"]');
        if (lbl) {
          var l = FreeCV.entryLabel(sec.type, item);
          lbl.textContent = l.text;
          lbl.classList.toggle('empty', l.empty);
        }
        var m = els.editor.querySelector('[data-meta-for="' + d.item + '"]');
        if (m && type.meta) m.textContent = type.meta(item);
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
    var item = sec && d.item ? itemIn(sec, d.item) : null;
    var idx, lines, focus = null, structural = true;

    switch (a) {
      case 'toggle-entry':
        if (ui.openEntries.has(d.item)) ui.openEntries.delete(d.item); else ui.openEntries.add(d.item);
        var entry = btn.closest('.entry');
        entry.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', entry.classList.contains('is-open'));
        entry.querySelectorAll('.bullet-input').forEach(autoGrow);
        return;

      case 'add-link':
        state.personal.links.push('');
        focus = { sel: '[data-link="' + (state.personal.links.length - 1) + '"]' };
        break;

      case 'del-link':
        state.personal.links.splice(+d.link, 1);
        if (!state.personal.links.length) state.personal.links.push('');
        break;

      case 'add-line':
        lines = item[d.field] ? item[d.field].split('\n') : [''];
        if (lines[lines.length - 1].trim() || lines.length === 0) lines.push('');
        item[d.field] = lines.join('\n');
        focus = { sel: bulletSel(d, lines.length - 1) };
        break;

      case 'del-line':
        lines = item[d.field].split('\n');
        lines.splice(+d.line, 1);
        item[d.field] = lines.join('\n');
        focus = { sel: bulletSel(d, Math.max(0, +d.line - 1)) };
        break;

      case 'add-item':
        var it = FreeCV.blankItem(sec.type);
        sec.items.push(it);
        ui.openEntries.add(it.id);
        focus = { sel: '[data-item="' + it.id + '"][data-field]' };
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
        focus = { sel: '[data-action="' + a + '"][data-item="' + d.item + '"]' };
        break;

      case 'up-sec':
      case 'down-sec':
        idx = state.sections.indexOf(sec);
        if (!move(state.sections, idx, idx + (a === 'up-sec' ? -1 : 1))) return;
        focus = { sel: '[data-action="' + a + '"][data-sec="' + sec.id + '"]' };
        break;

      case 'toggle-hide':
        sec.hidden = !sec.hidden;
        focus = { sel: '[data-action="toggle-hide"][data-sec="' + sec.id + '"].icon-btn' };
        break;

      default:
        structural = false;
    }
    if (!structural) return;
    renderEditor(focus);
    renderOutline();
    edited();
  });

  /* ---------- Outline: jump, drag to reorder, Alt+arrows ---------- */

  function scrollToSection(id) {
    var target = $('sec-' + id);
    if (!target) return;
    ui.active = id;
    lockSpy = Date.now() + 700; // don't let scroll-spy flicker while smooth-scrolling
    // Scroll only the pane that holds the form (scrollIntoView would also nudge the page itself).
    var box = els.editor.scrollHeight > els.editor.clientHeight + 1 ? els.editor : els.workspace;
    var outlineEl = document.querySelector('.outline');
    var offset = getComputedStyle(outlineEl).position === 'sticky' ? outlineEl.offsetHeight + 12 : 16;
    var top = target.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - offset;
    box.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    renderOutline();
  }

  els.outline.addEventListener('click', function (e) {
    var a = e.target.closest('.o-item');
    if (!a) return;
    e.preventDefault();
    scrollToSection(a.dataset.target);
  });

  els.outline.addEventListener('keydown', function (e) {
    var a = e.target.closest('.o-item[data-sec]');
    if (!a || !e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    var sec = secById(a.dataset.sec);
    var idx = state.sections.indexOf(sec);
    if (!move(state.sections, idx, idx + (e.key === 'ArrowUp' ? -1 : 1))) return;
    renderOutline(sec.id);
    renderEditor();
    edited();
  });

  var dragId = null;
  function clearDrop() {
    els.outline.querySelectorAll('.drop-before, .drop-after').forEach(function (li) { li.classList.remove('drop-before', 'drop-after'); });
  }
  els.outline.addEventListener('dragstart', function (e) {
    var li = e.target.closest('li[data-sec]');
    if (!li) return;
    dragId = li.dataset.sec;
    li.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragId);
  });
  els.outline.addEventListener('dragover', function (e) {
    if (!dragId) return;
    var li = e.target.closest('li[data-sec]');
    if (!li) return;
    e.preventDefault();
    clearDrop();
    if (li.dataset.sec === dragId) return;
    var r = li.getBoundingClientRect();
    li.classList.add(e.clientY < r.top + r.height / 2 ? 'drop-before' : 'drop-after');
  });
  els.outline.addEventListener('drop', function (e) {
    if (!dragId) return;
    var li = e.target.closest('li[data-sec]');
    e.preventDefault();
    if (li && li.dataset.sec !== dragId) {
      var after = li.classList.contains('drop-after');
      var from = state.sections.indexOf(secById(dragId));
      var moving = state.sections.splice(from, 1)[0];
      var to = state.sections.indexOf(secById(li.dataset.sec)) + (after ? 1 : 0);
      state.sections.splice(to, 0, moving);
      renderEditor();
      edited();
    }
    dragId = null;
    renderOutline();
  });
  els.outline.addEventListener('dragend', function () { dragId = null; clearDrop(); renderOutline(); });

  // Scroll-spy: highlight the section currently at the top of the form.
  var lockSpy = 0, spyQueued = false;
  function spy() {
    spyQueued = false;
    if (Date.now() < lockSpy) return;
    var top = els.editor.getBoundingClientRect().top + 40;
    var current = 'personal';
    els.editor.querySelectorAll('[data-anchor]').forEach(function (s) {
      if (s.getBoundingClientRect().top <= top) current = s.dataset.anchor;
    });
    if (current !== ui.active) { ui.active = current; renderOutline(); }
  }
  els.editor.addEventListener('scroll', function () {
    if (!spyQueued) { spyQueued = true; requestAnimationFrame(spy); }
  }, { passive: true });

  /* ---------- Design controls ---------- */

  els.templateSeg.addEventListener('click', function (e) {
    var b = e.target.closest('[data-template]');
    if (!b) return;
    state.settings.template = b.dataset.template;
    applySettings(); edited();
  });
  els.paperSeg.addEventListener('click', function (e) {
    var b = e.target.closest('[data-paper]');
    if (!b) return;
    state.settings.paper = b.dataset.paper;
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
    renderBackup();
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
      if (!confirm('Replace the resume in the editor with “' + (next.personal.name || file.name) + '”?\n\nYou can undo this right after.')) return;
      snapshot();
      state = next;
      ui.openEntries.clear();
      renderAll();
      edited();
      meta.lastExportAt = Date.now(); // the imported file is itself a backup
      saveMeta();
      renderBackup();
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
    if (!dragId && e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') >= 0) e.preventDefault();
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
    // Wait for the template's font, or the PDF would be set in the fallback font.
    var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    ready.then(function () { window.print(); });
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
    els.workspace.scrollTop = 0;
  });

  /* ---------- Resize ---------- */

  if (window.ResizeObserver) new ResizeObserver(function () { layoutSheet(); }).observe(els.preview);
  else window.addEventListener('resize', layoutSheet);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutSheet);
  // Switching template loads a new font; re-measure page breaks once it arrives.
  if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', layoutSheet);

  // First visit: open the first job so newcomers see how entries work.
  var exp = secById('experience');
  if (exp && exp.items[0] && !meta.firstEditAt) ui.openEntries.add(exp.items[0].id);
  renderAll();
  if (!storageOk) setStatus('Not saved: storage is blocked', true);
})();
