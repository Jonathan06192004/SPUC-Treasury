// ─── VIEW ALL MONTHS — shared logic for Tithes & Offerings pages ─────────────
// config = {
//   canvasId        : string   — main scrollable bar chart canvas id
//   datasets        : array    — Chart.js dataset objects (2025, 2026, Budget)
//   missionData     : array[]  — per-mission monthly arrays (5 missions × 12 months)
//   labels          : string[] — month labels ['Jan',...,'Dec']
//   VISIBLE_MONTHS  : number   — how many bars visible at once
// }

function initViewAllMonths(config) {
  const { canvasId, datasets, missionData, missionData2026, labels, VISIBLE_MONTHS } = config;

  const COLORS       = ['#4f7cff', '#f5a623', '#22d3a0', '#c084fc', '#f87171'];
  const GLOW_COLORS  = ['rgba(79,124,255,0.7)', 'rgba(245,166,35,0.7)', 'rgba(34,211,160,0.7)', 'rgba(192,132,252,0.7)', 'rgba(248,113,113,0.7)'];
  const MISSION_LABELS = ['NCMC', 'CMM', 'NMM', 'WMC', 'ZPM'];
  const FULL_NAMES   = {
    NCMC: ['North Central', 'Mindanao', 'Conference'],
    CMM:  ['Central', 'Mindanao', 'Mission'],
    NMM:  ['Northeastern', 'Mindanao', 'Mission'],
    WMC:  ['Western', 'Mindanao', 'Conference'],
    ZPM:  ['Zamboanga', 'Peninsular', 'Mission']
  };

  let overviewChart  = null;
  let lineChart      = null;
  let pieChart       = null;
  let resetPieExplode = () => {};
  let expandedWrap   = null;
  let activeFrom     = 0;
  let activeTo       = 11;

  // ── Month filter ────────────────────────────────────────────────────────────
  function applyMonthFilter() {
    const from = parseInt(document.getElementById('fromMonth').value);
    const to   = parseInt(document.getElementById('toMonth').value);
    if (from > to) { alert('"From" month cannot be after "To" month.'); return; }
    activeFrom = from; activeTo = to;
    document.getElementById('monthFilterDropdown').classList.add('hidden');
    const pill = document.getElementById('filterActivePill');
    if (from === 0 && to === 11) {
      pill.classList.add('hidden');
    } else {
      pill.textContent = labels[from] + (from === to ? '' : ' – ' + labels[to]);
      pill.classList.remove('hidden');
    }
    const sl = labels.slice(from, to + 1);
    if (overviewChart) {
      overviewChart.data.labels = sl;
      overviewChart.data.datasets[0].data = datasets[0].data.slice(from, to + 1);
      overviewChart.data.datasets[1].data = datasets[1].data.slice(from, to + 1);
      overviewChart.data.datasets[2].data = datasets[2].data.slice(from, to + 1);
      overviewChart.update('active');
    }
    if (lineChart) {
      lineChart.data.labels = sl;
      lineChart.data.datasets[0].data = datasets[0].data.slice(from, to + 1);
      lineChart.data.datasets[1].data = datasets[1].data.slice(from, to + 1);
      lineChart.data.datasets[2].data = datasets[2].data.slice(from, to + 1);
      lineChart.update('active');
    }
    if (pieChart) {
      _updatePieData();
      resetPieExplode(false);
    }
  }

  function resetMonthFilter() {
    document.getElementById('fromMonth').value = '0';
    document.getElementById('toMonth').value   = '11';
    applyMonthFilter();
  }

  // ── Chart expand / collapse ─────────────────────────────────────────────────
  function expandChart(wrapId) {
    if (expandedWrap === wrapId) { collapseChart(); return; }
    expandedWrap = wrapId;
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
    setTimeout(() => [overviewChart, lineChart, pieChart].forEach(c => c && c.resize()), 420);
  }

  function collapseChart() {
    expandedWrap = null;
    document.querySelectorAll('.overview-chart-wrap').forEach(w => {
      w.classList.remove('chart-expanded', 'chart-shrunk');
      w.querySelector('.chart-close-btn').classList.remove('visible');
    });
    resetPieExplode(false);
    setTimeout(() => [overviewChart, lineChart, pieChart].forEach(c => c && c.resize()), 420);
  }

  // ── Toggle between main chart card and overview card ────────────────────────
  function toggleMain() {
    const mainCard    = document.getElementById('mainChartCard');
    const overviewCard = document.getElementById('overviewCard');
    const headerBackBtn = document.getElementById('headerBackBtn');
    const isOverview  = !overviewCard.classList.contains('hidden');

    if (isOverview) {
      overviewCard.style.animation = 'fadeSlideOut 0.3s ease forwards';
      if (headerBackBtn) headerBackBtn.classList.add('hidden');
      setTimeout(() => {
        overviewCard.classList.add('hidden');
        overviewCard.style.animation = '';
        mainCard.classList.remove('hidden');
        mainCard.style.animation = 'fadeSlideIn 0.4s ease forwards';
        setTimeout(() => mainCard.style.animation = '', 400);
      }, 300);
    } else {
      mainCard.style.animation = 'fadeSlideOut 0.3s ease forwards';
      if (headerBackBtn) headerBackBtn.classList.remove('hidden');
      setTimeout(() => {
        mainCard.classList.add('hidden');
        mainCard.style.animation = '';
        overviewCard.classList.remove('hidden');
        overviewCard.style.animation = 'fadeSlideIn 0.4s ease forwards';
        setTimeout(() => overviewCard.style.animation = '', 400);
        _initOverviewCharts();
      }, 300);
    }
  }

  // ── Build overview bar + line charts (lazy, first open only) ────────────────
  function _initOverviewCharts() {
    if (!overviewChart) {
      overviewChart = new Chart(document.getElementById('overviewChart').getContext('2d'), {
        type: 'bar',
        data: {
          labels: labels.slice(activeFrom, activeTo + 1),
          datasets: [
            { label: '2025',   data: datasets[0].data.slice(activeFrom, activeTo + 1), backgroundColor: datasets[0].backgroundColor, borderRadius: 4 },
            { label: '2026',   data: datasets[1].data.slice(activeFrom, activeTo + 1), backgroundColor: datasets[1].backgroundColor, borderRadius: 4 },
            { label: 'Budget', data: datasets[2].data.slice(activeFrom, activeTo + 1), backgroundColor: datasets[2].backgroundColor, borderRadius: 4 }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: true, position: 'top', labels: { color: '#fff', font: { weight: '700', size: 11 } } },
            tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ₱${ctx.parsed.y.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` } }
          },
          scales: {
            y: { beginAtZero: true, ticks: { callback: v => v >= 1000000 ? '₱' + (v / 1000000).toFixed(1) + 'M' : '₱' + v, font: { weight: '700', size: 11 }, color: '#fff' }, grid: { color: 'rgba(255,255,255,0.3)' } },
            x: { grid: { display: false }, ticks: { font: { weight: '700', size: 11 }, color: '#fff' } }
          }
        }
      });
    }

    if (!lineChart) {
      lineChart = new Chart(document.getElementById('lineChart').getContext('2d'), {
        type: 'line',
        data: {
          labels: labels.slice(activeFrom, activeTo + 1),
          datasets: [
            { label: '2025',   data: datasets[0].data.slice(activeFrom, activeTo + 1), borderColor: '#4f7cff', backgroundColor: 'rgba(79,124,255,0.15)',  pointBackgroundColor: '#4f7cff', tension: 0.4, fill: true,  pointRadius: 4 },
            { label: '2026',   data: datasets[1].data.slice(activeFrom, activeTo + 1), borderColor: '#f5a623', backgroundColor: 'rgba(245,158,11,0.15)',  pointBackgroundColor: '#f5a623', tension: 0.4, fill: true,  pointRadius: 4 },
            { label: 'Budget', data: datasets[2].data.slice(activeFrom, activeTo + 1), borderColor: '#6d43ea', backgroundColor: 'rgba(109,67,234,0.18)',  pointBackgroundColor: '#6d43ea', tension: 0.4, fill: false, borderDash: [6, 3], pointRadius: 4 }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: true, position: 'top', labels: { color: '#fff', font: { weight: '700', size: 11 } } },
            tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ₱${ctx.parsed.y.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` } }
          },
          scales: {
            y: { beginAtZero: true, ticks: { callback: v => v >= 1000000 ? '₱' + (v / 1000000).toFixed(1) + 'M' : '₱' + v, font: { weight: '700', size: 11 }, color: '#fff' }, grid: { color: 'rgba(255,255,255,0.3)' } },
            x: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { font: { weight: '700', size: 11 }, color: '#fff' } }
          }
        }
      });
    }

    if (!pieChart) {
      _initPieChart();
    }
  }

  // ── Pie chart with explode animation ────────────────────────────────────────
  function _initPieChart() {
    const pieCanvas = document.getElementById('pieChart');
    const wrap      = document.getElementById('wrap-pie');
    let explodeProgress = 0;
    let pieIsExploded   = false;
    let rafId           = null;
    let pieYear         = 2025;

    // ── Year toggle button ───────────────────────────────────────────────────
    const yearToggle = document.createElement('div');
    yearToggle.id = 'pieYearToggle';
    yearToggle.style.cssText = 'position:absolute;top:8px;left:8px;z-index:10;display:flex;gap:4px;';
    ['2025','2026'].forEach(yr => {
      const btn = document.createElement('button');
      btn.textContent = yr;
      btn.dataset.yr = yr;
      btn.style.cssText = `padding:3px 9px;border-radius:5px;border:1px solid rgba(255,255,255,0.35);font-family:Montserrat,sans-serif;font-weight:700;font-size:0.62rem;letter-spacing:1px;cursor:pointer;transition:background 0.2s,color 0.2s;background:${yr==='2025'?'rgba(79,124,255,0.75)':'rgba(255,255,255,0.1)'};color:#fff;`;
      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (parseInt(yr) === pieYear) return;
        pieYear = parseInt(yr);
        yearToggle.querySelectorAll('button').forEach(b => {
          b.style.background = b.dataset.yr === yr ? 'rgba(79,124,255,0.75)' : 'rgba(255,255,255,0.1)';
        });
        _updatePieData();
        resetPieExplode(false);
      });
      yearToggle.appendChild(btn);
    });
    wrap.appendChild(yearToggle);

    function _getPieMissionData() {
      const src = pieYear === 2026 && missionData2026 ? missionData2026 : missionData;
      return src.map(m => m.slice(activeFrom, activeTo + 1).reduce((a, b) => a + (b || 0), 0));
    }

    function _updatePieData() {
      if (!pieChart) return;
      pieChart.data.datasets[0].data = _getPieMissionData();
      pieChart.update('active');
    }

    function easeOutBack(t) {
      return 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);
    }

    function drawArrowHead(ctx2, x, y, ang, color, alpha) {
      ctx2.save();
      ctx2.globalAlpha = alpha;
      ctx2.fillStyle = 'rgba(255,255,255,0.95)';
      ctx2.shadowColor = 'rgba(255,255,255,0.6)';
      ctx2.shadowBlur = 6;
      ctx2.beginPath();
      ctx2.arc(x, y, 6, 0, Math.PI * 2);
      ctx2.fill();
      ctx2.restore();
    }

    const explodePlugin = {
      id: 'explodeDetachedArcs',
      afterDraw(chart) {
        const meta = chart.getDatasetMeta(0);
        if (!meta.data.length || explodeProgress <= 0.01) return;
        const ctx2 = chart.ctx;
        const area = chart.chartArea || { left: 0, top: 0, right: chart.width, bottom: chart.height };
        const cx = (area.left + area.right) / 2;
        const cy = (area.top + area.bottom) / 2;
        const outerR = meta.data[0].outerRadius;
        const innerR = meta.data[0].innerRadius;
        const total  = chart.data.datasets[0].data.reduce((a, b) => a + b, 0) || 1;
        const p      = explodeProgress;
        const viewSize = Math.min(area.right - area.left, area.bottom - area.top);
        const pad = 10;
        const minX = area.left + pad, maxX = area.right - pad;
        const minY = area.top  + pad, maxY = area.bottom - pad;
        const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

        const detachedThickness = Math.max((outerR - innerR) * (1.05 + 0.12 * p), viewSize * 0.10);
        const detachedOuter = outerR + 6 + (viewSize * 0.03) * p;
        const detachedInner = Math.max(8, detachedOuter - detachedThickness);
        const orbit = outerR + 16 + (viewSize * 0.09) * p;

        MISSION_LABELS.forEach((label, i) => {
          const arc      = meta.data[i];
          const midAngle = (arc.startAngle + arc.endAngle) / 2;
          const shift    = label === 'NMM' ? 0.42 : 0;
          const drawStart = arc.startAngle + shift;
          const drawEnd   = arc.endAngle   + shift;
          const drawMid   = midAngle       + shift;
          const ease  = easeOutBack(Math.min(p, 1));
          const alpha = Math.min(1, 0.15 + p * 0.95);

          ctx2.save();
          ctx2.globalAlpha = alpha;

          const proposedX  = cx + Math.cos(drawMid) * orbit * ease;
          const proposedY  = cy + Math.sin(drawMid) * orbit * ease;
          const rightSide  = label === 'NCMC' || label === 'CMM';
          const edgeX      = rightSide ? maxX - detachedOuter - 8 : minX + detachedOuter + 8;
          const sideX      = proposedX * 0.18 + edgeX * 0.82;
          const nudgeX     = (label === 'ZPM' ? 14 : 0) + (label === 'NMM' ? 120 : 0);
          const dcx = clamp(sideX + nudgeX, minX + detachedOuter, maxX - detachedOuter);
          const dcy = clamp(proposedY,      minY + detachedOuter, maxY - detachedOuter);

          // Detached arc
          ctx2.save();
          ctx2.shadowColor = GLOW_COLORS[i];
          ctx2.shadowBlur  = 18 * p;
          ctx2.fillStyle   = COLORS[i];
          ctx2.beginPath();
          ctx2.arc(dcx, dcy, detachedOuter, drawStart, drawEnd);
          ctx2.arc(dcx, dcy, detachedInner, drawEnd, drawStart, true);
          ctx2.closePath();
          ctx2.fill();
          ctx2.shadowBlur = 0;
          ctx2.restore();

          // Connector + arrow — cubic bezier curving from pie edge to label text
          const sx  = cx  + Math.cos(midAngle) * (outerR + 2);
          const sy  = cy  + Math.sin(midAngle) * (outerR + 2);
          // Arrow tip: point at the label text center inside the detached arc, but stay outside the colored arc
          const labelR = detachedInner + (detachedOuter - detachedInner) * 0.5;
          const tx_tip = dcx + Math.cos(drawMid) * labelR;
          const ty_tip = dcy + Math.sin(drawMid) * labelR;
          // Stop arrow just outside the detached arc outer edge + small gap
          const arrowGap = 8;
          const rawEx = dcx + Math.cos(drawMid) * (detachedOuter + arrowGap);
          const rawEy = dcy + Math.sin(drawMid) * (detachedOuter + arrowGap);
          const shortenTip = { NCMC: 160, CMM: 160, WMC: 160, NMM: 100, ZPM: 100 }[label] || 100;
          const lineDist = Math.hypot(rawEx - sx, rawEy - sy);
          const trimT = Math.max(0, 1 - shortenTip / lineDist);
          const ex = sx + (rawEx - sx) * trimT;
          const ey = sy + (rawEy - sy) * trimT;
          // Two control points for a deep S-curve
          const dist = Math.hypot(ex - sx, ey - sy);
          const cp1x = sx + Math.cos(midAngle) * dist * 0.55;
          const cp1y = sy + Math.sin(midAngle) * dist * 0.55;
          const cp2x = ex - Math.cos(drawMid)  * dist * 0.45;
          const cp2y = ey - Math.sin(drawMid)  * dist * 0.45;
          ctx2.save();
          ctx2.strokeStyle = 'rgba(255,255,255,0.9)';
          ctx2.lineWidth   = 2.2;
          ctx2.lineCap     = 'round';
          ctx2.shadowColor = 'rgba(255,255,255,0.3)';
          ctx2.shadowBlur  = 4 * p;
          ctx2.beginPath();
          ctx2.moveTo(sx, sy);
          ctx2.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, ex, ey);
          ctx2.stroke();
          ctx2.shadowBlur = 0;
          ctx2.restore();
          // Arrowhead pointing toward the label text center
          drawArrowHead(ctx2, ex, ey, Math.atan2(ty_tip - ey, tx_tip - ex), 'rgba(255,255,255,0.95)', alpha);

          // Labels inside detached arc
          if (p > 0.22) {
            const value  = chart.data.datasets[0].data[i];
            const pct    = ((value / total) * 100).toFixed(1) + '%';
            const money  = '₱' + (value / 1000000).toFixed(1) + 'M';
            const lines  = FULL_NAMES[label] || [label];
            const labelR = detachedInner + (detachedOuter - detachedInner) * 0.5;
            const tx     = dcx + Math.cos(drawMid) * labelR;
            const ty     = dcy + Math.sin(drawMid) * labelR;
            const nameSize = Math.max(10, Math.round(9 + 4 * p));
            const dataSize = Math.max(11, Math.round(10 + 4 * p));
            const lineH    = nameSize + 4;
            const startY   = ty - ((lines.length + 2) / 2) * lineH + lineH * 0.5;

            ctx2.textAlign    = 'center';
            ctx2.textBaseline = 'middle';
            ctx2.shadowColor  = 'rgba(0,0,0,0.85)';
            ctx2.shadowBlur   = 5;
            ctx2.fillStyle    = '#ffffff';
            ctx2.font         = `800 ${nameSize}px Montserrat,sans-serif`;
            lines.forEach((ln, li) => ctx2.fillText(ln, tx, startY + li * lineH));

            const divY     = startY + lines.length * lineH - lineH * 0.3;
            const divHalfW = Math.min(detachedOuter * 0.38, 36);
            ctx2.shadowBlur   = 0;
            ctx2.strokeStyle  = 'rgba(255,255,255,0.5)';
            ctx2.lineWidth    = 1;
            ctx2.beginPath();
            ctx2.moveTo(tx - divHalfW, divY);
            ctx2.lineTo(tx + divHalfW, divY);
            ctx2.stroke();

            ctx2.shadowColor = 'rgba(0,0,0,0.9)';
            ctx2.shadowBlur  = 6;
            ctx2.fillStyle   = '#ffffff';
            ctx2.font        = `900 ${dataSize + 2}px Montserrat,sans-serif`;
            ctx2.fillText(pct, tx, startY + lines.length * lineH + lineH * 0.55);
            ctx2.fillStyle = 'rgba(255,255,255,0.88)';
            ctx2.font      = `700 ${dataSize}px Montserrat,sans-serif`;
            ctx2.fillText(money, tx, startY + (lines.length + 1) * lineH + lineH * 0.55);
            ctx2.shadowBlur = 0;
          }
          ctx2.restore();
        });
      }
    };

    const centerLabelPlugin = {
      id: 'centerLabel',
      afterDraw(chart) {
        if (explodeProgress > 0.12) return;
        const { ctx: c, chartArea } = chart;
        if (!chartArea) return;
        const cx    = (chartArea.left + chartArea.right) / 2;
        const cy    = (chartArea.top  + chartArea.bottom) / 2;
        const total = chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
        c.save();
        c.textAlign    = 'center';
        c.textBaseline = 'middle';
        c.font         = '800 13px Montserrat,sans-serif';
        c.fillStyle    = 'rgba(255,255,255,0.55)';
        c.fillText('TOTAL', cx, cy - 13);
        c.font        = '900 15px Montserrat,sans-serif';
        c.fillStyle   = '#f5a623';
        c.shadowColor = 'rgba(245,166,35,0.8)';
        c.shadowBlur  = 10;
        c.fillText('₱' + (total / 1000000).toFixed(1) + 'M', cx, cy + 4);
        c.shadowBlur  = 0;
        c.font        = '700 10px Montserrat,sans-serif';
        c.fillStyle   = 'rgba(255,255,255,0.45)';
        c.fillText(pieYear.toString(), cx, cy + 19);
        c.restore();
      }
    };

    let pulseT = 0;
    const pulsePlugin = {
      id: 'pulseRing',
      afterDraw(chart) {
        if (explodeProgress > 0.05) return;
        const meta = chart.getDatasetMeta(0);
        if (!meta.data.length) return;
        const { ctx: c, chartArea } = chart;
        const cx     = (chartArea.left + chartArea.right) / 2;
        const cy     = (chartArea.top  + chartArea.bottom) / 2;
        const outerR = meta.data[0].outerRadius;
        pulseT = (pulseT + 0.018) % (Math.PI * 2);
        const r    = outerR * (1 + Math.sin(pulseT) * 0.012) + 6;
        const grad = c.createRadialGradient(cx, cy, r - 4, cx, cy, r + 4);
        grad.addColorStop(0,   'rgba(79,124,255,0.0)');
        grad.addColorStop(0.5, 'rgba(79,124,255,0.35)');
        grad.addColorStop(1,   'rgba(79,124,255,0.0)');
        c.save();
        c.beginPath();
        c.arc(cx, cy, r, 0, Math.PI * 2);
        c.strokeStyle = grad;
        c.lineWidth   = 8;
        c.stroke();
        c.restore();
      }
    };

    pieChart = new Chart(pieCanvas.getContext('2d'), {
      type: 'doughnut',
      plugins: [ChartDataLabels, explodePlugin, centerLabelPlugin, pulsePlugin],
      data: {
        labels: MISSION_LABELS,
        datasets: [{
          data: _getPieMissionData(),
          backgroundColor: COLORS,
          borderColor:     GLOW_COLORS,
          borderWidth:     3,
          hoverOffset:     14,
          hoverBorderWidth: 4,
          hoverBorderColor: '#fff'
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, radius: '76%', cutout: '40%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(10,20,80,0.92)',
            borderColor: 'rgba(255,255,255,0.2)', borderWidth: 1,
            titleColor: '#f5a623', bodyColor: '#fff', padding: 10,
            callbacks: { label: ctx => ` ${ctx.label}: ₱${ctx.parsed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }
          },
          datalabels: {
            color: '#fff', font: { weight: '800', size: 11 },
            textShadowBlur: 6, textShadowColor: 'rgba(0,0,0,0.8)',
            formatter: (value, ctx) => {
              const total = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0) || 1;
              return `${((value / total) * 100).toFixed(1)}%\n₱${(value / 1000000).toFixed(1)}M`;
            },
            display: ctx => {
              if (explodeProgress > 0.12) return false;
              const total = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0) || 1;
              return (ctx.dataset.data[ctx.dataIndex] / total) > 0.05;
            }
          }
        },
        animation: { duration: 600, easing: 'easeOutQuart' }
      }
    });

    // Continuous pulse animation
    (function animatePulse() {
      if (pieChart) { pieChart.draw(); requestAnimationFrame(animatePulse); }
    })();

    new ResizeObserver(() => pieChart && pieChart.resize()).observe(wrap);

    function setExplodeState(show, animate = true) {
      if (rafId) cancelAnimationFrame(rafId);
      const dur = animate ? 520 : 0;
      const t0  = performance.now();
      const from = explodeProgress;
      const to   = show ? 1 : 0;
      pieIsExploded = show;
      pieChart.options.events = show ? ['click'] : undefined;
      pieChart.options.plugins.tooltip.enabled = !show;
      pieChart.data.datasets[0].hoverOffset = show ? 0 : 8;
      if (dur === 0) { explodeProgress = to; pieChart.update('none'); return; }
      function step(now) {
        const t = Math.min((now - t0) / dur, 1);
        explodeProgress = from + (to - from) * t;
        pieChart.draw();
        if (t < 1) rafId = requestAnimationFrame(step);
      }
      rafId = requestAnimationFrame(step);
    }

    resetPieExplode = (animate = true) => setExplodeState(false, animate);

    wrap.addEventListener('click', e => {
      if (e.target.closest('.chart-close-btn')) return;
      if (!wrap.classList.contains('chart-expanded')) {
        expandChart('wrap-pie');
        setTimeout(() => {
          if (expandedWrap === 'wrap-pie' && !pieIsExploded) setExplodeState(true);
        }, 430);
        return;
      }
      if (!pieIsExploded) setExplodeState(true);
      else collapseChart();
    });
  }

  // ── Wire up bar & line wrap clicks ──────────────────────────────────────────
  document.getElementById('wrap-bar').addEventListener('click',  () => expandChart('wrap-bar'));
  document.getElementById('wrap-line').addEventListener('click', () => expandChart('wrap-line'));

  // ── Expose to inline HTML onclick attributes ─────────────────────────────────
  window.toggleMonthDropdown = () => document.getElementById('monthFilterDropdown').classList.toggle('hidden');
  window.applyMonthFilter    = applyMonthFilter;
  window.resetMonthFilter    = resetMonthFilter;
  window.toggleMain          = toggleMain;
  window.expandChart         = expandChart;
  window.collapseChart       = collapseChart;
}
