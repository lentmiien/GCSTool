const data = JSON.parse(document.getElementById('graphdata').innerText);
const rect = document.getElementById('graph_area').getBoundingClientRect();

// Draw area values
const margin = {
  top: 10,
  right: 10,
  bottom: 50,
  left: 50,
};
const width = rect.width - margin.left - margin.right;
const height = 300;

function GenerateGraph(prefix, title) {
  // Create draw area
  d3.select('#graph_area').append('h2').text(title);
  const svg = d3.select('#graph_area')
    .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
    .append('g')
      .attr('transform', 
            `translate(${margin.left},${margin.top})`)

  // Prepare data
  let plotdata = data.map((entry, index) => {
    return {
      yval: entry[`${prefix}_days`] / (entry[`${prefix}_cnt`] > 0 ? entry[`${prefix}_cnt`] : 1),
      xval: index,
    }
  }).filter(entry => entry.yval > 0);

  // X label
  let x = d3.scaleLinear()
    .domain([0, 51])
    .range([width, 0]);
  svg.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x));

  // Y label
  let y = d3.scaleLinear()
    .domain([0, d3.max(plotdata, d => d.yval)])
    .range([height, 0]);
  svg.append('g')
    .call(d3.axisLeft(y));

  // Line
  svg
    .append('path')
    .datum(plotdata)
    .attr('fill', 'none')
    .attr('stroke', 'steelblue')
    .attr('stroke-width', 3)
    .attr('d', d3.line()
      .x(d => x(d.xval))
      .y(d => y(d.yval))
    );
}

GenerateGraph('ems', 'EMS');
GenerateGraph('airsp', 'Air Small Packet');
GenerateGraph('salspr', 'SAL Registered');
GenerateGraph('salp', 'SAL Parcel');
GenerateGraph('dhl', 'DHL');
GenerateGraph('airp', 'Air Parcel');