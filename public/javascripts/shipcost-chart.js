/* Shared whole-chart selection for the manager, date viewer and CSV export. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ShipcostChart = factory();
}(typeof window === 'undefined' ? this : window, function () {
  const zoneSort = (a, b) => a.localeCompare(b, 'en', { numeric: true });
  function fromRows(rows) {
    const weights = [...new Set(rows.map(row => row.uptoweight_g))].sort((a, b) => a - b);
    const zones = [...new Set(rows.map(row => row.zone))].sort(zoneSort).map(key => ({ key, label: `Zone ${key.replace(/^zone/, '')}` }));
    const cells = new Map(rows.map(row => [`${row.zone}:${row.uptoweight_g}`, row.cost]));
    return { weights, zones, rates: weights.map(weight => zones.map(zone => cells.has(`${zone.key}:${weight}`) ? cells.get(`${zone.key}:${weight}`) : null)) };
  }
  function toRows(chart, method, costdate) {
    return chart.weights.flatMap((weight, i) => chart.zones.map((zone, j) => ({ method, costdate, zone: zone.key, uptoweight_g: weight, cost: chart.rates[i][j] })));
  }
  function select(rows, versions, cutoff = 99991231) {
    const result = {};
    const methods = [...new Set([...rows.map(row => row.method), ...versions.map(version => version.method)])];
    for (const method of methods) {
      const version = versions.filter(v => v.method === method && v.costdate <= cutoff)
        .sort((a, b) => b.costdate - a.costdate || b.id - a.id)[0];
      if (version) { result[method] = { chart: version.chart, costdate: version.costdate, id: version.id }; continue; }
      const cells = new Map();
      rows.filter(row => row.method === method && row.costdate <= cutoff)
        .sort((a, b) => a.costdate - b.costdate || a.id - b.id)
        .forEach(row => cells.set(`${row.zone}:${row.uptoweight_g}`, row));
      if (cells.size) result[method] = { chart: fromRows([...cells.values()]), costdate: Math.max(...[...cells.values()].map(row => row.costdate)) };
    }
    return result;
  }
  function compare(before, after) {
    before = before || { weights: [], zones: [], rates: [] };
    const addedRows = after.weights.filter(weight => !before.weights.includes(weight));
    const removedRows = before.weights.filter(weight => !after.weights.includes(weight));
    const addedColumns = after.zones.filter(zone => !before.zones.some(old => old.key === zone.key)).map(zone => zone.key);
    const removedColumns = before.zones.filter(zone => !after.zones.some(current => current.key === zone.key)).map(zone => zone.key);
    const renamedColumns = after.zones.filter(zone => before.zones.some(old => old.key === zone.key && old.label !== zone.label)).map(zone => zone.key);
    const cells = [];
    after.weights.forEach((weight, i) => after.zones.forEach((zone, j) => {
      const oldRow = before.weights.indexOf(weight);
      const oldColumn = before.zones.findIndex(old => old.key === zone.key);
      if (oldRow >= 0 && oldColumn >= 0 && before.rates[oldRow][oldColumn] !== after.rates[i][j]) {
        cells.push({ weight, zone: zone.key, before: before.rates[oldRow][oldColumn], after: after.rates[i][j] });
      }
    }));
    return { addedRows, removedRows, addedColumns, removedColumns, renamedColumns, cells,
      identical: ![addedRows, removedRows, addedColumns, removedColumns, renamedColumns, cells].some(items => items.length) };
  }
  return { fromRows, toRows, select, compare };
}));
