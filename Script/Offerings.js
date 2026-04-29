const VISIBLE_MONTHS = 4;
const labels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MISSION_ORDER = ['NCMC','CMM','NMM','WMC','ZPM'];
const CURR_YEAR = new Date().getFullYear();
const PREV_YEAR = CURR_YEAR - 1;

// Set dynamic year headers
document.addEventListener('DOMContentLoaded', () => {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('thPrevYear', PREV_YEAR); set('thCurrYear', CURR_YEAR);
  set('modalThPrevYear', PREV_YEAR); set('modalThCurrYear', CURR_YEAR);
});

const fmt = v => v != null ? v.toLocaleString('en-US', {minimumFractionDigits:2,maximumFractionDigits:2}) : '-';
const fmtVariance = (v25, v26) => {
  if (v25 == null || v26 == null) return '<td class="cell-variance">-</td>';
  const diff = v26 - v25;
  const pct = ((diff / v25) * 100).toFixed(1);
  const cls = diff >= 0 ? 'variance-pos' : 'variance-neg';
  const arrow = diff >= 0 ? '▲' : '▼';
  return `<td class="cell-variance ${cls}">${arrow} ${fmt(Math.abs(diff))}<span class="variance-pct">${arrow} ${Math.abs(pct)}%</span></td>`;
};

let mainChart = null;

function renderPage(data2025, data2026, budgetData, missionData, missionData2026) {
  const t25 = data2025.reduce((a,b)=>a+(b||0),0);
  const t26 = data2026.reduce((a,b)=>a+(b||0),0);
  const tBgt = budgetData.reduce((a,b)=>a+(b||0),0);
  const tDiff = t26 - t25, tPct = ((tDiff/t25)*100).toFixed(1);
  const tCls = tDiff >= 0 ? 'variance-pos' : 'variance-neg';
  const tArrow = tDiff >= 0 ? '▲' : '▼';
  document.getElementById('excelBody').innerHTML =
    labels.map((m,i) => `<tr><td class="month-cell">${m}</td><td class="cell-2025">${fmt(data2025[i])}</td><td class="cell-2026">${fmt(data2026[i])}</td><td class="cell-budget">${fmt(budgetData[i])}</td>${fmtVariance(data2025[i],data2026[i])}</tr>`).join('') +
    `<tr class="total-row"><td class="month-cell">Total</td><td class="total-cell">${fmt(t25)}</td><td class="total-cell">${fmt(t26)}</td><td class="total-cell">${fmt(tBgt)}</td><td class="total-cell ${tCls}">${tArrow} ${fmt(Math.abs(tDiff))}<span class="variance-pct">${tArrow} ${Math.abs(tPct)}%</span></td></tr>`;

  const canvas = document.getElementById('offeringChart');
  const parent = canvas.parentElement;
  const barW = parent.clientWidth / VISIBLE_MONTHS;
  const parentH = parent.clientHeight || parent.offsetHeight || 400;
  canvas.style.width    = (barW * labels.length) + 'px';
  canvas.style.minWidth = (barW * labels.length) + 'px';
  canvas.style.height   = parentH + 'px';

  const datasets = [
    { label:'2025',   data:data2025,   backgroundColor:'#0a1e6e', borderRadius:4 },
    { label:'2026',   data:data2026,   backgroundColor:'#f59e0b', borderRadius:4 },
    { label:'Budget', data:budgetData, backgroundColor:'#6d43ea', borderRadius:4 }
  ];

  if (mainChart) mainChart.destroy();
  mainChart = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: false, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ₱${ctx.parsed.y.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}` } }
      },
      scales: {
        y: { beginAtZero:true, ticks:{ callback: v => v>=1e6?'₱'+(v/1e6).toFixed(1)+'M':'₱'+v, font:{weight:'700',size:11}, color:'#fff' }, grid:{color:'rgba(255,255,255,0.5)',lineWidth:2} },
        x: { grid:{display:false}, ticks:{font:{weight:'700',size:11},color:'#fff'} }
      }
    }
  });

  const legendEl = document.getElementById('chartLegend');
  legendEl.innerHTML = '';
  datasets.forEach((ds,i) => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `<span class="legend-paren">(</span><span class="legend-dot" style="background:${ds.backgroundColor}"></span><span class="legend-paren">)</span><span class="legend-label">${ds.label}</span>`;
    item.addEventListener('click', () => { const m = mainChart.getDatasetMeta(i); m.hidden = !m.hidden; item.classList.toggle('legend-hidden'); mainChart.update(); });
    legendEl.appendChild(item);
  });

  initViewAllMonths({ canvasId:'offeringChart', datasets, missionData, missionData2026, labels, VISIBLE_MONTHS });
}

fetchOfferings().then(rows => {
  const grouped         = groupByMission(rows);
  const data2025        = buildSpucTotal(grouped, 2025);
  const data2026        = buildSpucTotal(grouped, 2026);
  const budgetData      = buildSpucTotal(grouped, 2026, 'budget');
  const missionData     = MISSION_ORDER.map(c => buildMonthArray((grouped[c]&&grouped[c][2025])||[]));
  const missionData2026 = MISSION_ORDER.map(c => buildMonthArray((grouped[c]&&grouped[c][2026])||[]));

  const scrollEl = document.querySelector('.chart-scroll');
  const ro = new ResizeObserver(entries => {
    const h = entries[0].contentRect.height;
    if (h > 10) {
      ro.disconnect();
      renderPage(data2025, data2026, budgetData, missionData, missionData2026);
    }
  });
  ro.observe(scrollEl);
}).catch(err => console.error('Supabase fetch error:', err));

updateSideClock();
setInterval(updateSideClock, 1000);

function openTableModal() {
  document.getElementById('modalTableBody').innerHTML = document.getElementById('excelBody').innerHTML;
  document.getElementById('tableModalOverlay').classList.remove('hidden');
  const modal = document.getElementById('tableModal');
  modal.classList.remove('hidden');
  modal.style.animation = 'tableModalIn 0.35s cubic-bezier(0.4,0,0.2,1) forwards';
}
function closeTableModal() {
  const modal = document.getElementById('tableModal');
  modal.style.animation = 'tableModalOut 0.25s ease forwards';
  setTimeout(() => { modal.classList.add('hidden'); document.getElementById('tableModalOverlay').classList.add('hidden'); }, 250);
}
