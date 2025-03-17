const order_numbers = JSON.parse(document.getElementById("order_numbers") ? document.getElementById("order_numbers").innerHTML : "[]");
const case_numbers = JSON.parse(document.getElementById("case_numbers") ? document.getElementById("case_numbers").innerHTML : "[]");
const open_button = document.getElementById("open_button");
const create_button = document.getElementById("create_button");
function CheckExisting(e) {
  const index = order_numbers.indexOf(parseInt(e.value));
  if (index >= 0) {
    open_button.dataset.link = `/ct/case/${case_numbers[index]}`;
    open_button.disabled = false;
    create_button.disabled = true;
  } else {
    open_button.disabled = true;
    create_button.disabled =  false;
  }
}
function OpenCase(e) {
  open(e.dataset.link, "_self");
}

const iteminput = document.getElementById("iteminput");
let count = 0;
function AddItemRow(item_code = "") {
  count++;
  const inputgroup = document.createElement("div");
  inputgroup.classList.add("input-group");
  const itemcode = document.createElement("input");
  itemcode.id = `item${count}_code`;
  itemcode.classList.add("form-control");
  itemcode.type = `text`;
  itemcode.name = `item${count}_code`;
  itemcode.placeholder = `Item Code`;
  itemcode.value = item_code;
  const itemissue = document.createElement("input");
  itemissue.id = `item${count}_issue`;
  itemissue.classList.add("form-control");
  itemissue.type = `text`;
  itemissue.name = `item${count}_issue`;
  itemissue.placeholder = `Problem with item (non-problem items will be ignored)`;
  const itemcost = document.createElement("input");
  itemcost.id = `item${count}_cost`;
  itemcost.classList.add("form-control");
  itemcost.type = `text`;
  itemcost.name = `item${count}_cost`;
  itemcost.placeholder = `Item value`;
  const itemimage = document.createElement("input");
  itemimage.id = `item${count}_image`;
  itemimage.classList.add("form-control");
  itemimage.type = `file`;
  itemimage.name = `item${count}_image`;
  inputgroup.append(itemcode, itemissue, itemcost, itemimage);
  iteminput.append(inputgroup);
}

function AddItemRows(e) {
  if (count > 0) return;

  const contents = e.value.split("\n");
  for (let i = 0; i < contents.length; i += 2) {
    const code = contents[i]
    let itemcount = 0;
    if (i+1 < contents.length) itemcount = parseInt(contents[i+1]);
    for (; itemcount > 0; itemcount--) {
      AddItemRow(code);
    }
  }
}

function SetRecordForm(e) {
  document.getElementById("record_order").value = e.dataset.order;
  document.getElementById("record_tracking").value = e.dataset.tracking;
  document.getElementById("record_type").value = e.dataset.type;
  document.getElementById("record_item").value = e.dataset.item_cost;
  document.getElementById("record_shipping").value = e.dataset.shipping_cost;
  document.getElementById("record_gst").value = e.dataset.gst_cost;
  document.getElementById("record_status").value = e.dataset.status;
}

function SetItemForm(e) {
  document.getElementById("item_item_id").value = e.dataset.id;
  document.getElementById("item_item_code").value = e.dataset.item_code;
  document.getElementById("item_defect").value = e.dataset.defect;
  document.getElementById("item_item_cost").value = e.dataset.item_cost;
}

function SetRefundForm(e) {
  document.getElementById("refund_id").value = e.dataset.id;
  document.getElementById("refund_order").value = e.dataset.order;
  document.getElementById("refund_type").value = e.dataset.type;
  document.getElementById("refund_amount").value = e.dataset.amount;
  document.getElementById("refund_currency").value = e.dataset.currency;
  document.getElementById("refund_amount_jpy").value = e.dataset.jpy_amount;
  document.getElementById("refund_details").value = e.dataset.refund_details;
}

function SetDeadline(num, unit) {
  const d = new Date();
  const new_deadline = new Date(d.getFullYear(), d.getMonth() + (unit === "month" ? num : 0), d.getDate() + (unit === "week" ? 7 * num : 0), d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
  document.getElementById("new_deadline").value = `${new_deadline.getFullYear()}-${new_deadline.getMonth() > 8 ? (new_deadline.getMonth() + 1) : "0" + (new_deadline.getMonth() + 1)}-${new_deadline.getDate() > 9 ? new_deadline.getDate() : "0" + new_deadline.getDate()}`;
  document.getElementById("deadline_form").submit();
}

const processing_stats = document.getElementById("processing_stats");
if (processing_stats) {
  const cases = JSON.parse(document.getElementById("cases_details").innerHTML);

  // Count ongoing cases
  const count_col = document.createElement("div");
  count_col.classList.add("col");
  const case_count = {};
  for (const c of cases) {
    case_count[c.type] = (case_count[c.type] || 0) + 1;
  }
  const ul_1 = document.createElement("ul");
  const keys_1 = Object.keys(case_count);
  for (const key of keys_1) {
    const li = document.createElement("li");
    li.innerText = `${key}: ${case_count[key]} cases`;
    ul_1.append(li);
  }
  count_col.append(ul_1);

  // Count todays deadlines by staff member
  const deadline_col = document.createElement("div");
  deadline_col.classList.add("col");
  const d = new Date();
  const deadlines = {};
  for (const c of cases) {
    if (c.deadline && new Date(c.deadline) < d) {
      deadlines[c.staff_in_charge] = (deadlines[c.staff_in_charge] || 0) + 1;
    }
  }
  const ul_2 = document.createElement("ul");
  const keys_2 = Object.keys(deadlines);
  for (const key of keys_2) {
    const li = document.createElement("li");
    li.innerText = `${key}: ${deadlines[key]} deadlines`;
    ul_2.append(li);
  }
  deadline_col.append(ul_2);

  processing_stats.append(count_col, deadline_col);
}
