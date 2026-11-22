const API = '';
let token = localStorage.getItem('pam_token');
let charts = {};

function authHeaders() { return token ? { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }; }

async function api(path, opts = {}) {
  const r = await fetch(path, { ...opts, headers: { ...authHeaders(), ...(opts.headers || {}) } });
  if (r.status === 401) { logout(); throw new Error('unauth'); }
  return r;
}

function logout() {
  localStorage.removeItem('pam_token');
  token = null;
  document.getElementById('dashView').classList.add('hidden');
  document.getElementById('loginView').classList.remove('hidden');
}

// Login
const loginBtn = document.getElementById('loginBtn');
if (loginBtn) loginBtn.addEventListener('click', async () => {
  const u = document.getElementById('loginUser').value.trim();
  const p = document.getElementById('loginPass').value;
  const msg = document.getElementById('loginMsg');
  msg.textContent = '';
  try {
    const r = await fetch('/api/auth/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ username: u, password: p }) });
    const data = await r.json();
    if (!r.ok) throw new Error(data.detail || 'Error');
    token = data.access_token;
    localStorage.setItem('pam_token', token);
    showDash();
  } catch (e) {
    msg.textContent = e.message || 'Credenciales incorrectas';
  }
});

async function showDash() {
  try {
    const r = await api('/api/admin/me');
    if (!r.ok) throw new Error('unauth');
  } catch { logout(); return; }
  document.getElementById('loginView').classList.add('hidden');
  document.getElementById('dashView').classList.remove('hidden');
  await loadDashboard();
  await loadIntegrations();
}

// Navigation sections
document.querySelectorAll('.admin-nav button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.admin-nav button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const sec = btn.dataset.sec;
    ['overview','charts','sales','integrations','chat'].forEach(s => {
      const el = document.getElementById('sec-' + s);
      if (el) el.classList.toggle('hidden', s !== sec);
    });
    const titles = { overview:'Resumen ejecutivo', charts:'Gráficas', sales:'Detalle de ventas', integrations:'Integraciones', chat:'Agente financiero' };
    document.getElementById('pageTitle').textContent = titles[sec] || '';
  });
});

// State
let currentFilters = {};

function getFilters() {
  return {
    start: document.getElementById('fStart').value || null,
    end: document.getElementById('fEnd').value || null,
    categoria: document.getElementById('fCat').value || 'Todos',
    producto: document.getElementById('fProd').value || 'Todos',
    canal: document.getElementById('fCanal').value || 'Todos',
  };
}

async function loadDashboard() {
  const f = getFilters();
  const qs = new URLSearchParams();
  if (f.start) qs.set('start', f.start);
  if (f.end) qs.set('end', f.end);
  qs.set('categoria', f.categoria);
  qs.set('producto', f.producto);
  qs.set('canal', f.canal);
  const r = await api('/api/admin/dashboard?' + qs.toString());
  const data = await r.json();
  currentFilters = f;
  renderKPIs(data.kpis);
  renderFilters(data.filters);
  renderCharts(data);
  renderTable(data.table, data.total_rows);
}

function renderKPIs(k) {
  const grid = document.getElementById('kpiGrid');
  const items = [
    { label: 'Ventas totales', value: money(k.ventas_total), delta: `Crecimiento ${k.crecimiento}%` },
    { label: 'Costos', value: money(k.costos), delta: `Margen ${k.margen}%` },
    { label: 'Utilidad bruta', value: money(k.utilidad), delta: `Cumpl. ${k.cumplimiento_utilidad}%` },
    { label: 'Pedidos', value: k.pedidos, delta: `Ticket ${money(k.ticket_promedio)}` },
    { label: 'Unidades', value: k.unidades, delta: `Meta ventas ${money(k.meta_ventas_total)}` },
    { label: 'Margen bruto', value: k.margen + '%', delta: `Cumpl. ventas ${k.cumplimiento_ventas}%` },
    { label: 'Ticket promedio', value: money(k.ticket_promedio), delta: 'Por pedido' },
    { label: 'Cumpl. pedidos', value: k.cumplimiento_pedidos + '%', delta: `Meta ${k.meta_pedidos_total}` },
  ];
  grid.innerHTML = items.map(i => `<div class="kpi"><div class="label">${i.label}</div><div class="value">${i.value}</div><div class="delta">${i.delta}</div></div>`).join('');
}

function money(x) { return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(x); }

function renderFilters(f) {
  const fill = (id, arr) => {
    const sel = document.getElementById(id);
    const cur = sel.value;
    sel.innerHTML = '<option>Todos</option>' + arr.map(v => `<option>${v}</option>`).join('');
    if (arr.includes(cur)) sel.value = cur;
  };
  fill('fCat', f.categorias || []);
  fill('fProd', f.productos || []);
  fill('fCanal', f.canales || []);
  if (f.fecha_min) document.getElementById('fStart').placeholder = f.fecha_min;
  if (f.fecha_max) document.getElementById('fEnd').placeholder = f.fecha_max;
}

