async function sendTextToChatGPT(text) {
  try {
    const url = '/chatgpt/generate';
    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: text }),
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

  const instructions = document.getElementById(label).value;
  if (instructions.length > 0) {
    // connect to AI, and replace response in text box
    const response_data = await sendTextToChatGPT(instructions);
    document.getElementById(label).value = response_data.text;
  }

  e.target.disabled = false;
}
