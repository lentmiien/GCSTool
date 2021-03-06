async function UpdateName(id) {
  const response = await fetch(`/change_name/${id}/${document.getElementById("name_" + id).value}`, {
    method: 'get',
    cache: 'no-cache',
    headers: {
      Accept: 'application/json',
    },
  });
  const data = await response.json();
  if (data.status != 'OK') {
    alert(data.status);
  }
}

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
    btn.parentElement.innerHTML = '<b>NOT SET</b>';
  } else {
    alert(data.status);
  }
}

async function UpdateTeam(id) {
  const response = await fetch(`/change_team/${id}/${document.getElementById("team_" + id).value}`, {
    method: 'get',
    cache: 'no-cache',
    headers: {
      Accept: 'application/json',
    },
  });
  const data = await response.json();
  if (data.status != 'OK') {
    alert(data.status);
  }
}

async function MakeAdmin(id, btn) {
  const response = await fetch(`/make_admin/${id}`, {
    method: 'get',
    cache: 'no-cache',
    headers: {
      Accept: 'application/json',
    },
  });
  const data = await response.json();
  if (data.status === 'OK') {
    btn.parentElement.innerHTML = '<b>admin</b>';
  } else {
    alert(data.status);
  }
}

async function MakeUser(id, btn) {
  const response = await fetch(`/make_user/${id}`, {
    method: 'get',
    cache: 'no-cache',
    headers: {
      Accept: 'application/json',
    },
  });
  const data = await response.json();
  if (data.status === 'OK') {
    btn.parentElement.innerHTML = '<b>user</b>';
  } else {
    alert(data.status);
  }
}
