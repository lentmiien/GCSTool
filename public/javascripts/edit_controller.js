async function sendTextToChatGPT(text, title) {
  try {
    const url = '/chatgpt/generate';
    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: text, title: title }),
    };

    const response = await fetch(url, requestOptions);

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const jsonResponse = await response.json();
    return jsonResponse;
  } catch (error) {
    console.error('Error during fetch:', error);
  }
}

async function AI(e) {
  e.preventDefault();
  const label = e.target.dataset.label;
  e.target.disabled = true;

  let instructions = document.getElementById(label).value;
  const title = document.getElementById('title').value;
  const category = document.getElementById('category').value;
  if (instructions.length > 0) {
    // For manuals, replace <br> with \n and <pre>/</pre> with ```
    if (category == 'manual') {
      instructions = instructions.split('<br>').join('\n');
      instructions = instructions.split('<pre>').join('```');
      instructions = instructions.split('</pre>').join('```');
    }
    // connect to AI, and replace response in text box
    const response_data = await sendTextToChatGPT(instructions, title);
    if (category == 'manual') {
      // Split on ``` for code, and replace \n with <br>
      let pp_content = '';
      const parts = response_data.text.split('```');
      for (let i = 0; i < parts.length; i++) {
        if (i % 2 == 0) {
          pp_content += parts[i].split('\n').join('<br>');
        } else {
          pp_content += `<pre>${parts[i]}</pre>`;
        }
      }
      document.getElementById(label).value = pp_content;
    } else {
      document.getElementById(label).value = response_data.text;
    }
  }

  e.target.disabled = false;
}
