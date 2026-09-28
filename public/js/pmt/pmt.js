function CopyThis(e, key) {
  return CopyMarkdown(e, e.dataset[key]);
}

async function CopyMarkdown(button, markdown) {
  button.disabled = true;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(markdown);
    } else {
      // Support HTTP deployments, keeping focus inside the preview modal.
      const textarea = document.createElement('textarea');
      textarea.value = markdown;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      button.parentNode.appendChild(textarea);
      try {
        textarea.select();
        if (!document.execCommand('copy')) throw new Error('Copy failed');
      } finally {
        textarea.remove();
      }
    }
    button.textContent = 'Copied!';
  } catch (error) {
    button.textContent = 'Copy failed — retry';
  } finally {
    button.disabled = false;
    button.focus();
  }
}
