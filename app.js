/* EU Pay Transparency Directive — Member State Tracker */

const STATE = {
  data: null,
  topo: null,
  selected: null,
  filter: 'all',
  search: '',
  sort: 'status',
  week: null,           // ISO week being displayed (null = current/latest)
};

const EU27 = ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'];

const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

const daysBetween = (isoFuture) => {
  const today = new Date();
  today.setHours(0,0,0,0);
  const target = new Date(isoFuture + 'T00:00:00');
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
};

const currentWeek = () => STATE.data.meta.isoWeek;
const isCurrent = () => !STATE.week || STATE.week === currentWeek();

/**
 * Returns the country dict for the active week. The current week always
 * uses the full top-level `countries` (which carries summary, sources, dates).
 * Older weeks merge the snapshot status/headline onto the canonical record so
 * the UI keeps something to show even where the historical snapshot is sparse.
 */
function activeCountries() {
  const base = STATE.data.countries;
  if (isCurrent()) return base;
  const snap = STATE.data.history?.[STATE.week]?.countries || {};
  const merged = {};
  Object.entries(base).forEach(([code, c]) => {
    const s = snap[code];
    merged[code] = s
      ? { ...c, status: s.status, headline: s.headline || c.headline, _historical: true }
      : { ...c, _historical: true };
  });
  return merged;
}

/**
 * For each country at the active week, compute whether it changed tier vs.
 * the immediately previous week available in history. Returns a map
 * { CODE: { from, to, direction } } where direction is 'up' | 'down' | null
 * (null = unchanged, no entry = first observed week).
 */
function changesForWeek(week) {
  const weeks = STATE.data.weeks || [];
  const order = ['green','amber','red'];
  const idx = weeks.findIndex(w => w.isoWeek === week);
  if (idx <= 0) return {};
  const prevWeek = weeks[idx - 1].isoWeek;
  const cur = STATE.data.history?.[week]?.countries || {};
  const prev = STATE.data.history?.[prevWeek]?.countries || {};
  const out = {};
  Object.keys(cur).forEach(code => {
    const a = prev[code]?.status;
    const b = cur[code]?.status;
    if (!a || !b || a === b) return;
    out[code] = {
      from: a,
      to: b,
      // Going from green→amber→red is "down" (further from compliance).
      direction: order.indexOf(b) > order.indexOf(a) ? 'down' : 'up',
    };
  });
  return out;
}

async function init() {
  const bust = '?t=' + Date.now();
  const [data, topo] = await Promise.all([
    fetch('data.json' + bust).then(r => r.json()),
    fetch('europe.topojson').then(r => r.json())
  ]);
  STATE.data = data;
  STATE.topo = topo;
  STATE.week = data.meta.isoWeek;

  renderHeader();
  renderHero();
  renderLegend();
  renderTimeline();
  renderMap();
  renderGrid();
  renderQuicklinks();
  renderLeaderboard();
  renderMethodology();
  bindFilters();
}

function nextDateFor(country) {
  const dates = (country.keyDates || []).map(d => d.date).filter(Boolean).sort();
  const today = new Date().toISOString().slice(0, 10);
  return dates.find(d => d >= today) || dates[dates.length - 1] || null;
}

function renderHeader() {
  const { lastUpdated, disclaimer } = STATE.data.meta;
  const author = STATE.data.author || {};

  const longFmt = new Date(lastUpdated + 'T00:00:00Z')
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  document.getElementById('statusDate').textContent = longFmt;
  document.getElementById('footDisclaimer').textContent = disclaimer;

  const profileLink = document.getElementById('profileLink');
  const profileName = document.getElementById('profileName');
  const meetingLink = document.getElementById('meetingLink');
  const meetingLinkLg = document.getElementById('meetingLinkLg');
  const avatar = document.getElementById('avatar');

  if (author.name) {
    profileName.textContent = author.name;
    const initials = author.name.split(/\s+/).map(s => s[0]).slice(0,2).join('').toUpperCase();
    avatar.textContent = initials;
    avatar.setAttribute('aria-label', author.name);
  }
  if (author.linkedinUrl) {
    profileLink.href = author.linkedinUrl;
  }
  if (author.meetingUrl && author.meetingUrl !== '#') {
    meetingLink.href = author.meetingUrl;
    meetingLinkLg.href = author.meetingUrl;
  }
  if (author.photoUrl) {
    const isData = author.photoUrl.startsWith('data:');
    const photoSrc = isData ? author.photoUrl : author.photoUrl + '?t=' + Date.now();
    avatar.style.setProperty('--avatar-image', `url(${JSON.stringify(photoSrc)})`);
    avatar.classList.add('has-photo');
    avatar.textContent = '';
  }
}

