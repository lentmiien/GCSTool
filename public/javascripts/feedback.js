function RegisterFeedback() {
    // Acquire datafields to send
    const happiness = document.getElementById('happiness');
    const type = document.getElementById('type');
    const bug = document.getElementById('bug');
    const comment = document.getElementById('comment');

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
      }),
    }).then((res) => {
      happiness.value = 'neutral';
      type.value = 'overall';
      bug.checked = false;
      comment.value = '';
    });
  }