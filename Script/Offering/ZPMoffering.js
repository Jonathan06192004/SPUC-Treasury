fetchOfferingsByCode('ZPM').then(rows => {
  const { y2025, y2026, budget } = splitYears(rows);
  onLayoutReady(() => initMissionPage({
    canvasId: 'zpmOfferingChart',
    labelHeader: 'ZPM OFFERINGS',
    data2025: y2025, data2026: y2026, dataTarget: budget
  }));
});
