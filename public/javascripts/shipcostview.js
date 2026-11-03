const labels = JSON.parse(document.getElementById('labels').textContent);
const data = JSON.parse(document.getElementById('data').textContent);
const versions = JSON.parse(document.getElementById('versions').textContent);
const tableDate = document.getElementById('table_date');
const controls = document.getElementById('controls');
const output = document.getElementById('output');
function selectedCharts() {
  return ShipcostChart.select(data, versions, Number(tableDate.value.replace(/-/g, '')));
}
function GenerateTables() {
  controls.textContent = '';
  output.textContent = '';
  const charts = selectedCharts();
  if (!Object.keys(charts).length) output.textContent = 'No saved rates on or before this date.';
  Object.entries(charts).forEach(([method, { chart }], index) => {
    const button = document.createElement('button');
    button.textContent = method;
    button.className = 'btn btn-primary mr-3 mb-1';
    button.addEventListener('click', () => ShowTable(method));
    controls.append(button);
    const div = document.createElement('div');
    div.className = 'rate_table table-responsive';
    div.dataset.method = method;
    div.hidden = index !== 0;
    const heading = document.createElement('h3');
    heading.textContent = method;
    const history = document.createElement('a');
    history.href = `/shipcost/history?method=${encodeURIComponent(method)}`;
    history.textContent = 'Chart history and changes';
    const table = document.createElement('table');
    table.className = 'table table-striped table-bordered';
    const head = table.createTHead().insertRow();
    const cell = (row, text, tag = 'td') => {
      const element = document.createElement(tag);
      element.textContent = text;
      row.append(element);
      return element;
    };
    cell(head, 'Up to (g)', 'th');
    // Geographic descriptions are only known for the standard five-zone schema.
    // Other layouts keep the source labels instead of guessing from column count.
    const standardFive = chart.zones.map(zone => zone.key).join(',') === 'zone1,zone2,zone3,zone4,zone5';
    const descriptions = method === 'DHL' ? labels._dhlzones : method === 'Surface mail premium' ? labels._usaonly : standardFive ? labels._5zones : null;
    chart.zones.forEach((zone, j) => {
      const th = cell(head, zone.label, 'th');
      th.title = descriptions && descriptions.length === chart.zones.length && zone.label === `Zone ${j + 1}` ? descriptions[j] : zone.label;
    });
    const body = table.createTBody();
    chart.weights.forEach((weight, i) => {
      const row = body.insertRow();
      cell(row, weight, 'th');
      chart.zones.forEach((zone, j) => cell(row, chart.rates[i][j] == null ? '—' : chart.rates[i][j]));
    });
    div.append(heading, history, table);
    output.append(div);
  });
}
function ShowTable(method) {
  document.querySelectorAll('.rate_table').forEach(table => { table.hidden = table.dataset.method !== method; });
}
function DownloadCSV() {
  const charts = selectedCharts();
  const columns = Object.entries(charts).flatMap(([method, { chart }]) => chart.zones.map((zone, j) => ({ method, chart, zone, j })));
  const weights = [...new Set(Object.values(charts).flatMap(value => value.chart.weights))].sort((a, b) => a - b);
  const rows = [['Up to weight (g)', ...columns.map(({ method, zone }) => `${method.toLowerCase().replace(/ /g, '_')}_${zone.key}`)],
    ...weights.map(weight => [weight, ...columns.map(({ chart, j }) => {
      const i = chart.weights.indexOf(weight);
      return i < 0 || chart.rates[i][j] == null ? '' : chart.rates[i][j];
    })])];
  const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `shipping_costs_${tableDate.value.replace(/-/g, '')}.csv`);
}
GenerateTables();
