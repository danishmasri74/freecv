/* FreeCV — builds the editor form. Inputs carry data-* attributes that app.js binds. */
(function () {
  'use strict';

  var FreeCV = window.FreeCV;
  var esc = FreeCV.esc;

  function icon(name) { return '<svg class="ic" aria-hidden="true"><use href="#i-' + name + '"/></svg>'; }

  function iconBtn(action, name, label, attrs, disabled, extraCls) {
    return '<button type="button" class="icon-btn' + (extraCls ? ' ' + extraCls : '') + '" data-action="' + action + '" ' + (attrs || '') +
      ' aria-label="' + esc(label) + '" title="' + esc(label) + '"' + (disabled ? ' disabled' : '') + '>' + icon(name) + '</button>';
  }

  function input(attrs, value, opts) {
    opts = opts || {};
    var id = 'f-' + Math.random().toString(36).slice(2, 8);
    var ph = opts.placeholder ? ' placeholder="' + esc(opts.placeholder) + '"' : '';
    var control = opts.area
      ? '<textarea id="' + id + '" ' + attrs + ph + ' rows="' + (opts.rows || 4) + '">' + esc(value) + '</textarea>'
      : '<input id="' + id + '" type="' + (opts.type || 'text') + '" ' + attrs + ph + ' value="' + esc(value) + '"' + (opts.autocomplete ? ' autocomplete="' + opts.autocomplete + '"' : '') + '>';
    return '<div class="field' + (opts.wide || opts.area ? ' full' : '') + '"><span><label for="' + id + '">' + esc(opts.label) + '</label></span>' + control +
      (opts.hint ? '<p class="hint">' + esc(opts.hint) + '</p>' : '') + '</div>';
  }

  function personalCard(p, ui) {
    var open = !ui.closed.has('personal');
    var f = function (key, label, o) {
      o = o || {}; o.label = label;
      return input('data-scope="personal" data-field="' + key + '"', p[key], o);
    };
    var links = p.links.map(function (l, i) {
      return '<div class="link-row"><div class="field" style="flex:1"><input type="text" data-scope="personal" data-link="' + i + '" value="' + esc(l) +
        '" placeholder="linkedin.com/in/you" aria-label="Link ' + (i + 1) + '"></div>' +
        iconBtn('del-link', 'trash', 'Remove link', 'data-link="' + i + '"', false, 'danger') + '</div>';
    }).join('');

    return '<div class="card' + (open ? ' is-open' : '') + '" data-card="personal">' +
      '<div class="card-head"><button type="button" class="toggle" data-action="toggle-card" data-card-id="personal" aria-expanded="' + open + '" aria-label="Show or hide personal details">' + icon('chev') + '</button>' +
      '<span class="sec-fixed-title">Personal details</span></div>' +
      '<div class="card-body"><div class="grid">' +
      f('name', 'Full name', { wide: true, autocomplete: 'name' }) +
      f('headline', 'Headline', { wide: true, placeholder: 'e.g. Senior Accountant · CPA' }) +
      f('email', 'Email', { type: 'email', autocomplete: 'email' }) +
      f('phone', 'Phone', { type: 'tel', autocomplete: 'tel' }) +
      f('location', 'Location', { wide: true, placeholder: 'City, Country' }) +
      '<div class="field full"><span>Links</span><div class="links">' + links + '</div>' +
      '<button type="button" class="btn btn-small btn-ghost" data-action="add-link" style="align-self:flex-start;margin-top:4px">' + icon('plus') + 'Add link</button></div>' +
      '</div></div></div>';
  }

  function entryLabel(type, item) {
    var l = (FreeCV.TYPES[type].label(item) || '').trim();
    return l ? { text: l, empty: false } : { text: 'New entry, fill in below', empty: true };
  }
  FreeCV.entryLabel = entryLabel;

  function entryCard(sec, item, idx, count, ui) {
    var type = FreeCV.TYPES[sec.type];
    var open = ui.openEntries.has(item.id);
    var lbl = entryLabel(sec.type, item);
    var attrs = 'data-sec="' + sec.id + '" data-item="' + item.id + '"';
    var fields = type.fields.map(function (f) {
      return input(attrs + ' data-field="' + f.key + '"', item[f.key], {
        label: f.label, wide: f.wide, area: f.area, hint: f.hint, placeholder: f.placeholder, rows: f.key === 'bullets' ? 5 : 3
      });
    }).join('');

    return '<div class="entry' + (open ? ' is-open' : '') + '" data-entry="' + item.id + '">' +
      '<div class="entry-head">' +
      '<button type="button" class="toggle" data-action="toggle-entry" ' + attrs + ' aria-expanded="' + open + '">' + icon('chev') +
      '<span class="entry-label' + (lbl.empty ? ' empty' : '') + '" data-label-for="' + item.id + '">' + esc(lbl.text) + '</span></button>' +
      iconBtn('up-item', 'up', 'Move up', attrs, idx === 0) +
      iconBtn('down-item', 'down', 'Move down', attrs, idx === count - 1) +
      iconBtn('del-item', 'trash', 'Delete entry', attrs, false, 'danger') +
      '</div>' +
      '<div class="entry-body"><div class="grid">' + fields + '</div></div></div>';
  }

  function sectionCard(sec, idx, count, ui) {
    var open = !ui.closed.has(sec.id);
    var attrs = 'data-sec="' + sec.id + '"';
    var body;
    if (sec.type === 'summary') {
      body = input(attrs + ' data-field="text"', sec.text, {
        label: 'A short intro (2–4 sentences)', area: true, rows: 5,
        hint: 'Who you are, what you are good at, and what you are looking for.'
      });
    } else {
      body = sec.items.map(function (it, i) { return entryCard(sec, it, i, sec.items.length, ui); }).join('') +
        '<button type="button" class="btn add-btn" data-action="add-item" ' + attrs + '>' + icon('plus') + esc(FreeCV.TYPES[sec.type].addLabel) + '</button>';
    }

    return '<div class="card' + (open ? ' is-open' : '') + (sec.hidden ? ' is-hidden' : '') + '" data-card="' + sec.id + '">' +
      '<div class="card-head">' +
      '<button type="button" class="toggle" data-action="toggle-card" data-card-id="' + sec.id + '" aria-expanded="' + open + '" aria-label="Show or hide ' + esc(sec.title) + ' fields">' + icon('chev') + '</button>' +
      '<input class="sec-title" ' + attrs + ' data-field="title" value="' + esc(sec.title) + '" aria-label="Section title" title="Click to rename this section">' +
      iconBtn('up-sec', 'up', 'Move section up', attrs, idx === 0) +
      iconBtn('down-sec', 'down', 'Move section down', attrs, idx === count - 1) +
      iconBtn('toggle-hide', sec.hidden ? 'eye-off' : 'eye', sec.hidden ? 'Show section on resume' : 'Hide section from resume', attrs + ' aria-pressed="' + sec.hidden + '"') +
      '</div>' +
      '<div class="card-body">' + body + '</div></div>';
  }

  FreeCV.renderEditor = function (data, ui) {
    return personalCard(data.personal, ui) +
      data.sections.map(function (s, i) { return sectionCard(s, i, data.sections.length, ui); }).join('') +
      '<p class="editor-foot">Saved automatically in this browser. Use <strong>Export</strong> to keep a backup file.<br>FreeCV is free, with no paywall on PDF export.</p>';
  };
})();
