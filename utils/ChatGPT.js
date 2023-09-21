const { Configuration, OpenAIApi } = require('openai');

// Set your OpenAI API key
const configuration = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
const openai = new OpenAIApi(configuration);

// gpt-3.5-turbo or gpt-3.5-turbo-16k
const chatGPT = async (messages, model) => {
  try {
    const response = await openai.createChatCompletion({
      messages,
      model,
    });
    return response.data;
  } catch (error) {
    console.error(`Error while calling ChatGPT API: ${error}`);
    return null;
  }
};

// text-embedding-ada-002
const embedding = async (text, model) => {
  try {
    const response = await openai.createEmbedding({
      input: text,
      model,
    });
    return response.data;
  } catch (error) {
    console.error(`Error while calling Embedding API: ${error}`);
    return null;
  }
};

module.exports = {
  chatGPT,
  embedding,
};
