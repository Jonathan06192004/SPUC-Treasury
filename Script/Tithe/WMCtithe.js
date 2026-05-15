fetchDupTithesByCode('WMC').then(rows => {
  const { y2025, y2026, budget } = splitYears(rows);
  onLayoutReady(() => initMissionPage({
    canvasId: 'wmcChart',
    labelHeader: 'WMC TITHES',
    data2025: y2025, data2026: y2026, dataTarget: budget
  }));
});
