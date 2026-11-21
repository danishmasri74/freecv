/* FreeCV — data model, sample content, and import validation. */
(function () {
  'use strict';

  var FreeCV = (window.FreeCV = window.FreeCV || {});

  // Section titles shown in the outline and editor for sections with no editable title.
  FreeCV.PERSONAL_TITLE = 'Personal details';

  FreeCV.SCHEMA_VERSION = 1;

  FreeCV.uid = function () {
    return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
  };

  FreeCV.ACCENTS = [
    { name: 'Navy', value: '#1f3a5f' },
    { name: 'Teal', value: '#0f6b66' },
    { name: 'Burgundy', value: '#8b1e3f' },
    { name: 'Forest', value: '#2f5d34' },
    { name: 'Slate', value: '#3b4656' },
    { name: 'Black', value: '#111111' }
  ];

  FreeCV.TEMPLATES = ['classic', 'modern', 'minimal'];
  FreeCV.PAPERS = ['a4', 'letter'];

  /*
   * Field definitions per section type. `wide` fields take a full row;
   * `area` fields are textareas. `label` builds the collapsed entry title.
   */
  FreeCV.TYPES = {
    summary: { defaultTitle: 'Summary' },
    experience: {
      defaultTitle: 'Experience',
      addLabel: 'Add job',
      fields: [
        { key: 'role', label: 'Job title' },
        { key: 'org', label: 'Company' },
        { key: 'start', label: 'Start', placeholder: 'Jan 2022' },
        { key: 'end', label: 'End', placeholder: 'Present' },
        { key: 'location', label: 'Location', wide: true, placeholder: 'Kuala Lumpur (hybrid)' },
        { key: 'bullets', label: 'What you did', list: true, placeholder: 'Led a project that…', addLabel: 'Add a point', hint: 'Start with a verb; add numbers where you can. Press Enter for a new point.' }
      ],
      label: function (it) { return [it.role, it.org].filter(Boolean).join(' · '); },
      meta: function (it) { return dateRange(it.start, it.end); }
    },
    education: {
      defaultTitle: 'Education',
      addLabel: 'Add education',
      fields: [
        { key: 'degree', label: 'Degree / qualification', wide: true },
        { key: 'school', label: 'School', wide: true },
        { key: 'start', label: 'Start', placeholder: '2016' },
        { key: 'end', label: 'End', placeholder: '2020' },
        { key: 'location', label: 'Location', wide: true },
        { key: 'details', label: 'Details (optional)', area: true, hint: 'Grades, honours, thesis. Lines starting with “-” become bullets.' }
      ],
      label: function (it) { return [it.degree, it.school].filter(Boolean).join(' · '); },
      meta: function (it) { return dateRange(it.start, it.end); }
    },
    skills: {
      defaultTitle: 'Skills',
      addLabel: 'Add skill group',
      fields: [
        { key: 'name', label: 'Group (optional)', wide: true, placeholder: 'Languages' },
        { key: 'skills', label: 'Skills', wide: true, placeholder: 'TypeScript, Python, SQL' }
      ],
      label: function (it) { return it.name || it.skills; }
    },
    projects: {
      defaultTitle: 'Projects',
      addLabel: 'Add project',
      fields: [
        { key: 'name', label: 'Project name' },
        { key: 'date', label: 'Date (optional)', placeholder: '2024' },
        { key: 'subtitle', label: 'Role / tech (optional)', wide: true, placeholder: 'React, Node.js' },
        { key: 'link', label: 'Link (optional)', wide: true, placeholder: 'github.com/you/project' },
        { key: 'description', label: 'Description', area: true, hint: 'Lines starting with “-” become bullets.' }
      ],
      label: function (it) { return it.name; },
      meta: function (it) { return (it.date || '').trim(); }
    }
  };

  function dateRange(a, b) {
    a = (a || '').trim(); b = (b || '').trim();
    return a && b ? a + ' – ' + b : a || b;
  }

  FreeCV.SECTION_ORDER = ['summary', 'experience', 'education', 'skills', 'projects'];

  FreeCV.blankItem = function (type) {
    var item = { id: FreeCV.uid() };
    (FreeCV.TYPES[type].fields || []).forEach(function (f) { item[f.key] = ''; });
    return item;
  };

  function section(type, extra) {
    var s = { id: type, type: type, title: FreeCV.TYPES[type].defaultTitle, hidden: false };
    if (type === 'summary') s.text = '';
    else s.items = [];
    for (var k in extra) s[k] = extra[k];
    return s;
  }

  function withIds(items) {
    return items.map(function (it) { it.id = FreeCV.uid(); return it; });
  }

  FreeCV.defaultSettings = function () {
    return { template: 'classic', accent: FreeCV.ACCENTS[0].value, paper: 'a4' };
  };

  FreeCV.blank = function (settings) {
    return {
      version: FreeCV.SCHEMA_VERSION,
      settings: settings || FreeCV.defaultSettings(),
      personal: { name: '', headline: '', email: '', phone: '', location: '', links: [''] },
      sections: FreeCV.SECTION_ORDER.map(function (t) {
        var s = section(t);
        if (s.items) s.items = [FreeCV.blankItem(t)];
        return s;
      })
    };
  };

  FreeCV.sample = function (settings) {
    return {
      version: FreeCV.SCHEMA_VERSION,
      settings: settings || FreeCV.defaultSettings(),
      personal: {
        name: 'Aisyah Rahman',
        headline: 'Software Engineer · Frontend & Web Performance',
        email: 'aisyah.rahman@example.com',
        phone: '+60 12-345 6789',
        location: 'Kuala Lumpur, Malaysia',
        links: ['linkedin.com/in/aisyah-rahman-example', 'github.com/aisyah-example']
      },
      sections: [
        section('summary', {
          text: 'Frontend engineer with 5 years of experience building fast, accessible web apps for e-commerce and fintech. I care about load times, clean component APIs, and shipping small improvements every week. This is example text, so click anything on the left to make it yours.'
        }),
        section('experience', {
          items: withIds([
            {
              role: 'Senior Frontend Engineer', org: 'Lumen Pay', location: 'Kuala Lumpur (hybrid)',
              start: 'Mar 2023', end: 'Present',
              bullets: 'Led the rebuild of the merchant dashboard in React and TypeScript, cutting page load time from 4.1s to 1.3s\nCreated a shared component library now used by 6 product teams\nMentored 3 junior engineers through code review and weekly pairing\nWorked with design to bring the checkout flow up to WCAG 2.1 AA'
            },
            {
              role: 'Frontend Engineer', org: 'Kedai.co', location: 'Petaling Jaya',
              start: 'Jul 2020', end: 'Feb 2023',
              bullets: 'Built product listing and search pages serving 2M monthly visitors\nIntroduced image lazy-loading and code splitting, improving mobile conversion by 9%\nSet up end-to-end tests with Playwright, reducing release bugs by about a third'
            }
          ])
        }),
        section('education', {
          items: withIds([
            {
              degree: 'Bachelor of Computer Science (Software Engineering)', school: 'Universiti Teknologi Malaysia',
              location: 'Johor Bahru', start: '2016', end: '2020',
              details: 'First Class Honours, CGPA 3.78\nFinal-year project: offline-first attendance app for rural schools'
            }
          ])
        }),
        section('skills', {
          items: withIds([
            { name: 'Languages', skills: 'TypeScript, JavaScript, HTML, CSS, SQL, Python' },
            { name: 'Frameworks', skills: 'React, Next.js, Svelte, Node.js, Tailwind CSS' },
            { name: 'Tools', skills: 'Git, Vite, Playwright, Figma, Lighthouse, AWS' },
            { name: 'Spoken', skills: 'English, Bahasa Malaysia, Mandarin (conversational)' }
          ])
        }),
        section('projects', {
          items: withIds([
            {
              name: 'Hujan Alert', date: '2024', subtitle: 'Svelte, Cloudflare Workers', link: 'github.com/aisyah-example/hujan-alert',
              description: 'Free flood and heavy-rain alerts for Klang Valley, sent by Telegram bot.\n- 4,000+ subscribers in the first monsoon season\n- Runs on free tiers for under RM5 a month'
            }
          ])
        })
      ]
    };
  };

  function str(v) { return typeof v === 'string' ? v : (typeof v === 'number' ? String(v) : ''); }

  /*
   * Turn any parsed JSON into a valid resume, or throw a readable error.
   * Unknown keys are dropped; missing ones are filled with defaults.
   */
  FreeCV.normalize = function (raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('This file is not a FreeCV resume.');
    if (!raw.personal || !Array.isArray(raw.sections)) throw new Error('This file is missing resume data (personal details or sections).');

    var def = FreeCV.defaultSettings();
    var st = raw.settings || {};
    var settings = {
      template: FreeCV.TEMPLATES.indexOf(st.template) >= 0 ? st.template : def.template,
      accent: /^#[0-9a-f]{6}$/i.test(st.accent) ? st.accent : def.accent,
      paper: FreeCV.PAPERS.indexOf(st.paper) >= 0 ? st.paper : def.paper
    };

    var p = raw.personal;
    var personal = {
      name: str(p.name), headline: str(p.headline), email: str(p.email),
      phone: str(p.phone), location: str(p.location),
      links: Array.isArray(p.links) ? p.links.map(function (l) { return typeof l === 'object' && l ? str(l.url) : str(l); }) : []
    };
    if (!personal.links.length) personal.links = [''];

    var seen = {};
    var sections = [];
    raw.sections.forEach(function (s) {
      if (!s || !FreeCV.TYPES[s.type] || seen[s.type]) return;
      seen[s.type] = true;
      var out = section(s.type, { title: str(s.title) || FreeCV.TYPES[s.type].defaultTitle, hidden: !!s.hidden });
      if (s.type === 'summary') {
        out.text = str(s.text);
      } else {
        out.items = (Array.isArray(s.items) ? s.items : []).map(function (it) {
          var item = FreeCV.blankItem(s.type);
          if (it && typeof it === 'object') {
            Object.keys(item).forEach(function (k) { if (k !== 'id') item[k] = str(it[k]); });
          }
          return item;
        });
      }
      sections.push(out);
    });
    // Any section missing from the file is appended so the editor stays complete.
    FreeCV.SECTION_ORDER.forEach(function (t) { if (!seen[t]) sections.push(section(t)); });

    return { version: FreeCV.SCHEMA_VERSION, settings: settings, personal: personal, sections: sections };
  };
})();
