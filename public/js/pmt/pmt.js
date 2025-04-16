function CopyThis(e, key) {
  copy(e.dataset[key]);
}

function copy(text) {
  navigator.clipboard.writeText(text);
}