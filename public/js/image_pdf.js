function buildSampleCsvRows() {
  return [
    ['code', 'image url', 'name', 'specs', 'content', 'description', 'cost'].join(','),
    '',
  ];
}

function DownloadSampleCsv() {
  const rows = buildSampleCsvRows();
  const csvData = rows.join('\r\n');
  const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8' });

  saveAs(blob, 'image_grid_sample.csv');
}
