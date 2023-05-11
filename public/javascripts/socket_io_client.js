document.addEventListener('DOMContentLoaded', () => {
  // Connect to the Socket.IO server
  const socket = io();

  // Handle connection errors
  socket.on('connect_error', (error) => {
    console.log('Connection error:', error.message);
  });

  // Handle connection success
  socket.on('connect', () => {
    console.log('Connected to the server');
  });

  /***********
   * Meeting *
   ***********/
  document.getElementById('newpostbutton').addEventListener('click', () => {
    const name = document.getElementById('name').value;
    const title = document.getElementById('newtitle');
    const content = document.getElementById('newcontent');
    const comment = document.getElementById('newmycomment');
    socket.emit('meeting_new', { name, title: title.value, content: content.value, comment: comment.value });
  });
  const update_meeting_buttons = document.getElementsByClassName("update_meeting_button");
  for (let i = 0; i < update_meeting_buttons.length; i++){
    update_meeting_buttons[i].addEventListener('click', (e) => {
      const name = document.getElementById('name').value;
      const id = e.target.dataset.id;
      const status = document.getElementById(`editstatus${id}`);
      const content = document.getElementById(`editdetails${id}`);
      socket.emit('meeting_update', { name, id, content: content.value, status: status.value });
    });
  }
  const add_comment_buttons = document.getElementsByClassName("update_meeting_button");
  for (let i = 0; i < add_comment_buttons.length; i++){
    add_comment_buttons[i].addEventListener('click', (e) => {
      const name = document.getElementById('name').value;
      const id = e.target.dataset.id;
      const comment = document.getElementById(`newcomment${id}`);
      socket.emit('comment_add', { name, id, comment: comment.value });
    });
  }
  const update_comment_buttons = document.getElementsByClassName("update_comment_button");
  for (let i = 0; i < update_comment_buttons.length; i++){
    update_comment_buttons[i].addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      const comment = document.getElementById(`mycomment${id}`);
      socket.emit('comment_update', { id, comment: comment.value });
    });
  }
  // Listen for the 'server response' event
  socket.on('server_response', function(data) {
    console.log(data);
  });

  // Handle server messages
  socket.on('message', (data) => {
    console.log('Message from the server:', data);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Disconnected from the server');
  });
});
