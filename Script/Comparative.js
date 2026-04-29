const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

let dataTithes2025   = new Array(12).fill(null);
let dataOfferings2025 = new Array(12).fill(null);
let dataTithes2026   = new Array(12).fill(null);
let dataOfferings2026 = new Array(12).fill(null);

let currentYear = new Date().getFullYear() - 1;
const _CY = new Date().getFullYear();
const _PY = _CY - 1;

document.addEventListener('DOMContentLoaded', () => {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('thTithes', 'TITHES ' + _PY);   set('thOfferings', 'OFFERINGS ' + _PY);
  set('modalThTithes', 'TITHES ' + _PY); set('modalThOfferings', 'OFFERINGS ' + _PY);
});
let dataTithes = dataTithes2025;
let dataOfferings = dataOfferings2025;

const VISIBLE_MONTHS = 4;
const canvas = document.getElementById('comparativeChart');
const containerWidth = canvas.parentElement.clientWidth;
const containerHeight = canvas.parentElement.clientHeight;
const barWidth = containerWidth / VISIBLE_MONTHS;
canvas.style.width = (barWidth * months.length) + 'px';
canvas.style.minWidth = (barWidth * months.length) + 'px';
canvas.style.height = containerHeight + 'px';

const datasets = [
  { label: 'Tithes 2025',    data: [],    backgroundColor: '#0a1e6e', borderRadius: 4 },
  { label: 'Offerings 2025', data: [], backgroundColor: '#f59e0b', borderRadius: 4 }
];

