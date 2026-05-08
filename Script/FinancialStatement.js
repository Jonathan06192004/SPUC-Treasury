    let _rendering = false;
    async function renderAll(mi) {
      if (_rendering) return;
      _rendering = true;
      syncAllMonths(mi);
      await renderBalanceSheet();
      await renderIncomeStatement();
      renderCashFlow();
      await renderFinancialLiquidity();
      await renderConferenceCard(mi);
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
    const CURRENT_YEAR = new Date().getFullYear();
    const PREV_YEAR = CURRENT_YEAR - 1;

    // Set dynamic year labels in column headers
    (() => {
      const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      set('bsColYear1', PREV_YEAR);  set('bsColYear2', CURRENT_YEAR);
      set('isColYear1', CURRENT_YEAR); set('isColYear2', CURRENT_YEAR); set('isColYear3', PREV_YEAR);
      set('isThYear1', 'TOTAL ' + CURRENT_YEAR); set('isThYear2', 'BUDGET ' + CURRENT_YEAR); set('isThYear3', 'TOTAL ' + PREV_YEAR);
      set('flColYear1', CURRENT_YEAR); set('flColYear2', PREV_YEAR);
    })();

    const bsDataByYear = {
      [PREV_YEAR]: new Array(12).fill(null),
      [CURRENT_YEAR]: new Array(12).fill(null)
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
      if (bsDataByYear[PREV_YEAR][mi] && bsDataByYear[CURRENT_YEAR][mi] && bsNoteState[mi]) return;
      const month = mi + 1;
      const [
        bsPrevRows, bsCurrRows, cashRows, arRows, apRows, arEntityRows, apEntityRows
      ] = await Promise.all([
        fetchBalanceSheet(PREV_YEAR, month),
        fetchBalanceSheet(CURRENT_YEAR, month),
        fetchBalanceSheetNoteCash(CURRENT_YEAR, month),
        fetchBalanceSheetNoteAr(CURRENT_YEAR, month),
        fetchBalanceSheetNoteAp(CURRENT_YEAR, month),
        fetchBalanceSheetNoteArEntities(CURRENT_YEAR, month),
        fetchBalanceSheetNoteApEntities(CURRENT_YEAR, month)
      ]);

      bsDataByYear[PREV_YEAR][mi] = toBsShape((bsPrevRows || [])[0]);
      bsDataByYear[CURRENT_YEAR][mi] = toBsShape((bsCurrRows || [])[0]);
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

    function updateKPIs(incomeData = null) {
      const isMi = parseInt(document.getElementById('isMonthSelect').value);
      const d = incomeData || isDataByMonth[isMi] || {};
      const mn = MONTHS[isMi];
      const lastDay = new Date(CURRENT_YEAR, isMi + 1, 0).getDate();

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
      document.getElementById('kpiRevenueSub').textContent   = mn + ' ' + CURRENT_YEAR;
      document.getElementById('kpiExpenses').textContent    = fmtM(totalExp26);
      document.getElementById('kpiExpensesSub').textContent  = mn + ' ' + CURRENT_YEAR;
      document.getElementById('kpiCapital').textContent     = fmtM(incBeforeTransfers26);
      document.getElementById('kpiCapitalSub').textContent   = mn + ' ' + CURRENT_YEAR;
      document.getElementById('kpiNetAssets').textContent   = fmtM(netEnd26);
      document.getElementById('kpiNetAssetsSub').textContent = mn + ' ' + lastDay + ', ' + CURRENT_YEAR;
    }

    async function renderBalanceSheet() {
      const mi = parseInt(document.getElementById('bsMonthSelect').value);
      syncAllMonths(mi);
      try {
        await loadBalanceSheetMonth(mi);
      } catch (err) {
        console.error('Failed loading balance sheet data:', err);
      }
      const d25 = bsDataByYear[PREV_YEAR][mi];
      const d26 = bsDataByYear[CURRENT_YEAR][mi];
      const d = d26;
      const mn = MONTHS[mi];
      const lastDay = new Date(CURRENT_YEAR, mi + 1, 0).getDate();
      document.getElementById('bsPeriodLabel').textContent = mn.toUpperCase() + ' ' + CURRENT_YEAR;

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
      document.getElementById('kpiBsAssetsSub').textContent      = 'As of ' + mn + ' ' + lastDay + ', ' + CURRENT_YEAR;
      document.getElementById('kpiBsLiabilities').textContent    = fmtM(tl26);
      document.getElementById('kpiBsLiabilitiesSub').textContent = 'As of ' + mn + ' ' + lastDay + ', ' + CURRENT_YEAR;
      document.getElementById('kpiBsNetAssets').textContent      = fmtM(tna26);
      document.getElementById('kpiBsNetAssetsSub').textContent   = 'As of ' + mn + ' ' + lastDay + ', ' + CURRENT_YEAR;
      document.getElementById('kpiBsTotal').textContent          = fmtM(tlna26);
      document.getElementById('kpiBsTotalSub').textContent       = 'As of ' + mn + ' ' + lastDay + ', ' + CURRENT_YEAR;
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

    // ---- Income Statement monthly data (DB-backed) ----
    const isDataByMonth = new Array(12).fill(null);

    function getLineVal(map, key, field) {
      const row = map[key];
      if (!row) return 0;
      const n = Number(row[field]);
      return Number.isFinite(n) ? n : 0;
    }

    async function loadIncomeStatementMonth(mi) {
      if (isDataByMonth[mi]) return;
      const month = mi + 1;
      const [lineRows, budgetRows] = await Promise.all([
        fetchIncomeStatementLines(CURRENT_YEAR, month),
        fetchIncomeStatementBudgets(CURRENT_YEAR, month)
      ]);

      const lineMap = {};
      (lineRows || []).forEach(r => { lineMap[r.line_key] = r; });
      const budgetByKey = {};
      (budgetRows || []).forEach(r => {
        const key = r.income_statement_lines?.line_key;
        if (!key) return;
        const yr = Number(r.budget_year);
        if (!budgetByKey[key] || yr > budgetByKey[key].budget_year) {
          budgetByKey[key] = { budget_year: yr, amount: Number(r.budget_amount) || 0 };
        }
      });
      const b = (key) => budgetByKey[key]?.amount ?? 0;

      isDataByMonth[mi] = {
        tithe25: getLineVal(lineMap, 'TITHE_INCOME', 'total_2025'),
        tithe26: getLineVal(lineMap, 'TITHE_INCOME', 'total_2026'),
        offer25: getLineVal(lineMap, 'OFFERING_INCOME', 'total_2025'),
        offer26: getLineVal(lineMap, 'OFFERING_INCOME', 'total_2026'),
        inv25: getLineVal(lineMap, 'INVESTMENT_INCOME', 'total_2025'),
        inv26: getLineVal(lineMap, 'INVESTMENT_INCOME', 'total_2026'),
        other25: getLineVal(lineMap, 'OTHER_OPERATING_INCOME', 'total_2025'),
        other26: getLineVal(lineMap, 'OTHER_OPERATING_INCOME', 'total_2026'),
        budgetInc26: b('TOTAL_EARNED_OPERATING_INCOME'),
        budgetTithe26: b('TITHE_INCOME'),
        budgetOffer26: b('OFFERING_INCOME'),
        budgetInv26: b('INVESTMENT_INCOME'),
        budgetOther26: b('OTHER_OPERATING_INCOME'),
        emp25: getLineVal(lineMap, 'EMPLOYEE_RELATED_EXPENSES', 'total_2025'),
        emp26: getLineVal(lineMap, 'EMPLOYEE_RELATED_EXPENSES', 'total_2026'),
        prog25: getLineVal(lineMap, 'PROGRAM_SPECIFIC_EXPENSES', 'total_2025'),
        prog26: getLineVal(lineMap, 'PROGRAM_SPECIFIC_EXPENSES', 'total_2026'),
        admin25: getLineVal(lineMap, 'ADMINISTRATIVE_EXPENSES', 'total_2025'),
        admin26: getLineVal(lineMap, 'ADMINISTRATIVE_EXPENSES', 'total_2026'),
        office25: getLineVal(lineMap, 'OFFICE_EXPENSES', 'total_2025'),
        office26: getLineVal(lineMap, 'OFFICE_EXPENSES', 'total_2026'),
        gen25: getLineVal(lineMap, 'GENERAL_EXPENSES', 'total_2025'),
        gen26: getLineVal(lineMap, 'GENERAL_EXPENSES', 'total_2026'),
        plant25: getLineVal(lineMap, 'PLANT_OPERATION_EXPENSES', 'total_2025'),
        plant26: getLineVal(lineMap, 'PLANT_OPERATION_EXPENSES', 'total_2026'),
        budgetExp26: b('TOTAL_OPERATING_EXPENSES'),
        budgetEmp26: b('EMPLOYEE_RELATED_EXPENSES'),
        budgetProg26: b('PROGRAM_SPECIFIC_EXPENSES'),
        budgetAdmin26: b('ADMINISTRATIVE_EXPENSES'),
        budgetOffice26: b('OFFICE_EXPENSES'),
        budgetGen26: b('GENERAL_EXPENSES'),
        budgetPlant26: b('PLANT_OPERATION_EXPENSES'),
        appRec25: getLineVal(lineMap, 'TITHE_APPROP_RECEIVED', 'total_2025'),
        appRec26: getLineVal(lineMap, 'TITHE_APPROP_RECEIVED', 'total_2026'),
        appDisb25: getLineVal(lineMap, 'TITHE_APPROP_DISBURSED', 'total_2025'),
        appDisb26: getLineVal(lineMap, 'TITHE_APPROP_DISBURSED', 'total_2026'),
        budgetAppRec26: b('TITHE_APPROP_RECEIVED'),
        budgetAppDisb26: b('TITHE_APPROP_DISBURSED'),
        budgetNtRec26: b('NON_TITHE_APPROP_RECEIVED'),
        budgetNtDisb26: b('NON_TITHE_APPROP_DISBURSED'),
        budgetNetApp26: b('NET_APPROP_RETAINED'),
        budgetIncOps26: b('INCREASE_FROM_OPERATIONS'),
        nonTitheRec25: getLineVal(lineMap, 'NON_TITHE_APPROP_RECEIVED', 'total_2025'),
        nonTitheRec26: getLineVal(lineMap, 'NON_TITHE_APPROP_RECEIVED', 'total_2026'),
        nonTitheDisb25: getLineVal(lineMap, 'NON_TITHE_APPROP_DISBURSED', 'total_2025'),
        nonTitheDisb26: getLineVal(lineMap, 'NON_TITHE_APPROP_DISBURSED', 'total_2026'),
        capitalActivity25: getLineVal(lineMap, 'NET_CAPITAL_INCREASE', 'total_2025'),
        capitalActivity26: getLineVal(lineMap, 'NET_CAPITAL_INCREASE', 'total_2026'),
        budgetCap26: b('NET_CAPITAL_INCREASE'),
        budgetIncBefTr26: b('INCREASE_BEFORE_TRANSFERS'),
        transferBetweenFunc25: getLineVal(lineMap, 'TRANSFERS_BETWEEN_FUNCTIONS', 'total_2025'),
        transferBetweenFunc26: getLineVal(lineMap, 'TRANSFERS_BETWEEN_FUNCTIONS', 'total_2026'),
        transferBetweenFunds25: getLineVal(lineMap, 'TRANSFERS_BETWEEN_FUNDS', 'total_2025'),
        transferBetweenFunds26: getLineVal(lineMap, 'TRANSFERS_BETWEEN_FUNDS', 'total_2026'),
        budgetTfFunc26: b('TRANSFERS_BETWEEN_FUNCTIONS'),
        budgetTfFunds26: b('TRANSFERS_BETWEEN_FUNDS'),
        budgetNetInc26: b('NET_ASSETS_INCREASE_YEAR'),
        netAssetsBeg25: getLineVal(lineMap, 'NET_ASSETS_BEGIN', 'total_2025'),
        netAssetsBeg26: getLineVal(lineMap, 'NET_ASSETS_BEGIN', 'total_2026'),
        netAssetsEnd25: getLineVal(lineMap, 'NET_ASSETS_END', 'total_2025'),
        netAssetsEnd26: getLineVal(lineMap, 'NET_ASSETS_END', 'total_2026'),
        // keep existing OF/PF logic compatible
        titheOF: getLineVal(lineMap, 'TITHE_INCOME', 'total_2026'), tithePF: 0,
        offerOF: getLineVal(lineMap, 'OFFERING_INCOME', 'total_2026'), offerPF: 0,
        invOF: getLineVal(lineMap, 'INVESTMENT_INCOME', 'total_2026'), invPF: 0,
        otherOF: getLineVal(lineMap, 'OTHER_OPERATING_INCOME', 'total_2026'), otherPF: 0,
        empOF: getLineVal(lineMap, 'EMPLOYEE_RELATED_EXPENSES', 'total_2026'), empPF: 0,
        progOF: getLineVal(lineMap, 'PROGRAM_SPECIFIC_EXPENSES', 'total_2026'), progPF: 0,
        adminOF: getLineVal(lineMap, 'ADMINISTRATIVE_EXPENSES', 'total_2026'), adminPF: 0,
        officeOF: getLineVal(lineMap, 'OFFICE_EXPENSES', 'total_2026'), officePF: 0,
        genOF: getLineVal(lineMap, 'GENERAL_EXPENSES', 'total_2026'), genPF: 0,
        plantOF: getLineVal(lineMap, 'PLANT_OPERATION_EXPENSES', 'total_2026'), plantPF: 0
      };
    }

    function fmtIs(n) { return n ? n.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}) : ''; }

    async function renderIncomeStatement() {
      const mi = parseInt(document.getElementById('isMonthSelect').value);
      syncAllMonths(mi);
      await loadIncomeStatementMonth(mi);
      const d = isDataByMonth[mi] || {};
      const mn = MONTHS[mi];
      const lastDay = new Date(CURRENT_YEAR, mi + 1, 0).getDate();
      document.getElementById('isPeriodLabel').textContent = mn.toUpperCase() + ' ' + CURRENT_YEAR;

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
        row('TITHE INCOME, NET (NOTE 14)',titheOF,tithePF,d.tithe26,d.budgetTithe26,d.tithe25) +
        row('OFFERING INCOME &amp; SPECIFIC DONATIONS',offerOF,offerPF,d.offer26,d.budgetOffer26,d.offer25) +
        row('INVESTMENT INCOME (NOTE 4)',invOF,invPF,d.inv26,d.budgetInv26,d.inv25) +
        row('OTHER OPERATING INCOME',otherOF,otherPF,d.other26,d.budgetOther26,d.other25) +
        subtotalRow('TOTAL EARNED OPERATING INCOME',totalIncOF,totalIncPF,totalInc26,d.budgetInc26,totalInc25) +
        spacer() +
        subSecHdr('Operating Expenses') +
        row('EMPLOYEE RELATED EXPENSES (NOTE 19)',empOF,empPF,d.emp26,d.budgetEmp26,d.emp25) +
        row('PROGRAM SPECIFIC EXPENSES (NOTE 21)',progOF,progPF,d.prog26,d.budgetProg26,d.prog25) +
        row('ADMINISTRATIVE EXPENSES (NOTE 19)',adminOF,adminPF,d.admin26,d.budgetAdmin26,d.admin25) +
        row('OFFICE EXPENSES (NOTE 20a)',officeOF,officePF,d.office26,d.budgetOffice26,d.office25) +
        row('GENERAL EXPENSES (NOTE 20b)',genOF,genPF,d.gen26,d.budgetGen26,d.gen25) +
        row('PLANT OPERATION EXPENSES (NOTE 21)',plantOF,plantPF,d.plant26,d.budgetPlant26,d.plant25) +
        subtotalRow('TOTAL OPERATING EXPENSES',totalExpOF,totalExpPF,totalExp26,d.budgetExp26,totalExp25) +
        budgetRow('BUDGETED OP EXPENSES '+mn.toUpperCase()+' '+CURRENT_YEAR, d.budgetExp26) +
        highlightRow('INCREASE (DECREASE) BEFORE APPROP',incBefAppOF,incBefAppPF,incBefApp26,'',incBefApp25) +
        spacer() +
        subSecHdr('Operating Appropriations') +
        row('TITHE APPROPRIATION RECEIVED (S-22)',0,0,appRec26,d.budgetAppRec26,appRec25) +
        row('TITHE APPROPRIATION DISBURSED (S-23)',appDisb26OF,appDisb26PF,appDisb26,d.budgetAppDisb26,appDisb25,"",true) +
        row('NON-TITHE APPROPRIATION RECEIVED (S-24)',ntRec26OF,ntRec26PF,ntRec26,d.budgetNtRec26,ntRec25) +
        row('NON-TITHE APPROPRIATION DISBURSED (S-25)',0,0,ntDisb26,d.budgetNtDisb26,ntDisb25,"",true) +
        subtotalRow('NET APPROPRIATION RETAINED',netAppOF,netAppPF,netApp26,d.budgetNetApp26,netApp25) +
        highlightRow('INCREASE (DECREASE) FROM OPERATIONS',incOpsOF,incOpsPF,incOps26,d.budgetIncOps26,incOps25) +
        spacer() +
        secHdr('CAPITAL ACTIVITY') +
        row('NET CAPITAL INCREASE (DECREASE)',0,0,cap26,d.budgetCap26,cap25) +
        highlightRow('INCREASE (DECREASE) BEFORE TRANSFERS',incBefTrOF,incBefTrPF,incBefTr26,d.budgetIncBefTr26,incBefTr25) +
        spacer() +
        secHdr('TRANSFERS') +
        row('TRANSFERS BETWEEN FUNCTIONS/RESOURCES',tfFuncOF,tfFuncPF,tfFunc26,d.budgetTfFunc26,tfFunc25) +
        row('TRANSFERS BETWEEN FUNDS',0,0,tfFunds26,d.budgetTfFunds26,tfFunds25) +
        spacer() +
        subtotalRow('NET ASSETS INCREASE (DECREASE) FOR THE YEAR',netIncOF,netIncPF,netInc26,d.budgetNetInc26,netInc25) +
        row('NET ASSETS, JANUARY 1, '+CURRENT_YEAR,netBeg26OF,netBeg26PF,netBeg26,'',netBeg25) +
        totalRow('NET ASSETS, '+mn.toUpperCase()+' '+lastDay+', '+CURRENT_YEAR,netEnd26OF,netEnd26PF,netEnd26,'',netEnd25);

      updateKPIs(d);
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
    const flDataByMonth = new Array(12).fill(null);
    const flDefaultData = {
      coreOperating26: 0, coreOperating25: 0,
      coreRemittance26: 0, coreRemittance25: 0,
      currentAssets26: 0, currentAssets25: 0,
      currentLiab26: 0, currentLiab25: 0,
      donorRestriction26: 0, donorRestriction25: 0,
      cash26: 0, cash25: 0,
      heldForAgency26: 0, heldForAgency25: 0,
      investments26: 0, investments25: 0,
      workingMonths26: 0, workingMonths25: 0,
      liquidMonths26: 0, liquidMonths25: 0,
      recommendedMonthsWc26: 0, recommendedMonthsWc25: 0,
      requiredMonthsWc: 0,
      recommendedMonthsLa26: 0, recommendedMonthsLa25: 0,
      requiredMonthsLa: 0
    };

    function toFinite(v) {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    }

    async function loadFinancialIndicatorMonth(mi) {
      if (flDataByMonth[mi]) return;
      const rows = await fetchFinancialIndicator(CURRENT_YEAR, mi + 1);
      const r = (rows || [])[0] || {};
      flDataByMonth[mi] = {
        coreOperating26: toFinite(r.core_operating_2026),
        coreOperating25: toFinite(r.core_operating_2025),
        coreRemittance26: toFinite(r.core_remittance_2026),
        coreRemittance25: toFinite(r.core_remittance_2025),
        currentAssets26: toFinite(r.current_assets_2026),
        currentAssets25: toFinite(r.current_assets_2025),
        currentLiab26: toFinite(r.current_liabilities_2026),
        currentLiab25: toFinite(r.current_liabilities_2025),
        donorRestriction26: toFinite(r.donor_restriction_2026),
        donorRestriction25: toFinite(r.donor_restriction_2025),
        cash26: toFinite(r.cash_2026),
        cash25: toFinite(r.cash_2025),
        heldForAgency26: toFinite(r.held_for_agency_2026),
        heldForAgency25: toFinite(r.held_for_agency_2025),
        investments26: toFinite(r.investments_2026),
        investments25: toFinite(r.investments_2025),
        workingMonths26: toFinite(r.working_months_2026),
        workingMonths25: toFinite(r.working_months_2025),
        liquidMonths26: toFinite(r.liquid_months_2026),
        liquidMonths25: toFinite(r.liquid_months_2025),
        recommendedMonthsWc26: toFinite(r.recommended_months_wc_2026),
        recommendedMonthsWc25: toFinite(r.recommended_months_wc_2025),
        requiredMonthsWc: toFinite(r.required_months_wc),
        recommendedMonthsLa26: toFinite(r.recommended_months_la_2026),
        recommendedMonthsLa25: toFinite(r.recommended_months_la_2025),
        requiredMonthsLa: toFinite(r.required_months_la)
      };
    }

    let flShowPercentage = false;

    function fmtFl(n) { return n.toLocaleString('en-US'); }
    function fmtFlNeg(n) { return '(' + Math.abs(n).toLocaleString('en-US') + ')'; }
    function fmtFlPct(n) { return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'; }

    function toggleFlMode() {
      flShowPercentage = !flShowPercentage;
      document.getElementById('flPctBtn').textContent = flShowPercentage ? 'VIEW MONTHS' : '% SEE PERCENTAGE';
      renderFinancialLiquidity();
    }

    function updateFlKpis(d, wcCoverage, liquidCoverage) {
      if (flShowPercentage) {
        document.getElementById('kpiWcMonths').textContent = wcCoverage.toFixed(2) + '%';
        document.getElementById('kpiLaMonths').textContent = liquidCoverage.toFixed(2) + '%';
      } else {
        document.getElementById('kpiWcMonths').textContent = d.workingMonths26 + ' months';
        document.getElementById('kpiLaMonths').textContent = d.liquidMonths26 + ' months';
      }
    }

    async function renderFinancialLiquidity() {
      const mi = parseInt(document.getElementById('flMonthSelect').value);
      syncAllMonths(mi);
      try {
        await loadFinancialIndicatorMonth(mi);
      } catch (err) {
        console.error('Failed loading financial indicator data:', err);
      }
      const d = flDataByMonth[mi] || flDefaultData;
      const mn = MONTHS[mi];
      document.getElementById('flPeriodLabel').textContent = mn.toUpperCase() + ' ' + CURRENT_YEAR;

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
          <tr class="total-row highlight fl-months-row"><td class="fs-label">AVAILABLE WORKING CAPITAL IN MONTHS</td><td class="fs-amount center gold">${flShowPercentage ? '<span class="fl-pct-val">'+wcCoverage26.toFixed(2)+'%</span>' : '<span class="fl-month-val">'+wcMonthsDisplay26+'</span><span class="fl-month-label">months</span>'}</td><td class="fs-amount center gold">${flShowPercentage ? '<span class="fl-pct-val">'+wcCoverage25.toFixed(2)+'%</span>' : '<span class="fl-month-val">'+wcMonthsDisplay25+'</span><span class="fl-month-label">months</span>'}</td></tr>
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
          <tr class="total-row highlight fl-months-row"><td class="fs-label">AVAILABLE LIQUID ASSETS IN MONTHS</td><td class="fs-amount center gold">${flShowPercentage ? '<span class="fl-pct-val">'+liquidCoverage26.toFixed(2)+'%</span>' : '<span class="fl-month-val">'+laMonthsDisplay26+'</span><span class="fl-month-label">months</span>'}</td><td class="fs-amount center gold">${flShowPercentage ? '<span class="fl-pct-val">'+liquidCoverage25.toFixed(2)+'%</span>' : '<span class="fl-month-val">'+laMonthsDisplay25+'</span><span class="fl-month-label">months</span>'}</td></tr>
        `;
      updateFlKpis(d, wcCoverage26, liquidCoverage26);
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

    // ---- Conference Contributions Card ----
    async function renderConferenceCard(mi) {
      const month = mi + 1;
      const year = CURRENT_YEAR;
      const mn = MONTHS[mi];
      const [titheRows, offerRows] = await Promise.all([
        supabaseRequest(`${SUPABASE_URL}/rest/v1/tithes?select=amount,churches!inner(districts!inner(missions!inner(code,name)))&year=eq.${year}&month=eq.${month}`),
        supabaseRequest(`${SUPABASE_URL}/rest/v1/offerings?select=amount,churches!inner(districts!inner(missions!inner(code,name)))&year=eq.${year}&month=eq.${month}`)
      ]);

      const totals = {};
      (titheRows || []).forEach(r => {
        const code = r.churches?.districts?.missions?.code;
        const name = r.churches?.districts?.missions?.name;
        if (!code) return;
        if (!totals[code]) totals[code] = { code, name, amt: 0 };
        totals[code].amt += (Number(r.amount) || 0);
      });
      (offerRows || []).forEach(r => {
        const code = r.churches?.districts?.missions?.code;
        const name = r.churches?.districts?.missions?.name;
        if (!code) return;
        if (!totals[code]) totals[code] = { code, name, amt: 0 };
        totals[code].amt += (Number(r.amount) || 0);
      });

      const sorted = Object.values(totals).sort((a, b) => b.amt - a.amt);
      const max = sorted[0]?.amt || 1;

      document.getElementById('confCardTitle').textContent =
        `CONFERENCE CONTRIBUTIONS — ${mn.toUpperCase().slice(0,3)} ${year}`;

      document.getElementById('confCardRows').innerHTML = sorted.map(m => {
        const pct = Math.round((m.amt / max) * 100);
        const label = m.amt >= 1e6
          ? '\u20B1' + (m.amt / 1e6).toFixed(2) + 'M'
          : '\u20B1' + m.amt.toLocaleString('en-US');
        return `<div class="conf-row">
          <span class="conf-name">${m.code}</span>
          <div class="conf-bar-wrap"><div class="conf-bar" style="width:${pct}%"></div></div>
          <span class="conf-amt">${label}</span>
        </div>`;
      }).join('');
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

  