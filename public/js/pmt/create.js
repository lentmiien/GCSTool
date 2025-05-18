const editor = new toastui.Editor({
  el: document.querySelector('#editor'),
  height: '500px',
  initialEditType: 'wysiwyg',
  theme: 'dark',
});

document.getElementById("form").addEventListener('submit', function(event) {
  document.getElementById('content_md').value = editor.getMarkdown();
});
