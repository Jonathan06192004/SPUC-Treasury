fetchDupOfferingsByCode('NCMC').then(rows => {
  const { y2025, y2026, budget } = splitYears(rows);
  onLayoutReady(() => initMissionPage({
    canvasId: 'ncmcOfferingChart',
    labelHeader: 'NCMC OFFERINGS',
    data2025: y2025, data2026: y2026, dataTarget: budget
  }));
});
