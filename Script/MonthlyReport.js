updateSideClock();
setInterval(updateSideClock, 1000);

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// Institution config: key matches institution_key in DB, chip = short label
const INSTITUTIONS = [
  // Missions / Conferences
  { key: 'CMM',          chip: 'CMM',           group: 0 },
  { key: 'NCMC',         chip: 'NCMC',          group: 0 },
  { key: 'NMM',          chip: 'NMM',           group: 0 },
  { key: 'WMC',          chip: 'WMC',           group: 0 },
  { key: 'ZPM',          chip: 'ZPM',           group: 0 },
  // Medical Centers
  { key: 'AMC_ILIGAN',   chip: 'AMC-ILIGAN',    group: 1 },
  { key: 'AMC_VALENCIA', chip: 'AMC-VALENCIA',  group: 1 },
  { key: 'ADV_GINGOOG',  chip: 'ADV HOSP-GINGOOG', group: 1 },
  // Educational
  { key: 'MVC',          chip: 'MVC',           group: 2 },
  { key: 'AMC_COLLEGE',  chip: 'AMC COLLEGE',   group: 2 },
  { key: 'WMAA',         chip: 'WMAA',          group: 2 },
  { key: 'MMA',          chip: 'MMA',           group: 2 },
  { key: 'MVC_ACAD',     chip: 'MVC ACAD',      group: 2 },
  { key: 'NMA',          chip: 'NMA',           group: 2 },
  { key: 'LVA',          chip: 'LVA',           group: 2 },
  { key: 'CAA',          chip: 'CAA',           group: 2 },
  // Other Institutions
  { key: 'SULADS',       chip: 'SULADS',        group: 3 },
  { key: 'LMS',          chip: 'LMS',           group: 3 },
  { key: 'HOPE_CH',      chip: 'HOPE CH.',      group: 3 },
  { key: 'SAPD',         chip: 'SAPD',          group: 3 },
  { key: 'SEPU',         chip: 'SEPU',          group: 3 },
];

// Group boundaries: how many items per group (for section-gap rows)
const GROUP_SIZES = [5, 3, 8, 5];

function fmt(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtNum(val) {
  if (val == null) return '';
  return Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function loadReport() {
  const month = MONTH_NAMES.indexOf(document.getElementById('mrMonthSelect').value) + 1;
  const year  = parseInt(document.getElementById('mrYearSelect').value);
  const label = document.getElementById('mrMonthSelect').value.toUpperCase() + ' ' + year;

  document.getElementById('mrYearLabel').textContent    = label;
  document.getElementById('mrSummaryPeriod').textContent = label;

  let rows = [];
  try { rows = await fetchMonthlyReport(year, month); } catch(e) { rows = []; }
  if (!Array.isArray(rows)) rows = [];

  // Index by institution_key
  const byKey = {};
  rows.forEach(r => { byKey[r.institution_key] = r; });

  // Build tbody rows
  const tbody = document.querySelector('.mr-table tbody');
  let html = '';
  let groupIdx = 0;
  let countInGroup = 0;

  INSTITUTIONS.forEach((inst, i) => {
    // Section gap row before each group
    if (i === 0 || inst.group !== INSTITUTIONS[i - 1].group) {
      html += `<tr class="mr-data-section-gap"><td colspan="7"></td></tr>`;
    }

    const r = byKey[inst.key];
    if (r) {
      html += `<tr class="mr-data-row">
        <td>${fmt(r.fs_date_received)}</td>
        <td>${fmtNum(r.working_capital)}</td>
        <td>${fmtNum(r.liquidity)}</td>
        <td>${fmt(r.tr_date_received)}</td>
        <td>${fmtNum(r.remittance)}</td>
        <td>${fmt(r.recon_date_received)}</td>
        <td>${r.outstanding != null ? fmtNum(r.outstanding) : ''}</td>
      </tr>`;
    } else {
      html += `<tr class="mr-data-row"><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`;
    }
  });

  tbody.innerHTML = html;

  // Update summary stats & chips
  updateSummary(byKey);
}

function updateSummary(byKey) {
  const GROUP_CHIP_IDS = [
    ['CMM','NCMC','NMM','WMC','ZPM'],
    ['AMC_ILIGAN','AMC_VALENCIA','ADV_GINGOOG'],
    ['MVC','AMC_COLLEGE','WMAA','MMA','MVC_ACAD','NMA','LVA','CAA'],
    ['SULADS','LMS','HOPE_CH','SAPD','SEPU']
  ];

  let submitted = 0, outstanding = 0;

  // Rebuild all chips
  const chipGroups = document.querySelectorAll('.mr-status-chips');
  GROUP_CHIP_IDS.forEach((keys, gi) => {
    const container = chipGroups[gi];
    if (!container) return;
    container.innerHTML = '';
    keys.forEach(key => {
      const inst = INSTITUTIONS.find(i => i.key === key);
      const r = byKey[key];
      let cls = 'pending', title = 'Pending';
      if (r) {
        const hasOutstanding = r.outstanding != null && Number(r.outstanding) !== 0;
        if (hasOutstanding) { cls = 'outstanding'; title = 'Outstanding'; outstanding++; }
        else { cls = 'submitted'; title = 'Submitted'; submitted++; }
      }
      container.innerHTML += `<span class="mr-chip ${cls}" title="${title}">${inst ? inst.chip : key}</span>`;
    });
  });

  const total   = INSTITUTIONS.length;
  const pending = total - submitted - outstanding;
  document.getElementById('mrStatSubmitted').textContent  = submitted;
  document.getElementById('mrStatPending').textContent    = Math.max(0, pending);
  document.getElementById('mrStatOutstanding').textContent = outstanding;
}

// Sync scroll between inst panel and data scroll
const instPanel  = document.getElementById('instPanel');
const dataScroll = document.getElementById('dataScroll');
instPanel.addEventListener('scroll',  () => { dataScroll.scrollTop = instPanel.scrollTop; });
dataScroll.addEventListener('scroll', () => { instPanel.scrollTop  = dataScroll.scrollTop; });

// Zoom
let mrZoomLevel = 100;
function mrZoom(dir) {
  mrZoomLevel = Math.min(200, Math.max(60, mrZoomLevel + dir * 10));
  const inner = document.getElementById('mrSplit');
  const scale = mrZoomLevel / 100;
  inner.style.transformOrigin = 'top left';
  inner.style.transform = `scale(${scale})`;
  inner.style.width  = (100 / scale) + '%';
  inner.style.height = (100 / scale) + '%';
  document.getElementById('mrZoomLabel').textContent = mrZoomLevel + '%';
}

// Init: set current month and load
const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });
document.getElementById('mrMonthSelect').value = currentMonth;
loadReport();
