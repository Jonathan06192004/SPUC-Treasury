// ─── SIDE CLOCK ───────────────────────────────────────────────────────────────
function updateSideClock() {
  const now = new Date();
  const date = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  let hours = now.getHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const hh = String(hours).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  document.getElementById('sideClock').innerHTML =
    `<div class="side-clock-time">${hh}:${mm}:${ss} <span class="side-clock-ampm">${ampm}</span></div>
     <div class="side-clock-date">${date}</div>`;
}

// ─── FOOTER NAV ───────────────────────────────────────────────────────────────
function toggleFooterNav() {
  const wrap = document.getElementById('footerNavWrap');
  const btn  = document.getElementById('hamburgerBtn');
  const isHidden = wrap.classList.contains('hidden');
  const items = wrap.querySelectorAll('.btn-home, .footer-divider, .btn-page');
  if (isHidden) {
    wrap.classList.remove('hidden');
    btn.classList.remove('active');
    items.forEach((el, i) => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(-20px)';
      setTimeout(() => {
        el.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
        el.style.opacity = '1';
        el.style.transform = 'translateX(0)';
      }, i * 80);
    });
  } else {
    btn.classList.add('active');
    const reversed = Array.from(items).reverse();
    reversed.forEach((el, i) => {
      setTimeout(() => {
        el.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
        el.style.opacity = '0';
        el.style.transform = 'translateX(-20px)';
      }, i * 60);
    });
    setTimeout(() => wrap.classList.add('hidden'), reversed.length * 60 + 200);
  }
}

// ─── MONTH FILTER DROPDOWN ────────────────────────────────────────────────────
function toggleMonthDropdown() {
  document.getElementById('monthFilterDropdown').classList.toggle('hidden');
}

// ─── CHART EXPAND / COLLAPSE ──────────────────────────────────────────────────
function expandChart(wrapId, charts) {
  if (window._expandedWrap === wrapId) { collapseChart(charts); return; }
  window._expandedWrap = wrapId;
  document.querySelectorAll('.overview-chart-wrap').forEach(w => {
    if (w.id === wrapId) {
      w.classList.add('chart-expanded');
      w.classList.remove('chart-shrunk');
      w.querySelector('.chart-close-btn').classList.add('visible');
    } else {
      w.classList.add('chart-shrunk');
      w.classList.remove('chart-expanded');
      w.querySelector('.chart-close-btn').classList.remove('visible');
    }
  });
  setTimeout(() => charts.forEach(c => c && c.resize()), 380);
}

function collapseChart(charts) {
  window._expandedWrap = null;
  document.querySelectorAll('.overview-chart-wrap').forEach(w => {
    w.classList.remove('chart-expanded', 'chart-shrunk');
    w.querySelector('.chart-close-btn').classList.remove('visible');
  });
  setTimeout(() => charts.forEach(c => c && c.resize()), 380);
}

