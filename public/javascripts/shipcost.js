const zones = JSON.parse(document.getElementById("zones").innerHTML);
const data = JSON.parse(document.getElementById("data").innerHTML);

console.log(data)

const row_colors = ["#FFF", "#EEE"];
function Charts(group, type) {
  // Load settings
  const lowlimit = parseInt(document.getElementById("lowlimit").value);
  const highlimit = parseInt(document.getElementById("highlimit").value);
  const hide2575 = document.getElementById("hide2575").checked;
  const hideempty = document.getElementById("hideempty").checked;

  const group_elements = document.getElementsByClassName(group);
  const method_arr = [];
  for (let i = 0; i < group_elements.length; i++) {
    if (group_elements[i].checked == true) method_arr.push(group_elements[i].value);
  }
  let top_links = "";
  let output = "";
  zones[type].forEach((z, i) => {
    top_links += `<a href="#zone${i+1}">${z}</a><br>`;
    const zone = `zone${i+1}`;
    output += `<hr id="zone${i+1}"><h2>${z}</h2>`;
    output += `<table class="wysiwyg-text-align-center" style="width:100%;"><tr style="background-color:#CCC;"><th>Weight</th><th>${method_arr.join('</th><th>')}</th></tr>`;
    
    const output_data_array = [];
    const output_data_array_lookup = [];
    method_arr.forEach(ma => {
      for (let x = 0; x < data[ma][zone].length; x++) {
        const index = output_data_array_lookup.indexOf(data[ma][zone][x].uptoweight_g);
        if (index == -1) {
          if (data[ma][zone][x].uptoweight_g >= lowlimit && data[ma][zone][x].uptoweight_g <= highlimit) {
            if (!(hide2575 && (data[ma][zone][x].uptoweight_g == 1250 || data[ma][zone][x].uptoweight_g == 1750))) {
              output_data_array.push({
                w: data[ma][zone][x].uptoweight_g,
                [ma]: data[ma][zone][x].before_cost
              });
              output_data_array_lookup.push(data[ma][zone][x].uptoweight_g);
            }
          }
        } else {
          output_data_array[index][ma] = data[ma][zone][x].before_cost;
        }
      }
    });

    // Sort based on weight
    output_data_array.sort((a, b) => {
      if (a.w < b.w) return -1;
      if (a.w > b.w) return 1;
      return 0
    });
    
    // Filter rows with empty cells
    let filter_output = output_data_array;
    if (hideempty) {
      const full_count = method_arr.length + 1;
      filter_output = output_data_array.filter(a => Object.keys(a).length == full_count);
    }

    filter_output.forEach((o, x) => {
      output += `<tr style="background-color:${row_colors[x%2]};"><td>Up to ${FormatWeight(o.w)}</td>`;
      method_arr.forEach(m => output += (m in o ? `<td>${FormatCost(o[m])}</td>` : `<td></td>` ))
      output += `</tr>`;
    });

    output += `</table>`;
  });

  CopyToClipboard(`<p>${top_links}</p>${output}`);
}

function CopyToClipboard(s) {
  // Copy to clipboard
  function listener(e) {
    // e.clipboardData.setData('text/html', output);
    e.clipboardData.setData('text/plain', s);
    e.preventDefault();
  }
  document.addEventListener('copy', listener);
  document.execCommand('copy');
  document.removeEventListener('copy', listener);
}

function FormatWeight(w) {
  let w_str = `${w > 999 ? w/1000 : w}${w%1000 == 0 ? ".0" : ""}${w > 999 ? "kg" : "g"}`;
  return w_str;
}

function FormatCost(c) {
  let c_str = `${c}`;
  if (c > 100000) c_str = c_str.slice(0, 3) + "," + c_str.slice(3);
  else if (c > 10000) c_str = c_str.slice(0, 2) + "," + c_str.slice(2);
  else if (c > 1000) c_str = c_str.slice(0, 1) + "," + c_str.slice(1);
  return c_str + " JPY";
}

function ManualUpdate(element) {
  if (element.value == element.dataset.previous) {
    element.classList.remove("cost-change");
  } else {
    element.classList.add("cost-change");
  }
}

function UpdateDatabase(index, method) {
  const date = document.getElementById(`updatedate${index}`).value;
  const d = new Date(date);
  const inputs = document .getElementsByClassName(`group${index}`);

  const value_arr = [];
  for (let i = 0; i < inputs.length; i++) {
    value_arr.push({
      uptoweight_g: parseInt(inputs[i].dataset.weight),
      method: method,
      cost: parseInt(inputs[i].value),
      costdate: d.getFullYear()*10000 + (d.getMonth()+1)*100 + d.getDate(),
      zone: inputs[i].dataset.zone
    });
  }

  // Send to server
  fetch('/shipcost/savetodb', {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    method: "POST",
    body: JSON.stringify({method, data_array: value_arr})
  })
  .then((response) => {
    return response.json();
  })
  .then((myJson) => {
    alert(myJson.status);
  });
}
