const editor = new toastui.Editor({
  el: document.querySelector('#editor'),
  height: '500px',
  initialEditType: 'wysiwyg',
  previewStyle: 'vertical'
});

document.getElementById("form").addEventListener('submit', function(event) {
  document.getElementById('content_md').value = editor.getMarkdown();
});

editor.setMarkdown(document.getElementById('content_md').value);

function SelectVersion(e) {
  editor.setMarkdown(e.value);
}
