const csv_link = document.getElementById('csv_link');
const forms = JSON.parse(document.getElementById('forms').innerHTML);
const entries = JSON.parse(document.getElementById('entries').innerHTML);
const table_label1 = document.getElementById('table_label1');
const table_label2 = document.getElementById('table_label2');
const table_label3 = document.getElementById('table_label3');
const table_label4 = document.getElementById('table_label4');
const input_label1 = document.getElementById('input_label1');
const input_label2 = document.getElementById('input_label2');
const input_label3 = document.getElementById('input_label3');
const input_label4 = document.getElementById('input_label4');
const table_entries = document.getElementsByClassName('table_entry');
const group_label = document.getElementById('group_label');

function SelectForm(select) {
  // Update CSV link
  csv_link.href = `/form/csv?label=${select.value}`;

  // Update table header
  forms.forEach((f) => {
    if (f.group_label == select.value) {
      table_label1.innerText = f.label1;
      table_label2.innerText = f.label2;
      table_label3.innerText = f.label3;
      table_label4.innerText = f.label4;
      input_label1.innerText = f.label1;
      input_label2.innerText = f.label2;
      input_label3.innerText = f.label3;
      input_label4.innerText = f.label4;
    }
  });

  // Show/Hide table rows
  for (let i = 0; i < table_entries.length; i++) {
    if (table_entries[i].dataset.gl == select.value || select.value.length == 0) {
      table_entries[i].classList.remove('hidden');
    } else {
      table_entries[i].classList.add('hidden');
    }
  }

  // Sync select
  group_label.value = select.value;
}
