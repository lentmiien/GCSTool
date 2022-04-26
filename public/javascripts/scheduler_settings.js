const setting = document.getElementById('setting');
const key = document.getElementById('key');
const value = document.getElementById('value');
const output = document.getElementById('output');

function Edit() {
  fetch("/scheduler/settings", {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({setting: setting.value, key: key.value, value: value.value})
  })
    .then(response => response.json())
    .then(data => {
      console.log(data)
      output.innerHTML += `<p>Added "${key.value}":"${value.value}" to ${setting.value}</p>`;
    });
}