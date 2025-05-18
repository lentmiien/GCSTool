const allPolicies = JSON.parse(document.getElementById("policies_data").innerHTML);

const editor = new toastui.Editor({
  el: document.querySelector('#editor'),
  height: '500px',
  initialEditType: 'wysiwyg',
  theme: 'dark',
});

document.getElementById("form").addEventListener('submit', function(event) {
  document.getElementById('content_md').value = editor.getMarkdown();
});

editor.setMarkdown(document.getElementById('content_md').value);

function SelectVersion(e) {
  editor.setMarkdown(e.value);
}

function showPreview(){
  const sel   = Array.from(document.getElementById('policies').selectedOptions).map(o=>+o.value);
  const htmls = sel.map(id=>{
    const p = allPolicies.find(x=>x.id===id);
    return `<h5>${p.title}</h5><hr>${marked.parse(p.content_md)}`;
  });
  document.getElementById('policyPreview').innerHTML = htmls.join('<hr>');
}
showPreview();
