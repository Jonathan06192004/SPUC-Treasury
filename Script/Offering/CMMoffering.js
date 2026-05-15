fetchDupOfferingsByCode('CMM').then(rows => {
  const { y2025, y2026, budget } = splitYears(rows);
  onLayoutReady(() => initMissionPage({
    canvasId: 'cmmOfferingChart',
    labelHeader: 'CMM OFFERINGS',
    data2025: y2025, data2026: y2026, dataTarget: budget
  }));
});