// ─── MISSION PAGE INITIALIZER (used by all 10 Tithe/Offering mission pages) ───
// config = { canvasId, labelHeader, data2025, data2026, dataTarget }
function initMissionPage(config) {
  const VISIBLE_MONTHS = 4;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const { canvasId, data2025, data2026, dataTarget } = config;

  // ── Main scrollable bar chart ──
  const canvas = document.getElementById(canvasId);
  const barWidth = canvas.parentElement.clientWidth / VISIBLE_MONTHS;
  canvas.style.width = (barWidth * months.length) + 'px';
  canvas.style.minWidth = (barWidth * months.length) + 'px';
  canvas.style.height = canvas.parentElement.clientHeight + 'px';

  const datasets = [
    { label: '2025',   data: data2025,   backgroundColor: '#1a237e', borderRadius: 5 },
    { label: '2026',   data: data2026,   backgroundColor: '#f5a623', borderRadius: 5 },
    { label: 'Budget', data: dataTarget, backgroundColor: '#6d43ea', borderRadius: 5 }
  ];

  const chart = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: { labels: months, datasets },
    options: {
      responsive: false, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ₱${ctx.parsed.y.toLocaleString('en-US', {minimumFractionDigits:2,maximumFractionDigits:2})}` } }
      },
      scales: {
        y: { beginAtZero: true, ticks: { callback: v => v>=1000000?'₱'+(v/1000000).toFixed(1)+'M':v>=1000?'₱'+(v/1000).toFixed(1)+'K':'₱'+v, font:{weight:'600',size:11}, color:'#ffffff' }, grid:{color:'rgba(255,255,255,0.5)',lineWidth:2} },
        x: { grid:{display:false}, ticks:{font:{weight:'600',size:11},color:'#ffffff'} }
      }
    }
  });

  // ── Legend ──
  const legendEl = document.getElementById('chartLegend');
  datasets.forEach((ds, i) => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `<span class="legend-paren">(</span><span class="legend-dot" style="background:${ds.backgroundColor}"></span><span class="legend-paren">)</span><span class="legend-label">${ds.label}</span>`;
    item.addEventListener('click', () => {
      const meta = chart.getDatasetMeta(i);
      meta.hidden = !meta.hidden;
      item.classList.toggle('legend-hidden');
      chart.update();
    });
    legendEl.appendChild(item);
  });

  // ── Excel table ──
  const fmt = v => v != null ? v.toLocaleString('en-US', {minimumFractionDigits:2,maximumFractionDigits:2}) : '-';
  const fmtVariance = (v25, v26) => {
    if (v25 == null || v26 == null) return '<td class="cell-variance">-</td>';
    const diff = v26 - v25;
    const pct = ((diff / v25) * 100).toFixed(1);
    const cls = diff >= 0 ? 'variance-pos' : 'variance-neg';
    const arrow = diff >= 0 ? '▲' : '▼';
    return `<td class="cell-variance ${cls}">${arrow} ${fmt(Math.abs(diff))}<span class="variance-pct">${arrow} ${Math.abs(pct)}%</span></td>`;
  };
  const t25  = data2025.reduce((a,b)=>a+(b||0),0);
  const t26  = data2026.reduce((a,b)=>a+(b||0),0);
  const tBgt = dataTarget.reduce((a,b)=>a+(b||0),0);
  const tDiff = t26 - t25;
  const tPct  = ((tDiff / t25) * 100).toFixed(1);
  const tCls  = tDiff >= 0 ? 'variance-pos' : 'variance-neg';
  const tArrow = tDiff >= 0 ? '▲' : '▼';
  const label = config.labelHeader || 'MISSION';

  function buildRows() {
    return months.map((m,i) =>
      `<tr><td class="month-cell">${m}</td><td class="cell-2025">${fmt(data2025[i])}</td><td class="cell-2026">${fmt(data2026[i])}</td><td class="cell-budget">${fmt(dataTarget[i])}</td>${fmtVariance(data2025[i], data2026[i])}</tr>`
    ).join('') +
    `<tr class="total-row"><td class="month-cell">Total</td><td class="total-cell">${fmt(t25)}</td><td class="total-cell">${fmt(t26)}</td><td class="total-cell">${fmt(tBgt)}</td><td class="total-cell ${tCls}">${tArrow} ${fmt(Math.abs(tDiff))}<span class="variance-pct">${tArrow} ${Math.abs(tPct)}%</span></td></tr>`;
  }

  document.getElementById('excelBody').innerHTML = buildRows();

  // make table wrap clickable
  const tableWrap = document.querySelector('.excel-table-wrap');
  tableWrap.style.cursor = 'pointer';
  tableWrap.title = 'Click to expand';
  tableWrap.addEventListener('click', openTableModal);

  function openTableModal() {
    document.getElementById('modalTableBody').innerHTML = buildRows();
    document.getElementById('tableModalOverlay').classList.remove('hidden');
    const modal = document.getElementById('tableModal');
    modal.classList.remove('hidden');
    modal.style.animation = 'tableModalIn 0.35s cubic-bezier(0.4,0,0.2,1) forwards';
  }

  function closeTableModal() {
    const modal = document.getElementById('tableModal');
    modal.style.animation = 'tableModalOut 0.25s ease forwards';
    setTimeout(() => {
      modal.classList.add('hidden');
      document.getElementById('tableModalOverlay').classList.add('hidden');
    }, 250);
  }

  window.closeTableModal = closeTableModal;

  // inject modal HTML if not already present
  if (!document.getElementById('tableModal')) {
    const overlay = document.createElement('div');
    overlay.className = 'table-modal-overlay hidden';
    overlay.id = 'tableModalOverlay';
    overlay.onclick = closeTableModal;
    document.body.appendChild(overlay);

    const modal = document.createElement('div');
    modal.className = 'table-modal hidden';
    modal.id = 'tableModal';
    modal.innerHTML = `
      <div class="table-modal-header">
        <span class="table-modal-title">${label} — JANUARY TO DECEMBER <span style="font-size:0.6em;opacity:0.75;font-weight:600;letter-spacing:1px;text-transform:none;">(in PESO)</span></span>
        <button class="table-modal-close" onclick="closeTableModal()">&#10005;</button>
      </div>
      <div class="table-modal-body">
        <table class="excel-table table-modal-table">
          <thead><tr>
            <th class="th-month">MONTH</th>
            <th class="th-2025">2025</th>
            <th class="th-2026">2026</th>
            <th class="th-budget">BUDGET</th>
            <th class="th-variance">VARIANCE</th>
          </tr></thead>
          <tbody id="modalTableBody"></tbody>
        </table>
      </div>`;
    document.body.appendChild(modal);
  }

  // ── Side clock ──
  updateSideClock();
  setInterval(updateSideClock, 1000);

  // ── Overview charts (lazy) ──
  let overviewChart = null, lineChart = null;
  let activeFrom = 0, activeTo = 11;

  function applyMonthFilter() {
    const from = parseInt(document.getElementById('fromMonth').value);
    const to   = parseInt(document.getElementById('toMonth').value);
    if (from > to) { alert('"From" month cannot be after "To" month.'); return; }
    activeFrom = from; activeTo = to;
    document.getElementById('monthFilterDropdown').classList.add('hidden');
    const pill = document.getElementById('filterActivePill');
    if (from === 0 && to === 11) { pill.classList.add('hidden'); }
    else { pill.textContent = months[from] + (from === to ? '' : ' – ' + months[to]); pill.classList.remove('hidden'); }
    if (overviewChart) { overviewChart.data.labels=months.slice(from,to+1); overviewChart.data.datasets[0].data=data2025.slice(from,to+1); overviewChart.data.datasets[1].data=data2026.slice(from,to+1); overviewChart.data.datasets[2].data=dataTarget.slice(from,to+1); overviewChart.update('active'); }
    if (lineChart)    { lineChart.data.labels=months.slice(from,to+1);    lineChart.data.datasets[0].data=data2025.slice(from,to+1);    lineChart.data.datasets[1].data=data2026.slice(from,to+1);    lineChart.data.datasets[2].data=dataTarget.slice(from,to+1);    lineChart.update('active'); }
  }

  function resetMonthFilter() {
    document.getElementById('fromMonth').value = '0';
    document.getElementById('toMonth').value   = '11';
    applyMonthFilter();
  }

  function toggleMain() {
    const mainCard     = document.getElementById('mainChartCard');
    const overviewCard = document.getElementById('overviewCard');
    const isOverview   = !overviewCard.classList.contains('hidden');
    if (isOverview) {
      overviewCard.style.animation = 'fadeSlideOut 0.3s ease forwards';
      setTimeout(() => {
        overviewCard.classList.add('hidden'); overviewCard.style.animation = '';
        mainCard.classList.remove('hidden'); mainCard.style.animation = 'fadeSlideIn 0.4s ease forwards';
        setTimeout(() => mainCard.style.animation = '', 400);
      }, 300);
    } else {
      mainCard.style.animation = 'fadeSlideOut 0.3s ease forwards';
      setTimeout(() => {
        mainCard.classList.add('hidden'); mainCard.style.animation = '';
        overviewCard.classList.remove('hidden'); overviewCard.style.animation = 'fadeSlideIn 0.4s ease forwards';
        setTimeout(() => overviewCard.style.animation = '', 400);
        if (!overviewChart) {
          overviewChart = new Chart(document.getElementById('overviewChart').getContext('2d'), {
            type: 'bar',
            data: { labels: months.slice(activeFrom,activeTo+1), datasets: [
              { label:'2025',   data:data2025.slice(activeFrom,activeTo+1),   backgroundColor:'#1a237e', borderRadius:5 },
              { label:'2026',   data:data2026.slice(activeFrom,activeTo+1),   backgroundColor:'#f5a623', borderRadius:5 },
              { label:'Budget', data:dataTarget.slice(activeFrom,activeTo+1), backgroundColor:'#6d43ea', borderRadius:5 }
            ]},
            options: { responsive:true, maintainAspectRatio:false,
              plugins:{ legend:{display:true,position:'top',labels:{color:'#fff',font:{weight:'700',size:11}}}, tooltip:{callbacks:{label:ctx=>` ${ctx.dataset.label}: ₱${ctx.parsed.y.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`}} },
              scales:{ y:{beginAtZero:true,ticks:{callback:v=>v>=1000000?'₱'+(v/1000000).toFixed(1)+'M':'₱'+v,font:{weight:'700',size:11},color:'#fff'},grid:{color:'rgba(255,255,255,0.3)'}}, x:{grid:{display:false},ticks:{font:{weight:'700',size:11},color:'#fff'}} }
            }
          });
        }
        if (!lineChart) {
          lineChart = new Chart(document.getElementById('lineChart').getContext('2d'), {
            type: 'line',
            data: { labels: months.slice(activeFrom,activeTo+1), datasets: [
              { label:'2025',   data:data2025.slice(activeFrom,activeTo+1),   borderColor:'#4f7cff', backgroundColor:'rgba(79,124,255,0.15)',  pointBackgroundColor:'#4f7cff', tension:0.4, fill:true,  pointRadius:4 },
              { label:'2026',   data:data2026.slice(activeFrom,activeTo+1),   borderColor:'#f5a623', backgroundColor:'rgba(245,166,35,0.15)', pointBackgroundColor:'#f5a623', tension:0.4, fill:true,  pointRadius:4 },
              { label:'Budget', data:dataTarget.slice(activeFrom,activeTo+1), borderColor:'#6d43ea', backgroundColor:'rgba(109,67,234,0.18)', pointBackgroundColor:'#6d43ea', tension:0.4, fill:false, borderDash:[6,3], pointRadius:4 }
            ]},
            options: { responsive:true, maintainAspectRatio:false,
              plugins:{ legend:{display:true,position:'top',labels:{color:'#fff',font:{weight:'700',size:11}}}, tooltip:{callbacks:{label:ctx=>` ${ctx.dataset.label}: ₱${ctx.parsed.y.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`}} },
              scales:{ y:{beginAtZero:true,ticks:{callback:v=>v>=1000000?'₱'+(v/1000000).toFixed(1)+'M':'₱'+v,font:{weight:'700',size:11},color:'#fff'},grid:{color:'rgba(255,255,255,0.3)'}}, x:{grid:{color:'rgba(255,255,255,0.1)'},ticks:{font:{weight:'700',size:11},color:'#fff'}} }
            }
          });
        }
      }, 300);
    }
  }

  // expose to inline HTML onclick attributes
  window.toggleMonthDropdown = toggleMonthDropdown;
  window.applyMonthFilter    = applyMonthFilter;
  window.resetMonthFilter    = resetMonthFilter;
  window.toggleMain          = toggleMain;
  window.expandChart  = wrapId => expandChart(wrapId, [overviewChart, lineChart]);
  window.collapseChart = ()    => collapseChart([overviewChart, lineChart]);
}
