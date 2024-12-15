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
    // connect to AI, and replace response in text box
    const response_data = await sendTextToChatGPT(instructions, title);
    if (category == 'manual') {
      document.getElementById(label).value = marked.parse(response_data.text);
    } else {
      document.getElementById(label).value = response_data.text;
    }
  }

  e.target.disabled = false;
}
