/* EU Pay Transparency Directive — Member State Tracker */

const STATE = {
  data: null,
  topo: null,
  selected: null,
  filter: 'all',
  search: '',
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
  const [data, topo] = await Promise.all([
    fetch('data.json').then(r => r.json()),
    fetch('europe.topojson').then(r => r.json())
  ]);
  STATE.data = data;
  STATE.topo = topo;

  renderHeader();
  renderKpis();
  renderLegend();
  renderMap();
  renderGrid();
  renderQuicklinks();
  bindFilters();
}

function renderHeader() {
  const { lastUpdated, disclaimer } = STATE.data.meta;
  document.getElementById('lastUpdated').textContent = `Status as of ${fmtDate(lastUpdated)}`;
  document.getElementById('footDisclaimer').textContent = disclaimer;
}

function renderKpis() {
  const counts = { green: 0, amber: 0, red: 0 };
  Object.values(STATE.data.countries).forEach(c => counts[c.status]++);
  document.getElementById('kpiGreen').textContent = counts.green;
  document.getElementById('kpiAmber').textContent = counts.amber;
  document.getElementById('kpiRed').textContent = counts.red;
  const days = daysBetween(STATE.data.meta.deadlineTransposition);
  document.getElementById('kpiCountdown').textContent = days >= 0 ? days : 'past';
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
    .on('mouseenter', (event, d) => {
      const c = STATE.data.countries[d.id];
      if (!c) return;
      tooltip.hidden = false;
      tooltip.innerHTML = `
        <strong>${c.name}</strong>
        <span class="tt-status">${STATE.data.statusLegend[c.status].label}</span>
      `;
    })
    .on('mousemove', (event) => {
      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left + 14;
      const y = event.clientY - rect.top + 14;
      tooltip.style.left = x + 'px';
      tooltip.style.top = y + 'px';
    })
    .on('mouseleave', () => { tooltip.hidden = true; })
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

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function renderGrid() {
  const grid = document.getElementById('countryGrid');
  const order = ['green','amber','red'];
  const sorted = Object.values(STATE.data.countries).sort((a, b) => {
    const so = order.indexOf(a.status) - order.indexOf(b.status);
    if (so !== 0) return so;
    return a.name.localeCompare(b.name);
  });

  grid.innerHTML = sorted.map(c => `
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
      document.querySelectorAll('#filterPills .pill').forEach(x => x.classList.remove('is-active'));
      p.classList.add('is-active');
      STATE.filter = p.dataset.filter;
      applyFilter();
    });
  });
  document.getElementById('search').addEventListener('input', (e) => {
    STATE.search = e.target.value.trim().toLowerCase();
    applyFilter();
  });
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

  document.querySelectorAll('.country').forEach(el => el.classList.toggle('is-selected', el.dataset.code === code));
  document.querySelectorAll('.c-card').forEach(el => el.classList.toggle('is-selected', el.dataset.code === code));

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
