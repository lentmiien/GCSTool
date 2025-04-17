function CopyThis(e, key) {
  copy(e.dataset[key]);
  e.innerText = "Copied!"
}

function copy(text) {
  navigator.clipboard.writeText(text);
}