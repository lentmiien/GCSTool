async function ResetPassword(id, btn) {
  const response = await fetch(`/reset_password/${id}`, {
    method: 'get',
    cache: 'no-cache',
    headers: {
      Accept: 'application/json',
    },
  });
  const data = await response.json();
  if (data.status === 'OK') {
    btn.style.display = 'none';
  } else {
    alert(data.status);
  }
}
