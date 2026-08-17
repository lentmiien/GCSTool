async function PostAdminUpdate(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    cache: 'no-cache',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body || {}),
  });

  let data = {};
  try {
    data = await response.json();
  } catch (_error) {
    data = { status: 'The server returned an unexpected response.' };
  }
  if (!response.ok || data.status !== 'OK') {
    throw new Error(data.status || 'The update failed.');
  }
  return data;
}

async function UpdateName(id) {
  const input = document.getElementById(`name_${id}`);
  try {
    await PostAdminUpdate(`/change_name/${id}`, { name: input.value });
  } catch (error) {
    window.alert(error.message);
  }
}

async function ResetPassword(id, button) {
  const input = document.getElementById(`password_${id}`);
  if (!input || input.value.length < 12) {
    window.alert('Temporary passwords must contain at least 12 characters.');
    return;
  }

  button.disabled = true;
  try {
    await PostAdminUpdate(`/reset_password/${id}`, { password: input.value });
    input.value = '';
    button.textContent = 'Set';
    window.alert('Temporary password updated. The user must replace it before continuing.');
  } catch (error) {
    window.alert(error.message);
  } finally {
    button.disabled = false;
  }
}

async function UpdateTeam(id) {
  const select = document.getElementById(`team_${id}`);
  try {
    await PostAdminUpdate(`/change_team/${id}`, { team: select.value });
  } catch (error) {
    window.alert(error.message);
    window.location.reload();
  }
}

async function MakeAdmin(id) {
  try {
    await PostAdminUpdate(`/make_admin/${id}`);
    window.location.reload();
  } catch (error) {
    window.alert(error.message);
  }
}

async function MakeUser(id) {
  try {
    await PostAdminUpdate(`/make_user/${id}`);
    window.location.reload();
  } catch (error) {
    window.alert(error.message);
  }
}
