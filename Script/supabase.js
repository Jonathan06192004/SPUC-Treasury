const SUPABASE_URL = 'https://bchvcxkocdlrkkzivuun.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjaHZjeGtvY2Rscmtreml2dXVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyODA3NjksImV4cCI6MjA5Mjg1Njc2OX0.oyfzu_VNk9nZocRcq02JTmxdgQEi3BqclZEKgHwqF5U';

const HEADERS = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`
};

// ─── IDEMPOTENCY ──────────────────────────────────────────────────────────────
// Generates a unique key per logical operation (method + url + body hash).
function generateIdempotencyKey(method, url, body) {
  const raw = `${method}:${url}:${body ?? ''}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (Math.imul(31, hash) + raw.charCodeAt(i)) | 0;
  }
  return `${Math.abs(hash).toString(16)}-${Date.now()}`;
}

// In-flight GET request cache — deduplicates concurrent identical fetches.
const _inflight = new Map();

// Central fetch wrapper. Attaches Idempotency-Key for writes; deduplicates GETs.
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

  // For GET requests, reuse an in-flight promise for the same URL.
  if (!isWrite) {
    if (_inflight.has(url)) return _inflight.get(url);
    const promise = fetch(url, { ...options, headers })
      .then(r => r.json())
      .finally(() => _inflight.delete(url));
    _inflight.set(url, promise);
    return promise;
  }

  // For writes, always send a fresh request with the idempotency key.
  const res = await fetch(url, { ...options, headers });
  return res.json();
}

// Fetch all tithes joined with mission name
async function fetchTithes() {
  return supabaseRequest(
    `${SUPABASE_URL}/rest/v1/tithes?select=*,missions(code,name)&order=mission_id.asc,year.asc,month.asc`
  );
}

// Fetch all offerings joined with mission name
async function fetchOfferings() {
  return supabaseRequest(
    `${SUPABASE_URL}/rest/v1/offerings?select=*,missions(code,name)&order=mission_id.asc,year.asc,month.asc`
  );
}

// Fetch tithes for a specific mission code and year
async function fetchTithesByMission(missionCode, year) {
  return supabaseRequest(
    `${SUPABASE_URL}/rest/v1/tithes?select=month,amount,budget,missions!inner(code)&missions.code=eq.${missionCode}&year=eq.${year}&order=month.asc`
  );
}

// Fetch offerings for a specific mission code and year
async function fetchOfferingsByMission(missionCode, year) {
  return supabaseRequest(
    `${SUPABASE_URL}/rest/v1/offerings?select=month,amount,budget,missions!inner(code)&missions.code=eq.${missionCode}&year=eq.${year}&order=month.asc`
  );
}

// Build a 12-element array from DB rows (null for missing months)
function buildMonthArray(rows) {
  const arr = new Array(12).fill(null);
  rows.forEach(r => { arr[r.month - 1] = r.amount; });
  return arr;
}

// Build budget array (same value repeated, or per-month)
function buildBudgetArray(rows) {
  const arr = new Array(12).fill(null);
  rows.forEach(r => { arr[r.month - 1] = r.budget; });
  return arr;
}

// Group rows by mission code → { NCMC: {2025:[...], 2026:[...]}, ... }
function groupByMission(rows) {
  const result = {};
  rows.forEach(r => {
    const code = r.missions.code;
    if (!result[code]) result[code] = {};
    if (!result[code][r.year]) result[code][r.year] = [];
    result[code][r.year].push(r);
  });
  return result;
}

// Build SPUC total array by summing all 5 missions per month
function buildSpucTotal(grouped, year) {
  const total = new Array(12).fill(null);
  Object.values(grouped).forEach(missionYears => {
    const rows = missionYears[year] || [];
    rows.forEach(r => {
      const i = r.month - 1;
      if (r.amount != null) total[i] = (total[i] || 0) + r.amount;
    });
  });
  return total;
}

// Fetch tithes for one mission by code, both years
async function fetchTithesByCode(code) {
  return supabaseRequest(
    `${SUPABASE_URL}/rest/v1/tithes?select=year,month,amount,budget,missions!inner(code)&missions.code=eq.${code}&order=year.asc,month.asc`
  );
}

// Fetch offerings for one mission by code, both years
async function fetchOfferingsByCode(code) {
  return supabaseRequest(
    `${SUPABASE_URL}/rest/v1/offerings?select=year,month,amount,budget,missions!inner(code)&missions.code=eq.${code}&order=year.asc,month.asc`
  );
}

// Split rows into {2025:[12], 2026:[12]} month arrays
function splitYears(rows) {
  const y2025 = new Array(12).fill(null);
  const y2026 = new Array(12).fill(null);
  const budget = new Array(12).fill(null);
  rows.forEach(r => {
    if (r.year === 2025) y2025[r.month - 1] = r.amount;
    if (r.year === 2026) y2026[r.month - 1] = r.amount;
    if (r.budget != null) budget[r.month - 1] = r.budget;
  });
  return { y2025, y2026, budget };
}

// Wait for DOM layout then run callback
function onLayoutReady(cb) {
  if (document.readyState === 'complete') {
    requestAnimationFrame(() => requestAnimationFrame(cb));
  } else {
    window.addEventListener('load', () => requestAnimationFrame(() => requestAnimationFrame(cb)));
  }
}
