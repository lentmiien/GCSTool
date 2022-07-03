const sections_lookup = JSON.parse(document.getElementById('sections_lookup').innerHTML);
const headings_lookup = JSON.parse(document.getElementById('headings_lookup').innerHTML);
const entries = JSON.parse(document.getElementById('entries').innerHTML);

function Change(i) {
  // Check that input is valid HS code
  const newHS = document.getElementById(`input_${i}`).value;
  if (!(newHS in headings_lookup)) return;
  if (newHS.length != 6) return;

  // Send to server
  fetch('/hs/dbupdate', {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    method: "POST",
    body: JSON.stringify({
      currName: document.getElementById(`name_${i}`).innerText,
      currCode: document.getElementById(`code_${i}`).innerText,
      newCode: newHS
    })
  })
  .then((response) => {
    // When response, update data in row
    document.getElementById(`code_${i}`).innerText = newHS;
    document.getElementById(`desc_${i}`).innerText = headings_lookup[newHS].description;
    document.getElementById(`input_${i}`).value = '';
  });
}

/*
td(id=`name_${i}`)= entry.name
td(id=`code_${i}`)= entry.code
td(id=`desc_${i}`)= headings_lookup[entry.code].description
td(id=`uses_${i}`)= `${entry.uses}/${usage[entry.code]}`
td(id=`edit_${i}`) ***INPUT*** ***DELETE***
*/

function Delete(i) {
  // Send delete request to server
  fetch('/hs/dbdelete', {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    method: "POST",
    body: JSON.stringify({ id: i })
  })
  .then((response) => {
    // When response, update data in row (to empty data)
    document.getElementById(`name_${i}`).innerText = "---";
    document.getElementById(`code_${i}`).innerText = "---";
    document.getElementById(`desc_${i}`).innerText = "---";
    document.getElementById(`uses_${i}`).innerText = "---";
    document.getElementById(`edit_${i}`).innerText = "---";
  });
}
