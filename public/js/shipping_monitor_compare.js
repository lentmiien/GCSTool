document.addEventListener('DOMContentLoaded', () => {
  const report = window.shippingMonitorCompareReport;
  if (!report || typeof d3 === 'undefined') {
    return;
  }

  const paletteSource = document.querySelector('.shipping-monitor') || document.documentElement;
  const readCssVar = (name, fallback) => {
    const value = window.getComputedStyle(paletteSource).getPropertyValue(name).trim();
    return value || fallback;
  };

  const FILL_COLORS = {
    returnPercent: readCssVar('--shipping-monitor-color-return', '#ea7568'),
    inTransitPercent: readCssVar('--shipping-monitor-color-transit', '#4d8ff7'),
    destinationPercent: readCssVar('--shipping-monitor-color-destination', '#39b86d'),
  };

  const LINE_COLORS = {
    returnPercent: readCssVar('--shipping-monitor-color-return-line', '#b04338'),
    inTransitPercent: readCssVar('--shipping-monitor-color-transit-line', '#1f63cb'),
    destinationPercent: readCssVar('--shipping-monitor-color-destination-line', '#177a43'),
  };

  const toRgbaColor = (value, opacity) => {
    const parsed = d3.color(value);
    if (!parsed) {
      return value;
    }

    parsed.opacity = opacity;
    return parsed.formatRgb();
  };

  const buildGradientIds = (svg, container) => {
    const defs = svg.append('defs');
    const gradientKeyPrefix = String(container.id || `shipping-monitor-chart-${Math.random().toString(36).slice(2, 8)}`)
      .replace(/[^a-zA-Z0-9_-]+/g, '-');
    const gradientIds = {};

    Object.keys(FILL_COLORS).forEach((key) => {
      const gradientId = `${gradientKeyPrefix}-${key}-gradient`;
      const gradient = defs.append('linearGradient')
        .attr('id', gradientId)
        .attr('x1', '0%')
        .attr('x2', '0%')
        .attr('y1', '0%')
        .attr('y2', '100%');

      gradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', toRgbaColor(LINE_COLORS[key], 0.82));

      gradient.append('stop')
        .attr('offset', '56%')
        .attr('stop-color', toRgbaColor(FILL_COLORS[key], 0.48));

      gradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', toRgbaColor(FILL_COLORS[key], 0.16));

      gradientIds[key] = gradientId;
    });

    return gradientIds;
  };

  const truncateLabel = (value, limit) => {
    if (typeof value !== 'string') {
      return '';
    }

    return value.length > limit ? `${value.slice(0, limit - 3)}...` : value;
  };

  const toNumber = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  };

  const toNullableNumber = (value) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  };

  const preparePoint = (point, compact) => {
    const summary = point.summary || {};
    const chart = summary.chart || point.chart || {};
    const label = point.groupLabel || point.label || 'Group';

    return {
      selectionIndex: toNumber(point.selectionIndex),
      label,
      axisLabel: `#${toNumber(point.selectionIndex)} ${truncateLabel(label, compact ? 12 : 18)}`.trim(),
      destinationPercent: toNumber(chart.destinationPercent),
      returnPercent: toNumber(chart.returnPercent),
      inTransitPercent: toNumber(chart.inTransitPercent),
      comparableEntries: toNumber(chart.comparableEntries),
      destinationCount: toNumber(summary.destinationDeliveredEntries ?? point.destinationDeliveredEntries),
      returnCount: toNumber(summary.returnDeliveredEntries ?? point.returnDeliveredEntries),
      inTransitCount: toNumber(summary.inTransitEntries ?? point.inTransitEntries),
      totalEntries: toNumber(summary.totalEntries ?? point.totalEntries),
      cachedEntryCount: toNullableNumber(summary.cachedEntryCount ?? point.cachedEntryCount),
      uncachedEntryCount: toNullableNumber(summary.uncachedEntryCount ?? point.uncachedEntryCount),
    };
  };

  const buildTooltip = (point) => {
    const lines = [
      point.label,
      `Destination delivered: ${point.destinationPercent}% (${point.destinationCount})`,
      `In transit: ${point.inTransitPercent}% (${point.inTransitCount})`,
      `Return delivered: ${point.returnPercent}% (${point.returnCount})`,
      `Entries represented: ${point.comparableEntries}`,
    ];

    if (point.cachedEntryCount !== null && point.totalEntries > 0) {
      lines.push(`Cached entries: ${point.cachedEntryCount}/${point.totalEntries}`);
    }

    if (point.uncachedEntryCount !== null && point.uncachedEntryCount > 0) {
      lines.push(`Uncached entries: ${point.uncachedEntryCount}`);
    }

    return lines.join('\n');
  };

  const renderSinglePointChart = (chart, innerWidth, innerHeight, point, gradientIds) => {
    const barWidth = Math.max(48, Math.min(96, innerWidth * 0.3));
    const x = (innerWidth - barWidth) / 2;
    const y = d3.scaleLinear().domain([0, 100]).range([innerHeight, 0]);

    const segments = [
      { key: 'returnPercent', value: point.returnPercent },
      { key: 'inTransitPercent', value: point.inTransitPercent },
      { key: 'destinationPercent', value: point.destinationPercent },
    ];

    let currentBottom = 0;
    segments.forEach((segment) => {
      const y1 = y(currentBottom);
      const y0 = y(currentBottom + segment.value);
      chart.append('rect')
        .attr('x', x)
        .attr('y', y0)
        .attr('width', barWidth)
        .attr('height', Math.max(0, y1 - y0))
        .attr('fill', `url(#${gradientIds[segment.key]})`)
        .attr('stroke', LINE_COLORS[segment.key])
        .attr('stroke-width', 1.25)
        .append('title')
        .text(buildTooltip(point));
      currentBottom += segment.value;
    });

    chart.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 34)
      .attr('text-anchor', 'middle')
      .attr('class', 'shipping-monitor-chart-label')
      .text(point.axisLabel);
  };

  const renderOutcomeAreaChart = (container, rawPoints, options = {}) => {
    if (!container) {
      return;
    }

    container.innerHTML = '';

    const compact = options.compact === true;
    const points = (rawPoints || [])
      .map((point) => preparePoint(point, compact))
      .sort((left, right) => left.selectionIndex - right.selectionIndex);

    if (points.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'text-muted small';
      emptyState.textContent = 'No chart data available.';
      container.appendChild(emptyState);
      return;
    }

    const width = Math.max(320, container.clientWidth || 320);
    const height = options.height || (compact ? 220 : 320);
    const margin = {
      top: 16,
      right: 14,
      bottom: compact ? 72 : 92,
      left: 56,
    };
    const innerWidth = Math.max(120, width - margin.left - margin.right);
    const innerHeight = Math.max(120, height - margin.top - margin.bottom);

    const svg = d3.select(container)
      .append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('width', '100%')
      .attr('height', height)
      .attr('role', 'img')
      .attr('aria-label', compact ? 'Shipping method comparison chart' : 'Saved group comparison chart');

    const gradientIds = buildGradientIds(svg, container);

    const chart = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    chart.append('rect')
      .attr('class', 'shipping-monitor-plot-surface')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('rx', compact ? 12 : 16)
      .attr('ry', compact ? 12 : 16);

    const y = d3.scaleLinear()
      .domain([0, 100])
      .range([innerHeight, 0]);

    chart.append('g')
      .attr('class', 'shipping-monitor-grid')
      .call(
        d3.axisLeft(y)
          .ticks(5)
          .tickFormat(() => '')
          .tickSize(-innerWidth)
      )
      .call((axis) => axis.select('.domain').remove());

    chart.append('line')
      .attr('class', 'shipping-monitor-baseline')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', innerHeight + 0.5)
      .attr('y2', innerHeight + 0.5);

    if (points.length === 1) {
      renderSinglePointChart(chart, innerWidth, innerHeight, points[0], gradientIds);
      chart.append('g')
        .attr('class', 'shipping-monitor-axis shipping-monitor-axis--y')
        .call(
          d3.axisLeft(y)
            .ticks(5)
            .tickSize(0)
            .tickFormat((value) => `${value}%`)
        )
        .call((axis) => axis.select('.domain').remove());
      return;
    }

    const x = d3.scalePoint()
      .domain(points.map((point) => point.axisLabel))
      .range([0, innerWidth]);

    const stack = d3.stack()
      .keys(['returnPercent', 'inTransitPercent', 'destinationPercent']);

    const stackedSeries = stack(points);

    const area = d3.area()
      .x((datum) => x(datum.data.axisLabel))
      .y0((datum) => y(datum[0]))
      .y1((datum) => y(datum[1]))
      .curve(d3.curveMonotoneX);

    chart.selectAll('.shipping-monitor-area')
      .data(stackedSeries)
      .enter()
      .append('path')
      .attr('class', 'shipping-monitor-area')
      .attr('fill', (series) => `url(#${gradientIds[series.key]})`)
      .attr('d', area);

    const line = d3.line()
      .x((datum) => x(datum.data.axisLabel))
      .y((datum) => y(datum[1]))
      .curve(d3.curveMonotoneX);

    chart.selectAll('.shipping-monitor-area-line')
      .data(stackedSeries)
      .enter()
      .append('path')
      .attr('class', 'shipping-monitor-area-line')
      .attr('fill', 'none')
      .attr('stroke', (series) => LINE_COLORS[series.key])
      .attr('stroke-width', 1.75)
      .attr('d', line);

    stackedSeries.forEach((series) => {
      chart.selectAll(`.shipping-monitor-point--${series.key}`)
        .data(series)
        .enter()
        .append('circle')
        .attr('class', `shipping-monitor-point shipping-monitor-point--${series.key}`)
        .attr('cx', (datum) => x(datum.data.axisLabel))
        .attr('cy', (datum) => y(datum[1]))
        .attr('r', compact ? 2.75 : 3.35)
        .attr('fill', LINE_COLORS[series.key]);
    });

    const overlayWidth = Math.max(32, innerWidth / points.length);
    chart.selectAll('.shipping-monitor-hover-zone')
      .data(points)
      .enter()
      .append('rect')
      .attr('class', 'shipping-monitor-hover-zone')
      .attr('x', (point) => x(point.axisLabel) - (overlayWidth / 2))
      .attr('y', 0)
      .attr('width', overlayWidth)
      .attr('height', innerHeight)
      .attr('fill', 'transparent')
      .append('title')
      .text(buildTooltip);

    chart.append('g')
      .attr('class', 'shipping-monitor-axis shipping-monitor-axis--x')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).tickSize(0))
      .call((axis) => {
        axis.select('.domain').remove();
        axis.selectAll('text')
          .attr('class', 'shipping-monitor-chart-label')
          .attr('transform', compact ? 'rotate(-18)' : 'rotate(-22)')
          .style('text-anchor', 'end');
      });

    chart.append('g')
      .attr('class', 'shipping-monitor-axis shipping-monitor-axis--y')
      .call(
        d3.axisLeft(y)
          .ticks(5)
          .tickSize(0)
          .tickFormat((value) => `${value}%`)
      )
      .call((axis) => axis.select('.domain').remove());
  };

  const renderAllCharts = () => {
    renderOutcomeAreaChart(
      document.getElementById('shippingMonitorOverallChart'),
      (report.groups || []).map((group) => ({
        selectionIndex: group.selectionIndex,
        label: group.label,
        summary: group.summary,
      })),
      { height: 320, compact: false }
    );

    (report.methodSections || []).forEach((section) => {
      renderOutcomeAreaChart(
        document.getElementById(`shippingMonitorMethodChart-${section.grouplabel}`),
        (section.points || []).map((point) => ({
          selectionIndex: point.selectionIndex,
          label: point.groupLabel,
          summary: point.summary,
        })),
        { height: 220, compact: true }
      );
    });
  };

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(renderAllCharts, 120);
  });

  renderAllCharts();
});
