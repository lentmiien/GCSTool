async function DeleteHoliday(id, btn) {
  const response = await fetch(`/scheduler/deleteholiday`, {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    method: 'POST',
    body: JSON.stringify({ id: id }),
  });
  const data = await response.json();
  if (data.status === 'OK') {
    btn.parentElement.innerHTML = '<b>DELETED</b>';
  } else {
    alert(data.status);
  }
}