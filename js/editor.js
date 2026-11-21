/* FreeCV — builds the outline rail and the editor form. Inputs carry data-* attributes that app.js binds. */
(function () {
  'use strict';

  var FreeCV = window.FreeCV;
  var esc = FreeCV.esc;
  var fid = 0;

  function icon(name) { return '<svg class="ic" aria-hidden="true"><use href="#i-' + name + '"/></svg>'; }

  function iconBtn(action, name, label, attrs, disabled, extraCls) {
    return '<button type="button" class="icon-btn' + (extraCls ? ' ' + extraCls : '') + '" data-action="' + action + '" ' + (attrs || '') +
      ' aria-label="' + esc(label) + '" title="' + esc(label) + '"' + (disabled ? ' disabled' : '') + '>' + icon(name) + '</button>';
  }

  function field(attrs, value, o) {
    var id = 'f' + (++fid);
    var ph = o.placeholder ? ' placeholder="' + esc(o.placeholder) + '"' : '';
    var control = o.area
      ? '<textarea id="' + id + '" class="input" ' + attrs + ph + ' rows="' + (o.rows || 4) + '">' + esc(value) + '</textarea>'
      : '<input id="' + id + '" class="input" type="' + (o.type || 'text') + '" ' + attrs + ph + ' value="' + esc(value) + '"' +
        (o.autocomplete ? ' autocomplete="' + o.autocomplete + '"' : '') + '>';
    return '<div class="field' + (o.wide || o.area ? ' full' : '') + '"><label class="field-label" for="' + id + '">' + esc(o.label) + '</label>' + control +
      (o.hint ? '<p class="hint">' + esc(o.hint) + '</p>' : '') + '</div>';
  }

  // A newline-separated text field shown as one editable row per line.
  function bulletList(attrs, value, f) {
    var id = 'f' + (++fid);
    var lines = value ? value.split('\n') : [''];
    var rows = lines.map(function (line, i) {
      return '<div class="bullet" role="listitem"><span class="dot" aria-hidden="true">•</span>' +
        '<textarea class="bullet-input" rows="1" ' + attrs + ' data-line="' + i + '" aria-label="Point ' + (i + 1) + '"' +
        (i === 0 && lines.length === 1 ? ' placeholder="' + esc(f.placeholder || '') + '"' : '') + '>' + esc(line) + '</textarea>' +
        iconBtn('del-line', 'x', 'Remove point', attrs + ' data-line="' + i + '"', false, 'danger') + '</div>';
    }).join('');
    return '<div class="field full"><span class="field-label" id="' + id + '">' + esc(f.label) + '</span>' +
      '<div class="bullets" role="list" aria-labelledby="' + id + '">' + rows +
      '<button type="button" class="bullet-add" data-action="add-line" ' + attrs + '><span aria-hidden="true">+</span>' + esc(f.addLabel || 'Add') + '</button></div>' +
      (f.hint ? '<p class="hint">' + esc(f.hint) + '</p>' : '') + '</div>';
  }

  function hasContent(item) {
    return Object.keys(item).some(function (k) { return k !== 'id' && (item[k] || '').trim(); });
  }

  /* ---------- Outline rail ---------- */

  FreeCV.renderOutline = function (data, ui) {
    var html = '<li><a href="#sec-personal" class="o-item' + (ui.active === 'personal' ? ' is-active' : '') + '" data-target="personal">' +
      '<span class="o-name">' + FreeCV.PERSONAL_TITLE + '</span></a></li>';
    html += data.sections.map(function (s) {
      var count = s.items ? s.items.filter(hasContent).length : 0;
      var right = s.hidden ? 'Hidden' : (count ? String(count) : '');
      return '<li draggable="true" data-sec="' + s.id + '">' +
        '<a href="#sec-' + s.id + '" class="o-item' + (s.hidden ? ' is-hidden' : '') + (ui.active === s.id ? ' is-active' : '') + '" data-target="' + s.id + '" data-sec="' + s.id + '"' +
        ' aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown" title="Drag, or press Alt+↑/↓, to reorder">' +
        '<svg class="ic grip" aria-hidden="true"><use href="#i-grip"/></svg>' +
        '<span class="o-name">' + esc(s.title || FreeCV.TYPES[s.type].defaultTitle) + '</span>' +
        (right ? '<span class="o-count">' + right + '</span>' : '') + '</a></li>';
    }).join('');
    return html;
  };

  /* ---------- Form ---------- */

  function personalSection(p) {
    var f = function (key, label, o) {
      o = o || {}; o.label = label;
      return field('data-scope="personal" data-field="' + key + '"', p[key], o);
    };
    var links = p.links.map(function (l, i) {
      return '<div class="link-row"><input type="text" class="input" data-scope="personal" data-link="' + i + '" value="' + esc(l) +
        '" placeholder="linkedin.com/in/you" aria-label="Link ' + (i + 1) + '">' +
        iconBtn('del-link', 'x', 'Remove link', 'data-link="' + i + '"', false, 'danger') + '</div>';
    }).join('');

    return '<section class="f-sec" id="sec-personal" data-anchor="personal">' +
      '<div class="f-head"><h2 class="f-title-static">' + FreeCV.PERSONAL_TITLE + '</h2></div>' +
      '<div class="grid">' +
      f('name', 'Full name', { wide: true, autocomplete: 'name' }) +
      f('headline', 'Headline', { wide: true, placeholder: 'e.g. Senior Accountant · CPA' }) +
      f('email', 'Email', { type: 'email', autocomplete: 'email' }) +
      f('phone', 'Phone', { type: 'tel', autocomplete: 'tel' }) +
      f('location', 'Location', { wide: true, placeholder: 'City, Country' }) +
      '<div class="field full"><span class="field-label">Links</span><div class="links">' + links + '</div>' +
      '<button type="button" class="text-btn" data-action="add-link">+ Add link</button></div>' +
      '</div></section>';
  }

  function entryLabel(type, item) {
    var l = (FreeCV.TYPES[type].label(item) || '').trim();
    return l ? { text: l, empty: false } : { text: 'New entry', empty: true };
  }
  FreeCV.entryLabel = entryLabel;

  function entry(sec, item, idx, count, ui) {
    var type = FreeCV.TYPES[sec.type];
    var open = ui.openEntries.has(item.id);
    var lbl = entryLabel(sec.type, item);
    var meta = type.meta ? type.meta(item) : '';
    var attrs = 'data-sec="' + sec.id + '" data-item="' + item.id + '"';
    var fields = type.fields.map(function (f) {
      var a = attrs + ' data-field="' + f.key + '"';
      if (f.list) return bulletList(a, item[f.key], f);
      return field(a, item[f.key], { label: f.label, wide: f.wide, area: f.area, hint: f.hint, placeholder: f.placeholder, rows: 3 });
    }).join('');

    return '<div class="entry' + (open ? ' is-open' : '') + '" data-entry="' + item.id + '">' +
      '<div class="entry-row">' +
      '<button type="button" class="entry-toggle" data-action="toggle-entry" ' + attrs + ' aria-expanded="' + open + '">' + icon('chev') +
      '<span class="entry-label' + (lbl.empty ? ' empty' : '') + '" data-label-for="' + item.id + '">' + esc(lbl.text) + '</span>' +
      '<span class="entry-meta" data-meta-for="' + item.id + '">' + esc(meta) + '</span></button>' +
      '<div class="entry-actions">' +
      iconBtn('up-item', 'up', 'Move up', attrs, idx === 0) +
      iconBtn('down-item', 'down', 'Move down', attrs, idx === count - 1) +
      iconBtn('del-item', 'trash', 'Delete entry', attrs, false, 'danger') +
      '</div></div>' +
      '<div class="entry-body"><div class="grid">' + fields + '</div></div></div>';
  }

  function section(sec, idx, count, ui) {
    var attrs = 'data-sec="' + sec.id + '"';
    var body;
    if (sec.hidden) {
      body = '<p class="f-hidden-note">Hidden from your resume. <button type="button" data-action="toggle-hide" ' + attrs + '>Show it</button></p>';
    } else if (sec.type === 'summary') {
      body = field(attrs + ' data-field="text"', sec.text, {
        label: 'A short intro (2–4 sentences)', area: true, rows: 4,
        hint: 'Who you are, what you are good at, and what you are looking for.'
      });
    } else {
      body = '<div class="entries">' +
        sec.items.map(function (it, i) { return entry(sec, it, i, sec.items.length, ui); }).join('') +
        '<button type="button" class="text-btn" data-action="add-item" ' + attrs + '>+ ' + esc(FreeCV.TYPES[sec.type].addLabel) + '</button></div>';
    }

    var titleId = 'title-' + sec.id;
    return '<section class="f-sec' + (sec.hidden ? ' is-hidden' : '') + '" id="sec-' + sec.id + '" data-anchor="' + sec.id + '">' +
      '<div class="f-head">' +
      '<input class="f-title" id="' + titleId + '" ' + attrs + ' data-field="title" value="' + esc(sec.title) + '" aria-label="Section title (click to rename)">' +
      '<label class="icon-btn" for="' + titleId + '" title="Rename section">' + icon('pencil') + '<span class="sr-only">Rename section</span></label>' +
      iconBtn('up-sec', 'up', 'Move section up', attrs, idx === 0) +
      iconBtn('down-sec', 'down', 'Move section down', attrs, idx === count - 1) +
      iconBtn('toggle-hide', sec.hidden ? 'eye-off' : 'eye', sec.hidden ? 'Show section on resume' : 'Hide section from resume', attrs + ' aria-pressed="' + sec.hidden + '"') +
      (FreeCV.TYPES[sec.type].multiple ? iconBtn('del-sec', 'trash', 'Delete section', attrs, false, 'danger') : '') +
      '</div>' + body + '</section>';
  }

  FreeCV.renderEditor = function (data, ui) {
    fid = 0;
    return personalSection(data.personal) +
      data.sections.map(function (s, i) {
        return '<hr class="f-rule">' + section(s, i, data.sections.length, ui);
      }).join('') +
      '<hr class="f-rule"><button type="button" class="add-section" data-action="add-section">+ Add section</button>' +
      '<div class="editor-foot"><div class="backup" data-backup></div>' +
      '<p>Saved automatically in this browser. FreeCV is free, with no paywall on PDF export.</p></div>';
  };
})();
