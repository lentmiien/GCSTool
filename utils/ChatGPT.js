const { OpenAI } = require('openai');

// Set your OpenAI API key
const openai = [new OpenAI({ apiKey: process.env.OPENAI_API_KEY }), new OpenAI({ apiKey: process.env.OPENAI_API_KEY2 })];

const chatGPT = async (messages, model, api = 0) => {
  try {
    const response = await openai[api].chat.completions.create({
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
    const response = await openai[api].embeddings.create({
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
