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
    // socket.emit('server_response', { newMeeting: [...], updateMeeting: [...], newComment: [...], updateComment: [...] });
    const new_meeting_section = document.getElementById("new_meeting_section");
    if (new_meeting_section) {
      // Update as necessary
      if (data.newMeeting.length > 0) {
        const cnt = Date.now();
        const sDate = data.newMeeting[0].updatedAt;
        let classType = "alert-primary";
        let message = "";
        let hide = false;
        const s_list = {"new": "新規", "prosessing": "対応中", "onhold": "待ち", "completed": "完了", "discontinued": "中止"};
        if (data.newMeeting[0].status == "new") {
          classType = "alert-danger";
        }
        if (data.newMeeting[0].status == "prosessing") {
          classType = "alert-warning";
        }
        if (data.newMeeting[0].status == "completed") {
          classType = "alert-success";
          message = "<b>【完了】</b>";
          hide = true;
        }
        if (data.newMeeting[0].status == "discontinued") {
          classType = "alert-dark";
          message = "<b>【中止】</b>";
          hide = true;
        }
        const alert = document.createElement("div");
        alert.classList.add("alert", classType);
        alert.id = `meeting_${data.newMeeting[0].id}`;
        alert.role = "alert";
        new_meeting_section.prepend(alert);
        const h3_title = document.createElement("h3");
        h3_title.innerText = "■" + message + data.newMeeting[0].title;
        alert.append(h3_title);
        const content = document.createElement("div");
        alert.append(content);
        const b_status = document.createElement("b");
        b_status.id = `meeting_status_${data.newMeeting[0].id}`;
        b_status.innerText = `Status: ${s_list[data.newMeeting[0].status]}`;
        content.append(b_status);
        const i_updated = document.createElement("i");
        i_updated.innerText = ` (Updated: ${sDate.getFullYear()}-${sDate.getMonth()+1}-${sDate.getDate()})`;
        content.append(i_updated);
        const pre_content = data.newMeeting[0].content;
        pre_content.id = `meeting_content_${data.newMeeting[0].id}`;
        content.append(pre_content);
        const p_button = document.createElement("p");
        content.append(p_button);
        const button = document.createElement("button");
        button.classList.add("btn", "btn-primary");
        button.type = "button";
        button.dataset.toggle = "collapse";
        button.dataset.target = `#edit_form${cnt}`;
        button.ariaExpanded = "false";
        button.ariaControls = "collapseExample";
        button.innerText = "EDIT";
        p_button.append(button);
        const edit_form = document.createElement("div");
        edit_form.classList.add("collapse");
        edit_form.id = `edit_form${cnt}`;
        content.append(edit_form);
        const input_group_1 = document.createElement("div");
        input_group_1.classList.add("input-group");
        edit_form.append(input_group_1);
        const input_group_1_pre = document.createElement("div");
        input_group_1_pre.classList.add("input-group-prepend");
        input_group_1.append(input_group_1_pre);
        const input_group_1_text = document.createElement("div");
        input_group_1_text.classList.add("input-group-text");
        input_group_1_text.innerText = "Status";
        input_group_1_pre.append(input_group_1_text);
        const input_group_1_sel = document.createElement("select");
        input_group_1_sel.classList.add("form-control");
        input_group_1_sel.id = `editstatus${data.newMeeting[0].id}`;
        input_group_1_sel.name = "editstatus";
        input_group_1.append(input_group_1_sel)
        const input_group_1_opt1 = document.createElement("option");
        input_group_1_opt1.value = "new";
        input_group_1_opt1.innerText = "新規";
        const input_group_1_opt2 = document.createElement("option");
        input_group_1_opt2.value = "prosessing";
        input_group_1_opt2.innerText = "対応中";
        const input_group_1_opt3 = document.createElement("option");
        input_group_1_opt3.value = "onhold";
        input_group_1_opt3.innerText = "待ち";
        const input_group_1_opt4 = document.createElement("option");
        input_group_1_opt4.value = "completed";
        input_group_1_opt4.innerText = "完了";
        const input_group_1_opt5 = document.createElement("option");
        input_group_1_opt5.value = "discontinued";
        input_group_1_opt5.innerText = "中止";
        input_group_1_sel.append(input_group_1_opt1, input_group_1_opt2, input_group_1_opt3, input_group_1_opt4, input_group_1_opt5);
        const input_group_2 = document.createElement("div");
        input_group_2.classList.add("input-group");
        edit_form.append(input_group_2);
        const input_group_2_pre = document.createElement("div");
        input_group_2_pre.classList.add("input-group-prepend");
        input_group_2.append(input_group_2_pre);
        const input_group_2_text = document.createElement("div");
        input_group_2_text.classList.add("input-group-text");
        input_group_2_text.innerText = "Details";
        input_group_2_pre.append(input_group_2_text);
        const input_group_2_tarea = document.createElement("textarea");
        input_group_2_tarea.classList.add("form-control");
        input_group_2_tarea.id = `editdetails${data.newMeeting[0].id}`;
        input_group_2_tarea.name = "editdetails";
        input_group_2_tarea.cols = "30";
        input_group_2_tarea.rows = "3";
        input_group_2_tarea.value = data.newMeeting[0].content;
        input_group_2.append(input_group_2_tarea);
        // button
        // hr
        // comment section
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
