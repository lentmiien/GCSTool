const allPolicies = JSON.parse(document.getElementById('policies_data').textContent);

const entryType = document.getElementById('type');
const editorMode = () => entryType.value === 'Template' ? 'markdown' : 'wysiwyg';

const editor = new toastui.Editor({
  el: document.querySelector('#editor'),
  height: '500px',
  initialEditType: editorMode(),
  hideModeSwitch: true,
  previewStyle: 'tab',
  theme: document.documentElement.getAttribute('data-color-mode') === 'dark' ? 'dark' : '',
  usageStatistics: false,
});

const initialContent = document.getElementById('content_md');
if (initialContent.dataset.format === 'html') {
  editor.setHTML(initialContent.value);
} else {
  editor.setMarkdown(initialContent.value);
}

entryType.addEventListener('change', () => editor.changeMode(editorMode(), true));

const version = document.getElementById('version');
if (version) {
  version.addEventListener('change', () => editor.setMarkdown(version.value));
}

document.getElementById('form').addEventListener('submit', () => {
  initialContent.value = editor.getMarkdown();
});

function showPreview() {
  const policies = document.getElementById('policies').selectedOptions;
  const previews = Array.from(policies, option => {
    const policy = allPolicies.find(item => item.id === Number(option.value));
    return GCSPmtPreview.render(policy.title, policy.content_md);
  });
  document.getElementById('policyPreview').innerHTML = previews.join('<hr>');
}
showPreview();
