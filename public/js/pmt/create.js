const allPolicies = JSON.parse(document.getElementById("policies_data").innerHTML);

const editor = new toastui.Editor({
  el: document.querySelector('#editor'),
  height: '500px',
  initialEditType: 'wysiwyg',
  theme: document.documentElement.getAttribute('data-color-mode') === 'dark' ? 'dark' : '',
  usageStatistics: false,
});

document.getElementById("form").addEventListener('submit', function(event) {
  document.getElementById('content_md').value = editor.getMarkdown();
});

function showPreview(){
  const sel   = Array.from(document.getElementById('policies').selectedOptions).map(o=>+o.value);
  const htmls = sel.map(id=>{
    const p = allPolicies.find(x=>x.id===id);
    return GCSPmtPreview.render(p.title, p.content_md);
  });
  document.getElementById('policyPreview').innerHTML = htmls.join('<hr>');
}
showPreview();
