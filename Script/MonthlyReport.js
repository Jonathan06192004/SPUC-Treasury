updateSideClock();
setInterval(updateSideClock, 1000);

function updateMonthLabel() {
  const sel = document.getElementById('mrMonthSelect');
  const month = sel.value.toUpperCase();
  document.getElementById('mrYearLabel').textContent = month + ' 2026';
  document.getElementById('mrSummaryPeriod').textContent = month + ' 2026';
}

const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });
document.getElementById('mrMonthSelect').value = currentMonth;
updateMonthLabel();

const instPanel = document.getElementById('instPanel');
const dataScroll = document.getElementById('dataScroll');
instPanel.addEventListener('scroll', () => { dataScroll.scrollTop = instPanel.scrollTop; });
dataScroll.addEventListener('scroll', () => { instPanel.scrollTop = dataScroll.scrollTop; });

let mrZoomLevel = 100;
function mrZoom(dir) {
  mrZoomLevel = Math.min(200, Math.max(60, mrZoomLevel + dir * 10));
  const inner = document.getElementById('mrSplit');
  const scale = mrZoomLevel / 100;
  inner.style.transformOrigin = 'top left';
  inner.style.transform = `scale(${scale})`;
  inner.style.width = (100 / scale) + '%';
  inner.style.height = (100 / scale) + '%';
  document.getElementById('mrZoomLabel').textContent = mrZoomLevel + '%';
}
