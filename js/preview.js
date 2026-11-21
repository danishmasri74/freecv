/* FreeCV — turns resume data into resume HTML (same markup for all templates). */
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

  function link(text, href) {
    return href ? '<a href="' + esc(href) + '">' + esc(text) + '</a>' : esc(text);
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

  function row(left, right, cls) {
    return '<div class="r-row' + (cls ? ' ' + cls : '') + '">' + left +
      (right ? '<span class="' + (cls === 'r-sub' ? 'r-loc' : 'r-date') + '">' + esc(right) + '</span>' : '') + '</div>';
  }

  function hasContent(item) {
    return Object.keys(item).some(function (k) { return k !== 'id' && t(item[k]); });
  }

  var ENTRY = {
    experience: function (it) {
      var title = t(it.role) || t(it.org);
      var sub = t(it.role) ? t(it.org) : '';
      return row('<h3 class="r-title">' + esc(title) + '</h3>', dates(it.start, it.end)) +
        ((sub || t(it.location)) ? row('<span class="r-org">' + esc(sub) + '</span>', t(it.location), 'r-sub') : '') +
        richText(it.bullets, true);
    },
    education: function (it) {
      var title = t(it.degree) || t(it.school);
      var sub = t(it.degree) ? t(it.school) : '';
      var details = richText(it.details, false);
      return row('<h3 class="r-title">' + esc(title) + '</h3>', dates(it.start, it.end)) +
        ((sub || t(it.location)) ? row('<span class="r-org">' + esc(sub) + '</span>', t(it.location), 'r-sub') : '') +
        (details ? '<div class="r-text">' + details + '</div>' : '');
    },
    projects: function (it) {
      var head = '<h3 class="r-title">' + esc(t(it.name)) +
        (t(it.subtitle) ? '<span class="r-sub" style="font-weight:400"> · ' + esc(t(it.subtitle)) + '</span>' : '') + '</h3>';
      var desc = richText(it.description, false);
      return row(head, t(it.date)) +
        (t(it.link) ? '<div class="r-link">' + link(prettyUrl(it.link), safeHref(it.link)) + '</div>' : '') +
        (desc ? '<div class="r-text">' + desc + '</div>' : '');
    }
  };

  function renderSection(sec) {
    if (sec.hidden) return '';
    var title = '<h2 class="r-sec-title">' + esc(t(sec.title)) + '</h2>';
    var cls = 'r-sec r-sec-' + sec.type;

    if (sec.type === 'summary') {
      var body = richText(sec.text, false);
      return body ? '<section class="' + cls + ' r-keep">' + title + '<div class="r-text">' + body + '</div></section>' : '';
    }

    var items = sec.items.filter(hasContent);
    if (!items.length) return '';

    if (sec.type === 'skills') {
      var lis = items.map(function (it) {
        var name = t(it.name), skills = t(it.skills);
        return '<li>' + (name ? '<strong>' + esc(name) + (skills ? ':' : '') + '</strong> ' : '') + esc(skills) + '</li>';
      }).join('');
      return '<section class="' + cls + ' r-keep">' + title + '<ul class="r-skills">' + lis + '</ul></section>';
    }

    var entries = items.map(function (it) { return '<div class="r-entry">' + ENTRY[sec.type](it) + '</div>'; });
    // Keep the heading glued to the first entry so it never ends a page alone.
    return '<section class="' + cls + '"><div class="r-keep">' + title + entries[0] + '</div>' + entries.slice(1).join('') + '</section>';
  }

  FreeCV.renderResume = function (data) {
    var p = data.personal;
    var contact = [];
    if (t(p.location)) contact.push(esc(t(p.location)));
    if (t(p.email)) contact.push(link(t(p.email), safeHref('mailto:' + t(p.email))));
    if (t(p.phone)) contact.push(link(t(p.phone), 'tel:' + t(p.phone).replace(/[^\d+]/g, '')));
    p.links.forEach(function (l) { if (t(l)) contact.push(link(prettyUrl(l), safeHref(l))); });

    var head = '';
    if (t(p.name) || t(p.headline) || contact.length) {
      head = '<header class="r-head">' +
        (t(p.name) ? '<h1 class="r-name">' + esc(t(p.name)) + '</h1>' : '') +
        (t(p.headline) ? '<p class="r-headline">' + esc(t(p.headline)) + '</p>' : '') +
        (contact.length ? '<p class="r-contact">' + contact.join('&nbsp;<span class="sep">·</span> ') + '</p>' : '') +
        '</header>';
    }

    var body = head + data.sections.map(renderSection).join('');
    return body || '<p class="r-empty">Your resume preview appears here as you type.</p>';
  };
})();