function renderCharts(data) {
  // Trend
  const labels = data.evolution.map(e => e.label);
  makeChart('chartTrend', 'bar', labels, [
    { label: 'Ventas', data: data.evolution.map(e => e.ventas), backgroundColor: '#0A1F3D' },
    { label: 'Costos', data: data.evolution.map(e => e.costos), backgroundColor: '#005C73' },
    { label: 'Utilidad', data: data.evolution.map(e => e.utilidad), backgroundColor: '#FAB200' },
  ]);
  // Category (pie)
  makeChart('chartCategory', 'doughnut', data.by_category.map(c => c.categoria), [{
    data: data.by_category.map(c => c.ventas),
    backgroundColor: ['#0A1F3D','#005C73','#FAB200','#5B6B82','#1E7A3A','#A61B1B','#8A5A00','#333'],
  }]);
  // Top products
  makeChart('chartTop', 'bar', data.top_products.map(p => p.producto), [{
    label: 'Ventas', data: data.top_products.map(p => p.ventas), backgroundColor: '#005C73',
  }], true);
  // Goals
  makeChart('chartGoals', 'bar', data.metas_vs.map(m => m.mes), [
    { label: 'Real', data: data.metas_vs.map(m => m.actual), backgroundColor: '#0A1F3D' },
    { label: 'Meta', data: data.metas_vs.map(m => m.meta), backgroundColor: '#FAB200' },
  ]);
  // Income vs cost
  makeChart('chartIncome', 'line', data.evolution.map(e => e.label), [
    { label: 'Ventas', data: data.evolution.map(e => e.ventas), borderColor: '#0A1F3D', fill: false, tension: .3 },
    { label: 'Costos', data: data.evolution.map(e => e.costos), borderColor: '#005C73', fill: false, tension: .3 },
  ]);
  // Margin
  makeChart('chartMargin', 'line', data.evolution.map(e => e.label), [
    { label: 'Margen %', data: data.evolution.map(e => (e.ventas ? (e.utilidad/e.ventas*100) : 0)), borderColor: '#FAB200', fill: false, tension: .3 },
  ]);
}

function makeChart(id, type, labels, datasets, horizontal = false) {
  const ctx = document.getElementById(id);
  if (!ctx) return;
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(ctx, {
    type,
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      indexAxis: horizontal ? 'y' : 'x',
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } },
      scales: type === 'doughnut' || type === 'pie' ? {} : { y: { beginAtZero: true } },
    }
  });
}

function renderTable(rows, total) {
  const tbody = document.querySelector('#salesTable tbody');
  tbody.innerHTML = rows.map(r => `<tr>
    <td>${r.fecha}</td><td>${r.pedido}</td><td>${r.producto}</td><td>${r.categoria}</td>
    <td>${r.cantidad}</td><td>${money(r.precio)}</td><td>${money(r.costo)}</td><td>${r.canal}</td>
    <td>${r.pago}</td><td>${money(r.total)}</td><td>${money(r.utilidad)}</td>
  </tr>`).join('');
  document.getElementById('tableCount').textContent = `${rows.length} de ${total} registros`;
}

async function loadIntegrations() {
  const r = await api('/api/admin/integrations');
  const data = await r.json();
  const grid = document.getElementById('intGrid');
  const items = [
    ['n8n (público)', data.n8n_public_configured],
    ['n8n (admin)', data.n8n_admin_configured],
    ['API key n8n', data.n8n_api_key_configured],
    ['Google Drive', data.google_drive_configured],
    ['Gmail', data.gmail_configured],
    ['National Soft', data.national_soft_configured],
    ['CFDI/SAT', data.cfdi_configured],
    ['Banca', data.banking_configured],
  ];
  grid.innerHTML = items.map(([name, ok]) => `<div class="int-item"><span>${name}</span><span class="badge ${ok ? 'badge--ok' : 'badge--warn'}">${ok ? 'Conectado' : 'Pendiente'}</span></div>`).join('');
}

// Filters / refresh / export
document.getElementById('applyFilters').addEventListener('click', loadDashboard);
document.getElementById('refreshBtn').addEventListener('click', loadDashboard);
document.getElementById('exportBtn').addEventListener('click', async () => {
  const f = getFilters();
  const qs = new URLSearchParams();
  if (f.start) qs.set('start', f.start);
  if (f.end) qs.set('end', f.end);
  qs.set('categoria', f.categoria);
  qs.set('producto', f.producto);
  qs.set('canal', f.canal);
  try {
    const r = await api('/api/admin/export/csv?' + qs.toString());
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'PuertoAM_Admin_Reporte.csv';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  } catch { alert('No se pudo exportar'); }
});
document.getElementById('logoutBtn').addEventListener('click', logout);

// Agent chat
const agentBody = document.getElementById('agentBody');
const agentInput = document.getElementById('agentInput');
const agentSend = document.getElementById('agentSend');

function addAgentMsg(text, who) {
  const wrap = document.createElement('div');
  wrap.className = 'chat-msg ' + who;
  const b = document.createElement('div');
  b.className = 'chat-bubble';
  b.textContent = text;
  wrap.appendChild(b);
  agentBody.appendChild(wrap);
  agentBody.scrollTop = agentBody.scrollHeight;
}
async function sendAgent() {
  const text = agentInput.value.trim();
  if (!text) return;
  agentInput.value = '';
  addAgentMsg(text, 'user');
  // typing
  const t = document.createElement('div');
  t.className = 'chat-msg bot'; t.id = 'agentTyping';
  t.innerHTML = '<div class="chat-bubble"><div class="chat-typing"><span></span><span></span><span></span></div></div>';
  agentBody.appendChild(t); agentBody.scrollTop = agentBody.scrollHeight;
  try {
    const r = await api('/api/admin/chat', { method: 'POST', body: JSON.stringify({ message: text }) });
    const data = await r.json();
    const tp = document.getElementById('agentTyping'); if (tp) tp.remove();
    addAgentMsg((data.reply || 'Sin respuesta.') + (data.source === 'n8n' ? '' : ''), 'bot');
  } catch {
    const tp = document.getElementById('agentTyping'); if (tp) tp.remove();
    addAgentMsg('Error de conexión.', 'bot');
  }
}
if (agentSend) agentSend.addEventListener('click', sendAgent);
if (agentInput) agentInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendAgent(); });
document.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => { agentInput.value = b.dataset.q; sendAgent(); }));

// Boot
if (token) showDash(); else {
  document.getElementById('loginView').classList.remove('hidden');
}