function renderHero() {
  const counts = { green: 0, amber: 0, red: 0 };
  Object.values(activeCountries()).forEach(c => counts[c.status]++);
  const total = counts.green + counts.amber + counts.red;

  const deadlineIso = STATE.data.meta.deadlineTransposition;
  const deadlineLong = new Date(deadlineIso + 'T00:00:00Z')
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  document.getElementById('heroDeadline').textContent = deadlineLong;

  const days = daysBetween(deadlineIso);
  document.getElementById('heroCountdown').textContent = days >= 0 ? days : 'past';

  document.getElementById('hpGreenN').textContent = counts.green;
  document.getElementById('hpAmberN').textContent = counts.amber;
  document.getElementById('hpRedN').textContent = counts.red;

  // Animate segments in next frame so transition triggers
  requestAnimationFrame(() => {
    document.getElementById('hpGreen').style.width = (counts.green / total * 100) + '%';
    document.getElementById('hpAmber').style.width = (counts.amber / total * 100) + '%';
    document.getElementById('hpRed').style.width   = (counts.red   / total * 100) + '%';
  });
}

function renderLegend() {
  const legend = document.getElementById('legend');
  const { statusLegend } = STATE.data;
  const order = ['green','amber','red'];
  legend.innerHTML = order.map(k => `
    <span class="legend-item">
      <span class="legend-swatch" style="background:${statusLegend[k].color}"></span>
      ${statusLegend[k].label}
    </span>
  `).join('');
}

function renderQuicklinks() {
  const tracker = document.getElementById('trackerList');
  const directive = document.getElementById('directiveList');
  tracker.innerHTML = STATE.data.trackers.map(s => `
    <li><a href="${s.url}" target="_blank" rel="noopener">${s.title}<span class="pub">${s.publisher}</span></a></li>
  `).join('');
  directive.innerHTML = STATE.data.directiveSources.map(s => `
    <li><a href="${s.url}" target="_blank" rel="noopener">${s.title}<span class="pub">${s.publisher}</span></a></li>
  `).join('');
}

function renderLeaderboard() {
  const list = document.getElementById('leaderboard');
  if (!list) return;
  const today = new Date().toISOString().slice(0, 10);
  const items = Object.values(activeCountries())
    .map(c => ({ c, next: nextDateFor(c) }))
    .filter(x => x.next && x.next >= today)
    .sort((a, b) => a.next.localeCompare(b.next))
    .slice(0, 5);

  if (!items.length) { list.innerHTML = '<li style="cursor:default">No upcoming dates on record.</li>'; return; }

  list.innerHTML = items.map(({ c, next }) => `
    <li role="button" tabindex="0" data-code="${c.code}">
      <span class="lb-dot" style="background:${STATE.data.statusLegend[c.status].color}"></span>
      <span class="lb-name">${c.name}</span>
      <span class="lb-date">${fmtDate(next)}</span>
    </li>
  `).join('');

  list.querySelectorAll('li[data-code]').forEach(li => {
    const code = li.dataset.code;
    li.addEventListener('click', () => selectCountry(code));
    li.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectCountry(code); }
    });
  });
}

function renderMethodology() {
  const ul = document.getElementById('methodologyList');
  if (!ul) return;
  const order = ['green', 'amber', 'red'];
  ul.innerHTML = order.map(k => {
    const s = STATE.data.statusLegend[k];
    return `<li><span class="m-tag ${k}">${s.label}</span><span>${s.definition || ''}</span></li>`;
  }).join('');
}

/* ---------- Timeline / week selector + movers strip ---------- */

