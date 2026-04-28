/* EU Pay Transparency Directive — Member State Tracker */

const STATE = {
  data: null,
  topo: null,
  selected: null,
  filter: 'all',
  search: '',
  sort: 'status',
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

async function init() {
  const bust = '?t=' + Date.now();
  const [data, topo] = await Promise.all([
    fetch('data.json' + bust).then(r => r.json()),
    fetch('europe.topojson').then(r => r.json())
  ]);
  STATE.data = data;
  STATE.topo = topo;

  renderHeader();
  renderHero();
  renderLegend();
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
  Object.values(STATE.data.countries).forEach(c => counts[c.status]++);
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
  const today = new Date().toISOString().slice(0, 10);
  const items = Object.values(STATE.data.countries)
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

function renderMap() {
  const container = document.getElementById('map');
  const tooltip = document.getElementById('tooltip');
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

  const fillFor = (id) => {
    const c = STATE.data.countries[id];
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
    const c = STATE.data.countries[code];
    if (!c) return;
    tooltip.hidden = false;
    tooltip.innerHTML = `<strong>${c.name}</strong><span class="tt-status">${STATE.data.statusLegend[c.status].label}</span>`;
  };

  svg.selectAll('path')
    .data(features)
    .join('path')
    .attr('class', d => {
      const isEu = EU27.includes(d.id);
      return 'country' + (isEu ? '' : ' non-eu');
    })
    .attr('data-code', d => d.id)
    .attr('d', path)
    .attr('fill', d => fillFor(d.id) || '#eef0f4')
    .attr('tabindex', d => EU27.includes(d.id) ? 0 : null)
    .attr('role', d => EU27.includes(d.id) ? 'button' : null)
    .attr('aria-label', d => {
      const c = STATE.data.countries[d.id];
      return c ? `${c.name} — ${STATE.data.statusLegend[c.status].label}` : null;
    })
    .on('mouseenter', (event, d) => showTooltipFor(d.id))
    .on('mousemove', placeTooltip)
    .on('mouseleave', () => { tooltip.hidden = true; })
    .on('focus', function (event, d) {
      if (!STATE.data.countries[d.id]) return;
      showTooltipFor(d.id);
      const bbox = this.getBoundingClientRect();
      const rect = container.getBoundingClientRect();
      tooltip.style.left = (bbox.left - rect.left + bbox.width / 2 + 8) + 'px';
      tooltip.style.top = (bbox.top - rect.top + bbox.height / 2 + 8) + 'px';
    })
    .on('blur', () => { tooltip.hidden = true; })
    .on('keydown', (event, d) => {
      if ((event.key === 'Enter' || event.key === ' ') && STATE.data.countries[d.id]) {
        event.preventDefault();
        selectCountry(d.id);
      }
    })
    .on('click', (event, d) => {
      if (STATE.data.countries[d.id]) selectCountry(d.id);
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
  document.querySelectorAll('.country').forEach(el => {
    if (el.classList.contains('non-eu')) return;
    const code = el.getAttribute('data-code');
    const country = STATE.data.countries[code];
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
  const list = Object.values(STATE.data.countries);
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
  grid.innerHTML = sortedCountries().map(c => `
    <button class="c-card s-${c.status}" data-code="${c.code}" data-status="${c.status}">
      <div class="c-top">
        <span class="c-name">${c.name}</span>
        <span class="c-code">${c.code}</span>
      </div>
      <div class="c-headline">${c.headline}</div>
    </button>
  `).join('');

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
  document.querySelectorAll('#countryGrid .c-card').forEach(el => {
    const status = el.dataset.status;
    const code = el.dataset.code;
    const country = STATE.data.countries[code];
    const matchesStatus = STATE.filter === 'all' || STATE.filter === status;
    const q = STATE.search;
    const matchesSearch = !q
      || country.name.toLowerCase().includes(q)
      || code.toLowerCase().includes(q)
      || country.headline.toLowerCase().includes(q);
    el.classList.toggle('is-hidden', !(matchesStatus && matchesSearch));
  });
}

function selectCountry(code) {
  STATE.selected = code;
  const c = STATE.data.countries[code];
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
      ${c.sources.map(s => `<li><a href="${s.url}" target="_blank" rel="noopener">${s.title}<span class="pub">${s.publisher}</span></a></li>`).join('')}
    </ul>
  `;

  content.innerHTML = `
    <div class="country-meta">
      <span class="flag-box">${c.code}</span>
      <h3>${c.name}</h3>
    </div>
    <span class="status-badge status-${c.status}"><span class="dot dot-${c.status}"></span>${status.label}</span>
    <p class="headline">${c.headline}</p>
    <p class="summary">${c.summary}</p>
    ${datesHtml}
    ${sourcesHtml}
  `;

  if (window.innerWidth < 980) {
    document.querySelector('.detail-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

init();
