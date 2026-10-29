const $ = (id) => document.getElementById(id);
const state = { view: 'overview', days: 7, sensorPage: 1, postPage: 1, sensorPages: 1, postPages: 1, sensorTimer: null, postTimer: null, overview: null };
const fmt = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 1 });
const shortNum = (n) => Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(n || 0));
const dateFmt = (d, options = { month: 'short', day: 'numeric' }) => new Date(d).toLocaleDateString('en-US', options);
const dateTimeFmt = (d) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const escapeHtml = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function api(path) {
  const response = await fetch(`/api${path}`, { headers: { Accept: 'application/json' } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
function showNotice(message) { $('notice').textContent = message; $('notice').classList.remove('hidden'); }
function hideNotice() { $('notice').classList.add('hidden'); }
function setConnection(online) {
  $('connection-label').textContent = online ? 'MongoDB connected' : 'Connection issue';
  document.querySelector('.live-indicator').classList.toggle('offline', !online);
  $('footer-status').textContent = online ? 'MONGODB / CONNECTED' : 'DATABASE / UNAVAILABLE';
}
function goToView(view) {
  state.view = view;
  document.querySelectorAll('.nav-link').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  ['overview', 'sensors', 'social'].forEach((name) => $(`${name}-view`).classList.toggle('hidden', name !== view));
  const copy = {
    overview: ['ANALYTICS WORKSPACE / 01', 'Signals, in context.', 'A clear view across physical environments and digital communities.'],
    sensors: ['PHYSICAL SYSTEMS / 02', 'Read the environment.', 'Sensor measurements, device health and location-level telemetry.'],
    social: ['DIGITAL COMMUNITIES / 03', 'Understand activity.', 'Explore content performance and the signals behind engagement.']
  }[view];
  $('page-kicker').textContent = copy[0]; $('page-title').textContent = copy[1]; $('page-description').textContent = copy[2];
  document.querySelector('.main-nav').classList.remove('open'); $('menu-toggle').setAttribute('aria-expanded', 'false');
  if (location.hash !== `#${view}`) history.replaceState(null, '', `#${view}`);
  if (view === 'sensors') loadSensors();
  if (view === 'social') loadPosts();
}

async function loadOverview() {
  try {
    const data = await api(`/overview?days=${state.days}`); state.overview = data; setConnection(true); hideNotice();
    $('metric-readings').textContent = fmt(data.sensors.readings); $('metric-devices').textContent = `${fmt(data.sensors.devices)} devices reporting`;
    $('metric-temperature').innerHTML = `${fmt(data.sensors.avgTemperature)}<small>°C</small>`;
    $('metric-engagement').textContent = shortNum(data.social.engagement); $('metric-posts').textContent = `${fmt(data.social.posts)} posts published`;
    $('metric-users').textContent = fmt(data.social.users); $('metric-events').textContent = `${fmt(data.social.activityEvents)} activity events`;
    $('chart-period-label').textContent = `Last ${state.days} days`; $('social-likes').textContent = shortNum(data.social.likes); $('social-comments').textContent = shortNum(data.social.comments); $('social-shares').textContent = shortNum(data.social.shares); $('social-activity').textContent = fmt(data.social.activityEvents);
    renderTemperatureChart(data.sensorSeries); renderPlatforms(data.platformStats); renderAlerts(data.recentAlerts); renderTopPosts(await api('/insights/top-posts?limit=5'));
  } catch (error) { setConnection(false); showNotice(`${error.message}. Start MongoDB, configure MONGODB_URI, then run the seed command.`); }
}
function renderTemperatureChart(rows) {
  const canvas = $('temperature-chart'); const empty = $('chart-empty');
  if (!rows || !rows.length) { canvas.classList.add('hidden'); empty.classList.remove('hidden'); return; }
  canvas.classList.remove('hidden'); empty.classList.add('hidden');
  const rect = canvas.getBoundingClientRect(); const width = Math.max(280, rect.width); const height = Math.max(160, rect.height); const ratio = window.devicePixelRatio || 1;
  canvas.width = width * ratio; canvas.height = height * ratio;
  const ctx = canvas.getContext('2d'); ctx.scale(ratio, ratio); ctx.clearRect(0, 0, width, height);
  const pad = { left: 32, right: 12, top: 12, bottom: 28 }; const cw = width - pad.left - pad.right; const ch = height - pad.top - pad.bottom;
  const values = rows.map(r => Number(r.temperature)); let min = Math.floor(Math.min(...values) - 2); let max = Math.ceil(Math.max(...values) + 2); if (max - min < 6) { min -= 2; max += 2; }
  ctx.font = '10px Arial, Helvetica, sans-serif'; ctx.textBaseline = 'middle';
  for (let i = 0; i < 4; i++) { const val = min + (max - min) * i / 3; const y = pad.top + ch - ch * i / 3; ctx.strokeStyle = '#e8e9e1'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(width - pad.right, y); ctx.stroke(); ctx.fillStyle = '#858a80'; ctx.textAlign = 'right'; ctx.fillText(`${val.toFixed(0)}°`, pad.left - 8, y); }
  const pts = rows.map((r, i) => ({ x: pad.left + (rows.length === 1 ? cw / 2 : cw * i / (rows.length - 1)), y: pad.top + ch - ((Number(r.temperature) - min) / (max - min)) * ch, row: r }));
  const gradient = ctx.createLinearGradient(0, pad.top, 0, height - pad.bottom); gradient.addColorStop(0, 'rgba(111,145,103,.20)'); gradient.addColorStop(1, 'rgba(111,145,103,0)');
  ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.lineTo(pts[pts.length - 1].x, pad.top + ch); ctx.lineTo(pts[0].x, pad.top + ch); ctx.closePath(); ctx.fillStyle = gradient; ctx.fill();
  ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.strokeStyle = '#6e8e67'; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
  pts.forEach((p, i) => { if (rows.length <= 14 || i % 2 === 0) { ctx.beginPath(); ctx.arc(p.x, p.y, 2.7, 0, Math.PI * 2); ctx.fillStyle = '#6e8e67'; ctx.fill(); } });
  const labelCount = Math.min(rows.length, width < 420 ? 4 : 7); ctx.fillStyle = '#858a80'; ctx.textAlign = 'center';
  for (let i = 0; i < labelCount; i++) { const idx = labelCount === 1 ? 0 : Math.round(i * (rows.length - 1) / (labelCount - 1)); const p = pts[idx]; ctx.fillText(dateFmt(rows[idx].date), p.x, height - 10); }
}
function renderPlatforms(rows) {
  const root = $('platform-list');
  if (!rows.length) { root.innerHTML = '<div class="loading-line">No platform activity in this period.</div>'; return; }
  const max = Math.max(...rows.map(r => r.engagement), 1);
  root.innerHTML = rows.map(r => `<div class="platform-row"><div class="platform-row-head"><span>${escapeHtml(r.platform)}</span><span>${fmt(r.engagement)}</span></div><div class="bar-track"><div class="bar-fill" style="width:${Math.max(1, r.engagement / max * 100)}%"></div></div></div>`).join('');
}
function statusFor(s) { return Number(s.temperature) >= 38 || Number(s.battery) <= 15 || Number(s.humidity) >= 88 ? 'Alert' : 'Normal'; }
function renderAlerts(rows) {
  $('alert-table').innerHTML = rows.length ? rows.map(r => `<tr><td class="device-id">${escapeHtml(r.deviceId)}</td><td>${escapeHtml(r.location)}</td><td class="temp-value">${Number(r.temperature).toFixed(1)} °C</td><td>${fmt(r.battery)}%</td><td><span class="status alert">${Number(r.battery) <= 15 ? 'Low battery' : Number(r.temperature) >= 38 ? 'High temp.' : 'High humidity'}</span></td></tr>`).join('') : '<tr><td colspan="5" class="empty-cell">No critical readings in this period.</td></tr>';
}
function renderTopPosts(data) {
  $('top-posts').innerHTML = data.items.length ? data.items.map((p, i) => `<div class="top-post"><span class="post-rank">${String(i + 1).padStart(2, '0')}</span><div><div><span class="post-author">@${escapeHtml(p.username)}</span><span class="post-platform">${escapeHtml(p.platform)}</span></div><p class="post-snippet">${escapeHtml(p.text)}</p></div><span class="post-engagement">${shortNum(p.engagement)} <span style="color:#858a80;font-weight:400">eng.</span></span></div>`).join('') : '<div class="loading-line">No posts found for this period.</div>';
}

async function loadSensors() {
  const params = new URLSearchParams({ page: state.sensorPage, limit: 10, location: $('location-filter').value, status: $('sensor-status-filter').value, device: $('sensor-search').value.trim() });
  try {
    const data = await api(`/sensors?${params}`); state.sensorPages = Math.max(1, data.pages); $('sensor-total').textContent = fmt(data.total);
    const locationSelect = $('location-filter'); const currentLocation = locationSelect.value;
    if (locationSelect.options.length === 1 && data.locations) { data.locations.sort().forEach(loc => { const o = document.createElement('option'); o.value = loc; o.textContent = loc; locationSelect.appendChild(o); }); locationSelect.value = currentLocation; }
    $('sensor-table').innerHTML = data.items.length ? data.items.map(s => { const status = statusFor(s); return `<tr><td class="device-id">${escapeHtml(s.deviceId)}</td><td>${escapeHtml(s.location)}</td><td class="temp-value">${Number(s.temperature).toFixed(1)} °C</td><td>${fmt(s.humidity)}%</td><td>${fmt(s.battery)}%</td><td><span class="status ${status === 'Alert' ? 'alert' : ''}">${status}</span></td><td>${dateTimeFmt(s.timestamp)}</td></tr>`; }).join('') : '<tr><td colspan="7" class="empty-cell">No readings match these filters.</td></tr>';
    $('sensor-page-info').textContent = `Page ${data.pages ? data.page : 0} of ${data.pages || 0} · ${fmt(data.total)} results`; $('sensor-prev').disabled = data.page <= 1; $('sensor-next').disabled = data.page >= data.pages;
  } catch (error) { showNotice(error.message); }
}
async function loadPosts() {
  const params = new URLSearchParams({ page: state.postPage, limit: 10, platform: $('platform-filter').value, search: $('post-search').value.trim() });
  try {
    const data = await api(`/posts?${params}`); state.postPages = Math.max(1, data.pages); $('post-total').textContent = fmt(data.total);
    const platformSelect = $('platform-filter'); const currentPlatform = platformSelect.value;
    if (platformSelect.options.length === 1 && data.platforms) { data.platforms.sort().forEach(platform => { const o = document.createElement('option'); o.value = platform; o.textContent = platform; platformSelect.appendChild(o); }); platformSelect.value = currentPlatform; }
    $('post-list').innerHTML = data.items.length ? data.items.map(p => { const initials = p.username.split(/[._]/).slice(0, 2).map(x => x[0]).join('').toUpperCase(); return `<article class="feed-post"><div class="feed-post-head"><div class="avatar">${escapeHtml(initials)}</div><div><div class="feed-author">@${escapeHtml(p.username)}</div><div class="feed-meta">${dateTimeFmt(p.createdAt)}</div></div><span class="platform-pill">${escapeHtml(p.platform)}</span></div><p>${escapeHtml(p.text)}</p><div class="feed-stats"><span><strong>${shortNum(p.likes)}</strong> likes</span><span><strong>${shortNum(p.comments)}</strong> comments</span><span><strong>${shortNum(p.shares)}</strong> shares</span></div></article>`; }).join('') : '<div class="empty-cell">No posts match these filters.</div>';
    $('post-page-info').textContent = `Page ${data.pages ? data.page : 0} of ${data.pages || 0} · ${fmt(data.total)} results`; $('post-prev').disabled = data.page <= 1; $('post-next').disabled = data.page >= data.pages;
  } catch (error) { showNotice(error.message); }
}
function debounce(fn, key) { clearTimeout(state[key]); state[key] = setTimeout(fn, 250); }

$('range-select').addEventListener('change', async (e) => { state.days = Number(e.target.value); await loadOverview(); });
$('refresh-button').addEventListener('click', async () => { $('refresh-button').disabled = true; $('refresh-button').innerHTML = '<span class="refresh-icon">↻</span> Refreshing…'; await loadOverview(); if (state.view === 'sensors') await loadSensors(); if (state.view === 'social') await loadPosts(); $('refresh-button').disabled = false; $('refresh-button').innerHTML = '<span class="refresh-icon">↻</span> Refresh data'; });
document.querySelectorAll('.nav-link').forEach(button => button.addEventListener('click', () => goToView(button.dataset.view)));
document.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => goToView(button.dataset.go)));
$('menu-toggle').addEventListener('click', () => { const nav = document.querySelector('.main-nav'); const open = nav.classList.toggle('open'); $('menu-toggle').setAttribute('aria-expanded', String(open)); });
$('sensor-search').addEventListener('input', () => debounce(() => { state.sensorPage = 1; loadSensors(); }, 'sensorTimer'));
$('location-filter').addEventListener('change', () => { state.sensorPage = 1; loadSensors(); }); $('sensor-status-filter').addEventListener('change', () => { state.sensorPage = 1; loadSensors(); });
$('sensor-prev').addEventListener('click', () => { if (state.sensorPage > 1) { state.sensorPage--; loadSensors(); } }); $('sensor-next').addEventListener('click', () => { if (state.sensorPage < state.sensorPages) { state.sensorPage++; loadSensors(); } });
$('post-search').addEventListener('input', () => debounce(() => { state.postPage = 1; loadPosts(); }, 'postTimer')); $('platform-filter').addEventListener('change', () => { state.postPage = 1; loadPosts(); });
$('post-prev').addEventListener('click', () => { if (state.postPage > 1) { state.postPage--; loadPosts(); } }); $('post-next').addEventListener('click', () => { if (state.postPage < state.postPages) { state.postPage++; loadPosts(); } });
window.addEventListener('resize', () => { if (state.overview) renderTemperatureChart(state.overview.sensorSeries); });
$('today-label').textContent = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const initialView = location.hash.replace('#', ''); goToView(['overview', 'sensors', 'social'].includes(initialView) ? initialView : 'overview');
loadOverview();
