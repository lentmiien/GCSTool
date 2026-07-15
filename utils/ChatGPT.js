const { OpenAI } = require('openai');
const FormData = require('form-data');
const nodeFetch = require('node-fetch');

if (typeof globalThis.Headers === 'undefined') {
  globalThis.Headers = nodeFetch.Headers;
  globalThis.Request = nodeFetch.Request;
  globalThis.Response = nodeFetch.Response;
}
if (typeof globalThis.FormData === 'undefined') {
  globalThis.FormData = FormData;
}

const fetch = globalThis.fetch || nodeFetch;

// Set your OpenAI API key
const openai = [process.env.OPENAI_API_KEY, process.env.OPENAI_API_KEY2 || process.env.OPENAI_API_KEY]
  .map((apiKey) => apiKey ? new OpenAI({ apiKey, fetch }) : null);

function getOpenAIClient(api) {
  const client = openai[api];
  if (!client) {
    throw new Error(`OpenAI API key ${api + 1} is not configured.`);
  }
  return client;
}

const chatGPT = async (messages, model, api = 0, requestOptions = {}) => {
  try {
    const response = await getOpenAIClient(api).chat.completions.create({
      ...requestOptions,
      messages,
      model,
    });
    return response;
  } catch (error) {
    console.error(`Error while calling ChatGPT API: ${error}`);
    return null;
  }
};

// text-embedding-ada-002
const embedding = async (text, model, api = 0) => {
  try {
    const response = await getOpenAIClient(api).embeddings.create({
      input: text,
      model,
    });
    return response;
  } catch (error) {
    console.error(`Error while calling Embedding API: ${error}`);
    return null;
  }
};

module.exports = {
  chatGPT,
  embedding,
};