function renderTimeline() {
  const root = document.getElementById('timeline');
  if (!root) return;
  const weeks = STATE.data.weeks || [];
  if (weeks.length < 2) { root.hidden = true; return; }

  // Sort ascending by ISO week so the newest is on the right.
  const sorted = [...weeks].sort((a, b) => a.isoWeek.localeCompare(b.isoWeek));
  const movers = STATE.data.history?.[STATE.week]?.movers || [];

  const summaryFor = (week) => STATE.data.history?.[week]?.summary || null;

  const dotsHtml = sorted.map((w, i) => {
    const sum = summaryFor(w.isoWeek);
    const moverCount = (STATE.data.history?.[w.isoWeek]?.movers || []).length;
    const isActive = w.isoWeek === STATE.week;
    const isLast = i === sorted.length - 1;
    return `
      <button class="tl-dot ${isActive ? 'is-active' : ''} ${isLast ? 'is-current' : ''}"
              data-week="${w.isoWeek}"
              aria-pressed="${isActive ? 'true' : 'false'}"
              title="${w.longLabel || w.isoWeek}${sum ? ` — ${sum.green}G · ${sum.amber}A · ${sum.red}R` : ''}">
        <span class="tl-dot-week">${w.shortLabel || w.isoWeek}</span>
        <span class="tl-dot-bullet" aria-hidden="true"></span>
        ${moverCount ? `<span class="tl-dot-badge" aria-label="${moverCount} movers">${moverCount}</span>` : ''}
      </button>
    `;
  }).join('<span class="tl-line" aria-hidden="true"></span>');

  const moversHtml = movers.length
    ? movers.map(m => {
        const fromLabel = STATE.data.statusLegend[m.from]?.label || m.from;
        const toLabel = STATE.data.statusLegend[m.to]?.label || m.to;
        const arrow = m.direction === 'up' ? '↑' : m.direction === 'down' ? '↓' : '↺';
        const cls = `mv-${m.direction || 'flat'}`;
        const country = STATE.data.countries[m.code];
        const name = country?.name || m.code;
        return `
          <button class="mover ${cls}" data-code="${m.code}">
            <span class="mv-arrow" aria-hidden="true">${arrow}</span>
            <span class="mv-body">
              <span class="mv-name">${m.code} · ${name}</span>
              <span class="mv-tier">
                <span class="mv-from t-${m.from}">${fromLabel}</span>
                <span class="mv-sep">→</span>
                <span class="mv-to t-${m.to}">${toLabel}</span>
              </span>
              <span class="mv-headline">${m.headline}</span>
            </span>
          </button>
        `;
      }).join('')
    : `<p class="mv-empty">No tier changes recorded for this week.</p>`;

  const weekMeta = STATE.data.history?.[STATE.week] || {};
  const weekLabel = sorted.find(w => w.isoWeek === STATE.week)?.longLabel || STATE.week;
  const moversTitle = movers.length === 1 ? '1 country moved' : `${movers.length} countries moved`;

  root.innerHTML = `
    <div class="tl-head">
      <div class="tl-title">
        <span class="tl-eyebrow">Timeline</span>
        <h2>Week-over-week changes</h2>
      </div>
      <div class="tl-rail" role="tablist" aria-label="ISO week">
        ${dotsHtml}
      </div>
    </div>
    <div class="tl-week-meta">
      <strong>${weekLabel}</strong>
      ${weekMeta.summary ? `<span class="tl-tally">
        <span class="t-green">${weekMeta.summary.green}</span> green ·
        <span class="t-amber">${weekMeta.summary.amber}</span> amber ·
        <span class="t-red">${weekMeta.summary.red}</span> red
      </span>` : ''}
      <span class="tl-movers-count">${moversTitle}</span>
    </div>
    <div class="movers" id="moversList">
      ${moversHtml}
    </div>
  `;

  root.querySelectorAll('.tl-dot').forEach(btn => {
    btn.addEventListener('click', () => switchWeek(btn.dataset.week));
  });
  root.querySelectorAll('.mover[data-code]').forEach(btn => {
    btn.addEventListener('click', () => selectCountry(btn.dataset.code));
  });
}

