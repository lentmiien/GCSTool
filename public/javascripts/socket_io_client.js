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
  const update_meeting_buttons = document.getElementsByClassName('update_meeting_button');
  for (let i = 0; i < update_meeting_buttons.length; i++) {
    update_meeting_buttons[i].addEventListener('click', (e) => {
      const name = document.getElementById('name').value;
      const id = e.target.dataset.id;
      const status = document.getElementById(`editstatus${id}`);
      const content = document.getElementById(`editdetails${id}`);
      socket.emit('meeting_update', { name, id, content: content.value, status: status.value });
    });
  }
  const add_comment_buttons = document.getElementsByClassName('add_comment_button');
  for (let i = 0; i < add_comment_buttons.length; i++) {
    add_comment_buttons[i].addEventListener('click', (e) => {
      const name = document.getElementById('name').value;
      const id = e.target.dataset.id;
      const comment = document.getElementById(`newcomment${id}`);
      socket.emit('comment_add', { name, id, comment: comment.value });
    });
  }
  const update_comment_buttons = document.getElementsByClassName('update_comment_button');
  for (let i = 0; i < update_comment_buttons.length; i++) {
    update_comment_buttons[i].addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      const comment = document.getElementById(`mycomment${id}`);
      socket.emit('comment_update', { id, comment: comment.value });
    });
  }
  // Listen for the 'server response' event
  socket.on('server_response', function (data) {
    console.log(data);
    // socket.emit('server_response', { newMeeting: [...], updateMeeting: [...], newComment: [...], updateComment: [...] });
    const new_meeting_section = document.getElementById('new_meeting_section');
    if (new_meeting_section) {
      // Update as necessary
      if (data.newMeeting.length > 0) {
        const cnt = Date.now();
        const sDate = new Date(data.newMeeting[0].updatedAt);
        let classType = 'alert-primary';
        let message = '';
        let hide = false;
        const s_list = { new: '新規', prosessing: '対応中', onhold: '待ち', completed: '完了', discontinued: '中止' };
        if (data.newMeeting[0].status == 'new') {
          classType = 'alert-danger';
        }
        if (data.newMeeting[0].status == 'prosessing') {
          classType = 'alert-warning';
        }
        if (data.newMeeting[0].status == 'completed') {
          classType = 'alert-success';
          message = '<b>【完了】</b>';
          hide = true;
        }
        if (data.newMeeting[0].status == 'discontinued') {
          classType = 'alert-dark';
          message = '<b>【中止】</b>';
          hide = true;
        }
        const alert = document.createElement('div');
        alert.classList.add('alert', classType);
        alert.id = `meeting_${data.newMeeting[0].id}`;
        alert.role = 'alert';
        new_meeting_section.prepend(alert);
        const h3_title = document.createElement('h3');
        h3_title.innerText = '■' + message + data.newMeeting[0].title;
        alert.append(h3_title);
        const content = document.createElement('div');
        alert.append(content);
        const b_status = document.createElement('b');
        b_status.id = `meeting_status_${data.newMeeting[0].id}`;
        b_status.innerText = `Status: ${s_list[data.newMeeting[0].status]}`;
        content.append(b_status);
        const i_updated = document.createElement('i');
        i_updated.innerText = ` (Updated: ${sDate.getFullYear()}-${sDate.getMonth() + 1}-${sDate.getDate()})`;
        content.append(i_updated);
        const pre_content = document.createElement('pre');
        pre_content.id = `meeting_content_${data.newMeeting[0].id}`;
        pre_content.innerHTML = data.newMeeting[0].content;
        content.append(pre_content);
        const p_button = document.createElement('p');
        content.append(p_button);
        const button = document.createElement('button');
        button.classList.add('btn', 'btn-primary');
        button.type = 'button';
        button.dataset.toggle = 'collapse';
        button.dataset.target = `#edit_form${cnt}`;
        button.ariaExpanded = 'false';
        button.ariaControls = 'collapseExample';
        button.innerText = 'EDIT';
        p_button.append(button);
        const edit_form = document.createElement('div');
        edit_form.classList.add('collapse');
        edit_form.id = `edit_form${cnt}`;
        content.append(edit_form);
        const input_group_1 = document.createElement('div');
        input_group_1.classList.add('input-group');
        edit_form.append(input_group_1);
        const input_group_1_pre = document.createElement('div');
        input_group_1_pre.classList.add('input-group-prepend');
        input_group_1.append(input_group_1_pre);
        const input_group_1_text = document.createElement('div');
        input_group_1_text.classList.add('input-group-text');
        input_group_1_text.innerText = 'Status';
        input_group_1_pre.append(input_group_1_text);
        const input_group_1_sel = document.createElement('select');
        input_group_1_sel.classList.add('form-control');
        input_group_1_sel.id = `editstatus${data.newMeeting[0].id}`;
        input_group_1_sel.name = 'editstatus';
        input_group_1.append(input_group_1_sel);
        const input_group_1_opt1 = document.createElement('option');
        input_group_1_opt1.value = 'new';
        input_group_1_opt1.innerText = '新規';
        const input_group_1_opt2 = document.createElement('option');
        input_group_1_opt2.value = 'prosessing';
        input_group_1_opt2.innerText = '対応中';
        const input_group_1_opt3 = document.createElement('option');
        input_group_1_opt3.value = 'onhold';
        input_group_1_opt3.innerText = '待ち';
        const input_group_1_opt4 = document.createElement('option');
        input_group_1_opt4.value = 'completed';
        input_group_1_opt4.innerText = '完了';
        const input_group_1_opt5 = document.createElement('option');
        input_group_1_opt5.value = 'discontinued';
        input_group_1_opt5.innerText = '中止';
        input_group_1_sel.append(input_group_1_opt1, input_group_1_opt2, input_group_1_opt3, input_group_1_opt4, input_group_1_opt5);
        const input_group_2 = document.createElement('div');
        input_group_2.classList.add('input-group');
        edit_form.append(input_group_2);
        const input_group_2_pre = document.createElement('div');
        input_group_2_pre.classList.add('input-group-prepend');
        input_group_2.append(input_group_2_pre);
        const input_group_2_text = document.createElement('div');
        input_group_2_text.classList.add('input-group-text');
        input_group_2_text.innerText = 'Details';
        input_group_2_pre.append(input_group_2_text);
        const input_group_2_tarea = document.createElement('textarea');
        input_group_2_tarea.classList.add('form-control');
        input_group_2_tarea.id = `editdetails${data.newMeeting[0].id}`;
        input_group_2_tarea.name = 'editdetails';
        input_group_2_tarea.cols = '30';
        input_group_2_tarea.rows = '3';
        input_group_2_tarea.value = data.newMeeting[0].content;
        input_group_2.append(input_group_2_tarea);
        const button2 = document.createElement('button');
        button2.classList.add('btn', 'btn-warning', 'btn-lg', 'btn-block', 'update_meeting_button');
        button2.dataset.id = `${data.newMeeting[0].id}`;
        button2.innerText = 'Update';
        button2.addEventListener('click', (e) => {
          const name = document.getElementById('name').value;
          const id = e.target.dataset.id;
          const status = document.getElementById(`editstatus${id}`);
          const content = document.getElementById(`editdetails${id}`);
          socket.emit('meeting_update', { name, id, content: content.value, status: status.value });
        });
        edit_form.append(button2);
        const hr = document.createElement('hr');
        content.append(hr);
        // comment section
        const newcomment = document.createElement('div');
        newcomment.classList.add('comment');
        content.append(newcomment);
        const newcomment_text = document.createElement('textarea');
        newcomment_text.classList.add('form-control');
        newcomment_text.id = `newcomment${data.newMeeting[0].id}`;
        newcomment_text.name = 'mycomment';
        newcomment_text.cols = '30';
        newcomment_text.rows = '3';
        newcomment_text.style.width = '100%';
        newcomment.append(newcomment_text);
        const button3 = document.createElement('button');
        button3.classList.add('btn', 'btn-warning', 'btn-lg', 'btn-block', 'add_comment_button');
        button3.dataset.id = `${data.newMeeting[0].id}`;
        button3.innerText = 'Add comment';
        button3.addEventListener('click', (e) => {
          const name = document.getElementById('name').value;
          const id = e.target.dataset.id;
          const comment = document.getElementById(`newcomment${id}`);
          socket.emit('comment_add', { name, id, comment: comment.value });
        });
        newcomment.append(button3);
        const comment_section = document.createElement('div');
        comment_section.id = `comment_section_${data.newMeeting[0].id}`;
        content.append(comment_section);
        if (data.newMeeting[0].comments.length > 0) {
          const comment2 = document.createElement('div');
          comment2.classList.add('comment');
          comment_section.append(comment2);
          const h4_created_by = document.createElement('h4');
          h4_created_by.innerText = data.newMeeting[0].comments[0].created_by;
          comment2.append(h4_created_by);
          const comment_pre = document.createElement('pre');
          comment_pre.id = `comment_id_${data.newMeeting[0].comments[0].id}`;
          comment_pre.innerHTML = data.newMeeting[0].comments[0].content;
          comment2.append(comment_pre);
          if (data.newMeeting[0].comments[0].created_by == document.getElementById('name').value) {
            const editcomment_text = document.createElement('textarea');
            editcomment_text.classList.add('form-control');
            editcomment_text.id = `mycomment${data.newMeeting[0].comments[0].id}`;
            editcomment_text.name = 'mycomment';
            editcomment_text.cols = '30';
            editcomment_text.rows = '3';
            editcomment_text.style.width = '100%';
            editcomment_text.value = data.newMeeting[0].comments[0].content;
            comment2.append(editcomment_text);
            const button4 = document.createElement('button');
            button4.classList.add('btn', 'btn-warning', 'btn-lg', 'btn-block', 'update_comment_button');
            button4.dataset.id = `${data.newMeeting[0].comments[0].id}`;
            button4.innerText = 'Update comment';
            button4.addEventListener('click', (e) => {
              const id = e.target.dataset.id;
              const comment = document.getElementById(`mycomment${id}`);
              socket.emit('comment_update', { id, comment: comment.value });
            });
            comment2.append(button4);
          }
        }
      }
      if (data.updateMeeting.length > 0) {
        const class_type = {
          new: 'alert-danger',
          prosessing: 'alert-warning',
          completed: 'alert-success',
          discontinued: 'alert-dark',
          onhold: 'alert-primary',
        };
        const s_list = { new: '新規', prosessing: '対応中', onhold: '待ち', completed: '完了', discontinued: '中止' };
        const alert = document.getElementById(`meeting_${data.updateMeeting[0].id}`);
        alert.classList.remove('alert-danger', 'alert-warning', 'alert-success', 'alert-dark', 'alert-primary');
        alert.classList.add(class_type[data.updateMeeting[0].status]);
        const status = document.getElementById(`meeting_status_${data.updateMeeting[0].id}`);
        status.innerText = `Status: ${s_list[data.updateMeeting[0].status]}`;
        const content = document.getElementById(`meeting_content_${data.updateMeeting[0].id}`);
        content.innerHTML = data.updateMeeting[0].content;

        // move to top
        document.getElementById('new_meeting_section').prepend(alert);
      }
      if (data.newComment.length > 0) {
        const comment = document.createElement('div');
        comment.classList.add('comment');
        document.getElementById(`comment_section_${data.newComment[0].meeting_id}`).prepend(comment);
        const h4_created_by = document.createElement('h4');
        h4_created_by.innerText = data.newComment[0].created_by;
        comment.append(h4_created_by);
        const comment_pre = document.createElement('pre');
        comment_pre.id = `comment_id_${data.newComment[0].id}`;
        comment_pre.innerHTML = data.newComment[0].content;
        comment.append(comment_pre);
        if (data.newComment[0].created_by == document.getElementById('name').value) {
          const editcomment_text = document.createElement('textarea');
          editcomment_text.classList.add('form-control');
          editcomment_text.id = `mycomment${data.newComment[0].id}`;
          editcomment_text.name = 'mycomment';
          editcomment_text.cols = '30';
          editcomment_text.rows = '3';
          editcomment_text.style.width = '100%';
          editcomment_text.value = data.newComment[0].content;
          comment.append(editcomment_text);
          const button4 = document.createElement('button');
          button4.classList.add('btn', 'btn-warning', 'btn-lg', 'btn-block', 'update_comment_button');
          button4.dataset.id = `${data.newComment[0].id}`;
          button4.innerText = 'Update comment';
          button4.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            const comment = document.getElementById(`mycomment${id}`);
            socket.emit('comment_update', { id, comment: comment.value });
          });
          comment.append(button4);
        }

        document.getElementById('new_meeting_section').prepend(document.getElementById(`meeting_${data.newComment[0].meeting_id}`));
      }
      if (data.updateComment.length > 0) {
        document.getElementById(`comment_id_${data.updateComment[0].id}`).innerHTML = data.updateComment[0].content;

        document.getElementById('new_meeting_section').prepend(document.getElementById(`meeting_${data.updateComment[0].meeting_id}`));
      }
    } else {
      // Alert
    }
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
