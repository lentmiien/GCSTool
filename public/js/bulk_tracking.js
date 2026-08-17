(function () {
  'use strict';

  const report = window.bulkTrackingReport || null;
  const colors = {};

  function updateChartColors() {
    const isDarkMode = document.documentElement.getAttribute('data-color-mode') !== 'light';
    Object.assign(colors, {
      delivered: isDarkMode ? '#48c78e' : '#22a06b',
      in_transit: isDarkMode ? '#5aa2ff' : '#2778e8',
      attention: isDarkMode ? '#f07480' : '#dd5361',
      no_match: isDarkMode ? '#93a7b4' : '#9aaab5',
      cyan: isDarkMode ? '#45c5d3' : '#22a8bd',
      amber: isDarkMode ? '#f2b75a' : '#e69b2e',
      violet: isDarkMode ? '#a694f2' : '#7259d6',
      grid: isDarkMode ? '#3f5360' : '#dce7ed',
      text: isDarkMode ? '#adbec9' : '#60798a',
      ink: isDarkMode ? '#edf4f8' : '#173247',
      surface: isDarkMode ? '#20282f' : '#ffffff',
      track: isDarkMode ? '#34434d' : '#eaf1f4',
      transition: isDarkMode ? '#607887' : '#a9c1cd',
    });
  }

  updateChartColors();

  function initShipmentFilters() {
    const search = document.getElementById('btShipmentSearch');
    const state = document.getElementById('btShipmentState');
    const method = document.getElementById('btShipmentMethod');
    const rowsContainer = document.getElementById('btShipmentRows');
    const count = document.getElementById('btVisibleShipmentCount');
    const noResults = document.getElementById('btNoShipmentResults');
    if (!search || !state || !method || !rowsContainer || !count) {
      return;
    }

    const rows = Array.from(rowsContainer.querySelectorAll('tr'));
    function filterRows() {
      const query = search.value.trim().toLowerCase();
      const stateValue = state.value;
      const methodValue = method.value;
      let visibleCount = 0;

      rows.forEach((row) => {
        const matchesSearch = !query || row.dataset.search.includes(query);
        const matchesState = !stateValue || row.dataset.state === stateValue;
        const matchesMethod = !methodValue || row.dataset.method === methodValue;
        const visible = matchesSearch && matchesState && matchesMethod;
        row.hidden = !visible;
        if (visible) {
          visibleCount += 1;
        }
      });

      count.textContent = String(visibleCount);
      if (noResults) {
        noResults.classList.toggle('hidden', visibleCount !== 0);
      }
    }

    [search, state, method].forEach((element) => {
      element.addEventListener(element === search ? 'input' : 'change', filterRows);
    });
    search.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        search.value = '';
        filterRows();
      }
    });
  }

  initShipmentFilters();

  if (!report) {
    return;
  }

  const chartElements = Array.from(document.querySelectorAll('.bt-chart'));
  if (!window.d3) {
    chartElements.forEach((element) => {
      element.innerHTML = '<div class="bt-chart-empty">Interactive charts could not be loaded. The tables below still contain the full report.</div>';
    });
    return;
  }

  const d3 = window.d3;
  const tooltip = document.createElement('div');
  tooltip.className = 'bt-chart-tooltip';
  tooltip.style.whiteSpace = 'pre-line';
  document.body.appendChild(tooltip);

  function showTooltip(event, lines) {
    tooltip.textContent = lines.filter(Boolean).join('\n');
    tooltip.style.left = `${Math.min(event.clientX + 14, window.innerWidth - 300)}px`;
    tooltip.style.top = `${Math.min(event.clientY + 14, window.innerHeight - 140)}px`;
    tooltip.classList.add('is-visible');
  }

  function hideTooltip() {
    tooltip.classList.remove('is-visible');
  }

  function getContainer(id) {
    const element = document.getElementById(id);
    if (element) {
      element.innerHTML = '';
    }
    return element;
  }

  function emptyChart(container, message) {
    if (!container) {
      return;
    }
    const empty = document.createElement('div');
    empty.className = 'bt-chart-empty';
    empty.textContent = message;
    container.appendChild(empty);
  }

  function createSvg(container, height) {
    const width = Math.max(container.clientWidth || 0, 300);
    return {
      width,
      height,
      svg: d3.select(container)
        .append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('preserveAspectRatio', 'xMidYMid meet'),
    };
  }

  function drawStatusChart() {
    const container = getContainer('btStatusChart');
    if (!container) {
      return;
    }
    const data = (report.statusMix || []).filter((item) => item.count > 0);
    if (data.length === 0) {
      emptyChart(container, 'No shipment-state data is available yet.');
      return;
    }

    const { width, svg } = createSvg(container, 260);
    const compact = width < 440;
    const centerX = compact ? width / 2 : Math.min(width * 0.34, 170);
    const centerY = compact ? 102 : 130;
    const radius = compact ? 76 : 88;
    const group = svg.append('g').attr('transform', `translate(${centerX},${centerY})`);
    const pie = d3.pie().sort(null).value((item) => item.count);
    const arc = d3.arc().innerRadius(radius * 0.64).outerRadius(radius);

    group.selectAll('path')
      .data(pie(data))
      .join('path')
      .attr('fill', (item) => colors[item.data.key] || colors.cyan)
      .attr('stroke', colors.surface)
      .attr('stroke-width', 3)
      .attr('d', arc)
      .style('cursor', 'default')
      .on('mousemove', (event, item) => showTooltip(event, [
        item.data.label,
        `${item.data.count} shipment${item.data.count === 1 ? '' : 's'}`,
        `${Math.round((item.data.count / report.summary.shipmentCount) * 1000) / 10}% of group`,
      ]))
      .on('mouseleave', hideTooltip);

    group.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', -3)
      .attr('fill', colors.ink)
      .attr('font-size', 26)
      .attr('font-weight', 800)
      .text(report.summary.shipmentCount || 0);
    group.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 17)
      .attr('fill', colors.text)
      .attr('font-size', 10)
      .attr('font-weight', 700)
      .text('SHIPMENTS');

    const legendX = compact ? Math.max(12, centerX - 135) : centerX + radius + 42;
    const legendY = compact ? 205 : 66;
    const legend = svg.append('g').attr('transform', `translate(${legendX},${legendY})`);
    data.forEach((item, index) => {
      const x = compact ? (index % 2) * 145 : 0;
      const y = compact ? Math.floor(index / 2) * 24 : index * 35;
      legend.append('circle')
        .attr('cx', x + 5)
        .attr('cy', y + 5)
        .attr('r', 5)
        .attr('fill', colors[item.key] || colors.cyan);
      legend.append('text')
        .attr('x', x + 17)
        .attr('y', y + 8)
        .attr('fill', colors.text)
        .attr('font-size', 11)
        .text(`${item.label} · ${item.count}`);
    });
  }

  function drawDurationChart() {
    const container = getContainer('btDurationChart');
    if (!container) {
      return;
    }
    const values = (report.deliveredDurations || [])
      .map(Number)
      .filter(Number.isFinite);
    if (values.length === 0) {
      emptyChart(container, 'Delivered transit-time data will appear after the first completed shipment.');
      return;
    }

    const { width, height, svg } = createSvg(container, 260);
    const margin = { top: 18, right: 18, bottom: 42, left: 42 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const maxValue = Math.max(d3.max(values) || 1, 1);
    const x = d3.scaleLinear().domain([0, maxValue * 1.05]).nice().range([0, plotWidth]);
    const binCount = Math.max(4, Math.min(10, Math.ceil(Math.sqrt(values.length) * 1.5)));
    const bins = d3.bin().domain(x.domain()).thresholds(x.ticks(binCount))(values);
    const y = d3.scaleLinear()
      .domain([0, Math.max(d3.max(bins, (bin) => bin.length) || 0, 1)])
      .nice()
      .range([plotHeight, 0]);
    const plot = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    plot.append('g')
      .attr('transform', `translate(0,${plotHeight})`)
      .call(d3.axisBottom(x).ticks(6).tickFormat((value) => `${value}d`));
    plot.append('g').call(d3.axisLeft(y).ticks(4).tickFormat(d3.format('d')));
    plot.append('g')
      .attr('stroke', colors.grid)
      .attr('stroke-opacity', 0.75)
      .call(d3.axisLeft(y).ticks(4).tickSize(-plotWidth).tickFormat(''))
      .call((selection) => selection.select('.domain').remove());

    plot.selectAll('.bt-hist-bar')
      .data(bins)
      .join('rect')
      .attr('class', 'bt-hist-bar')
      .attr('x', (bin) => x(bin.x0) + 1)
      .attr('y', (bin) => y(bin.length))
      .attr('width', (bin) => Math.max(0, x(bin.x1) - x(bin.x0) - 2))
      .attr('height', (bin) => plotHeight - y(bin.length))
      .attr('rx', 4)
      .attr('fill', colors.cyan)
      .attr('opacity', 0.86)
      .on('mousemove', (event, bin) => showTooltip(event, [
        `${Math.round(bin.x0 * 10) / 10}–${Math.round(bin.x1 * 10) / 10} days`,
        `${bin.length} delivered shipment${bin.length === 1 ? '' : 's'}`,
      ]))
      .on('mouseleave', hideTooltip);

    const median = report.deliveredDurationStats && report.deliveredDurationStats.median;
    if (median !== null && median !== undefined) {
      plot.append('line')
        .attr('x1', x(median))
        .attr('x2', x(median))
        .attr('y1', 0)
        .attr('y2', plotHeight)
        .attr('stroke', colors.violet)
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5 4');
      plot.append('text')
        .attr('x', Math.min(x(median) + 5, plotWidth - 70))
        .attr('y', 10)
        .attr('fill', colors.violet)
        .attr('font-size', 10)
        .attr('font-weight', 800)
        .text(`Median ${median}d`);
    }
  }

  function truncateLabel(value, length) {
    const text = String(value || '');
    return text.length > length ? `${text.slice(0, length - 1)}…` : text;
  }

  function drawMethodChart() {
    const container = getContainer('btMethodChart');
    if (!container) {
      return;
    }
    const data = (report.methods || [])
      .filter((method) => method.durationStats && method.durationStats.median !== null)
      .slice(0, 8);
    if (data.length === 0) {
      emptyChart(container, 'Method performance needs at least one delivered shipment with a ship date.');
      return;
    }

    const height = Math.max(260, data.length * 38 + 70);
    const { width, svg } = createSvg(container, height);
    const margin = { top: 14, right: 54, bottom: 40, left: Math.min(150, width * 0.36) };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const x = d3.scaleLinear()
      .domain([0, Math.max(d3.max(data, (method) => method.durationStats.median) || 0, 1) * 1.15])
      .nice()
      .range([0, plotWidth]);
    const y = d3.scaleBand()
      .domain(data.map((method) => method.id))
      .range([0, plotHeight])
      .padding(0.3);
    const plot = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    plot.append('g')
      .attr('transform', `translate(0,${plotHeight})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat((value) => `${value}d`));
    plot.append('g')
      .call(d3.axisLeft(y).tickFormat((id) => truncateLabel(data.find((item) => item.id === id).name, 22)));
    plot.append('g')
      .attr('stroke', colors.grid)
      .call(d3.axisBottom(x).ticks(5).tickSize(plotHeight).tickFormat(''))
      .call((selection) => selection.select('.domain').remove());

    plot.selectAll('.bt-method-bar')
      .data(data)
      .join('rect')
      .attr('x', 0)
      .attr('y', (method) => y(method.id))
      .attr('width', (method) => x(method.durationStats.median))
      .attr('height', y.bandwidth())
      .attr('rx', 5)
      .attr('fill', (method, index) => d3.interpolateRgb('#2b88d3', '#22a884')(index / Math.max(data.length - 1, 1)))
      .on('mousemove', (event, method) => showTooltip(event, [
        method.name,
        `Median delivery: ${method.durationStats.median} days`,
        `Typical range: ${method.durationStats.p25}–${method.durationStats.p75} days`,
        `${method.deliveredCount} delivered of ${method.shipmentCount}`,
      ]))
      .on('mouseleave', hideTooltip);

    plot.selectAll('.bt-method-value')
      .data(data)
      .join('text')
      .attr('x', (method) => x(method.durationStats.median) + 6)
      .attr('y', (method) => y(method.id) + y.bandwidth() / 2 + 4)
      .attr('fill', colors.ink)
      .attr('font-size', 10)
      .attr('font-weight', 800)
      .text((method) => `${method.durationStats.median}d`);
  }

  function drawCountryChart() {
    const container = getContainer('btCountryChart');
    if (!container) {
      return;
    }
    const source = report.countryDistribution || [];
    if (source.length === 0) {
      emptyChart(container, 'No destination data is available yet.');
      return;
    }
    const data = source.slice(0, 7);
    if (source.length > 7) {
      data.push({
        country: 'Other destinations',
        count: source.slice(7).reduce((total, item) => total + item.count, 0),
      });
    }

    const height = Math.max(260, data.length * 34 + 70);
    const { width, svg } = createSvg(container, height);
    const margin = { top: 12, right: 44, bottom: 38, left: Math.min(145, width * 0.36) };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const x = d3.scaleLinear()
      .domain([0, Math.max(d3.max(data, (item) => item.count) || 0, 1)])
      .nice()
      .range([0, plotWidth]);
    const y = d3.scaleBand()
      .domain(data.map((item) => item.country))
      .range([0, plotHeight])
      .padding(0.32);
    const plot = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    plot.append('g')
      .attr('transform', `translate(0,${plotHeight})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format('d')));
    plot.append('g')
      .call(d3.axisLeft(y).tickFormat((label) => truncateLabel(label, 21)));
    plot.selectAll('.bt-country-bar')
      .data(data)
      .join('rect')
      .attr('x', 0)
      .attr('y', (item) => y(item.country))
      .attr('width', (item) => x(item.count))
      .attr('height', y.bandwidth())
      .attr('rx', 5)
      .attr('fill', colors.violet)
      .attr('opacity', 0.84)
      .on('mousemove', (event, item) => showTooltip(event, [
        item.country,
        `${item.count} shipment${item.count === 1 ? '' : 's'}`,
      ]))
      .on('mouseleave', hideTooltip);
    plot.selectAll('.bt-country-value')
      .data(data)
      .join('text')
      .attr('x', (item) => x(item.count) + 6)
      .attr('y', (item) => y(item.country) + y.bandwidth() / 2 + 4)
      .attr('fill', colors.ink)
      .attr('font-size', 10)
      .attr('font-weight', 800)
      .text((item) => item.count);
  }

  function drawFunnel(method, methodIndex) {
    const container = getContainer(`btFunnelChart-${methodIndex}`);
    if (!container) {
      return;
    }
    const data = method.stageFunnel || [];
    if (data.length === 0) {
      emptyChart(container, 'No common stage funnel is available.');
      return;
    }

    const height = Math.max(280, data.length * 36 + 54);
    const { width, svg } = createSvg(container, height);
    const margin = { top: 10, right: 48, bottom: 32, left: Math.min(145, width * 0.41) };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const x = d3.scaleLinear().domain([0, 100]).range([0, plotWidth]);
    const y = d3.scaleBand()
      .domain(data.map((stage) => stage.key))
      .range([0, plotHeight])
      .padding(0.3);
    const plot = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    plot.append('g')
      .attr('transform', `translate(0,${plotHeight})`)
      .call(d3.axisBottom(x).ticks(4).tickFormat((value) => `${value}%`));
    plot.append('g')
      .call(d3.axisLeft(y).tickFormat((key) => truncateLabel(data.find((stage) => stage.key === key).label, 20)));
    plot.selectAll('.bt-funnel-track')
      .data(data)
      .join('rect')
      .attr('x', 0)
      .attr('y', (stage) => y(stage.key))
      .attr('width', plotWidth)
      .attr('height', y.bandwidth())
      .attr('rx', 5)
      .attr('fill', colors.track);
    plot.selectAll('.bt-funnel-bar')
      .data(data)
      .join('rect')
      .attr('x', 0)
      .attr('y', (stage) => y(stage.key))
      .attr('width', (stage) => x(stage.reachedPercent))
      .attr('height', y.bandwidth())
      .attr('rx', 5)
      .attr('fill', (_stage, index) => d3.interpolateRgb('#35aab9', '#2778e8')(index / Math.max(data.length - 1, 1)))
      .on('mousemove', (event, stage) => showTooltip(event, [
        stage.label,
        `${stage.reachedCount} of ${method.shipmentCount} shipments`,
        `${stage.reachedPercent}% reached this stage`,
      ]))
      .on('mouseleave', hideTooltip);
    plot.selectAll('.bt-funnel-value')
      .data(data)
      .join('text')
      .attr('x', (stage) => Math.min(x(stage.reachedPercent) + 5, plotWidth + 4))
      .attr('y', (stage) => y(stage.key) + y.bandwidth() / 2 + 4)
      .attr('fill', colors.ink)
      .attr('font-size', 9)
      .attr('font-weight', 800)
      .text((stage) => `${stage.reachedPercent}%`);
  }

  function drawTransitions(method, methodIndex) {
    const container = getContainer(`btTransitionChart-${methodIndex}`);
    if (!container) {
      return;
    }
    const data = (method.transitions || []).filter((transition) => transition.sampleSize > 0);
    if (data.length === 0) {
      emptyChart(container, 'At least one shipment must contain both adjacent stages before transition timing can be calculated.');
      return;
    }

    const height = Math.max(280, data.length * 43 + 58);
    const { width, svg } = createSvg(container, height);
    const margin = { top: 12, right: 28, bottom: 36, left: Math.min(190, width * 0.48) };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const labels = data.map((transition) => `${transition.fromLabel} → ${transition.toLabel}`);
    const maxDays = Math.max(d3.max(data, (transition) => Math.max(
      transition.p90 || 0,
      transition.p75 || 0,
      transition.median || 0
    )) || 0, 1);
    const x = d3.scaleLinear().domain([0, maxDays * 1.12]).nice().range([0, plotWidth]);
    const y = d3.scaleBand().domain(labels).range([0, plotHeight]).padding(0.42);
    const plot = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    plot.append('g')
      .attr('transform', `translate(0,${plotHeight})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat((value) => `${value}d`));
    plot.append('g')
      .call(d3.axisLeft(y).tickFormat((label) => truncateLabel(label, 29)));
    plot.append('g')
      .attr('stroke', colors.grid)
      .call(d3.axisBottom(x).ticks(5).tickSize(plotHeight).tickFormat(''))
      .call((selection) => selection.select('.domain').remove());

    const rows = plot.selectAll('.bt-transition-row')
      .data(data)
      .join('g')
      .attr('class', 'bt-transition-row')
      .attr('transform', (transition) => `translate(0,${y(`${transition.fromLabel} → ${transition.toLabel}`) + y.bandwidth() / 2})`)
      .on('mousemove', (event, transition) => showTooltip(event, [
        `${transition.fromLabel} → ${transition.toLabel}`,
        `Median: ${transition.median} days`,
        `Middle 50%: ${transition.p25}–${transition.p75} days`,
        `90th percentile: ${transition.p90} days`,
        `${transition.sampleSize} comparable shipment${transition.sampleSize === 1 ? '' : 's'}`,
      ]))
      .on('mouseleave', hideTooltip);

    rows.append('line')
      .attr('x1', (transition) => x(transition.p25))
      .attr('x2', (transition) => x(transition.p75))
      .attr('stroke', colors.cyan)
      .attr('stroke-width', 7)
      .attr('stroke-linecap', 'round');
    rows.append('line')
      .attr('x1', 0)
      .attr('x2', (transition) => x(transition.p90))
      .attr('stroke', colors.transition)
      .attr('stroke-width', 1.5)
      .lower();
    rows.append('circle')
      .attr('cx', (transition) => x(transition.median))
      .attr('r', 5)
      .attr('fill', colors.surface)
      .attr('stroke', colors.violet)
      .attr('stroke-width', 3);
    rows.append('path')
      .attr('d', d3.symbol().type(d3.symbolDiamond).size(38))
      .attr('transform', (transition) => `translate(${x(transition.p90)},0)`)
      .attr('fill', colors.amber);
  }

  function drawAllCharts() {
    hideTooltip();
    drawStatusChart();
    drawDurationChart();
    drawMethodChart();
    drawCountryChart();
    (report.methods || []).forEach((method, index) => {
      drawFunnel(method, index);
      drawTransitions(method, index);
    });
  }

  drawAllCharts();
  window.addEventListener('gcs:themechange', () => {
    updateChartColors();
    drawAllCharts();
  });
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(drawAllCharts, 180);
  });
})();
