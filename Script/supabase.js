// ─── DATABASE: tithes, offerings, financial data ──────────────────────────────
const SUPABASE_URL = 'https://bchvcxkocdlrkkzivuun.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjaHZjeGtvY2Rscmtreml2dXVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyODA3NjksImV4cCI6MjA5Mjg1Njc2OX0.oyfzu_VNk9nZocRcq02JTmxdgQEi3BqclZEKgHwqF5U';

// ─── DATABASE: users (login / settings) ───────────────────────────────────────
const USERS_URL = 'https://fczudbtgtpkxteppckwb.supabase.co';
const USERS_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjenVkYnRndHBreHRlcHBja3diIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NzczMzEsImV4cCI6MjA5MzU1MzMzMX0.AZKGqLFVB-VpBsDrg0ekOzX755t5kLfgWZPEJ92ELeU';

const HEADERS = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`
};

const USERS_HEADERS = {
  'apikey': USERS_KEY,
  'Authorization': `Bearer ${USERS_KEY}`
};

// ─── IDEMPOTENCY ──────────────────────────────────────────────────────────────
function generateIdempotencyKey(method, url, body) {
  const raw = `${method}:${url}:${body ?? ''}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (Math.imul(31, hash) + raw.charCodeAt(i)) | 0;
  }
  return `${Math.abs(hash).toString(16)}-${Date.now()}`;
}

const _inflight = new Map();

async function supabaseRequest(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const isWrite = method !== 'GET' && method !== 'HEAD';
  const idempotencyKey = generateIdempotencyKey(method, url, options.body);

  const headers = {
    ...HEADERS,
    'Content-Type': 'application/json',
    ...(options.headers || {}),
    ...(isWrite ? { 'Idempotency-Key': idempotencyKey } : {})
  };

  if (!isWrite) {
    if (_inflight.has(url)) return _inflight.get(url);
    const promise = fetch(url, { ...options, headers })
      .then(r => r.json())
      .finally(() => _inflight.delete(url));
    _inflight.set(url, promise);
    return promise;
  }

  const res = await fetch(url, { ...options, headers });
  return res.json();
}

// ─── TITHES & OFFERINGS ───────────────────────────────────────────────────────
async function fetchTithes() {
  return supabaseRequest(
    `${SUPABASE_URL}/rest/v1/tithes?status=eq.confirmed&select=year,month,amount,budget,churches!inner(districts!inner(missions!inner(code,name)))&order=year.asc,month.asc`
  );
}

async function fetchOfferings() {
  return supabaseRequest(
    `${SUPABASE_URL}/rest/v1/offerings?status=eq.confirmed&select=year,month,amount,budget,churches!inner(districts!inner(missions!inner(code,name)))&order=year.asc,month.asc`
  );
}

async function fetchTithesByMission(missionCode, year) {
  return supabaseRequest(
    `${SUPABASE_URL}/rest/v1/tithes?status=eq.confirmed&select=month,amount,budget,churches!inner(districts!inner(missions!inner(code)))&churches.districts.missions.code=eq.${missionCode}&year=eq.${year}&order=month.asc`
  );
}

async function fetchOfferingsByMission(missionCode, year) {
  return supabaseRequest(
    `${SUPABASE_URL}/rest/v1/offerings?status=eq.confirmed&select=month,amount,budget,churches!inner(districts!inner(missions!inner(code)))&churches.districts.missions.code=eq.${missionCode}&year=eq.${year}&order=month.asc`
  );
}

async function fetchTithesByCode(code) {
  return supabaseRequest(
    `${SUPABASE_URL}/rest/v1/tithes?status=eq.confirmed&select=year,month,amount,budget,churches!inner(districts!inner(missions!inner(code)))&churches.districts.missions.code=eq.${code}&order=year.asc,month.asc`
  );
}

async function fetchOfferingsByCode(code) {
  return supabaseRequest(
    `${SUPABASE_URL}/rest/v1/offerings?status=eq.confirmed&select=year,month,amount,budget,churches!inner(districts!inner(missions!inner(code)))&churches.districts.missions.code=eq.${code}&order=year.asc,month.asc`
  );
}

// ─── ARRAY HELPERS ────────────────────────────────────────────────────────────
function buildMonthArray(rows) {
  const arr = new Array(12).fill(null);
  rows.forEach(r => {
    const i = r.month - 1;
    if (r.amount != null) arr[i] = (arr[i] || 0) + r.amount;
  });
  return arr;
}

function buildBudgetArray(rows) {
  const arr = new Array(12).fill(null);
  rows.forEach(r => { arr[r.month - 1] = r.budget; });
  return arr;
}

function groupByMission(rows) {
  const result = {};
  rows.forEach(r => {
    const code = r.churches?.districts?.missions?.code;
    if (!code) return;
    if (!result[code]) result[code] = {};
    if (!result[code][r.year]) result[code][r.year] = [];
    result[code][r.year].push(r);
  });
  return result;
}

function buildSpucTotal(grouped, year, field = 'amount') {
  const total = new Array(12).fill(null);
  Object.values(grouped).forEach(missionYears => {
    const rows = missionYears[year] || [];
    rows.forEach(r => {
      const i = r.month - 1;
      if (r[field] != null) total[i] = (total[i] || 0) + r[field];
    });
  });
  return total;
}

function splitYears(rows) {
  const y2025 = new Array(12).fill(null);
  const y2026 = new Array(12).fill(null);
  const budget = new Array(12).fill(null);
  rows.forEach(r => {
    const i = r.month - 1;
    if (r.year === 2025 && r.amount != null) y2025[i] = (y2025[i] || 0) + r.amount;
    if (r.year === 2026 && r.amount != null) y2026[i] = (y2026[i] || 0) + r.amount;
    if (r.budget != null) budget[i] = (budget[i] || 0) + r.budget;
  });
  return { y2025, y2026, budget };
}

