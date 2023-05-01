const data = JSON.parse(document.getElementById('data').innerHTML);

function OpenChat(threadid) {
  // Reload #chatarea
  document.getElementById('chatarea').innerHTML = '';
  if (threadid != '0') {
    data[threadid].forEach((comment) => {
      const element = document.createElement('div');
      element.classList.add(comment.role);
      const tokens = document.createElement('div');
      tokens.classList.add('tokens');
      tokens.innerText = `Tokens: ${comment.tokens}, Processed by: ${comment.user}`;
      element.append(tokens);
      const parts = comment.content.split('```');
      parts.forEach((d, i) => {
        if (i % 2 == 0) {
          const p = document.createElement('p');
          p.innerHTML = d.split('\n').join('<br>');
          element.append(p);
        } else {
          const pre = document.createElement('pre');
          pre.innerHTML = d;
          element.append(pre);
        }
      });
      document.getElementById('chatarea').append(element);
    });
    document.getElementById('title').value = data[threadid][data[threadid].length - 1].title;
  }

  document.getElementById('threadid').value = threadid;
}
