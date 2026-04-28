const SUPABASE_URL = 'https://bchvcxkocdlrkkzivuun.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjaHZjeGtvY2Rscmtreml2dXVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyODA3NjksImV4cCI6MjA5Mjg1Njc2OX0.oyfzu_VNk9nZocRcq02JTmxdgQEi3BqclZEKgHwqF5U';

const HEADERS = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`
};

// Fetch all tithes joined with mission name
async function fetchTithes() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/tithes?select=*,missions(code,name)&order=mission_id.asc,year.asc,month.asc`,
    { headers: HEADERS }
  );
  return await res.json();
}

// Fetch all offerings joined with mission name
async function fetchOfferings() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/offerings?select=*,missions(code,name)&order=mission_id.asc,year.asc,month.asc`,
    { headers: HEADERS }
  );
  return await res.json();
}

// Fetch tithes for a specific mission code and year
async function fetchTithesByMission(missionCode, year) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/tithes?select=month,amount,budget,missions!inner(code)&missions.code=eq.${missionCode}&year=eq.${year}&order=month.asc`,
    { headers: HEADERS }
  );
  return await res.json();
}

// Fetch offerings for a specific mission code and year
async function fetchOfferingsByMission(missionCode, year) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/offerings?select=month,amount,budget,missions!inner(code)&missions.code=eq.${missionCode}&year=eq.${year}&order=month.asc`,
    { headers: HEADERS }
  );
  return await res.json();
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
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/tithes?select=year,month,amount,budget,missions!inner(code)&missions.code=eq.${code}&order=year.asc,month.asc`,
    { headers: HEADERS }
  );
  return await res.json();
}

// Fetch offerings for one mission by code, both years
async function fetchOfferingsByCode(code) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/offerings?select=year,month,amount,budget,missions!inner(code)&missions.code=eq.${code}&order=year.asc,month.asc`,
    { headers: HEADERS }
  );
  return await res.json();
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
