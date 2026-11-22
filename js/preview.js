/* FreeCV — turns resume data into resume HTML.
 * Every template gets the same semantic markup (in reading order, for ATS);
 * resume.css arranges it differently per template. */
(function () {
  'use strict';

  var FreeCV = window.FreeCV;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  FreeCV.esc = esc;

  function t(s) { return (s || '').trim(); }

  // Only http(s), mailto and tel links make it into the resume.
  function safeHref(raw) {
    var v = t(raw);
    if (!v) return '';
    if (/^(https?:\/\/|mailto:|tel:)/i.test(v)) return v;
    if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return '';
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'mailto:' + v;
    if (/^[^\s]+\.[a-z]{2,}(\/\S*)?$/i.test(v)) return 'https://' + v;
    return '';
  }

  // Show links the way they'd be typed: no protocol, no trailing slash.
  function prettyUrl(raw) {
    return t(raw).replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
  }

  function link(text, href, cls) {
    var c = cls ? ' class="' + cls + '"' : '';
    return href ? '<a' + c + ' href="' + esc(href) + '">' + esc(text) + '</a>' : '<span' + c + '>' + esc(text) + '</span>';
  }

  var BULLET = /^\s*([-*•–·]|\d+[.)])\s+/;

  /*
   * Multi-line text → paragraphs and bullet lists.
   * allBullets: every non-empty line becomes a bullet (used for job descriptions).
   */
  function richText(text, allBullets) {
    var lines = (text || '').split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    if (!lines.length) return '';
    var html = '', list = [];
    function flush() {
      if (list.length) { html += '<ul class="r-list">' + list.join('') + '</ul>'; list = []; }
    }
    lines.forEach(function (l) {
      if (allBullets || BULLET.test(l)) list.push('<li>' + esc(l.replace(BULLET, '')) + '</li>');
      else { flush(); html += '<p>' + esc(l) + '</p>'; }
    });
    flush();
    return html;
  }

  function dates(a, b) {
    a = t(a); b = t(b);
    return a && b ? a + ' – ' + b : a || b;
  }

  function hasContent(item) {
    return Object.keys(item).some(function (k) { return k !== 'id' && t(item[k]); });
  }

  // Map each section type onto the shared entry parts.
  var PARTS = {
    experience: function (it) {
      return {
        title: t(it.role) || t(it.org), org: t(it.role) ? t(it.org) : '',
        loc: t(it.location), date: dates(it.start, it.end), body: richText(it.bullets, true)
      };
    },
    education: function (it) {
      return {
        title: t(it.degree) || t(it.school), org: t(it.degree) ? t(it.school) : '',
        loc: t(it.location), date: dates(it.start, it.end), body: richText(it.details, false)
      };
    },
    projects: function (it) {
      return {
        title: t(it.name), org: t(it.subtitle), loc: '', date: t(it.date),
        link: t(it.link) ? link(prettyUrl(it.link), safeHref(it.link), 'r-link') : '',
        body: richText(it.description, false)
      };
    },
    custom: function (it) {
      return {
        title: t(it.name) || t(it.org), org: t(it.name) ? t(it.org) : '',
        loc: t(it.location), date: t(it.date),
        link: t(it.link) ? link(prettyUrl(it.link), safeHref(it.link), 'r-link') : '',
        body: richText(it.description, false)
      };
    }
  };

  function entry(type, it) {
    var p = PARTS[type](it);
    var body = (p.link || '') + (p.body || '');
    return '<div class="r-entry">' +
      (p.title ? '<h3 class="r-title">' + esc(p.title) + '</h3>' : '') +
      (p.org ? '<span class="r-org r-meta">' + esc(p.org) + '</span>' : '') +
      (p.loc ? '<span class="r-loc r-meta">' + esc(p.loc) + '</span>' : '') +
      (p.date ? '<span class="r-date r-meta">' + esc(p.date) + '</span>' : '') +
      (body ? '<div class="r-body">' + body + '</div>' : '') +
      '</div>';
  }

  // Templates whose headings are capitals. The capitals are real text, not CSS
  // text-transform: Firefox prints CSS-uppercased text one letter at a time, which an
  // ATS reads as "S U M M A R Y".
  var CAPITAL_HEADINGS = { harbor: true, ledger: true, atlas: true };
  var capitalHeadings = false;

  function renderSection(sec) {
    if (sec.hidden) return '';
    var heading = t(sec.title);
    if (capitalHeadings) heading = heading.toLocaleUpperCase();
    var title = '<h2 class="r-sec-title">' + esc(heading) + '</h2>';
    var cls = 'r-sec r-sec-' + sec.type;

    if (sec.type === 'summary') {
      var body = richText(sec.text, false);
      return body ? '<section class="' + cls + ' r-keep">' + title + '<div class="r-text">' + body + '</div></section>' : '';
    }

    var items = sec.items.filter(hasContent);
    if (!items.length) return '';

    if (sec.type === 'skills' || sec.type === 'list') { // label: details rows
      var lis = items.map(function (it) {
        var name = t(it.name), skills = t(it.skills);
        return '<li class="r-skill">' +
          (name ? '<span class="r-skill-name">' + esc(name) + '</span>' + (skills ? '<span class="r-skill-sep">: </span>' : '') : '') +
          '<span class="r-skill-list">' + esc(skills) + '</span></li>';
      }).join('');
      return '<section class="' + cls + ' r-keep">' + title + '<ul class="r-skills">' + lis + '</ul></section>';
    }

    var entries = items.map(function (it) { return entry(sec.type, it); });
    // Keep the heading glued to the first entry so it never ends a page alone.
    return '<section class="' + cls + '"><div class="r-keep">' + title + entries[0] + '</div>' + entries.slice(1).join('') + '</section>';
  }

  FreeCV.renderResume = function (data) {
    var p = data.personal;
    var contact = [];
    if (t(p.location)) contact.push('<span class="r-c">' + esc(t(p.location)) + '</span>');
    if (t(p.email)) contact.push(link(t(p.email), safeHref('mailto:' + t(p.email)), 'r-c'));
    if (t(p.phone)) contact.push(link(t(p.phone), 'tel:' + t(p.phone).replace(/[^\d+]/g, ''), 'r-c'));
    p.links.forEach(function (l) { if (t(l)) contact.push(link(prettyUrl(l), safeHref(l), 'r-c')); });

    var head = '';
    if (t(p.name) || t(p.headline) || contact.length) {
      head = '<header class="r-head"><div class="r-id">' +
        (t(p.name) ? '<h1 class="r-name">' + esc(t(p.name)) + '</h1>' : '') +
        (t(p.headline) ? '<p class="r-headline">' + esc(t(p.headline)) + '</p>' : '') +
        '</div>' +
        (contact.length ? '<p class="r-contact">' + contact.join('<span class="sep">&nbsp;· </span>') + '</p>' : '') +
        '</header>';
    }

    capitalHeadings = !!CAPITAL_HEADINGS[data.settings && data.settings.template];
    var body = head + data.sections.map(renderSection).join('');
    return body || '<p class="r-empty">Your resume preview appears here as you type.</p>';
  };
})();