function switchWeek(week) {
  if (week === STATE.week) return;
  STATE.week = week;
  renderTimeline();
  renderHero();
  renderMap();      // re-render map fills based on new week
  renderGrid();
  renderLeaderboard();
  // Refresh detail panel if a country is selected.
  if (STATE.selected) selectCountry(STATE.selected, { skipScroll: true });
  // Mark page state for the user.
  document.body.classList.toggle('viewing-historical', !isCurrent());
  // Update the hero stamp to make it clear which week is shown.
  const stamp = document.querySelector('.hero-stamp');
  if (stamp) {
    if (isCurrent()) {
      stamp.innerHTML = `Last updated <time id="statusDate">${new Date(STATE.data.meta.lastUpdated + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}</time> · verified across publicly available legal trackers`;
    } else {
      const w = (STATE.data.weeks || []).find(x => x.isoWeek === STATE.week);
      stamp.innerHTML = `<span class="historic-pill">Historical view</span> showing <strong>${w?.longLabel || STATE.week}</strong> · <button class="link-btn" id="backToCurrent">Back to latest</button>`;
      document.getElementById('backToCurrent')?.addEventListener('click', () => switchWeek(currentWeek()));
    }
  }
}

function renderMap() {
  const container = document.getElementById('map');
  const tooltip = document.getElementById('tooltip');
  // Wipe any prior render so re-rendering on week change works cleanly.
  container.innerHTML = '';
  const width = container.clientWidth;
  const height = 540;

  const features = topojson.feature(STATE.topo, STATE.topo.objects.europe).features;
  const euFeatures = features.filter(f => EU27.includes(f.id));
  const euCollection = { type: 'FeatureCollection', features: euFeatures };

  const projection = d3.geoMercator();
  projection.fitExtent([[16, 16], [width - 16, height - 16]], euCollection);

  const path = d3.geoPath().projection(projection);

  const svg = d3.select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const countriesActive = activeCountries();
  const fillFor = (id) => {
    const c = countriesActive[id];
    if (!c) return null;
    return STATE.data.statusLegend[c.status].color;
  };

  const placeTooltip = (event) => {
    const rect = container.getBoundingClientRect();
    const ttRect = tooltip.getBoundingClientRect();
    let x = event.clientX - rect.left + 14;
    let y = event.clientY - rect.top + 14;
    if (x + ttRect.width > rect.width - 8) x = event.clientX - rect.left - ttRect.width - 14;
    if (y + ttRect.height > rect.height - 8) y = event.clientY - rect.top - ttRect.height - 14;
    tooltip.style.left = Math.max(8, x) + 'px';
    tooltip.style.top = Math.max(8, y) + 'px';
  };

  const showTooltipFor = (code) => {
    const c = countriesActive[code];
    if (!c) return;
    tooltip.hidden = false;
    const change = changesForWeek(STATE.week)[code];
    const changePill = change
      ? `<span class="tt-change tt-${change.direction}">${change.direction === 'up' ? '↑' : '↓'} from ${STATE.data.statusLegend[change.from].label}</span>`
      : '';
    tooltip.innerHTML = `<strong>${c.name}</strong><span class="tt-status">${STATE.data.statusLegend[c.status].label}</span>${changePill}`;
  };

  svg.selectAll('path')
    .data(features)
    .join('path')
    .attr('class', d => {
      const isEu = EU27.includes(d.id);
      const change = changesForWeek(STATE.week)[d.id];
      return 'country' + (isEu ? '' : ' non-eu') + (change ? ` mover-${change.direction}` : '');
    })
    .attr('data-code', d => d.id)
    .attr('d', path)
    .attr('fill', d => fillFor(d.id) || '#eef0f4')
    .attr('tabindex', d => EU27.includes(d.id) ? 0 : null)
    .attr('role', d => EU27.includes(d.id) ? 'button' : null)
    .attr('aria-label', d => {
      const c = countriesActive[d.id];
      return c ? `${c.name} — ${STATE.data.statusLegend[c.status].label}` : null;
    })
    .on('mouseenter', (event, d) => showTooltipFor(d.id))
    .on('mousemove', placeTooltip)
    .on('mouseleave', () => { tooltip.hidden = true; })
    .on('focus', function (event, d) {
      if (!countriesActive[d.id]) return;
      showTooltipFor(d.id);
      const bbox = this.getBoundingClientRect();
      const rect = container.getBoundingClientRect();
      tooltip.style.left = (bbox.left - rect.left + bbox.width / 2 + 8) + 'px';
      tooltip.style.top = (bbox.top - rect.top + bbox.height / 2 + 8) + 'px';
    })
    .on('blur', () => { tooltip.hidden = true; })
    .on('keydown', (event, d) => {
      if ((event.key === 'Enter' || event.key === ' ') && countriesActive[d.id]) {
        event.preventDefault();
        selectCountry(d.id);
      }
    })
    .on('click', (event, d) => {
      if (countriesActive[d.id]) selectCountry(d.id);
    });

  window.addEventListener('resize', debounce(() => {
    const w = container.clientWidth;
    svg.attr('viewBox', `0 0 ${w} ${height}`);
    projection.fitExtent([[16, 16], [w - 16, height - 16]], euCollection);
    svg.selectAll('path').attr('d', path);
  }, 200));
}