function onLayoutReady(cb) {
  if (document.readyState === 'complete') {
    requestAnimationFrame(() => requestAnimationFrame(cb));
  } else {
    window.addEventListener('load', () => requestAnimationFrame(() => requestAnimationFrame(cb)));
  }
}

// ─── BALANCE SHEET ────────────────────────────────────────────────────────────
async function fetchBalanceSheet(year, month) {
  return supabaseRequest(
    `${SUPABASE_URL}/rest/v1/balance_sheet?year=eq.${year}&month=eq.${month}&limit=1`
  );
}

async function fetchBalanceSheetNoteCash(year, month) {
  return supabaseRequest(
    `${SUPABASE_URL}/rest/v1/balance_sheet_note_cash?year=eq.${year}&month=eq.${month}&order=sort_order.asc`
  );
}

async function fetchBalanceSheetNoteAr(year, month) {
  return supabaseRequest(
    `${SUPABASE_URL}/rest/v1/balance_sheet_note_ar?year=eq.${year}&month=eq.${month}&order=sort_order.asc`
  );
}

async function fetchBalanceSheetNoteArEntities(year, month) {
  return supabaseRequest(
    `${SUPABASE_URL}/rest/v1/balance_sheet_note_ar_sda?year=eq.${year}&month=eq.${month}&order=sort_order.asc`
  );
}

async function fetchBalanceSheetNoteAp(year, month) {
  return supabaseRequest(
    `${SUPABASE_URL}/rest/v1/balance_sheet_note_ap?year=eq.${year}&month=eq.${month}&order=sort_order.asc`
  );
}

async function fetchBalanceSheetNoteApEntities(year, month) {
  return supabaseRequest(
    `${SUPABASE_URL}/rest/v1/balance_sheet_note_ap_sda?year=eq.${year}&month=eq.${month}&order=sort_order.asc`
  );
}

// ─── INCOME STATEMENT ─────────────────────────────────────────────────────────
async function fetchIncomeStatementLines(reportYear, reportMonth) {
  return supabaseRequest(
    `${SUPABASE_URL}/rest/v1/income_statement_lines?report_year=eq.${reportYear}&report_month=eq.${reportMonth}&order=sort_order.asc`
  );
}

async function fetchIncomeStatementBudgets(reportYear, reportMonth) {
  return supabaseRequest(
    `${SUPABASE_URL}/rest/v1/income_statement_budgets?select=budget_year,budget_amount,income_statement_lines!inner(line_key,report_year,report_month)&income_statement_lines.report_year=eq.${reportYear}&income_statement_lines.report_month=eq.${reportMonth}`
  );
}

// ─── FINANCIAL INDICATOR ──────────────────────────────────────────────────────
async function fetchFinancialIndicator(reportYear, reportMonth) {
  return supabaseRequest(
    `${SUPABASE_URL}/rest/v1/financial_indicator?report_year=eq.${reportYear}&report_month=eq.${reportMonth}&limit=1`
  );
}

// ─── MONTHLY REPORT ───────────────────────────────────────────────────────────
async function fetchMonthlyReport(year, month) {
  return supabaseRequest(
    `${SUPABASE_URL}/rest/v1/monthly_report?year=eq.${year}&month=eq.${month}&order=sort_order.asc`
  );
}

// ─── UNION USERS (auth + profile) — uses USERS DB ────────────────────────────
const _usersInflight = new Map();

async function usersRequest(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = { ...USERS_HEADERS, 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (method === 'GET') {
    if (_usersInflight.has(url)) return _usersInflight.get(url);
    const p = fetch(url, { ...options, headers }).then(r => r.json()).finally(() => _usersInflight.delete(url));
    _usersInflight.set(url, p);
    return p;
  }
  return fetch(url, { ...options, headers }).then(r => r.json());
}

async function loginUser(username, password) {
  const data = await usersRequest(
    `${USERS_URL}/rest/v1/union_users?username=eq.${encodeURIComponent(username)}&password_hash=eq.${encodeURIComponent(password)}&is_active=eq.true&select=id,username,full_name,email,phone,two_fa_enabled,totp_secret&limit=1`
  );
  return Array.isArray(data) && data.length ? data[0] : null;
}

async function fetchCurrentUser(id) {
  const data = await usersRequest(
    `${USERS_URL}/rest/v1/union_users?id=eq.${id}&select=id,username,full_name,email,phone,two_fa_enabled,totp_secret&limit=1`
  );
  return Array.isArray(data) && data.length ? data[0] : null;
}

async function updateTwoFa(id, fields) {
  return usersRequest(
    `${USERS_URL}/rest/v1/union_users?id=eq.${id}`,
    { method: 'PATCH', headers: { 'Prefer': 'return=representation' }, body: JSON.stringify(fields) }
  );
}

// ─── CROSS-TAB LOGOUT ────────────────────────────────────────────────────────
window.addEventListener('storage', e => {
  if (e.key !== 'spuc_logout') return;
  sessionStorage.clear();
  const path = location.pathname;
  const isIndex = path.endsWith('index.html') || path.endsWith('/');
  if (isIndex) return;
  const depth = (path.match(/\/Pages\/[^/]+\//) ? '../../' : '../');
  location.href = depth + 'index.html';
});

async function updateUserProfile(id, fields) {
  return usersRequest(
    `${USERS_URL}/rest/v1/union_users?id=eq.${id}`,
    {
      method: 'PATCH',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(fields)
    }
  );
}