const chart = new Chart(canvas.getContext('2d'), {
  type: 'bar',
  data: { labels: months, datasets },
  options: {
    responsive: false,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ₱${ctx.parsed.y.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` } }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { callback: v => v >= 1000000 ? '₱' + (v/1000000).toFixed(1) + 'M' : '₱' + v, font: { weight: '700', size: 11 }, color: '#ffffff' },
        grid: { color: 'rgba(255,255,255,0.5)', lineWidth: 2 }
      },
      x: {
        grid: { display: false },
        ticks: { font: { weight: '700', size: 11 }, color: '#ffffff' }
      }
    }
  }
});

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

const fmt = v => v != null ? v.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-';

function renderTable(tithes, offerings) {
  const tbody = document.getElementById('summaryBody');
  let grandTithes = 0, grandOfferings = 0;
  tbody.innerHTML = months.map((m, i) => {
    const t = tithes[i] || 0;
    const o = offerings[i] || 0;
    const total = (tithes[i] != null || offerings[i] != null) ? t + o : null;
    grandTithes += t;
    grandOfferings += o;
    return `<tr>
      <td class="month-cell">${m}</td>
      <td class="cell-tithes">${fmt(tithes[i])}</td>
      <td class="cell-offerings">${fmt(offerings[i])}</td>
      <td class="cell-total">${total != null ? fmt(total) : '-'}</td>
    </tr>`;
  }).join('') + `
    <tr class="total-row">
      <td class="month-cell">TOTAL</td>
      <td class="total-cell">${fmt(grandTithes)}</td>
      <td class="total-cell">${fmt(grandOfferings)}</td>
      <td class="total-cell">${fmt(grandTithes + grandOfferings)}</td>
    </tr>`;
}

function toggleYear() {
  const btn = document.getElementById('yearToggleBtn');
  if (currentYear === _PY) {
    currentYear = _CY;
    chart.data.datasets[0].data = dataTithes2026;
    chart.data.datasets[0].label = 'Tithes ' + _CY;
    chart.data.datasets[1].data = dataOfferings2026;
    chart.data.datasets[1].label = 'Offerings ' + _CY;
    chart.update();
    document.getElementById('thTithes').textContent = 'TITHES ' + _CY;
    document.getElementById('thOfferings').textContent = 'OFFERINGS ' + _CY;
    document.getElementById('modalThTithes').textContent = 'TITHES ' + _CY;
    document.getElementById('modalThOfferings').textContent = 'OFFERINGS ' + _CY;
    renderTable(dataTithes2026, dataOfferings2026);
    btn.innerHTML = 'VIEW ' + _PY + ' &#8592;';
    btn.classList.add('active');
  } else {
    currentYear = _PY;
    chart.data.datasets[0].data = dataTithes2025;
    chart.data.datasets[0].label = 'Tithes ' + _PY;
    chart.data.datasets[1].data = dataOfferings2025;
    chart.data.datasets[1].label = 'Offerings ' + _PY;
    chart.update();
    document.getElementById('thTithes').textContent = 'TITHES ' + _PY;
    document.getElementById('thOfferings').textContent = 'OFFERINGS ' + _PY;
    document.getElementById('modalThTithes').textContent = 'TITHES ' + _PY;
    document.getElementById('modalThOfferings').textContent = 'OFFERINGS ' + _PY;
    renderTable(dataTithes2025, dataOfferings2025);
    btn.innerHTML = 'VIEW ' + _CY + ' &#8594;';
    btn.classList.remove('active');
  }
  const overviewCard = document.getElementById('overviewCard');
  const legendItems = document.querySelectorAll('#chartLegend .legend-label');
  if (legendItems.length >= 2) {
    legendItems[0].textContent = 'Tithes ' + currentYear;
    legendItems[1].textContent = 'Offerings ' + currentYear;
  }
  if (!overviewCard.classList.contains('hidden')) {
    const tithes = currentYear === 2025 ? dataTithes2025 : dataTithes2026;
    const offerings = currentYear === 2025 ? dataOfferings2025 : dataOfferings2026;
    const yr = currentYear;
    const sliced = months.slice(activeFrom, activeTo + 1);
    if (overviewChart) {
      overviewChart.data.labels = sliced;
      overviewChart.data.datasets[0].data = tithes.slice(activeFrom, activeTo + 1);
      overviewChart.data.datasets[0].label = 'Tithes ' + yr;
      overviewChart.data.datasets[1].data = offerings.slice(activeFrom, activeTo + 1);
      overviewChart.data.datasets[1].label = 'Offerings ' + yr;
      overviewChart.update();
    }
    if (lineChart) {
      lineChart.data.labels = sliced;
      lineChart.data.datasets[0].data = tithes.slice(activeFrom, activeTo + 1);
      lineChart.data.datasets[0].label = 'Tithes ' + yr;
      lineChart.data.datasets[1].data = offerings.slice(activeFrom, activeTo + 1);
      lineChart.data.datasets[1].label = 'Offerings ' + yr;
      lineChart.update();
    }
  }
}

async function initData() {
  const [tithesRows, offeringsRows] = await Promise.all([fetchTithes(), fetchOfferings()]);
  const tGrouped = groupByMission(tithesRows);
  const oGrouped = groupByMission(offeringsRows);
  dataTithes2025    = buildSpucTotal(tGrouped, 2025);
  dataOfferings2025 = buildSpucTotal(oGrouped, 2025);
  dataTithes2026    = buildSpucTotal(tGrouped, 2026);
  dataOfferings2026 = buildSpucTotal(oGrouped, 2026);
  dataTithes   = dataTithes2025;
  dataOfferings = dataOfferings2025;
  chart.data.datasets[0].data = dataTithes2025;
  chart.data.datasets[1].data = dataOfferings2025;
  chart.update();
  renderTable(dataTithes2025, dataOfferings2025);
}
initData();

function openTableModal() {
  document.getElementById('modalSummaryBody').innerHTML = document.getElementById('summaryBody').innerHTML;
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

updateSideClock();
setInterval(updateSideClock, 1000);

let overviewChart = null, lineChart = null;
let activeFrom = 0, activeTo = 11;

function toggleMonthDropdown() {
  document.getElementById('monthFilterDropdown').classList.toggle('hidden');
}

function applyMonthFilter() {
  const from = parseInt(document.getElementById('fromMonth').value);
  const to   = parseInt(document.getElementById('toMonth').value);
  if (from > to) { alert('"From" month cannot be after "To" month.'); return; }
  activeFrom = from; activeTo = to;
  document.getElementById('monthFilterDropdown').classList.add('hidden');
  const pill = document.getElementById('filterActivePill');
  if (from === 0 && to === 11) { pill.classList.add('hidden'); }
  else { pill.textContent = months[from] + (from === to ? '' : ' – ' + months[to]); pill.classList.remove('hidden'); }
  const tithes   = currentYear === 2025 ? dataTithes2025   : dataTithes2026;
  const offerings = currentYear === 2025 ? dataOfferings2025 : dataOfferings2026;
  const sliced = months.slice(from, to + 1);
  if (overviewChart) {
    overviewChart.data.labels = sliced;
    overviewChart.data.datasets[0].data = tithes.slice(from, to + 1);
    overviewChart.data.datasets[1].data = offerings.slice(from, to + 1);
    overviewChart.update('active');
  }
  if (lineChart) {
    lineChart.data.labels = sliced;
    lineChart.data.datasets[0].data = tithes.slice(from, to + 1);
    lineChart.data.datasets[1].data = offerings.slice(from, to + 1);
    lineChart.update('active');
  }
}

function resetMonthFilter() {
  document.getElementById('fromMonth').value = '0';
  document.getElementById('toMonth').value   = '11';
  applyMonthFilter();
}

function toggleMain() {
  const mainCard = document.getElementById('mainChartCard');
  const overviewCard = document.getElementById('overviewCard');
  const toggleMainBtn = document.getElementById('toggleMainBtn');
  const isOverview = !overviewCard.classList.contains('hidden');
  if (isOverview) {
    overviewCard.style.animation = 'fadeSlideOut 0.3s ease forwards';
    setTimeout(() => {
      overviewCard.classList.add('hidden'); overviewCard.style.animation = '';
      mainCard.classList.remove('hidden'); mainCard.style.animation = 'fadeSlideIn 0.4s ease forwards';
      toggleMainBtn.innerHTML = '&#9660; VIEW ALL MONTHS';
      setTimeout(() => mainCard.style.animation = '', 400);
    }, 300);
  } else {
    mainCard.style.animation = 'fadeSlideOut 0.3s ease forwards';
    setTimeout(() => {
      mainCard.classList.add('hidden'); mainCard.style.animation = '';
      overviewCard.classList.remove('hidden'); overviewCard.style.animation = 'fadeSlideIn 0.4s ease forwards';
      toggleMainBtn.innerHTML = '&#9650; BACK TO DETAIL VIEW';
      setTimeout(() => overviewCard.style.animation = '', 400);
      const tithes = currentYear === 2025 ? dataTithes2025 : dataTithes2026;
      const offerings = currentYear === 2025 ? dataOfferings2025 : dataOfferings2026;
      const yr = currentYear;
      const sliced = months.slice(activeFrom, activeTo + 1);
      if (overviewChart) {
        overviewChart.data.labels = sliced;
        overviewChart.data.datasets[0].data = tithes.slice(activeFrom, activeTo + 1);
        overviewChart.data.datasets[0].label = 'Tithes ' + yr;
        overviewChart.data.datasets[1].data = offerings.slice(activeFrom, activeTo + 1);
        overviewChart.data.datasets[1].label = 'Offerings ' + yr;
        overviewChart.update();
      } else {
        const barCanvas = document.getElementById('overviewChart'), barWrap = barCanvas.parentElement;
        barCanvas.style.width = (barWrap.clientWidth - 16) + 'px'; barCanvas.style.height = (barWrap.clientHeight - 30) + 'px';
        overviewChart = new Chart(barCanvas.getContext('2d'), { type: 'bar', data: { labels: sliced, datasets: [{ label: 'Tithes '+yr, data: tithes.slice(activeFrom, activeTo+1), backgroundColor: '#0a1e6e', borderRadius: 4 },{ label: 'Offerings '+yr, data: offerings.slice(activeFrom, activeTo+1), backgroundColor: '#f59e0b', borderRadius: 4 }]}, options: { responsive: false, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'top', labels: { color: '#fff', font: { weight: '700', size: 11 } } }, tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ₱${ctx.parsed.y.toLocaleString('en-US', {minimumFractionDigits:2,maximumFractionDigits:2})}` } } }, scales: { y: { beginAtZero: true, ticks: { callback: v => v >= 1000000 ? '₱'+(v/1000000).toFixed(1)+'M' : '₱'+v, font:{weight:'700',size:11}, color:'#fff' }, grid:{color:'rgba(255,255,255,0.3)'} }, x: { grid:{display:false}, ticks:{font:{weight:'700',size:11},color:'#fff'} } } } });
      }
      if (lineChart) {
        lineChart.data.labels = sliced;
        lineChart.data.datasets[0].data = tithes.slice(activeFrom, activeTo + 1);
        lineChart.data.datasets[0].label = 'Tithes ' + yr;
        lineChart.data.datasets[1].data = offerings.slice(activeFrom, activeTo + 1);
        lineChart.data.datasets[1].label = 'Offerings ' + yr;
        lineChart.update();
      } else {
        const lineCanvas = document.getElementById('lineChart'), lineWrap = lineCanvas.parentElement;
        lineCanvas.style.width = (lineWrap.clientWidth - 16) + 'px'; lineCanvas.style.height = (lineWrap.clientHeight - 30) + 'px';
        lineChart = new Chart(lineCanvas.getContext('2d'), { type: 'line', data: { labels: sliced, datasets: [{ label: 'Tithes '+yr, data: tithes.slice(activeFrom, activeTo+1), borderColor: '#4f7cff', backgroundColor: 'rgba(79,124,255,0.15)', pointBackgroundColor: '#4f7cff', tension: 0.4, fill: true, pointRadius: 4 },{ label: 'Offerings '+yr, data: offerings.slice(activeFrom, activeTo+1), borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.15)', pointBackgroundColor: '#f59e0b', tension: 0.4, fill: true, pointRadius: 4 }]}, options: { responsive: false, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'top', labels: { color: '#fff', font: { weight: '700', size: 11 } } }, tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ₱${ctx.parsed.y.toLocaleString('en-US', {minimumFractionDigits:2,maximumFractionDigits:2})}` } } }, scales: { y: { beginAtZero: true, ticks: { callback: v => v >= 1000000 ? '₱'+(v/1000000).toFixed(1)+'M' : '₱'+v, font:{weight:'700',size:11}, color:'#fff' }, grid:{color:'rgba(255,255,255,0.3)'} }, x: { grid:{color:'rgba(255,255,255,0.1)'}, ticks:{font:{weight:'700',size:11},color:'#fff'} } } } });
      }
    }, 300);
  }
}
