function UpdateVersion(e) {
  document.getElementById('content').innerHTML = e.value;
  const copyButton = document.getElementById('copy-markdown');
  if (copyButton) copyButton.textContent = 'Copy';
}

function CopySelectedVersion(button) {
  const version = document.getElementById('version');
  return CopyMarkdown(button, version.options[version.selectedIndex].dataset.md);
}
