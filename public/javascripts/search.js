const database = JSON.parse(document.getElementsByTagName('pre')[0].innerText);
const database_tracking = JSON.parse(document.getElementsByTagName('pre')[1].innerText);

const graph_icon = `
<svg width="20" height="15">
  <line x1="0" y1="15" x2="5" y2="7" style="stroke:rgb(100,100,200);stroke-width:2" />
  <line x1="5" y1="7" x2="10" y2="12" style="stroke:rgb(100,100,200);stroke-width:2" />
  <line x1="10" y1="12" x2="15" y2="11" style="stroke:rgb(100,100,200);stroke-width:2" />
  <line x1="15" y1="11" x2="20" y2="0" style="stroke:rgb(100,100,200);stroke-width:2" />
</svg>
`;

// Constants
const delay_trigger = 1.5; // If shipping time is 50% (or more) longer then usual, then consider as delayed
const statuses = [
  {
    text: 'Unavailable',
    class: 'unavailable',
    title: 'This shipping method is not provided for this country.',
  },
  {
    text: 'Available',
    class: 'available',
    title: 'Available, shipping is possible.',
  },
  {
    text: 'Suspended',
    class: 'suspended',
    title:
      'Orders will be put on hold for shipment until the shipping method becomes available again, previously shipped packages may be largely delayed.',
  },
  {
    text: 'Blocked',
    class: 'blocked',
    title:
      'Suspended indefinitely, unlikely to become available again within any forseeable future.\n*Customers can NOT select this shipping method.',
  },
];

// Trigger a search from script
function FillIn(text) {
  document.getElementById('search').value = text;
  ChangeSearch();
}

// Get the available data
function Available(num, current_avg, overall_avg) {
  // To prevent division with 0
  let overall_average = overall_avg;
  if (overall_avg == 0) {
    overall_average = 1;
  }

  // Calculate delays, if delayed longer than "delay_trigger"
  const delay = {};
  if (current_avg > overall_average * delay_trigger) {
    delay['text'] = `${Math.round((10 * current_avg) / overall_average) / 10}x delay`;
    delay['class'] = 'delays';
    delay['title'] = `On average, the last 2 weeks, shipments has been delayed about ${
      Math.round((10 * current_avg) / overall_average) / 10
    }x the normal average shipping time.`;
  }

  // Determine current status and return data
  if (num < statuses.length) {
    return {
      text: statuses[num].text,
      class: statuses[num].class,
      title: statuses[num].title,
      delay,
    };
  } else {
    return { text: `Unknown(${num})`, class: 'unknown', title: 'Unknown status, contact Lennart!', delay };
  }
}

// Perform a search
function ChangeSearch() {
  let search = document.getElementById('search').value.toUpperCase();
  const output = [];
  let tracking_number = '';

  // Do a tracking lookup
  database_tracking.forEach((dt) => {
    if (dt.tracking == search) {
      search = dt.country;
      tracking_number = dt.tracking;
    }
  });

  // Get selected index
  let index = -1;
  let code = search.charCodeAt(search.length - 1) - 48;
  if (code > 0 && code < 6) {
    index = code;
    search = search.slice(0, search.length - 1);
  }

  // Aquire data from database
  database.forEach((d) => {
    if (d.country_code == search) {
      output.unshift(d);
      if (index == -1) {
        index = 1;
      }
    } else if (d.country_name.toUpperCase() == search) {
      output.unshift(d);
      if (index == -1) {
        index = 1;
      }
    } else if (d.country_name.toUpperCase().indexOf(search) >= 0) {
      output.push(d);
    }
  });

  // If no index has been set, default to "1"
  if (index == -1) {
    index = 1;
  }

  // Print result
  document.getElementById('auto').innerHTML = '';
  for (let i = 0; i < 5; i++) {
    if (i < output.length) {
      // Show auto-complete term
      document.getElementById('auto').innerHTML += `
            <button class="btn btn-link" onclick="FillIn('${output[i].country_name}')" style="color:#ffffff;">${output[i].country_name} {${
        i + 1
      }}</button>
            `;

      // If at active entry, display data
      if (i + 1 == index) {
        document.getElementById(
          'link'
        ).innerHTML = `<a class="btn btn-link" href="/country/countrygraph/${output[i].country_code}" style="color:rgb(100,100,200);">${graph_icon}Show graphs</a>`;
        const format = {
          ems: Available(output[i].ems_available, output[i].ems_averagetime, output[i].ems_totalaveragetime),
          airsp: Available(output[i].airsp_available, output[i].airsp_averagetime, output[i].airsp_totalaveragetime),
          salspr: Available(output[i].salspr_available, output[i].salspr_averagetime, output[i].salspr_totalaveragetime),
          salspu: Available(output[i].salspu_available, output[i].salspu_averagetime, output[i].salspu_totalaveragetime),
          salp: Available(output[i].salp_available, output[i].salp_averagetime, output[i].salp_totalaveragetime),
          dhl: Available(output[i].dhl_available, output[i].dhl_averagetime, output[i].dhl_totalaveragetime),
          airp: Available(output[i].airp_available, output[i].airp_averagetime, output[i].airp_totalaveragetime),
        };
        document.getElementById('country').innerText = `${output[i].country_name} (${output[i].country_code})`;
        document.getElementById('tracking').innerText = tracking_number;

        for (let key of Object.keys(format)) {
          document.getElementById(
            `${key}_available`
          ).innerHTML = `<span class="${format[key].class}" title="${format[key].title}">${format[key].text}</span>`;
          if (format[key].delay.text) {
            document.getElementById(
              `${key}_available`
            ).innerHTML += `<span class="${format[key].delay.class}" title="${format[key].delay.title}">${format[key].delay.text}</span>`;
          }
          if (output[i][`${key}_small_sample`]) {
            document.getElementById(`${key}_available`).innerHTML += `<b style="color:red;">△</b>`;
          }
          // document.getElementById(`${key}_average`).innerHTML = `${
          //   output[i][`${key}_averagetime`] > 0 ? Math.round(10 * output[i][`${key}_averagetime`]) / 10 : '--'
          // } days <span class="${
          //   Math.round(10 * output[i][`${key}_averagetime`]) / 10 - output[i][`${key}_totalaveragetime`] < 0 ? 'fast' : 'slow'
          // }" title="Overall average shipping time: ${output[i][`${key}_totalaveragetime`]} days">(${
          //   output[i][`${key}_averagetime`] > 0
          //     ? Math.round(10 * (output[i][`${key}_averagetime`] - output[i][`${key}_totalaveragetime`])) / 10
          //     : '--'
          // } days)</span>`;
          // document.getElementById(`${key}_lastshipped`).innerHTML = `${
          //   output[i][`${key}_lastsucessfullyshipped`] > 0 ? new Date(output[i][`${key}_lastsucessfullyshipped`]).toDateString() : ''
          // }`;
        }
      }
    }
  }
}

ChangeSearch();