function applyMapDim() {
  const q = STATE.search;
  const countriesActive = activeCountries();
  document.querySelectorAll('.country').forEach(el => {
    if (el.classList.contains('non-eu')) return;
    const code = el.getAttribute('data-code');
    const country = countriesActive[code];
    if (!country) return;
    const matches = !q
      || country.name.toLowerCase().includes(q)
      || code.toLowerCase().includes(q)
      || (country.headline || '').toLowerCase().includes(q);
    el.classList.toggle('is-dim', !matches);
  });
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function sortedCountries() {
  const order = ['green','amber','red'];
  const list = Object.values(activeCountries());
  if (STATE.sort === 'alpha') {
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }
  if (STATE.sort === 'deadline') {
    const far = '9999-99-99';
    return list.sort((a, b) => (nextDateFor(a) || far).localeCompare(nextDateFor(b) || far));
  }
  return list.sort((a, b) => {
    const so = order.indexOf(a.status) - order.indexOf(b.status);
    if (so !== 0) return so;
    return a.name.localeCompare(b.name);
  });
}

function renderGrid() {
  const grid = document.getElementById('countryGrid');
  const changes = changesForWeek(STATE.week);
  grid.innerHTML = sortedCountries().map(c => {
    const ch = changes[c.code];
    const changePill = ch
      ? `<span class="c-change c-change-${ch.direction}" title="${ch.direction === 'up' ? 'Tier up' : 'Tier down'} from ${STATE.data.statusLegend[ch.from].label}">
           <span aria-hidden="true">${ch.direction === 'up' ? '↑' : '↓'}</span>
           <span>was ${STATE.data.statusLegend[ch.from].label}</span>
         </span>`
      : '';
    return `
      <button class="c-card s-${c.status}" data-code="${c.code}" data-status="${c.status}">
        <div class="c-top">
          <span class="c-name">${c.name}</span>
          <span class="c-code">${c.code}</span>
        </div>
        <div class="c-headline">${c.headline}</div>
        ${changePill}
        ${c.verifiedWeek && isCurrent() ? `<div class="c-verified" title="${c.weeklyCheckSummary || ''}"><span class="c-verified-dot" aria-hidden="true">✓</span>Verified ${c.verifiedWeek.replace('-W', ' KW')}</div>` : ''}
      </button>
    `;
  }).join('');

  grid.querySelectorAll('.c-card').forEach(el => {
    el.addEventListener('click', () => selectCountry(el.dataset.code));
  });
}

function bindFilters() {
  document.querySelectorAll('#filterPills .pill').forEach(p => {
    p.addEventListener('click', () => {
      document.querySelectorAll('#filterPills .pill').forEach(x => {
        x.classList.remove('is-active');
        x.setAttribute('aria-pressed', 'false');
      });
      p.classList.add('is-active');
      p.setAttribute('aria-pressed', 'true');
      STATE.filter = p.dataset.filter;
      applyFilter();
    });
  });
  document.getElementById('search').addEventListener('input', (e) => {
    STATE.search = e.target.value.trim().toLowerCase();
    applyFilter();
    applyMapDim();
  });
  const sortSel = document.getElementById('sortSelect');
  if (sortSel) {
    sortSel.addEventListener('change', (e) => {
      STATE.sort = e.target.value;
      renderGrid();
      applyFilter();
    });
  }
}

function applyFilter() {
  const countriesActive = activeCountries();
  document.querySelectorAll('#countryGrid .c-card').forEach(el => {
    const status = el.dataset.status;
    const code = el.dataset.code;
    const country = countriesActive[code];
    const matchesStatus = STATE.filter === 'all' || STATE.filter === status;
    const q = STATE.search;
    const matchesSearch = !q
      || country.name.toLowerCase().includes(q)
      || code.toLowerCase().includes(q)
      || country.headline.toLowerCase().includes(q);
    el.classList.toggle('is-hidden', !(matchesStatus && matchesSearch));
  });
}

function selectCountry(code, opts = {}) {
  STATE.selected = code;
  const c = activeCountries()[code];
  if (!c) return;

  document.querySelectorAll('.country').forEach(el => {
    const match = el.getAttribute('data-code') === code;
    el.classList.toggle('is-selected', match);
    if (match) el.setAttribute('aria-current', 'true'); else el.removeAttribute('aria-current');
  });
  document.querySelectorAll('.c-card').forEach(el => {
    const match = el.dataset.code === code;
    el.classList.toggle('is-selected', match);
    if (match) el.setAttribute('aria-current', 'true'); else el.removeAttribute('aria-current');
  });

  const empty = document.getElementById('detailEmpty');
  const content = document.getElementById('detailContent');
  empty.hidden = true;
  content.hidden = false;

  const status = STATE.data.statusLegend[c.status];
  const datesHtml = (c.keyDates || []).length
    ? `<div class="section-label">Key dates</div>
       <ul class="dates">
         ${c.keyDates.map(d => `<li><span class="d-label">${d.label}</span><span class="d-date">${fmtDate(d.date)}</span></li>`).join('')}
       </ul>`
    : '';

  const sourcesHtml = `
    <div class="section-label">Sources</div>
    <ul class="sources">
      ${(c.sources || []).map(s => `<li><a href="${s.url}" target="_blank" rel="noopener">${s.title}<span class="pub">${s.publisher}</span></a></li>`).join('')}
    </ul>
  `;

  const verifiedHtml = c.verifiedWeek
    ? `<div class="verified-stamp" title="${c.weeklyCheckSummary || ''}">
         <span class="verified-icon" aria-hidden="true">✓</span>
         <span class="verified-text">Verified <strong>${c.verifiedWeek.replace('-W', ' KW')}</strong> · ${fmtDate(c.verifiedAt)}</span>
       </div>
       ${c.weeklyCheckSummary ? `<p class="verified-summary">${c.weeklyCheckSummary}</p>` : ''}`
    : '';

  // Per-country history strip (if we have ≥ 2 weeks recorded).
  const weeks = STATE.data.weeks || [];
  let historyHtml = '';
  if (weeks.length > 1) {
    const items = weeks.map(w => {
      const snap = STATE.data.history?.[w.isoWeek]?.countries?.[code];
      if (!snap) return null;
      const isShown = w.isoWeek === STATE.week;
      const lbl = STATE.data.statusLegend[snap.status]?.label || snap.status;
      return `
        <li>
          <button class="ch-step ${isShown ? 'is-active' : ''}" data-week="${w.isoWeek}">
            <span class="ch-week">${w.shortLabel || w.isoWeek}</span>
            <span class="ch-dot t-${snap.status}" title="${lbl}"></span>
            <span class="ch-headline">${snap.headline || ''}</span>
          </button>
        </li>`;
    }).filter(Boolean).join('');
    if (items) {
      historyHtml = `
        <div class="section-label">Country history</div>
        <ul class="ch-track">${items}</ul>
      `;
    }
  }

  const historicalNote = !isCurrent()
    ? `<div class="historic-note">Showing snapshot from <strong>${(weeks.find(w => w.isoWeek === STATE.week)?.longLabel) || STATE.week}</strong>. Sources, dates and verified stamp reflect the latest week.</div>`
    : '';

  content.innerHTML = `
    <div class="country-meta">
      <span class="flag-box">${c.code}</span>
      <h3>${c.name}</h3>
    </div>
    <span class="status-badge status-${c.status}"><span class="dot dot-${c.status}"></span>${status.label}</span>
    <p class="headline">${c.headline}</p>
    ${historicalNote}
    <p class="summary">${c.summary || ''}</p>
    ${verifiedHtml}
    ${historyHtml}
    ${datesHtml}
    ${sourcesHtml}
  `;

  content.querySelectorAll('.ch-step[data-week]').forEach(b => {
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      switchWeek(b.dataset.week);
    });
  });

  if (!opts.skipScroll && window.innerWidth < 980) {
    document.querySelector('.detail-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

init();
