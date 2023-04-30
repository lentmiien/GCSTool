const { Configuration, OpenAIApi } = require('openai');

// Set your OpenAI API key
const configuration = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
const openai = new OpenAIApi(configuration);

const chatGPT = async (messages) => {
  try {
    const response = await openai.createChatCompletion({
      messages,
      model: 'gpt-3.5-turbo',
    });
    return response.data;
  } catch (error) {
    console.error(`Error while calling ChatGPT API: ${error}`);
    return null;
  }
};

module.exports = chatGPT;
