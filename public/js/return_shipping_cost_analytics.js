document.addEventListener('DOMContentLoaded', () => {
  const sections = Array.isArray(window.returnShippingCostAnalytics) ? window.returnShippingCostAnalytics : [];

  if (typeof d3 === 'undefined') {
    return;
  }

  function toNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function formatAmount(value) {
    return d3.format(',')(value);
  }

  function buildTooltip(row, section) {
    const currency = row.currency || (section.currencies || []).join(', ');
    const lines = [
      row.weightInterval || '-',
      `p95: ${row.p95AmountWithCurrency || '-'}`,
      `entries: ${row.entryCount || 0}`,
    ];

    if (currency && !(row.p95AmountWithCurrency || '').includes(currency)) {
      lines[1] = `p95: ${row.p95AmountDisplay || '-'} ${currency}`;
    }

    if (row.guardrail) {
      lines.push(`guardrail: ${row.guardrail}`);
    }

    return lines.join('\n');
  }

  function renderChart(container, section) {
    container.innerHTML = '';

    const chartRows = (section.rows || [])
      .map((row) => Object.assign({}, row, { p95Amount: toNumber(row.p95Amount) }))
      .filter((row) => row.p95Amount !== null);

    if (chartRows.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'text-muted small';
      emptyState.textContent = 'No numeric p95 amount is available for this country.';
      container.appendChild(emptyState);
      return;
    }

    const width = Math.max(420, container.clientWidth || 420);
    const height = 340;
    const margin = {
      top: 20,
      right: 18,
      bottom: chartRows.length > 6 ? 96 : 72,
      left: 70,
    };
    const innerWidth = Math.max(160, width - margin.left - margin.right);
    const innerHeight = Math.max(140, height - margin.top - margin.bottom);
    const currencies = section.currencies || [];
    const yAxisLabel = currencies.length === 1 ? `p95 amount (${currencies[0]})` : 'p95 amount';

    const svg = d3.select(container)
      .append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('width', '100%')
      .attr('height', height)
      .attr('role', 'img')
      .attr('aria-label', `${section.country} p95 return shipping cost by weight interval`);

    svg.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', width)
      .attr('height', height)
      .attr('fill', '#1f252d');

    const chart = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    chart.append('rect')
      .attr('class', 'chart-surface')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', innerWidth)
      .attr('height', innerHeight);

    const x = d3.scaleBand()
      .domain(chartRows.map((row) => row.axisLabel || row.weightInterval || '-'))
      .range([0, innerWidth])
      .padding(0.22);

    const maxAmount = d3.max(chartRows, (row) => row.p95Amount) || 0;
    const y = d3.scaleLinear()
      .domain([0, maxAmount > 0 ? maxAmount * 1.12 : 1])
      .nice()
      .range([innerHeight, 0]);

    chart.append('g')
      .attr('class', 'chart-grid')
      .call(
        d3.axisLeft(y)
          .ticks(5)
          .tickFormat(() => '')
          .tickSize(-innerWidth)
      )
      .call((axis) => axis.select('.domain').remove());

    chart.append('g')
      .attr('class', 'chart-axis chart-axis-y')
      .call(
        d3.axisLeft(y)
          .ticks(5)
          .tickSizeOuter(0)
          .tickFormat((value) => formatAmount(value))
      );

    chart.append('g')
      .attr('class', 'chart-axis chart-axis-x')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).tickSizeOuter(0))
      .selectAll('text')
      .attr('text-anchor', 'end')
      .attr('dx', '-0.6em')
      .attr('dy', '0.2em')
      .attr('transform', 'rotate(-38)');

    chart.append('text')
      .attr('x', -innerHeight / 2)
      .attr('y', -54)
      .attr('text-anchor', 'middle')
      .attr('transform', 'rotate(-90)')
      .attr('class', 'chart-value-label')
      .text(yAxisLabel);

    chart.selectAll('.chart-bar')
      .data(chartRows)
      .enter()
      .append('rect')
      .attr('class', 'chart-bar')
      .attr('x', (row) => x(row.axisLabel || row.weightInterval || '-'))
      .attr('y', (row) => y(row.p95Amount))
      .attr('width', x.bandwidth())
      .attr('height', (row) => innerHeight - y(row.p95Amount))
      .append('title')
      .text((row) => buildTooltip(row, section));

    chart.selectAll('.chart-value-label-top')
      .data(chartRows)
      .enter()
      .append('text')
      .attr('class', 'chart-value-label')
      .attr('x', (row) => (x(row.axisLabel || row.weightInterval || '-') || 0) + x.bandwidth() / 2)
      .attr('y', (row) => Math.max(12, y(row.p95Amount) - 6))
      .attr('text-anchor', 'middle')
      .text((row) => row.p95AmountDisplay || formatAmount(row.p95Amount));
  }

  function renderAllCharts() {
    document.querySelectorAll('[data-return-shipping-chart]').forEach((container) => {
      const sectionIndex = Number(container.getAttribute('data-section-index'));
      const section = sections[sectionIndex];

      if (section) {
        renderChart(container, section);
      }
    });
  }

  renderAllCharts();

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(renderAllCharts, 150);
  });
});
