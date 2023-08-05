const name_to_hs = JSON.parse(document.getElementById('name_to_hs').innerHTML);

function AddItemRow() {
  const items = document.getElementsByClassName("item");
  const new_index = items.length;

  const item_str = `item${new_index}`;

  // Create HTML elements
  const item = document.createElement('div');
  item.id = item_str;
  item.classList.add("item");
  const row1 = document.createElement('div');
  row1.classList.add("row");
  const row2 = document.createElement('div');
  row2.classList.add("row");
  const col1_1 = document.createElement('div');
  col1_1.classList.add("col-6");
  const col1_2 = document.createElement('div');
  col1_2.classList.add("col-2");
  const col1_3 = document.createElement('div');
  col1_3.classList.add("col-2");
  const col1_4 = document.createElement('div');
  col1_4.classList.add("col-2");
  const col2_1 = document.createElement('div');
  col2_1.classList.add("col");
  const i_group_1 = document.createElement('div');
  i_group_1.classList.add("input-group");
  const i_group_2 = document.createElement('div');
  i_group_2.classList.add("input-group");
  const i_group_3 = document.createElement('div');
  i_group_3.classList.add("input-group");
  const i_group_4 = document.createElement('div');
  i_group_4.classList.add("input-group");
  const i_group_5 = document.createElement('div');
  i_group_5.classList.add("input-group");
  const i_group_text_1 = document.createElement('div');
  i_group_text_1.innerText = "Item";
  i_group_text_1.classList.add("input-group-text");
  const i_group_text_2 = document.createElement('div');
  i_group_text_2.innerText = "HS code";
  i_group_text_2.classList.add("input-group-text");
  const i_group_text_3 = document.createElement('div');
  i_group_text_3.innerText = "Quantity";
  i_group_text_3.classList.add("input-group-text");
  const i_group_text_4 = document.createElement('div');
  i_group_text_4.innerText = "Unit cost";
  i_group_text_4.classList.add("input-group-text");
  const i_group_text_5 = document.createElement('div');
  i_group_text_5.innerText = "Remarks";
  i_group_text_5.classList.add("input-group-text");
  const input_1 = document.createElement('input');
  input_1.id = `${item_str}_invoice`;
  input_1.classList.add("form-control");
  input_1.type = "text";
  input_1.name = `${item_str}_invoice`;
  input_1.setAttribute('list', 'name_list');
  input_1.addEventListener('change', ChangeName);
  const input_2 = document.createElement('input');
  input_2.id = `${item_str}_hs`;
  input_2.classList.add("form-control");
  input_2.type = "text";
  input_2.name = `${item_str}_hs`;
  input_2.setAttribute('list', 'hs_list');
  const input_3 = document.createElement('input');
  input_3.id = `${item_str}_q`;
  input_3.classList.add("form-control");
  input_3.type = "text";
  input_3.name = `${item_str}_q`;
  const input_4 = document.createElement('input');
  input_4.id = `${item_str}_rate`;
  input_4.classList.add("form-control");
  input_4.type = "text";
  input_4.name = `${item_str}_rate`;
  const input_5 = document.createElement('input');
  input_5.id = `${item_str}_remarks`;
  input_5.classList.add("form-control");
  input_5.type = "text";
  input_5.name = `${item_str}_remarks`;

  // Put together HTML structure
  item.append(row1, row2);
  row1.append(col1_1, col1_2, col1_3, col1_4);
  row2.append(col2_1);
  col1_1.append(i_group_1);
  col1_2.append(i_group_2);
  col1_3.append(i_group_3);
  col1_4.append(i_group_4);
  col2_1.append(i_group_5);
  i_group_1.append(i_group_text_1, input_1);
  i_group_2.append(i_group_text_2, input_2);
  i_group_3.append(i_group_text_3, input_3);
  i_group_4.append(i_group_text_4, input_4);
  i_group_5.append(i_group_text_5, input_5);

  // Append to item list
  document.getElementById("items").append(item);
}

AddItemRow();

function ChangeName(e) {
  if (e.target.value in name_to_hs) {
    const num = e.target.id.split('_')[0];
    document.getElementById(`${num}_hs`).value = name_to_hs[e.target.value];
  }
}
