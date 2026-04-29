    let _rendering = false;
    async function renderAll(mi) {
      if (_rendering) return;
      _rendering = true;
      syncAllMonths(mi);
      await renderBalanceSheet();
      renderIncomeStatement();
      renderCashFlow();
      renderFinancialLiquidity();
      updateFlKpis();
      _rendering = false;
    }

    function syncAllMonths(mi) {
      document.getElementById('bsMonthSelect').value = mi;
      document.getElementById('isMonthSelect').value = mi;
      document.getElementById('cfMonthSelect').value = mi;
      document.getElementById('flMonthSelect').value = mi;
    }

    function switchTab(id, btn) {
      document.querySelectorAll('.fs-panel').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.getElementById('tab-' + id).classList.add('active');
      btn.classList.add('active');
      document.getElementById('kpiCardsIncome').classList.add('hidden');
      document.getElementById('kpiCardsBalance').classList.add('hidden');
      document.getElementById('kpiCardsEquity').classList.add('hidden');
      if (id === 'balance') {
        document.getElementById('kpiCardsBalance').classList.remove('hidden');
      } else if (id === 'equity') {
        document.getElementById('kpiCardsEquity').classList.remove('hidden');
      } else {
        document.getElementById('kpiCardsIncome').classList.remove('hidden');
      }

      // Re-measure headers only after the selected tab becomes visible.
      requestAnimationFrame(() => {
        if (id === 'balance') alignBsColHeader();
        if (id === 'income') alignIsColHeader();
        if (id === 'equity') alignFlColHeader();
      });
    }

    updateSideClock();
    setInterval(updateSideClock, 1000);
    // ---- Balance Sheet monthly data ----
    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

    const bsDataByYear = {
      2025: new Array(12).fill(null),
      2026: new Array(12).fill(null)
    };
    const bsNoteState = {};

    function toNum(v) {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    }

    function toBsShape(row) {
      if (!row) {
        return {
          cash: 0, inv: 0, ar: 0, agency: 0, loans: 0, supplies: 0, fixedPlant: 0, loansNC: 0, otherNC: 0,
          ap: 0, offa: 0, interFundAp: 0, loansP: 0, una_t: 0, una_nt: 0, alloc: 0, unexpP: 0, investP: 0
        };
      }
      return {
        cash: toNum(row.cash),
        inv: toNum(row.investments),
        ar: toNum(row.accounts_receivable),
        agency: toNum(row.cash_held_agency),
        loans: toNum(row.loans_receivable),
        supplies: toNum(row.supplies),
        fixedPlant: toNum(row.fixed_assets),
        loansNC: toNum(row.loans_nc),
        otherNC: toNum(row.other_assets_nc),
        ap: toNum(row.accounts_payable),
        offa: toNum(row.offerings_agency),
        interFundAp: toNum(row.interfund_ap),
        loansP: toNum(row.loans_payable),
        una_t: toNum(row.una_tithe),
        una_nt: toNum(row.una_non_tithe),
        alloc: toNum(row.allocated_na),
        unexpP: toNum(row.unexpended_plant),
        investP: toNum(row.invested_plant)
      };
    }

    function fmtNoteValue(v) {
      if (v == null || v === '') return '';
      const n = Number(v);
      if (!Number.isFinite(n)) return String(v);
      const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
      return n < 0 ? '(' + abs + ')' : abs;
    }

    function mapNoteRows(rows, noteKey) {
      return (rows || []).map(r => {
        const rt = String(r.row_type || '').toLowerCase();
        const label = r.label || '';
        let drillKey = r.drill_key || '';
        // Fallback: make SDA rows drillable even if drill_key is not set in DB.
        if (!drillKey && /sda entities within spuc/i.test(label)) {
          if (noteKey === 'ar') drillKey = 'sda';
          if (noteKey === 'ap') drillKey = 'sdaAp';
        }
        return {
          label,
          curr: fmtNoteValue(r.current_amount),
          prev: fmtNoteValue(r.previous_amount),
          sub: rt.includes('subtotal') || rt.includes('total'),
          group: rt.includes('group') || rt.includes('header') || rt.includes('section'),
          indent: !!r.is_indent,
          drill: drillKey,
          neg: toNum(r.current_amount) < 0 || toNum(r.previous_amount) < 0 || rt.includes('neg')
        };
      });
    }

    function renderSdaEntitiesRows(rows) {
      const tbody = document.getElementById('sdaTableBody');
      if (!tbody) return;
      tbody.innerHTML = (rows || []).map(r => {
        const name = r.entity_name || r.label || '';
        const amount = Number(r.amount);
        const cls = /total/i.test(name) ? 'nt-subtotal' : '';
        return `<tr class="${cls}"><td class="nt-label nt-indent">${name}</td><td class="nt-val">${Number.isFinite(amount) ? amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '-'}</td></tr>`;
      }).join('');
    }

    function renderSdaApEntitiesRows(rows) {
      const tbody = document.getElementById('sdaApTableBody');
      if (!tbody) return;
      tbody.innerHTML = (rows || []).map(r => {
        const name = r.entity_name || r.label || '';
        const baseAmount = Number(r.base_amount);
        const currAmount = Number(r.current_amount);
        const cls = /total/i.test(name) ? 'nt-subtotal' : '';
        const baseText = Number.isFinite(baseAmount) ? fmtNoteValue(baseAmount) : '-';
        const currText = Number.isFinite(currAmount) ? fmtNoteValue(currAmount) : '-';
        const baseCls = baseAmount < 0 ? ' nt-neg-val' : '';
        return `<tr class="${cls}"><td class="nt-label nt-indent">${name}</td><td class="nt-val${baseCls}">${baseText}</td><td class="nt-val">${currText}</td></tr>`;
      }).join('');
    }

    async function loadBalanceSheetMonth(mi) {
      if (bsDataByYear[2025][mi] && bsDataByYear[2026][mi] && bsNoteState[mi]
          && (bsNoteState[mi].sda.length > 0 || bsNoteState[mi].sdaAp.length > 0)) return;
      const month = mi + 1;
      const [
        bs2025Rows, bs2026Rows, cashRows, arRows, apRows, arEntityRows, apEntityRows
      ] = await Promise.all([
        fetchBalanceSheet(2025, month),
        fetchBalanceSheet(2026, month),
        fetchBalanceSheetNoteCash(2026, month),
        fetchBalanceSheetNoteAr(2026, month),
        fetchBalanceSheetNoteAp(2026, month),
        fetchBalanceSheetNoteArEntities(2026, month),
        fetchBalanceSheetNoteApEntities(2026, month)
      ]);

      bsDataByYear[2025][mi] = toBsShape((bs2025Rows || [])[0]);
      bsDataByYear[2026][mi] = toBsShape((bs2026Rows || [])[0]);
      bsNoteState[mi] = {
        cash: { title: 'NOTE 3 - CASH AND CASH EQUIVALENTS', rows: mapNoteRows(cashRows, 'cash') },
        ar: { title: 'NOTE 5 - ACCOUNTS RECEIVABLE', rows: mapNoteRows(arRows, 'ar') },
        ap: { title: 'NOTE 10 - ACCOUNTS PAYABLE', rows: mapNoteRows(apRows, 'ap') },
        sda: arEntityRows || [],
        sdaAp: apEntityRows || []
      };
    }

    function fmt(n) { return n.toLocaleString('en-US'); }

    function fmtM(n) {
      if (n >= 1e9) return '\u20B1' + (n/1e9).toFixed(2) + 'B';
      if (n >= 1e6) return '\u20B1' + (n/1e6).toFixed(2) + 'M';
      return '\u20B1' + n.toLocaleString('en-US');
    }

    function updateKPIs() {
      const isMi = parseInt(document.getElementById('isMonthSelect').value);
      const d = isData[isMi];
      const mn = MONTHS[isMi];
      const lastDay = new Date(2026, isMi + 1, 0).getDate();

      const totalInc26 = d.tithe26+d.offer26+d.inv26+d.other26;
      const totalExp26 = d.emp26+d.prog26+d.admin26+d.office26+d.gen26+d.plant26;
      const incBeforeApprop26 = totalInc26 - totalExp26;
      const appRec26  = d.appRec26  ?? 0;
      const appDisb26 = d.appDisb26 ?? 0;
      const ntRec26   = d.nonTitheRec26  ?? 0;
      const ntDisb26  = d.nonTitheDisb26 ?? 0;
      const incFromOps26 = incBeforeApprop26 + appRec26 + appDisb26 + ntRec26 + ntDisb26;
      const incBeforeTransfers26 = incFromOps26 + (d.capitalActivity26 ?? 0);
      const netEnd26 = d.netAssetsEnd26 ?? 0;

      document.getElementById('kpiRevenue').textContent     = fmtM(totalInc26);
      document.getElementById('kpiRevenueSub').textContent   = mn + ' 2026';
      document.getElementById('kpiExpenses').textContent    = fmtM(totalExp26);
      document.getElementById('kpiExpensesSub').textContent  = mn + ' 2026';
      document.getElementById('kpiCapital').textContent     = fmtM(incBeforeTransfers26);
      document.getElementById('kpiCapitalSub').textContent   = mn + ' 2026';
      document.getElementById('kpiNetAssets').textContent   = fmtM(netEnd26);
      document.getElementById('kpiNetAssetsSub').textContent = mn + ' ' + lastDay + ', 2026';
    }

    async function renderBalanceSheet() {
      const mi = parseInt(document.getElementById('bsMonthSelect').value);
      syncAllMonths(mi);
      try {
        await loadBalanceSheetMonth(mi);
      } catch (err) {
        console.error('Failed loading balance sheet data:', err);
      }
      const d25 = bsDataByYear[2025][mi];
      const d26 = bsDataByYear[2026][mi];
      const d = d26;
      const mn = MONTHS[mi];
      const lastDay = new Date(2026, mi + 1, 0).getDate();
      document.getElementById('bsPeriodLabel').textContent = mn.toUpperCase() + ' 2026';

      const tca25 = d25.cash + d25.inv + d25.ar + d25.agency + d25.loans + d25.supplies;
      const tca26 = d26.cash + d26.inv + d26.ar + d26.agency + d26.loans + d26.supplies;
      const fixedPlant25 = d25.fixedPlant;
      const fixedPlant26 = d26.fixedPlant;
      const tfa25 = fixedPlant25;
      const tfa26 = fixedPlant26;
      const loansNC25 = d25.loansNC;
      const loansNC26 = d26.loansNC;
      const otherNC25 = d25.otherNC;
      const otherNC26 = d26.otherNC;
      const toa25 = loansNC25 + otherNC25;
      const toa26 = loansNC26 + otherNC26;

      const ta25 = tca25 + tfa25 + toa25;
      const ta26 = tca26 + tfa26 + toa26;

      const tcl25 = d25.ap + d25.offa + d25.interFundAp;
      const tcl26 = d26.ap + d26.offa + d26.interFundAp;
      const loansP25 = d25.loansP;
      const loansP26 = d26.loansP;
      const tol25 = loansP25;
      const tol26 = loansP26;
      const tl25 = tcl25 + tol25;
      const tl26 = tcl26 + tol26;

      const unexpP25 = d25.unexpP;
      const unexpP26 = d26.unexpP;
      const investP25 = d25.investP;
      const investP26 = d26.investP;
      const tna25 = d25.una_t + d25.una_nt + d25.alloc + unexpP25 + investP25;
      const tna26 = d26.una_t + d26.una_nt + d26.alloc + unexpP26 + investP26;
      const tlna25 = tl25 + tna25;
      const tlna26 = tl26 + tna26;

      document.getElementById('bsTableBody').innerHTML = `
        <tr class="section-header"><td colspan="3">ASSETS</td></tr>
        <tr class="section-header"><td colspan="3" style="padding-left:20px;font-size:0.65rem;">Current Assets</td></tr>
        <tr class="bs-drilldown-row" onclick="openNote('cash')"><td class="fs-label indent">CASH AND CASH EQUIVALENTS (NOTE 3) <span class="drill-icon">&#9654;</span></td><td class="fs-amount center">${fmt(d25.cash)}</td><td class="fs-amount center">${fmt(d26.cash)}</td></tr>
        <tr><td class="fs-label indent">INVESTMENTS (NOTE 4)</td><td class="fs-amount center">${fmt(d25.inv)}</td><td class="fs-amount center">${fmt(d26.inv)}</td></tr>
        <tr class="bs-drilldown-row" onclick="openNote('ar')"><td class="fs-label indent">ACCOUNTS RECEIVABLE - NET (NOTE 5) <span class="drill-icon">&#9654;</span></td><td class="fs-amount center">${fmt(d25.ar)}</td><td class="fs-amount center">${fmt(d26.ar)}</td></tr>
        <tr><td class="fs-label indent">CASH HELD FOR AGENCY (NOTE 3)</td><td class="fs-amount center">${fmt(d25.agency)}</td><td class="fs-amount center">${fmt(d26.agency)}</td></tr>
        <tr><td class="fs-label indent">LOANS RECEIVABLE (NOTE 6)</td><td class="fs-amount center">${fmt(d25.loans)}</td><td class="fs-amount center">${fmt(d26.loans)}</td></tr>
        <tr><td class="fs-label indent">SUPPLIES AND PREPAID EXPENSES (NOTE 7)</td><td class="fs-amount center">${fmt(d25.supplies)}</td><td class="fs-amount center">${fmt(d26.supplies)}</td></tr>
        <tr class="subtotal-row"><td class="fs-label indent-sub">TOTAL CURRENT ASSETS</td><td class="fs-amount center">${fmt(tca25)}</td><td class="fs-amount center">${fmt(tca26)}</td></tr>
        <tr class="spacer"><td colspan="3"></td></tr>
        <tr class="section-header"><td colspan="3" style="padding-left:20px;font-size:0.65rem;">Fixed Assets - Net (Note 8)</td></tr>
        <tr><td class="fs-label indent">FOR USE BY SOUTHWESTERN PHILIPPINE UNION CONFERENCE, NET</td><td class="fs-amount center">${fmt(fixedPlant25)}</td><td class="fs-amount center">${fmt(fixedPlant26)}</td></tr>
        <tr class="subtotal-row"><td class="fs-label indent-sub">TOTAL FIXED ASSETS</td><td class="fs-amount center">${fmt(tfa25)}</td><td class="fs-amount center">${fmt(tfa26)}</td></tr>
        <tr class="spacer"><td colspan="3"></td></tr>
        <tr class="section-header"><td colspan="3" style="padding-left:20px;font-size:0.65rem;">Other Assets</td></tr>
        <tr><td class="fs-label indent">LOANS RECEIVABLE - NON-CURRENT (NOTE 6)</td><td class="fs-amount center">${fmt(loansNC25)}</td><td class="fs-amount center">${fmt(loansNC26)}</td></tr>
        <tr><td class="fs-label indent">OTHER ASSETS - NON-CURRENT</td><td class="fs-amount center">${fmt(otherNC25)}</td><td class="fs-amount center">${fmt(otherNC26)}</td></tr>
        <tr class="spacer"><td colspan="3"></td></tr>
        <tr class="total-row highlight"><td class="fs-label">TOTAL ASSETS</td><td class="fs-amount center gold">${fmt(ta25)}</td><td class="fs-amount center gold">${fmt(ta26)}</td></tr>
        <tr class="spacer"><td colspan="3"></td></tr>
        <tr><th class="fs-th" colspan="3">LIABILITIES</th></tr>
        <tr class="section-header"><td colspan="3" style="padding-left:20px;font-size:0.65rem;">Current Liabilities</td></tr>
        <tr class="bs-drilldown-row" onclick="openNote('ap')"><td class="fs-label indent">ACCOUNTS PAYABLE (NOTE 10) <span class="drill-icon">&#9654;</span></td><td class="fs-amount center">${fmt(d25.ap)}</td><td class="fs-amount center">${fmt(d26.ap)}</td></tr>
        <tr><td class="fs-label indent">OFFERINGS AND AGENCY (NOTE 11)</td><td class="fs-amount center">${fmt(d25.offa)}</td><td class="fs-amount center">${fmt(d26.offa)}</td></tr>
        <tr><td class="fs-label indent">INTER-FUND ACCOUNTS PAYABLE - CURRENT (NOTE 12)</td><td class="fs-amount center">${fmt(d25.interFundAp)}</td><td class="fs-amount center">${fmt(d26.interFundAp)}</td></tr>
        <tr class="subtotal-row"><td class="fs-label indent-sub">TOTAL CURRENT LIABILITIES</td><td class="fs-amount center">${fmt(tcl25)}</td><td class="fs-amount center">${fmt(tcl26)}</td></tr>
        <tr class="spacer"><td colspan="3"></td></tr>
        <tr class="section-header"><td colspan="3" style="padding-left:20px;font-size:0.65rem;">Other Liabilities</td></tr>
        <tr><td class="fs-label indent">LOANS PAYABLE - NON-CURRENT (NOTE 12)</td><td class="fs-amount center">${fmt(loansP25)}</td><td class="fs-amount center">${fmt(loansP26)}</td></tr>
        <tr class="subtotal-row"><td class="fs-label indent-sub">TOTAL OTHER LIABILITIES</td><td class="fs-amount center">${fmt(tol25)}</td><td class="fs-amount center">${fmt(tol26)}</td></tr>
        <tr class="spacer"><td colspan="3"></td></tr>
        <tr class="subtotal-row"><td class="fs-label">TOTAL LIABILITIES</td><td class="fs-amount center">${fmt(tl25)}</td><td class="fs-amount center">${fmt(tl26)}</td></tr>
        <tr class="spacer"><td colspan="3"></td></tr>
        <tr><th class="fs-th" colspan="3">NET ASSETS</th></tr>
        <tr><td class="fs-label indent">UNALLOCATED NET ASSETS - TITHE</td><td class="fs-amount center">${fmt(d25.una_t)}</td><td class="fs-amount center">${fmt(d26.una_t)}</td></tr>
        <tr><td class="fs-label indent">UNALLOCATED NET ASSETS - NON-TITHE</td><td class="fs-amount center">${fmt(d25.una_nt)}</td><td class="fs-amount center">${fmt(d26.una_nt)}</td></tr>
        <tr><td class="fs-label indent">ALLOCATED NET ASSETS</td><td class="fs-amount center">${fmt(d25.alloc)}</td><td class="fs-amount center">${fmt(d26.alloc)}</td></tr>
        <tr><td class="fs-label indent">UNEXPENDED PLANT</td><td class="fs-amount center">${fmt(unexpP25)}</td><td class="fs-amount center">${fmt(unexpP26)}</td></tr>
        <tr><td class="fs-label indent">INVESTED IN PLANT</td><td class="fs-amount center">${fmt(investP25)}</td><td class="fs-amount center">${fmt(investP26)}</td></tr>
        <tr class="subtotal-row"><td class="fs-label indent-sub">TOTAL NET ASSETS</td><td class="fs-amount center">${fmt(tna25)}</td><td class="fs-amount center">${fmt(tna26)}</td></tr>
        <tr class="spacer"><td colspan="3"></td></tr>
        <tr class="total-row highlight"><td class="fs-label">TOTAL LIABILITIES &amp; NET ASSETS</td><td class="fs-amount center gold">${fmt(tlna25)}</td><td class="fs-amount center gold">${fmt(tlna26)}</td></tr>
      `;
      updateKPIs();
      document.getElementById('kpiBsAssets').textContent        = fmtM(ta26);
      document.getElementById('kpiBsAssetsSub').textContent      = 'As of ' + mn + ' ' + lastDay + ', 2026';
      document.getElementById('kpiBsLiabilities').textContent    = fmtM(tl26);
      document.getElementById('kpiBsLiabilitiesSub').textContent = 'As of ' + mn + ' ' + lastDay + ', 2026';
      document.getElementById('kpiBsNetAssets').textContent      = fmtM(tna26);
      document.getElementById('kpiBsNetAssetsSub').textContent   = 'As of ' + mn + ' ' + lastDay + ', 2026';
      document.getElementById('kpiBsTotal').textContent          = fmtM(tlna26);
      document.getElementById('kpiBsTotalSub').textContent       = 'As of ' + mn + ' ' + lastDay + ', 2026';
      alignBsColHeader();
    }

    // ---- Initialization ----
    function alignBsColHeader() {
      const table = document.getElementById('bsTable');
      const header = document.getElementById('bsColHeader');
      if (!table || !header) return;

      const assetsLabel = header.querySelector('.bs-col-assets');
      const yearLabels = header.querySelectorAll('.bs-col-label');
      if (!assetsLabel || yearLabels.length < 2) return;

      // Use the first real data row with 3 cells (skip section/subheader rows with colspan)
      const probeCell = table.querySelector('tbody tr td:nth-child(3)');
      if (!probeCell) return;

      const row = probeCell.parentElement;
      if (!row) return;
      const cells = row.querySelectorAll('td');
      if (cells.length !== 3) return;

      const col1 = cells[0].getBoundingClientRect().width;
      const col2 = cells[1].getBoundingClientRect().width;
      const col3 = cells[2].getBoundingClientRect().width;

      // Force the top year bar to use the exact same 3-column geometry as the table.
      header.style.display = 'grid';
      header.style.gridTemplateColumns = `${col1}px ${col2}px ${col3}px`;

      assetsLabel.style.width = 'auto';
      assetsLabel.style.flex = 'initial';
      yearLabels[0].style.width = 'auto';
      yearLabels[0].style.flex = 'initial';
      yearLabels[1].style.width = 'auto';
      yearLabels[1].style.flex = 'initial';
    }

    function alignIsColHeader() {
      const table = document.getElementById('isTable');
      const header = document.getElementById('isColHeader');
      if (!table || !header) return;
      const probeCell = table.querySelector('tbody tr td:nth-child(4)');
      if (!probeCell) return;
      const row = probeCell.parentElement;
      if (!row) return;
      const cells = row.querySelectorAll('td');
      if (cells.length !== 4) return;
      const w1 = cells[0].getBoundingClientRect().width;
      const w2 = cells[1].getBoundingClientRect().width;
      const w3 = cells[2].getBoundingClientRect().width;
      const w4 = cells[3].getBoundingClientRect().width;
      // If tab is hidden, widths become 0 and labels collapse/merge.
      if (w1 <= 0 || w2 <= 0 || w3 <= 0 || w4 <= 0) return;
      const assetsLabel = header.querySelector('.is-col-assets');
      const yearLabels = header.querySelectorAll('.is-col-label');
      if (!assetsLabel || yearLabels.length < 3) return;
      assetsLabel.style.width = w1 + 'px';
      assetsLabel.style.flex = '0 0 ' + w1 + 'px';
      yearLabels[0].style.width = w2 + 'px';
      yearLabels[0].style.flex = '0 0 ' + w2 + 'px';
      yearLabels[1].style.width = w3 + 'px';
      yearLabels[1].style.flex = '0 0 ' + w3 + 'px';
      yearLabels[2].style.width = w4 + 'px';
      yearLabels[2].style.flex = '0 0 ' + w4 + 'px';
    }

    function alignFlColHeader() {
      const table = document.getElementById('flTable');
      const header = document.getElementById('flColHeader');
      if (!table || !header) return;
      const probeCell = table.querySelector('tbody tr td:nth-child(3)');
      if (!probeCell) return;
      const row = probeCell.parentElement;
      if (!row) return;
      const cells = row.querySelectorAll('td');
      if (cells.length !== 3) return;

      const w1 = cells[0].getBoundingClientRect().width;
      const w2 = cells[1].getBoundingClientRect().width;
      const w3 = cells[2].getBoundingClientRect().width;
      if (w1 <= 0 || w2 <= 0 || w3 <= 0) return;

      const assetsLabel = header.querySelector('.fl-col-assets');
      const yearLabels = header.querySelectorAll('.fl-col-label');
      if (!assetsLabel || yearLabels.length < 2) return;

      assetsLabel.style.width = w1 + 'px';
      assetsLabel.style.flex = '0 0 ' + w1 + 'px';
      yearLabels[0].style.width = w2 + 'px';
      yearLabels[0].style.flex = '0 0 ' + w2 + 'px';
      yearLabels[1].style.width = w3 + 'px';
      yearLabels[1].style.flex = '0 0 ' + w3 + 'px';
    }

    window.addEventListener('DOMContentLoaded', async () => {
      const cur = new Date().getMonth();
      await renderAll(cur);
    });
    window.addEventListener('resize', () => { alignBsColHeader(); alignIsColHeader(); alignFlColHeader(); });

    let bsZoomLevel = 100;
    function bsZoom(dir) {
      bsZoomLevel = Math.min(200, Math.max(60, bsZoomLevel + dir * 10));
      const inner = document.getElementById('bsTableScroll');
      const scale = bsZoomLevel / 100;
      inner.style.transformOrigin = 'top left';
      inner.style.transform = `scale(${scale})`;
      inner.style.width = (100 / scale) + '%';
      inner.style.height = 'auto';
      // Expand the outer container to fit the scaled content
      const outer = inner.parentElement;
      outer.style.height = (inner.scrollHeight * scale) + 'px';
      document.getElementById('bsZoomLabel').textContent = bsZoomLevel + '%';
    }

    // ---- Income Statement monthly data ----
    const isData = [
      { tithe25:12380337,tithe26:10224173,offer25:1168882,offer26:1438331,inv25:9650,inv26:7711,other25:501917,other26:463182,budgetInc26:13717319,emp25:2548906,emp26:2565212,prog25:2261240,prog26:3214341,admin25:847047,admin26:751343,office25:125432,office26:66196,gen25:271014,gen26:38794,plant25:921917,plant26:867154,budgetExp26:7464603,netAssetsBeg:348889046 },
      { tithe25:11850200,tithe26:9980450,offer25:1090300,offer26:1320180,inv25:8420,inv26:7100,other25:478300,other26:441200,budgetInc26:13200000,emp25:2410500,emp26:2490300,prog25:2180600,prog26:3050200,admin25:810200,admin26:720100,office25:118300,office26:61400,gen25:258700,gen26:35200,plant25:890400,plant26:840200,budgetExp26:7200000,netAssetsBeg:353403633 },
      // Mar - exact figures from screenshot
      { tithe25:35005774,tithe26:37495773,offer25:3131676,offer26:3461072,inv25:28948,inv26:23856,other25:22804157,other26:4712385,
        budgetInc26:54869275,
        emp25:7645418,emp26:7685282,prog25:52845511,prog26:7241960,admin25:4230583,admin26:5021515,office25:359374,office26:411354,gen25:287511,gen26:309970,plant25:3622892,plant26:3360333,
        budgetExp26:29858414,
        // Operating Fund vs Plan tFund splits
        titheOF:37495773, tithePF:0,
        offerOF:3461072,  offerPF:0,
        invOF:23856,      invPF:0,
        otherOF:4712385,  otherPF:0,
        empOF:7685282,    empPF:0,
        progOF:7241960,   progPF:0,
        adminOF:5021515,  adminPF:0,
        officeOF:411354,  officePF:0,
        genOF:309970,     genPF:0,
        plantOF:1707233,  plantPF:1653100,
        appRec26:0,appRec25:851355,appDisb26:-1730000,appDisb25:-19627170,
        appDisb26OF:-1730000, appDisb26PF:0,
        nonTitheRec26:59000,nonTitheRec25:0,nonTitheDisb26:0,nonTitheDisb25:-408333,
        nonTitheRec26OF:59000, nonTitheRec26PF:0,
        capitalActivity26:0,capitalActivity25:0,
        transferBetweenFunc26:-72493,transferBetweenFunc25:-4745076,
        transferBetweenFunc26OF:-72493, transferBetweenFunc26PF:72493,
        transferBetweenFunds26:0,transferBetweenFunds25:-1933333,
        netAssetsBeg26:338992649,netAssetsBeg25:324883755,
        netAssetsBeg26OF:270250888, netAssetsBeg26PF:68741756,
        netAssetsEnd26:358984314,netAssetsEnd25:315171033,
        netAssetsEnd26OF:291823166, netAssetsEnd26PF:67161149 },
      { tithe25:12950800,tithe26:10680200,offer25:1210400,offer26:1490300,inv25:9900,inv26:8050,other25:515200,other26:475800,budgetInc26:13850000,emp25:2620100,emp26:2650800,prog25:2310500,prog26:3280100,admin25:865400,admin26:762300,office25:128700,office26:67800,gen25:278300,gen26:39500,plant25:935600,plant26:872400,budgetExp26:7520000,netAssetsBeg:362204283 },
      { tithe25:11680400,tithe26:9620100,offer25:1050200,offer26:1280500,inv25:8100,inv26:6850,other25:462100,other26:428300,budgetInc26:12900000,emp25:2320400,emp26:2410200,prog25:2090300,prog26:2980400,admin25:782100,admin26:698500,office25:112400,office26:58200,gen25:248900,gen26:33800,plant25:862100,plant26:815300,budgetExp26:6980000,netAssetsBeg:366824783 },
      { tithe25:13580200,tithe26:11240500,offer25:1290800,offer26:1580200,inv25:10800,inv26:8900,other25:542600,other26:502100,budgetInc26:14500000,emp25:2750800,emp26:2790300,prog25:2450200,prog26:3410600,admin25:912500,admin26:801400,office25:136800,office26:72900,gen25:293100,gen26:43100,plant25:968400,plant26:912600,budgetExp26:7890000,netAssetsBeg:370404983 },
      { tithe25:11420600,tithe26:9410300,offer25:1028400,offer26:1250800,inv25:7850,inv26:6620,other25:451200,other26:418600,budgetInc26:12600000,emp25:2280100,emp26:2370500,prog25:2050800,prog26:2920100,admin25:768400,admin26:685200,office25:109800,office26:56800,gen25:243200,gen26:32900,plant25:845600,plant26:798400,budgetExp26:6820000,netAssetsBeg:375585283 },
      { tithe25:12680300,tithe26:10480200,offer25:1148600,offer26:1408300,inv25:9200,inv26:7500,other25:498300,other26:461200,budgetInc26:13500000,emp25:2510200,emp26:2540800,prog25:2230400,prog26:3150200,admin25:838600,admin26:742100,office25:124200,office26:64800,gen25:268400,gen26:37600,plant25:912300,plant26:858200,budgetExp26:7380000,netAssetsBeg:379005383 },
      { tithe25:13820400,tithe26:11420600,offer25:1312500,offer26:1608400,inv25:11100,inv26:9100,other25:551800,other26:510400,budgetInc26:14800000,emp25:2790500,emp26:2830100,prog25:2490600,prog26:3460800,admin25:928400,admin26:815600,office25:139200,office26:74500,gen25:298400,gen26:44200,plant25:982100,plant26:926800,budgetExp26:8020000,netAssetsBeg:383285883 },
      { tithe25:11180200,tithe26:9210400,offer25:1008200,offer26:1228600,inv25:7600,inv26:6400,other25:441800,other26:409200,budgetInc26:12300000,emp25:2240800,emp26:2330200,prog25:2010400,prog26:2860500,admin25:754200,admin26:672400,office25:107200,office26:55400,gen25:237800,gen26:32100,plant25:829800,plant26:782100,budgetExp26:6680000,netAssetsBeg:388666083 },
      { tithe25:12420500,tithe26:10280300,offer25:1128400,offer26:1380600,inv25:8950,inv26:7300,other25:488600,other26:452400,budgetInc26:13300000,emp25:2470600,emp26:2510400,prog25:2190800,prog26:3100500,admin25:824800,admin26:730600,office25:121600,office26:63200,gen25:263100,gen26:36800,plant25:898600,plant26:845800,budgetExp26:7260000,netAssetsBeg:391946483 },
      { tithe25:14280600,tithe26:11820400,offer25:1358200,offer26:1658800,inv25:11500,inv26:9400,other25:568400,other26:526200,budgetInc26:15200000,emp25:2850200,emp26:2890600,prog25:2550800,prog26:3520400,admin25:948600,admin26:832800,office25:142800,office26:76400,gen25:305200,gen26:45600,plant25:998600,plant26:942400,budgetExp26:8180000,netAssetsBeg:396126683 }
    ];

    function fmtIs(n) { return n ? n.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}) : ''; }

    function renderIncomeStatement() {
      const mi = parseInt(document.getElementById('isMonthSelect').value);
      syncAllMonths(mi);
      const d = isData[mi];
      const mn = MONTHS[mi];
      const lastDay = new Date(2026, mi + 1, 0).getDate();
      document.getElementById('isPeriodLabel').textContent = mn.toUpperCase() + ' 2026';

      // helpers - OF = Operating Fund, PF = Plan tFund
      const g = (v) => v ?? 0;
      const fi = (n) => n ? n.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}) : '';
      const fn = (n) => n ? '(' + Math.abs(n).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}) + ')' : '';
      const fc = (n) => n ? n.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}) : '';

      // Income
      const titheOF=g(d.titheOF??d.tithe26), tithePF=g(d.tithePF);
      const offerOF=g(d.offerOF??d.offer26), offerPF=g(d.offerPF);
      const invOF=g(d.invOF??d.inv26),       invPF=g(d.invPF);
      const otherOF=g(d.otherOF??d.other26), otherPF=g(d.otherPF);
      const totalIncOF=titheOF+offerOF+invOF+otherOF;
      const totalIncPF=tithePF+offerPF+invPF+otherPF;
      const totalInc26=totalIncOF+totalIncPF;
      const totalInc25=d.tithe25+d.offer25+d.inv25+d.other25;

      // Expenses
      const empOF=g(d.empOF??d.emp26),     empPF=g(d.empPF);
      const progOF=g(d.progOF??d.prog26),  progPF=g(d.progPF);
      const adminOF=g(d.adminOF??d.admin26),adminPF=g(d.adminPF);
      const officeOF=g(d.officeOF??d.office26),officePF=g(d.officePF);
      const genOF=g(d.genOF??d.gen26),     genPF=g(d.genPF);
      const plantOF=g(d.plantOF??d.plant26),plantPF=g(d.plantPF);
      const totalExpOF=empOF+progOF+adminOF+officeOF+genOF+plantOF;
      const totalExpPF=empPF+progPF+adminPF+officePF+genPF+plantPF;
      const totalExp26=totalExpOF+totalExpPF;
      const totalExp25=d.emp25+d.prog25+d.admin25+d.office25+d.gen25+d.plant25;
      const incBefAppOF=totalIncOF-totalExpOF;
      const incBefAppPF=totalIncPF-totalExpPF;
      const incBefApp26=incBefAppOF+incBefAppPF;
      const incBefApp25=totalInc25-totalExp25;

      // Appropriations
      const appRec26=g(d.appRec26),appRec25=g(d.appRec25);
      const appDisb26OF=g(d.appDisb26OF??d.appDisb26),appDisb26PF=g(d.appDisb26PF);
      const appDisb26=appDisb26OF+appDisb26PF, appDisb25=g(d.appDisb25);
      const ntRec26OF=g(d.nonTitheRec26OF??d.nonTitheRec26),ntRec26PF=g(d.nonTitheRec26PF);
      const ntRec26=ntRec26OF+ntRec26PF, ntRec25=g(d.nonTitheRec25);
      const ntDisb26=g(d.nonTitheDisb26),ntDisb25=g(d.nonTitheDisb25);
      const netAppOF=appRec26+appDisb26OF+ntRec26OF+ntDisb26;
      const netAppPF=appDisb26PF+ntRec26PF;
      const netApp26=netAppOF+netAppPF;
      const netApp25=appRec25+appDisb25+ntRec25+ntDisb25;
      const incOpsOF=incBefAppOF+netAppOF;
      const incOpsPF=incBefAppPF+netAppPF;
      const incOps26=incOpsOF+incOpsPF;
      const incOps25=incBefApp25+netApp25;

      // Capital
      const cap26=g(d.capitalActivity26),cap25=g(d.capitalActivity25);
      const incBefTrOF=incOpsOF+cap26;
      const incBefTrPF=incOpsPF;
      const incBefTr26=incOps26+cap26;
      const incBefTr25=incOps25+cap25;

      // Transfers
      const tfFuncOF=g(d.transferBetweenFunc26OF??d.transferBetweenFunc26);
      const tfFuncPF=g(d.transferBetweenFunc26PF);
      const tfFunc26=tfFuncOF+tfFuncPF, tfFunc25=g(d.transferBetweenFunc25);
      const tfFunds26=g(d.transferBetweenFunds26),tfFunds25=g(d.transferBetweenFunds25);
      const netIncOF=incBefTrOF+tfFuncOF+tfFunds26;
      const netIncPF=incBefTrPF+tfFuncPF;
      const netInc26=netIncOF+netIncPF;
      const netInc25=incBefTr25+tfFunc25+tfFunds25;

      const netBeg26OF=g(d.netAssetsBeg26OF??d.netAssetsBeg26??d.netAssetsBeg);
      const netBeg26PF=g(d.netAssetsBeg26PF);
      const netBeg26=netBeg26OF+netBeg26PF, netBeg25=g(d.netAssetsBeg25);
      const netEnd26OF=g(d.netAssetsEnd26OF), netEnd26PF=g(d.netAssetsEnd26PF);
      const netEnd26=g(d.netAssetsEnd26), netEnd25=g(d.netAssetsEnd25);

      const C = (v,neg=false) => `<td class="fs-amount center${neg?' neg':''}">${neg&&v?fn(v):fc(v)}</td>`;
      const row = (label,of,pf,t26,bud,t25,cls='',neg=false) =>
        `<tr class="${cls}"><td class="fs-label${cls.includes('indent')?' indent':''}">${
          label}</td>${C(t26,neg)}${C(bud)}${C(t25,neg)}</tr>`;
      const subtotalRow = (label,of,pf,t26,bud,t25) =>
        `<tr class="subtotal-row"><td class="fs-label indent-sub">${label}</td>${C(t26)}${C(bud)}${C(t25)}</tr>`;
      const highlightRow = (label,of,pf,t26,bud,t25) =>
        `<tr class="income-highlight-row"><td class="fs-label">${label}</td>${C(t26)}${C(bud)}${C(t25)}</tr>`;
      const totalRow = (label,of,pf,t26,bud,t25) =>
        `<tr class="total-row highlight"><td class="fs-label">${label}</td><td class="fs-amount center gold">${fc(t26)}</td><td class="fs-amount center gold">${fc(bud)}</td><td class="fs-amount center gold">${fc(t25)}</td></tr>`;
      const secHdr = (label,cols=6) =>
        `<tr class="section-header"><td colspan="4">${label}</td></tr>`;
      const subSecHdr = (label,cols=6) =>
        `<tr class="section-header"><td colspan="4" style="padding-left:20px;font-size:0.65rem;">${label}</td></tr>`;
      const spacer = () => `<tr class="spacer"><td colspan="4"></td></tr>`;
      const budgetRow = (label,bud) =>
        `<tr class="income-budget-row"><td class="fs-label indent-sub">${label}</td><td class="fs-amount center"></td><td class="fs-amount center">${fc(bud)}</td><td class="fs-amount center"></td></tr>`;

      document.getElementById('isTableBody').innerHTML =
        secHdr('OPERATING ACTIVITY') +
        subSecHdr('Operating Income') +
        row('TITHE INCOME, NET (NOTE 14)',titheOF,tithePF,d.tithe26,48277235,d.tithe25) +
        row('OFFERING INCOME &amp; SPECIFIC DONATIONS',offerOF,offerPF,d.offer26,5753325,d.offer25) +
        row('INVESTMENT INCOME (NOTE 4)',invOF,invPF,d.inv26,200000,d.inv25) +
        row('OTHER OPERATING INCOME',otherOF,otherPF,d.other26,638715,d.other25) +
        subtotalRow('TOTAL EARNED OPERATING INCOME',totalIncOF,totalIncPF,totalInc26,d.budgetInc26,totalInc25) +
        spacer() +
        subSecHdr('Operating Expenses') +
        row('EMPLOYEE RELATED EXPENSES (NOTE 19)',empOF,empPF,d.emp26,11676469,d.emp25) +
        row('PROGRAM SPECIFIC EXPENSES (NOTE 21)',progOF,progPF,d.prog26,6554466,d.prog25) +
        row('ADMINISTRATIVE EXPENSES (NOTE 19)',adminOF,adminPF,d.admin26,7186771,d.admin25) +
        row('OFFICE EXPENSES (NOTE 20a)',officeOF,officePF,d.office26,867867,d.office25) +
        row('GENERAL EXPENSES (NOTE 20b)',genOF,genPF,d.gen26,793736,d.gen25) +
        row('PLANT OPERATION EXPENSES (NOTE 21)',plantOF,plantPF,d.plant26,2779075,d.plant25) +
        subtotalRow('TOTAL OPERATING EXPENSES',totalExpOF,totalExpPF,totalExp26,d.budgetExp26,totalExp25) +
        budgetRow('BUDGETED OP EXPENSES '+mn.toUpperCase()+' 2026', d.budgetExp26) +
        highlightRow('INCREASE (DECREASE) BEFORE APPROP',incBefAppOF,incBefAppPF,incBefApp26,'',incBefApp25) +
        spacer() +
        subSecHdr('Operating Appropriations') +
        row('TITHE APPROPRIATION RECEIVED (S-22)',0,0,appRec26,851355,appRec25) +
        row('TITHE APPROPRIATION DISBURSED (S-23)',appDisb26OF,appDisb26PF,appDisb26,-19627170,appDisb25,"",true) +
        row('NON-TITHE APPROPRIATION RECEIVED (S-24)',ntRec26OF,ntRec26PF,ntRec26,851696,ntRec25) +
        row('NON-TITHE APPROPRIATION DISBURSED (S-25)',0,0,ntDisb26,-408333,ntDisb25,"",true) +
        subtotalRow('NET APPROPRIATION RETAINED',netAppOF,netAppPF,netApp26,-18332452,netApp25) +
        highlightRow('INCREASE (DECREASE) FROM OPERATIONS',incOpsOF,incOpsPF,incOps26,6678409,incOps25) +
        spacer() +
        secHdr('CAPITAL ACTIVITY') +
        row('NET CAPITAL INCREASE (DECREASE)',0,0,cap26,0,cap25) +
        highlightRow('INCREASE (DECREASE) BEFORE TRANSFERS',incBefTrOF,incBefTrPF,incBefTr26,6678409,incBefTr25) +
        spacer() +
        secHdr('TRANSFERS') +
        row('TRANSFERS BETWEEN FUNCTIONS/RESOURCES',tfFuncOF,tfFuncPF,tfFunc26,-4745076,tfFunc25) +
        row('TRANSFERS BETWEEN FUNDS',0,0,tfFunds26,-1933333,tfFunds25) +
        spacer() +
        subtotalRow('NET ASSETS INCREASE (DECREASE) FOR THE YEAR',netIncOF,netIncPF,netInc26,-0,netInc25) +
        row('NET ASSETS, JANUARY 1, 2026',netBeg26OF,netBeg26PF,netBeg26,'',netBeg25) +
        totalRow('NET ASSETS, '+mn.toUpperCase()+' '+lastDay+', 2026',netEnd26OF,netEnd26PF,netEnd26,'',netEnd25);

      updateKPIs();
      alignIsColHeader();
    }

    // ---- Income Statement zoom ----
    let isZoomLevel = 100;
    function isZoom(dir) {
      isZoomLevel = Math.min(200, Math.max(60, isZoomLevel + dir * 10));
      const inner = document.getElementById('isTableScroll');
      const scale = isZoomLevel / 100;
      inner.style.transformOrigin = 'top left';
      inner.style.transform = `scale(${scale})`;
      inner.style.width = (100 / scale) + '%';
      inner.style.height = 'auto';
      const outer = inner.parentElement;
      outer.style.height = (inner.scrollHeight * scale) + 'px';
      document.getElementById('isZoomLabel').textContent = isZoomLevel + '%';
    }

    // ---- Cash Flow monthly data ----
    const cfData = [
      { tithes:61301229.98, offerings:23721985.60, ops:46700000, remit:15500000, equip:2500000, disposal:350000, loan:0, cashBeg:17776784.42 },
      { tithes:58420180.00, offerings:22380450.00, ops:44200000, remit:14800000, equip:1800000, disposal:200000, loan:0, cashBeg:38450000.00 },
      { tithes:63480300.00, offerings:24920400.00, ops:47800000, remit:15900000, equip:2100000, disposal:420000, loan:0, cashBeg:62050630.00 },
      { tithes:62150200.00, offerings:23890300.00, ops:46500000, remit:15600000, equip:2300000, disposal:310000, loan:0, cashBeg:85271030.00 },
      { tithes:57320100.00, offerings:21780500.00, ops:43900000, remit:14500000, equip:1600000, disposal:180000, loan:0, cashBeg:109016030.00 },
      { tithes:65840500.00, offerings:25580200.00, ops:49200000, remit:16400000, equip:2600000, disposal:480000, loan:0, cashBeg:131396030.00 },
      { tithes:56910300.00, offerings:21250800.00, ops:43100000, remit:14200000, equip:1500000, disposal:160000, loan:0, cashBeg:157696030.00 },
      { tithes:61480200.00, offerings:23408300.00, ops:46100000, remit:15300000, equip:2000000, disposal:280000, loan:0, cashBeg:178406030.00 },
      { tithes:66420600.00, offerings:25608400.00, ops:49800000, remit:16600000, equip:2700000, disposal:520000, loan:0, cashBeg:201974030.00 },
      { tithes:55210400.00, offerings:20828600.00, ops:42500000, remit:14000000, equip:1400000, disposal:140000, loan:0, cashBeg:226824030.00 },
      { tithes:60280300.00, offerings:22880600.00, ops:45400000, remit:15100000, equip:1900000, disposal:240000, loan:0, cashBeg:245294030.00 },
      { tithes:68820400.00, offerings:26658800.00, ops:51200000, remit:17100000, equip:2900000, disposal:580000, loan:0, cashBeg:266314030.00 }
    ];

    function fmtCf(n) { return '\u20B1 ' + Math.abs(n).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}); }
    function fmtCfNeg(n) { return '( \u20B1 ' + n.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}) + ' )'; }

    function renderCashFlow() {
      const mi = parseInt(document.getElementById('cfMonthSelect').value);
      syncAllMonths(mi);
      const d = cfData[mi];
      const mn = MONTHS[mi];
      const lastDay = new Date(2026, mi + 1, 0).getDate();
      document.getElementById('cfPeriodLabel').textContent = mn.toUpperCase() + ' 2026';
      const netOps = d.tithes + d.offerings - d.ops - d.remit;
      const netInv = d.disposal - d.equip;
      const netFin = -d.loan;
      const netIncrease = netOps + netInv + netFin;
      const cashEnd = d.cashBeg + netIncrease;
      document.getElementById('cfTableBody').innerHTML = `
        <tr class="section-header"><td colspan="2">OPERATING ACTIVITIES</td></tr>
        <tr><td class="fs-label indent">CASH RECEIVED FROM TITHES</td><td class="fs-amount">${fmtCf(d.tithes)}</td></tr>
        <tr><td class="fs-label indent">CASH RECEIVED FROM OFFERINGS</td><td class="fs-amount">${fmtCf(d.offerings)}</td></tr>
        <tr><td class="fs-label indent">CASH PAID FOR OPERATIONS</td><td class="fs-amount neg">${fmtCfNeg(d.ops)}</td></tr>
        <tr><td class="fs-label indent">CASH REMITTED TO DIVISION</td><td class="fs-amount neg">${fmtCfNeg(d.remit)}</td></tr>
        <tr class="subtotal-row"><td class="fs-label">NET CASH FROM OPERATIONS</td><td class="fs-amount">${fmtCf(netOps)}</td></tr>
        <tr class="spacer"><td colspan="2"></td></tr>
        <tr class="section-header"><td colspan="2">INVESTING ACTIVITIES</td></tr>
        <tr><td class="fs-label indent">PURCHASE OF EQUIPMENT</td><td class="fs-amount neg">${fmtCfNeg(d.equip)}</td></tr>
        <tr><td class="fs-label indent">PROCEEDS FROM ASSET DISPOSAL</td><td class="fs-amount">${fmtCf(d.disposal)}</td></tr>
        <tr class="subtotal-row"><td class="fs-label">NET CASH FROM INVESTING</td><td class="fs-amount ${netInv < 0 ? 'neg' : ''}">${netInv < 0 ? fmtCfNeg(-netInv) : fmtCf(netInv)}</td></tr>
        <tr class="spacer"><td colspan="2"></td></tr>
        <tr class="section-header"><td colspan="2">FINANCING ACTIVITIES</td></tr>
        <tr><td class="fs-label indent">LOAN REPAYMENTS</td><td class="fs-amount neg">${fmtCfNeg(d.loan)}</td></tr>
        <tr class="subtotal-row"><td class="fs-label">NET CASH FROM FINANCING</td><td class="fs-amount">${fmtCf(0)}</td></tr>
        <tr class="spacer"><td colspan="2"></td></tr>
        <tr class="total-row highlight"><td class="fs-label">NET INCREASE IN CASH</td><td class="fs-amount gold">${fmtCf(netIncrease)}</td></tr>
        <tr><td class="fs-label indent">CASH - BEGINNING OF PERIOD</td><td class="fs-amount">${fmtCf(d.cashBeg)}</td></tr>
        <tr class="total-row highlight"><td class="fs-label">CASH - END OF PERIOD (${mn.toUpperCase()} ${lastDay}, 2026)</td><td class="fs-amount gold">${fmtCf(cashEnd)}</td></tr>
      `;
    }

    let cfZoomLevel = 100;
    function cfZoom(dir) {
      cfZoomLevel = Math.min(200, Math.max(60, cfZoomLevel + dir * 10));
      const inner = document.getElementById('cfTableScroll');
      const scale = cfZoomLevel / 100;
      inner.style.transformOrigin = 'top left';
      inner.style.transform = `scale(${scale})`;
      inner.style.width = (100 / scale) + '%';
      inner.style.height = 'auto';
      inner.parentElement.style.height = (inner.scrollHeight * scale) + 'px';
      document.getElementById('cfZoomLabel').textContent = cfZoomLevel + '%';
    }

    // ---- Financial Indicator (Note 20) ----
    const flData = [
      {
        coreOperating26: 136697749, coreOperating25: 84546205,
        coreRemittance26: 63058071, coreRemittance25: 152153779,
        currentAssets26: 379691345, currentAssets25: 406661295,
        currentLiab26: 106805367, currentLiab25: 177780486,
        donorRestriction26: 17189257, donorRestriction25: 5216467,
        cash26: 205269532, cash25: 269820967,
        heldForAgency26: 19791231, heldForAgency25: 15210862,
        investments26: 35838949, investments25: 36009254,
        workingMonths26: 16, workingMonths25: 6,
        liquidMonths26: 10, liquidMonths25: 5,
        recommendedMonthsWc26: 9, recommendedMonthsWc25: 18,
        requiredMonthsWc: 6,
        recommendedMonthsLa26: 6, recommendedMonthsLa25: 12,
        requiredMonthsLa: 3
      }
    ];

    let flShowPercentage = false;

    function fmtFl(n) { return n.toLocaleString('en-US'); }
    function fmtFlNeg(n) { return '(' + Math.abs(n).toLocaleString('en-US') + ')'; }
    function fmtFlPct(n) { return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'; }

    function toggleFlMode() {
      flShowPercentage = !flShowPercentage;
      document.getElementById('flPctBtn').textContent = flShowPercentage ? 'VIEW MONTHS' : '% SEE PERCENTAGE';
      renderFinancialLiquidity();
      updateFlKpis();
    }

    function updateFlKpis() {
      const d = flData[0];
      if (flShowPercentage) {
        document.getElementById('kpiWcMonths').textContent = '273.95%';
        document.getElementById('kpiLaMonths').textContent = '135.06%';
      } else {
        document.getElementById('kpiWcMonths').textContent = d.workingMonths26 + ' months';
        document.getElementById('kpiLaMonths').textContent = d.liquidMonths26 + ' months';
      }
    }

    function renderFinancialLiquidity() {
      const d = flData[0];
      const mi = parseInt(document.getElementById('flMonthSelect').value);
      syncAllMonths(mi);
      const mn = MONTHS[mi];
      document.getElementById('flPeriodLabel').textContent = mn.toUpperCase() + ' 2026';

      const coreTotal26 = d.coreOperating26 + d.coreRemittance26;
      const coreTotal25 = d.coreOperating25 + d.coreRemittance25;

      const availableWorkingCapital26 = d.currentAssets26 - d.currentLiab26 - d.donorRestriction26;
      const availableWorkingCapital25 = d.currentAssets25 - d.currentLiab25 - d.donorRestriction25;

      const recWcMin26 = (coreTotal26 / 12) * d.recommendedMonthsWc26;
      const recWcMin25 = (coreTotal25 / 12) * d.recommendedMonthsWc25;
      const wcSurplus26 = availableWorkingCapital26 - recWcMin26;
      const wcSurplus25 = availableWorkingCapital25 - recWcMin25;
      const wcMonths26 = availableWorkingCapital26 / (coreTotal26 / 12);
      const wcMonths25 = availableWorkingCapital25 / (coreTotal25 / 12);
      const wcMonthsDisplay26 = d.workingMonths26 ?? Math.round(wcMonths26);
      const wcMonthsDisplay25 = d.workingMonths25 ?? Math.round(wcMonths25);

      const totalLiquidCurrentAssets26 = d.cash26 - d.heldForAgency26 + d.investments26;
      const totalLiquidCurrentAssets25 = d.cash25 - d.heldForAgency25 + d.investments25;
      const totalCommitments26 = d.currentLiab26 + d.donorRestriction26;
      const totalCommitments25 = d.currentLiab25 + d.donorRestriction25;
      const availableLiquidAssets26 = totalLiquidCurrentAssets26 - totalCommitments26;
      const availableLiquidAssets25 = totalLiquidCurrentAssets25 - totalCommitments25;

      const recLaMin26 = ((coreTotal26 * 0.5) / 12) * d.recommendedMonthsLa26;
      const recLaMin25 = ((coreTotal25 * 0.5) / 12) * d.recommendedMonthsLa25;
      const laSurplus26 = availableLiquidAssets26 - recLaMin26;
      const laSurplus25 = availableLiquidAssets25 - recLaMin25;
      const laMonths26 = availableLiquidAssets26 / ((coreTotal26 * 0.5) / 12);
      const laMonths25 = availableLiquidAssets25 / ((coreTotal25 * 0.5) / 12);
      const laMonthsDisplay26 = d.liquidMonths26 ?? Math.round(laMonths26);
      const laMonthsDisplay25 = d.liquidMonths25 ?? Math.round(laMonths25);

      const wcCoverage26 = (availableWorkingCapital26 / recWcMin26) * 100;
      const wcCoverage25 = (availableWorkingCapital25 / recWcMin25) * 100;
      const liquidCoverage26 = (availableLiquidAssets26 / recLaMin26) * 100;
      const liquidCoverage25 = (availableLiquidAssets25 / recLaMin25) * 100;

      document.getElementById('flTableBody').innerHTML = `
          <tr class="section-header"><td colspan="3">CORE EXPENSES</td></tr>
          <tr><td class="fs-label indent">OPERATING EXPENSES</td><td class="fs-amount center">${fmtFl(d.coreOperating26)}</td><td class="fs-amount center">${fmtFl(d.coreOperating25)}</td></tr>
          <tr><td class="fs-label indent">NET OUTGOING REMITTANCE</td><td class="fs-amount center">${fmtFl(d.coreRemittance26)}</td><td class="fs-amount center">${fmtFl(d.coreRemittance25)}</td></tr>
          <tr class="subtotal-row"><td class="fs-label indent-sub">TOTAL CORE EXPENSES</td><td class="fs-amount center">${fmtFl(coreTotal26)}</td><td class="fs-amount center">${fmtFl(coreTotal25)}</td></tr>
          <tr class="spacer"><td colspan="3"></td></tr>

          <tr class="section-header"><td colspan="3">AVAILABLE WORKING CAPITAL</td></tr>
          <tr><td class="fs-label indent">CURRENT ASSETS</td><td class="fs-amount center">${fmtFl(d.currentAssets26)}</td><td class="fs-amount center">${fmtFl(d.currentAssets25)}</td></tr>
          <tr><td class="fs-label indent">MINUS: CURRENT LIABILITIES</td><td class="fs-amount center neg">${fmtFlNeg(d.currentLiab26)}</td><td class="fs-amount center neg">${fmtFlNeg(d.currentLiab25)}</td></tr>
          <tr><td class="fs-label indent">MINUS: CURRENT ASSETS HELD FOR DONOR RESTRICTION</td><td class="fs-amount center neg">${fmtFlNeg(d.donorRestriction26)}</td><td class="fs-amount center neg">${fmtFlNeg(d.donorRestriction25)}</td></tr>
          <tr class="subtotal-row"><td class="fs-label indent-sub">AVAILABLE WORKING CAPITAL</td><td class="fs-amount center">${fmtFl(availableWorkingCapital26)}</td><td class="fs-amount center">${fmtFl(availableWorkingCapital25)}</td></tr>
          <tr><td class="fs-label indent">RECOMMENDED WORKING CAPITAL MINIMUM</td><td class="fs-amount center">${fmtFl(Math.round(recWcMin26))}</td><td class="fs-amount center">${fmtFl(Math.round(recWcMin25))}</td></tr>
          <tr><td class="fs-label indent">SURPLUS (SHORTFALL) IN RECOMMENDED MINIMUM</td><td class="fs-amount center ${wcSurplus26 < 0 ? 'neg' : ''}">${wcSurplus26 < 0 ? fmtFlNeg(wcSurplus26) : fmtFl(wcSurplus26)}</td><td class="fs-amount center ${wcSurplus25 < 0 ? 'neg' : ''}">${wcSurplus25 < 0 ? fmtFlNeg(wcSurplus25) : fmtFl(wcSurplus25)}</td></tr>
          <tr class="total-row highlight fl-months-row"><td class="fs-label">AVAILABLE WORKING CAPITAL IN MONTHS</td><td class="fs-amount center gold">${flShowPercentage ? '<span class="fl-pct-val">273.95%</span>' : '<span class="fl-month-val">16</span><span class="fl-month-label">months</span>'}</td><td class="fs-amount center gold">${flShowPercentage ? '<span class="fl-pct-val">256.81%</span>' : '<span class="fl-month-val">6</span><span class="fl-month-label">months</span>'}</td></tr>
          <tr class="spacer"><td colspan="3"></td></tr>

          <tr class="section-header"><td colspan="3">AVAILABLE LIQUID ASSETS</td></tr>
          <tr><td class="fs-label indent">CASH AND CASH EQUIVALENTS</td><td class="fs-amount center">${fmtFl(d.cash26)}</td><td class="fs-amount center">${fmtFl(d.cash25)}</td></tr>
          <tr><td class="fs-label indent">LESS: HELD FOR AGENCY</td><td class="fs-amount center neg">${fmtFlNeg(d.heldForAgency26)}</td><td class="fs-amount center neg">${fmtFlNeg(d.heldForAgency25)}</td></tr>
          <tr><td class="fs-label indent">INVESTMENTS</td><td class="fs-amount center">${fmtFl(d.investments26)}</td><td class="fs-amount center">${fmtFl(d.investments25)}</td></tr>
          <tr class="subtotal-row"><td class="fs-label indent-sub">TOTAL LIQUID CURRENT ASSETS</td><td class="fs-amount center">${fmtFl(totalLiquidCurrentAssets26)}</td><td class="fs-amount center">${fmtFl(totalLiquidCurrentAssets25)}</td></tr>
          <tr><td class="fs-label indent">MINUS: TOTAL COMMITMENTS</td><td class="fs-amount center neg">${fmtFlNeg(totalCommitments26)}</td><td class="fs-amount center neg">${fmtFlNeg(totalCommitments25)}</td></tr>
          <tr class="subtotal-row"><td class="fs-label indent-sub">AVAILABLE LIQUID ASSETS</td><td class="fs-amount center">${fmtFl(availableLiquidAssets26)}</td><td class="fs-amount center">${fmtFl(availableLiquidAssets25)}</td></tr>
          <tr><td class="fs-label indent">RECOMMENDED MINIMUM AVAILABLE LIQUID ASSETS</td><td class="fs-amount center">${fmtFl(Math.round(recLaMin26))}</td><td class="fs-amount center">${fmtFl(Math.round(recLaMin25))}</td></tr>
          <tr><td class="fs-label indent">SURPLUS (SHORTFALL) IN RECOMMENDED MINIMUM</td><td class="fs-amount center ${laSurplus26 < 0 ? 'neg' : ''}">${laSurplus26 < 0 ? fmtFlNeg(laSurplus26) : fmtFl(laSurplus26)}</td><td class="fs-amount center ${laSurplus25 < 0 ? 'neg' : ''}">${laSurplus25 < 0 ? fmtFlNeg(laSurplus25) : fmtFl(laSurplus25)}</td></tr>
          <tr class="total-row highlight fl-months-row"><td class="fs-label">AVAILABLE LIQUID ASSETS IN MONTHS</td><td class="fs-amount center gold">${flShowPercentage ? '<span class="fl-pct-val">135.06%</span>' : '<span class="fl-month-val">10</span><span class="fl-month-label">months</span>'}</td><td class="fs-amount center gold">${flShowPercentage ? '<span class="fl-pct-val">133.02%</span>' : '<span class="fl-month-val">5</span><span class="fl-month-label">months</span>'}</td></tr>
        `;
      alignFlColHeader();
    }

    let flZoomLevel = 100;
    function flZoom(dir) {
      flZoomLevel = Math.min(200, Math.max(60, flZoomLevel + dir * 10));
      const inner = document.getElementById('flTableScroll');
      const scale = flZoomLevel / 100;
      inner.style.transformOrigin = 'top left';
      inner.style.transform = `scale(${scale})`;
      inner.style.width = (100 / scale) + '%';
      inner.style.height = 'auto';
      inner.parentElement.style.height = (inner.scrollHeight * scale) + 'px';
      document.getElementById('flZoomLabel').textContent = flZoomLevel + '%';
    }

    // ---- Note drilldown modals ----
    function getCurrentBsNoteState() {
      const mi = parseInt(document.getElementById('bsMonthSelect').value);
      return bsNoteState[mi] || {
        cash: { title: 'NOTE 3 - CASH AND CASH EQUIVALENTS', rows: [] },
        ar: { title: 'NOTE 5 - ACCOUNTS RECEIVABLE', rows: [] },
        ap: { title: 'NOTE 10 - ACCOUNTS PAYABLE', rows: [] },
        sda: [],
        sdaAp: []
      };
    }

    function openNote(key) {
      const state = getCurrentBsNoteState();
      const data = state[key];
      if (!data) return;
      document.getElementById('noteModalTitle').textContent = data.title;
      const tbody = document.getElementById('noteTableBody');

      // Determine which SDA drill key applies to this note
      const sdaDrillKey = key === 'ar' ? 'sda' : key === 'ap' ? 'sdaAp' : null;
      const hasSdaData = sdaDrillKey && (state[sdaDrillKey] || []).length > 0;

      tbody.innerHTML = data.rows.map(r => {
        // Prefer DB drill_key; fallback: auto-attach SDA drill to rows whose label mentions SDA entities
        const drill = r.drill || (sdaDrillKey && /sda entities within/i.test(r.label) ? sdaDrillKey : '');
        const cls = r.sub ? 'nt-subtotal' : r.group ? 'nt-group' : r.neg ? 'nt-neg' : '';
        const indentCls = r.indent ? ' nt-indent' : '';
        const drillAttr = drill ? `onclick="openDrill('${drill}')" style="cursor:pointer;"` : '';
        const drillIcon = drill ? ` <span class="drill-icon" style="color:#f5a623;">&#9654;</span>` : '';
        return `<tr class="${cls}" ${drillAttr}>
          <td class="nt-label${indentCls}">${r.label}${drillIcon}</td>
          <td class="nt-val${r.neg ? ' nt-neg-val' : ''}">${r.curr}</td>
          <td class="nt-val${r.neg ? ' nt-neg-val' : ''}">${r.prev}</td>
        </tr>`;
      }).join('');

      // Always append a dedicated SDA ENTITIES row at the bottom if data exists
      if (hasSdaData) {
        const drillLabel = key === 'ar' ? 'SDA ENTITIES WITHIN SPUC' : 'SDA ENTITIES WITHIN SPUC';
        tbody.innerHTML += `<tr class="nt-subtotal" onclick="openDrill('${sdaDrillKey}')" style="cursor:pointer;">
          <td class="nt-label nt-indent">${drillLabel} <span class="drill-icon" style="color:#f5a623;">&#9654;</span></td>
          <td class="nt-val"></td>
          <td class="nt-val"></td>
        </tr>`;
      }

      document.getElementById('noteOverlay').classList.remove('hidden');
      const modal = document.getElementById('noteModal');
      modal.classList.remove('hidden');
      modal.style.animation = 'noteModalIn 0.25s cubic-bezier(0.4,0,0.2,1) forwards';
    }

    function closeNote() {
      closeSda();
      closeSdaAp();
      const modal = document.getElementById('noteModal');
      modal.style.animation = 'noteModalOut 0.2s ease forwards';
      setTimeout(() => {
        modal.classList.add('hidden');
        document.getElementById('noteOverlay').classList.add('hidden');
      }, 200);
    }

    function openDrill(key) {
      if (key === 'sda') openSda();
      else if (key === 'sdaAp') openSdaAp();
    }

    function openSda() {
      const state = getCurrentBsNoteState();
      renderSdaEntitiesRows(state.sda);
      const modal = document.getElementById('sdaModal');
      modal.classList.remove('hidden');
      modal.style.animation = 'noteModalIn 0.25s cubic-bezier(0.4,0,0.2,1) forwards';
    }

    function closeSda() {
      const modal = document.getElementById('sdaModal');
      if (!modal.classList.contains('hidden')) {
        modal.style.animation = 'noteModalOut 0.2s ease forwards';
        setTimeout(() => modal.classList.add('hidden'), 200);
      }
    }

    function openSdaAp() {
      const state = getCurrentBsNoteState();
      renderSdaApEntitiesRows(state.sdaAp);
      const modal = document.getElementById('sdaApModal');
      modal.classList.remove('hidden');
      modal.style.animation = 'noteModalIn 0.25s cubic-bezier(0.4,0,0.2,1) forwards';
    }

    function closeSdaAp() {
      const modal = document.getElementById('sdaApModal');
      if (!modal.classList.contains('hidden')) {
        modal.style.animation = 'noteModalOut 0.2s ease forwards';
        setTimeout(() => modal.classList.add('hidden'), 200);
      }
    }

  