function RegisterFeedback() {
  // Acquire datafields to send
  const happiness = document.getElementById('happiness');
  const type = document.getElementById('type');
  const bug = document.getElementById('bug');
  const comment = document.getElementById('comment');
  const ticket = document.getElementById('ticket');

  if (comment.value.length == 0) {
    alert('Please add a comment');
    return;
  }

  document.getElementById('feedbackbutton').disabled = true;

  fetch('/meeting/addfeedback', {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    method: 'POST',
    body: JSON.stringify({
      happiness: happiness.value,
      type: type.value,
      bug: bug.checked,
      comment: comment.value,
      ticket: ticket.value,
    }),
  }).then((res) => {
    happiness.value = 'neutral';
    type.value = 'general';
    bug.checked = false;
    comment.value = '';
    ticket.value = '';
    document.getElementById('feedbackbutton').disabled = false;
  });
}

function UpdateIssue(incident_id) {
  const issue_id = document.getElementById(incident_id).value;

  fetch('/meeting/editfeedback', {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    method: 'POST',
    body: JSON.stringify({
      incident_id,
      issue_id,
    }),
  })
}
